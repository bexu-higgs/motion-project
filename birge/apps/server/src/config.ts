import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const bool = z
  .string()
  .optional()
  .transform((v) => v === '1' || v === 'true' || v === 'yes');

const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

const EnvSchema = z.object({
  NODE_ENV: z.string().default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().default(4000),
  TRUST_PROXY: bool,
  /** Сервердің сырттан көрінетін мекенжайы (OAuth қайтару сілтемелері үшін). */
  PUBLIC_URL: z.string().default('http://localhost:4000'),
  /** Веб-қосымша мекенжайы (шақыру сілтемелері, OAuth соңынан қайту). */
  WEB_URL: optional,
  CORS_ORIGINS: optional,
  APP_SCHEME: z.string().default('birge'),
  DATA_DIR: z.string().default('./data'),
  DATABASE_URL: optional,
  UPLOAD_DIR: optional,
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(4096),
  WEB_DIST: optional,
  SECRET: optional,
  LOG_LEVEL: z.string().default('info'),
  SUPPORT_EMAIL: z.string().default('support@birge.app'),

  DEV_OTP: bool,
  REVIEW_LOGINS: optional,
  MODERATOR_EMAILS: optional,

  SMTP_URL: optional,
  MAIL_FROM: z.string().default('Birge <no-reply@birge.app>'),

  SMS_PROVIDER: z.enum(['none', 'twilio', 'console']).default('none'),
  TWILIO_ACCOUNT_SID: optional,
  TWILIO_AUTH_TOKEN: optional,
  TWILIO_FROM: optional,
  TWILIO_MESSAGING_SERVICE_SID: optional,

  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,

  APPLE_TEAM_ID: optional,
  APPLE_KEY_ID: optional,
  APPLE_PRIVATE_KEY: optional,
  /** Веб/Android арқылы кіру үшін Services ID (мыс. kz.birge.web). */
  APPLE_SERVICES_ID: optional,
  /** iOS қосымшасының Bundle ID (мыс. kz.birge.app). */
  APPLE_BUNDLE_ID: optional,

  /** Шақыру сілтемелері қосымшаны тікелей ашуы үшін (Android App Links). */
  ANDROID_PACKAGE: optional,
  ANDROID_CERT_SHA256: optional,

  LIVEKIT_URL: optional,
  LIVEKIT_API_URL: optional,
  LIVEKIT_API_KEY: optional,
  LIVEKIT_API_SECRET: optional,
});

export interface Config {
  env: string;
  isProduction: boolean;
  host: string;
  port: number;
  trustProxy: boolean;
  publicUrl: string;
  webUrl: string;
  corsOrigins: string[];
  appScheme: string;
  dataDir: string;
  databaseUrl?: string;
  uploadDir: string;
  maxUploadBytes: number;
  webDist?: string;
  secret: string;
  logLevel: string;
  supportEmail: string;
  devOtp: boolean;
  reviewLogins: Map<string, string>;
  moderatorEmails: Set<string>;
  smtpUrl?: string;
  mailFrom: string;
  sms:
    | { provider: 'none' }
    | { provider: 'console' }
    | { provider: 'twilio'; accountSid: string; authToken: string; from?: string; messagingServiceSid?: string };
  google?: { clientId: string; clientSecret: string };
  apple?: {
    teamId: string;
    keyId: string;
    privateKey: string;
    servicesId?: string;
    bundleId?: string;
  };
  livekit?: { url: string; apiUrl: string; apiKey: string; apiSecret: string };
  /** Universal Links (iOS): TEAMID.bundle.id */
  iosAppId?: string;
  androidApp?: { packageName: string; fingerprints: string[] };
}

function stripSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

/** Әзірлеу кезінде құпия кілтті data/secret файлында сақтаймыз, сессиялар қайта іске қосқанда сақталсын. */
function loadDevSecret(dataDir: string): string {
  const file = path.join(dataDir, 'secret');
  if (existsSync(file)) return readFileSync(file, 'utf8').trim();
  mkdirSync(dataDir, { recursive: true });
  const secret = randomBytes(32).toString('base64url');
  writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}

