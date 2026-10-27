import type { Locale, OtpChannel } from '@birge/shared';
import nodemailer, { type Transporter } from 'nodemailer';
import type { Config } from '../config';

export interface Logger {
  info(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
}

export interface Notifier {
  /** Осы арна арқылы код жіберуге бола ма. */
  canSend(channel: OtpChannel): boolean;
  sendCode(channel: OtpChannel, target: string, code: string, locale: Locale): Promise<void>;
}

const TEXT = {
  kk: {
    subject: (code: string) => `Birge: кіру коды ${code}`,
    body: (code: string) =>
      `Сәлем!\n\nBirge-ге кіру кодыңыз: ${code}\nКод 10 минут жарамды. Егер сіз сұрамаған болсаңыз, бұл хатты елемеңіз.\n\nBirge`,
    sms: (code: string) => `Birge коды: ${code}. Ешкімге айтпаңыз.`,
  },
  en: {
    subject: (code: string) => `Birge: your sign-in code ${code}`,
    body: (code: string) =>
      `Hi!\n\nYour Birge sign-in code is: ${code}\nIt expires in 10 minutes. If you didn't request it, you can ignore this email.\n\nBirge`,
    sms: (code: string) => `Birge code: ${code}. Do not share it.`,
  },
} as const;

async function sendTwilio(config: Extract<Config['sms'], { provider: 'twilio' }>, to: string, body: string): Promise<void> {
  const params = new URLSearchParams({ To: to, Body: body });
  if (config.messagingServiceSid) params.set('MessagingServiceSid', config.messagingServiceSid);
  else if (config.from) params.set('From', config.from);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Twilio error ${res.status}: ${await res.text()}`);
}

export function createNotifier(config: Config, log: Logger): Notifier {
  let transport: Transporter | null = null;
  if (config.smtpUrl) transport = nodemailer.createTransport(config.smtpUrl);
  const devFallback = !config.isProduction;

  return {
    canSend(channel) {
      if (config.devOtp) return true;
      if (channel === 'email') return Boolean(transport) || devFallback;
      return config.sms.provider !== 'none' || devFallback;
    },
    async sendCode(channel, target, code, locale) {
      const t = TEXT[locale];
      if (channel === 'email' && transport) {
        await transport.sendMail({ from: config.mailFrom, to: target, subject: t.subject(code), text: t.body(code) });
        return;
      }
      if (channel === 'phone' && config.sms.provider === 'twilio') {
        await sendTwilio(config.sms, target, t.sms(code));
        return;
      }
      // Әзірлеу режимі: код тек сервер журналына жазылады.
      log.warn({ channel, target, code }, 'OTP code (dev mode — not delivered)');
    },
  };
}
