import { existsSync } from 'node:fs';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { Server } from 'socket.io';
import { ZodError } from 'zod';
import { AccountService } from './accounts';
import { OAuthService, type OAuthDeps } from './auth/oauth';
import { AuthService } from './auth/service';
import type { Config } from './config';
import { createDb, type Db } from './db';
import { bearerToken } from './http';
import { AppError, isAppError } from './lib/errors';
import { MediaStore } from './media/store';
import { fetchYouTubeTitle } from './media/youtube';
import { ModerationService } from './moderation/service';
import { createNotifier, type Logger, type Notifier } from './notify';
import { RoomHub, type IO } from './rooms/hub';
import { RoomRepo } from './rooms/repo';
import { authRoutes } from './routes/auth';
import { meRoutes } from './routes/me';
import { moderationRoutes } from './routes/moderation';
import { roomRoutes } from './routes/rooms';
import type { Services } from './services';
import { VoiceService } from './voice/livekit';

export interface BuildOptions {
  db?: Db;
  notifier?: Notifier;
  oauth?: OAuthDeps;
  fetchTitle?: (videoId: string) => Promise<string | null>;
  logger?: boolean;
}

export interface BuiltApp {
  app: FastifyInstance;
  io: IO;
  services: Services;
  close(): Promise<void>;
}

export async function buildApp(config: Config, options: BuildOptions = {}): Promise<BuiltApp> {
  const app = Fastify({
    logger:
      options.logger === false
        ? false
        : {
            level: config.logLevel,
            redact: ['req.headers.authorization', 'req.query.sig', 'req.query.code'],
            transport: config.isProduction ? undefined : { target: 'pino-pretty', options: { singleLine: true } },
          },
    trustProxy: config.trustProxy,
    bodyLimit: 1024 * 1024,
  });
  const log: Logger = app.log;

  const db = options.db ?? (await createDb({ databaseUrl: config.databaseUrl, dataDir: config.dataDir }));
  const notifier = options.notifier ?? createNotifier(config, log);
  const auth = new AuthService(db, config, notifier);
  const oauth = new OAuthService(config, auth, log, options.oauth);
  const rooms = new RoomRepo(db);
  const media = new MediaStore(config, db);
  const voice = new VoiceService(config, log);
  const moderation = new ModerationService(db);

  const io: IO = new Server(app.server, {
    cors: { origin: config.corsOrigins },
    maxHttpBufferSize: 64 * 1024,
    pingInterval: 20_000,
  });
  const hub = new RoomHub(io, rooms, media, voice, log, options.fetchTitle ?? ((id) => fetchYouTubeTitle(id)));
  const accounts = new AccountService(db, auth, oauth, rooms, hub, media, moderation);
  const services: Services = { config, db, log, notifier, auth, oauth, rooms, hub, media, voice, moderation, accounts };

  io.use(async (socket, next) => {
    try {
      const token = (socket.handshake.auth as { token?: string } | undefined)?.token;
      const user = await auth.authenticate(token);
      if (!user) return next(new Error('unauthorized'));
      if (!user.terms_accepted_at) return next(new Error('terms_required'));
      socket.data.user = { id: user.id, displayName: user.display_name };
      socket.data.token = token!;
      next();
    } catch (err) {
      log.error({ err }, 'socket auth failed');
      next(new Error('server_error'));
    }
  });
  hub.attach();

  await app.register(cors, {
    origin: (origin, cb) => cb(null, !origin || config.corsOrigins.includes(origin) || config.corsOrigins.includes('*')),
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // YouTube ендірілген ойнатқышы сайттың мекенжайын (Referer) талап етеді.
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });
  await app.register(formbody);
  await app.register(multipart, { limits: { fileSize: config.maxUploadBytes, files: 1, fields: 5 } });
  // Кірген қолданушыны ID бойынша, қалғандарын IP бойынша шектейміз (бір Wi-Fi-дағы адамдар бір-біріне кедергі болмасын).
  await app.register(rateLimit, { global: false, keyGenerator: (request) => request.user?.id ?? request.ip });

  app.decorateRequest('user', null);
  app.decorateRequest('token', null);
  app.addHook('onRequest', async (request) => {
    if (!request.url.startsWith('/api/')) return;
    const token = bearerToken(request);
    if (token) {
      request.token = token;
      request.user = await auth.authenticate(token);
    }
  });

  app.setErrorHandler((error, request, reply) => {
    if (isAppError(error)) return reply.code(error.status).send({ error: error.code });
    if (error instanceof ZodError) return reply.code(400).send({ error: 'invalid_input' });
    const err = error as { statusCode?: number; code?: string };
    if (err.statusCode === 429) return reply.code(429).send({ error: 'rate_limited' });
    if (err.code === 'FST_REQ_FILE_TOO_LARGE') return reply.code(413).send({ error: 'upload_too_large' });
    if (err.statusCode && err.statusCode < 500) return reply.code(err.statusCode).send({ error: 'invalid_input' });
    request.log.error({ err: error }, 'request failed');
    return reply.code(500).send({ error: 'server_error' });
  });

  authRoutes(app, services);
  meRoutes(app, services);
  roomRoutes(app, services);
  moderationRoutes(app, services);

  // Веб-нұсқаның дайын файлдарын (expo export) осы сервер таратады.
  const webDist = config.webDist;
  if (webDist && existsSync(path.join(webDist, 'index.html'))) {
    await app.register(fastifyStatic, {
      root: webDist,
      wildcard: true,
      setHeaders(reply, filePath) {
        const immutable = filePath.includes(`${path.sep}_expo${path.sep}`) || filePath.includes(`${path.sep}assets${path.sep}`);
        reply.header('Cache-Control', immutable ? 'public, max-age=31536000, immutable' : 'no-cache');
      },
    });
    app.setNotFoundHandler((request, reply) => {
      if (request.method === 'GET' && !request.url.startsWith('/api/') && !request.url.startsWith('/socket.io')) {
        return reply.header('Cache-Control', 'no-cache').sendFile('index.html');
      }
      return reply.code(404).send({ error: 'not_found' });
    });
  } else {
    app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: 'not_found' }));
  }

  const cleanup = setInterval(() => void auth.cleanupExpired().catch((err) => log.error({ err }, 'cleanup failed')), 60 * 60 * 1000);
  cleanup.unref();

  return {
    app,
    io,
    services,
    async close() {
      clearInterval(cleanup);
      io.close();
      await app.close();
      await db.close();
    },
  };
}

export { AppError };
