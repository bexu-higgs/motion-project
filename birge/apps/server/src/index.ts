import { buildApp } from './app';
import { loadConfig } from './config';

const config = loadConfig();
const { app, close } = await buildApp(config);

try {
  await app.listen({ host: config.host, port: config.port });
  app.log.info(
    {
      publicUrl: config.publicUrl,
      web: Boolean(config.webDist),
      voice: Boolean(config.livekit),
      google: Boolean(config.google),
      apple: Boolean(config.apple),
      sms: config.sms.provider,
      email: Boolean(config.smtpUrl),
      database: config.databaseUrl ? 'postgres' : 'pglite',
    },
    'Birge server started',
  );
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    app.log.info(`${signal} received, shutting down`);
    close()
      .catch((err) => app.log.error(err))
      .finally(() => process.exit(0));
  });
}