function parseReviewLogins(raw?: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!raw) return map;
  for (const entry of raw.split(',')) {
    const idx = entry.lastIndexOf(':');
    if (idx <= 0) continue;
    const target = entry.slice(0, idx).trim().toLowerCase();
    const code = entry.slice(idx + 1).trim();
    if (target && /^\d{6}$/.test(code)) map.set(target, code);
  }
  return map;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const e = EnvSchema.parse(env);
  const isProduction = e.NODE_ENV === 'production';
  const dataDir = path.resolve(e.DATA_DIR);
  const publicUrl = stripSlash(e.PUBLIC_URL);
  const webUrl = stripSlash(e.WEB_URL ?? publicUrl);

  if (isProduction && !e.SECRET) throw new Error('SECRET айнымалысы продакшнда міндетті (кемінде 32 таңба).');
  if (isProduction && e.DEV_OTP) throw new Error('DEV_OTP продакшнда қосылмайды.');
  const secret = e.SECRET ?? loadDevSecret(dataDir);
  if (secret.length < 32) throw new Error('SECRET кемінде 32 таңбадан тұруы керек.');

  let sms: Config['sms'] = { provider: e.SMS_PROVIDER === 'twilio' ? 'none' : e.SMS_PROVIDER };
  if (e.SMS_PROVIDER === 'twilio') {
    if (!e.TWILIO_ACCOUNT_SID || !e.TWILIO_AUTH_TOKEN || !(e.TWILIO_FROM || e.TWILIO_MESSAGING_SERVICE_SID)) {
      throw new Error('Twilio үшін TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN және TWILIO_FROM керек.');
    }
    sms = {
      provider: 'twilio',
      accountSid: e.TWILIO_ACCOUNT_SID,
      authToken: e.TWILIO_AUTH_TOKEN,
      from: e.TWILIO_FROM,
      messagingServiceSid: e.TWILIO_MESSAGING_SERVICE_SID,
    };
  }

  const apple =
    e.APPLE_TEAM_ID && e.APPLE_KEY_ID && e.APPLE_PRIVATE_KEY && (e.APPLE_SERVICES_ID || e.APPLE_BUNDLE_ID)
      ? {
          teamId: e.APPLE_TEAM_ID,
          keyId: e.APPLE_KEY_ID,
          privateKey: e.APPLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          servicesId: e.APPLE_SERVICES_ID,
          bundleId: e.APPLE_BUNDLE_ID,
        }
      : undefined;

  const livekit =
    e.LIVEKIT_URL && e.LIVEKIT_API_KEY && e.LIVEKIT_API_SECRET
      ? {
          url: e.LIVEKIT_URL,
          apiUrl: e.LIVEKIT_API_URL ?? e.LIVEKIT_URL.replace(/^ws/, 'http'),
          apiKey: e.LIVEKIT_API_KEY,
          apiSecret: e.LIVEKIT_API_SECRET,
        }
      : undefined;

  const corsOrigins = (e.CORS_ORIGINS ?? webUrl)
    .split(',')
    .map((o) => stripSlash(o.trim()))
    .filter(Boolean);

  return {
    env: e.NODE_ENV,
    isProduction,
    host: e.HOST,
    port: e.PORT,
    trustProxy: e.TRUST_PROXY,
    publicUrl,
    webUrl,
    corsOrigins,
    appScheme: e.APP_SCHEME,
    dataDir,
    databaseUrl: e.DATABASE_URL,
    uploadDir: path.resolve(e.UPLOAD_DIR ?? path.join(dataDir, 'uploads')),
    maxUploadBytes: e.MAX_UPLOAD_MB * 1024 * 1024,
    webDist: e.WEB_DIST ? path.resolve(e.WEB_DIST) : undefined,
    secret,
    logLevel: e.LOG_LEVEL,
    supportEmail: e.SUPPORT_EMAIL,
    devOtp: e.DEV_OTP,
    reviewLogins: parseReviewLogins(e.REVIEW_LOGINS),
    moderatorEmails: new Set(
      (e.MODERATOR_EMAILS ?? '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
    smtpUrl: e.SMTP_URL,
    mailFrom: e.MAIL_FROM,
    sms,
    google:
      e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET ? { clientId: e.GOOGLE_CLIENT_ID, clientSecret: e.GOOGLE_CLIENT_SECRET } : undefined,
    apple,
    livekit,
    iosAppId: e.APPLE_TEAM_ID && e.APPLE_BUNDLE_ID ? `${e.APPLE_TEAM_ID}.${e.APPLE_BUNDLE_ID}` : undefined,
    androidApp:
      e.ANDROID_PACKAGE && e.ANDROID_CERT_SHA256
        ? {
            packageName: e.ANDROID_PACKAGE,
            fingerprints: e.ANDROID_CERT_SHA256.split(',')
              .map((f) => f.trim().toUpperCase())
              .filter(Boolean),
          }
        : undefined,
  };
}
