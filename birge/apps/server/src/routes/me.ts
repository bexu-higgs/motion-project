import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DISPLAY_NAME_MAX_LENGTH, SUPPORTED_LOCALES, type PublicConfig } from '@birge/shared';
import type { Services } from '../services';
import { noContent, requireUser } from '../http';

const Patch = z.object({
  displayName: z
    .string()
    .max(DISPLAY_NAME_MAX_LENGTH * 2)
    .optional(),
  locale: z.enum(SUPPORTED_LOCALES).optional(),
  acceptTerms: z.boolean().optional(),
});

export function meRoutes(app: FastifyInstance, s: Services) {
  app.get('/api/health', async () => ({ ok: true }));

  // Шақыру сілтемелері (https://домен/join/КОД) орнатылған қосымшада ашылсын.
  app.get('/.well-known/apple-app-site-association', async (_request, reply) => {
    if (!s.config.iosAppId) return reply.code(404).send({ error: 'not_found' });
    return reply.type('application/json').send({
      applinks: { details: [{ appIDs: [s.config.iosAppId], components: [{ '/': '/join/*' }] }] },
    });
  });

  app.get('/.well-known/assetlinks.json', async (_request, reply) => {
    const android = s.config.androidApp;
    if (!android) return reply.code(404).send({ error: 'not_found' });
    return [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: { namespace: 'android_app', package_name: android.packageName, sha256_cert_fingerprints: android.fingerprints },
      },
    ];
  });

  app.get('/api/config', async (): Promise<PublicConfig> => {
    const { config } = s;
    return {
      providers: {
        email: s.notifier.canSend('email') || config.reviewLogins.size > 0,
        phone: s.notifier.canSend('phone'),
        google: s.oauth.isEnabled('google'),
        apple: s.oauth.isEnabled('apple'),
      },
      voice: s.voice.enabled,
      maxUploadMb: Math.floor(config.maxUploadBytes / 1024 / 1024),
      supportEmail: config.supportEmail,
      webUrl: config.webUrl,
      devOtp: config.devOtp,
    };
  });

  app.get('/api/me', async (request) => s.auth.getMe(requireUser(request).id));

  app.patch('/api/me', async (request) => {
    const user = requireUser(request);
    return s.auth.updateProfile(user.id, Patch.parse(request.body));
  });

  app.delete('/api/me', async (request, reply) => {
    const user = requireUser(request);
    await s.accounts.deleteAccount(user.id);
    return noContent(reply);
  });

  app.post('/api/me/logout-all', async (request, reply) => {
    await s.accounts.logoutEverywhere(requireUser(request).id);
    return noContent(reply);
  });
}
