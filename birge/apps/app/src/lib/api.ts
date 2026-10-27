import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { ERROR_CODES, type ErrorCode } from '@birge/shared';

export type ClientErrorCode = ErrorCode | 'network';

export class ApiError extends Error {
  constructor(
    readonly code: ClientErrorCode,
    readonly status = 0,
  ) {
    super(code);
  }
}

export function toErrorCode(err: unknown): ClientErrorCode {
  if (err instanceof ApiError) return err.code;
  if (typeof err === 'string' && (ERROR_CODES as readonly string[]).includes(err)) return err as ErrorCode;
  return 'network';
}

/**
 * Сервер мекенжайы:
 *  1) EXPO_PUBLIC_API_URL (продакшн құрастыруда міндетті),
 *  2) вебте — беттің өз домені (сервер веб-нұсқаны өзі таратады),
 *  3) әзірлеуде — Metro іске қосылған компьютердің :4000 порты.
 */
export function apiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL || (Constants.expoConfig?.extra?.apiUrl as string | undefined) || '';
  if (configured) return configured.replace(/\/+$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const { protocol, hostname, port, origin } = window.location;
    return port === '8081' ? `${protocol}//${hostname}:4000` : origin;
  }
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return host ? `http://${host}:4000` : 'http://localhost:4000';
}

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setApiToken(value: string | null): void {
  token = value;
}

export function getApiToken(): string | null {
  return token;
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  // Жауап келгенше сессия ауысуы мүмкін — 401 тек осы токенмен жіберілген сұрауға қатысты.
  const sentToken = token;
  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl()}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(sentToken ? { Authorization: `Bearer ${sentToken}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('network');
  }
  if (res.status === 204) return undefined as T;
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // бос немесе JSON емес жауап
  }
  if (!res.ok) {
    const code = (json as { error?: string } | null)?.error;
    const known = code && (ERROR_CODES as readonly string[]).includes(code) ? (code as ErrorCode) : 'server_error';
    if (res.status === 401 && sentToken && sentToken === token) onUnauthorized?.();
    throw new ApiError(known, res.status);
  }
  return json as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T = void>(path: string) => request<T>('DELETE', path),
};

export interface UploadFile {
  /** Вебте — File объектісі, нативте — файлдың uri-і. */
  file?: Blob;
  uri: string;
  name: string;
  mimeType?: string;
}

/** Файлды жүктеу барысын көрсету үшін XMLHttpRequest қолданамыз. */
export function uploadFile(path: string, upload: UploadFile, onProgress: (fraction: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    if (upload.file) form.append('file', upload.file, upload.name);
    else
      form.append('file', { uri: upload.uri, name: upload.name, type: upload.mimeType ?? 'application/octet-stream' } as unknown as Blob);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${apiBaseUrl()}${path}`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let code: ClientErrorCode = xhr.status === 413 ? 'upload_too_large' : 'server_error';
      try {
        const parsed = JSON.parse(xhr.responseText) as { error?: string };
        if (parsed.error && (ERROR_CODES as readonly string[]).includes(parsed.error)) code = parsed.error as ErrorCode;
      } catch {
        // JSON емес жауап
      }
      reject(new ApiError(code, xhr.status));
    };
    xhr.onerror = () => reject(new ApiError('network'));
    xhr.send(form);
  });
}
