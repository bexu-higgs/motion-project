import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { io as connectSocket, type Socket } from 'socket.io-client';
import type { AuthResult, ClientToServerEvents, ServerToClientEvents } from '@birge/shared';
import { buildApp, type BuildOptions } from '../src/app';
import { loadConfig, type Config } from '../src/config';

export type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface TestServer {
  url: string;
  config: Config;
  built: Awaited<ReturnType<typeof buildApp>>;
  api<T = unknown>(
    method: string,
    route: string,
    opts?: { token?: string; body?: unknown; ip?: string },
  ): Promise<{ status: number; body: T }>;
  signUp(email: string, name: string): Promise<{ token: string; userId: string }>;
  connect(token: string): Promise<ClientSocket>;
  close(): Promise<void>;
}

export async function startServer(env: Record<string, string> = {}, options: BuildOptions = {}): Promise<TestServer> {
  const dir = mkdtempSync(path.join(tmpdir(), 'birge-test-'));
  const config = loadConfig({
    NODE_ENV: 'test',
    DATA_DIR: dir,
    DATABASE_URL: 'memory',
    SECRET: 'test-secret-that-is-long-enough-123456',
    DEV_OTP: '1',
    TRUST_PROXY: '1',
    ...env,
  });
  const built = await buildApp(config, { logger: false, fetchTitle: async () => 'Test video', ...options });
  await built.app.listen({ host: '127.0.0.1', port: 0 });
  const url = `http://127.0.0.1:${(built.app.server.address() as AddressInfo).port}`;
  config.publicUrl = url;
  const sockets: ClientSocket[] = [];

  const api: TestServer['api'] = async (method, route, opts = {}) => {
    const res = await fetch(`${url}${route}`, {
      method,
      headers: {
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
        'X-Forwarded-For': opts.ip ?? '127.0.0.1',
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      redirect: 'manual',
    });
    const text = await res.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      // HTML немесе бос жауап
    }
    return { status: res.status, body: body as never };
  };

  let ip = 0;
  return {
    url,
    config,
    built,
    api,
    async signUp(email, name) {
      // Әр тіркелу басқа «адрестен» келгендей болсын (IP шектеуі тесттерге кедергі келтірмесін).
      ip++;
      const from = `10.${(ip >> 8) & 255}.${ip & 255}.1`;
      const req = await api<{ devCode: string }>('POST', '/api/auth/otp/request', { body: { channel: 'email', target: email }, ip: from });
      if (req.status !== 200) throw new Error(`otp request failed: ${req.status} ${JSON.stringify(req.body)}`);
      const ver = await api<AuthResult>('POST', '/api/auth/otp/verify', {
        body: { channel: 'email', target: email, code: req.body.devCode },
        ip: from,
      });
      if (ver.status !== 200) throw new Error(`otp verify failed: ${ver.status}`);
      const patch = await api('PATCH', '/api/me', { token: ver.body.token, body: { displayName: name, acceptTerms: true } });
      if (patch.status !== 200) throw new Error(`profile update failed: ${patch.status} ${JSON.stringify(patch.body)}`);
      return { token: ver.body.token, userId: ver.body.user.id };
    },
    connect(token) {
      return new Promise((resolve, reject) => {
        const socket: ClientSocket = connectSocket(url, { auth: { token }, transports: ['websocket'], forceNew: true });
        sockets.push(socket);
        socket.once('connect', () => resolve(socket));
        socket.once('connect_error', (err) => reject(err));
      });
    },
    async close() {
      for (const s of sockets) s.disconnect();
      await built.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** Келесі оқиғаны күтеді (уақыт шектеуімен). */
export function nextEvent<E extends keyof ServerToClientEvents>(
  socket: ClientSocket,
  event: E,
  timeoutMs = 3000,
): Promise<Parameters<ServerToClientEvents[E]>[0]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs);
    (socket.once as (ev: string, fn: (arg: unknown) => void) => void)(event, (arg) => {
      clearTimeout(timer);
      resolve(arg as never);
    });
  });
}

type AckOf<E extends keyof ClientToServerEvents> = Parameters<ClientToServerEvents[E]> extends [unknown, (r: infer R) => void] ? R : never;

export function emit<E extends keyof ClientToServerEvents>(
  socket: ClientSocket,
  event: E,
  payload: Parameters<ClientToServerEvents[E]>[0],
): Promise<AckOf<E>> {
  return (socket.timeout(3000).emitWithAck as (ev: string, p: unknown) => Promise<never>)(event, payload);
}
