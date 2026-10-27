import { MEDIA_URL_MAX_LENGTH } from './limits';
import type { MediaType } from './protocol';

export const VIDEO_EXTENSIONS = ['mp4', 'm4v', 'webm', 'mov', 'ogv', 'm3u8'] as const;
export const AUDIO_EXTENSIONS = ['mp3', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'wav', 'flac'] as const;

export type ParsedMedia =
  | { kind: 'youtube'; videoId: string }
  | { kind: 'url'; url: string; mediaType: MediaType; hls: boolean; fileName: string };

export type ParseMediaResult = { ok: true; media: ParsedMedia } | { ok: false; error: 'invalid_url' | 'unsupported_media' };

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

export function extractYouTubeId(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  if (host === 'youtu.be') {
    const id = url.pathname.split('/')[1] ?? '';
    return YOUTUBE_ID.test(id) ? id : null;
  }
  if (!YOUTUBE_HOSTS.has(host)) return null;
  const v = url.searchParams.get('v');
  if (url.pathname === '/watch' && v && YOUTUBE_ID.test(v)) return v;
  const match = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})(?:[/?#]|$)/);
  return match ? match[1]! : null;
}

function extensionOf(pathname: string): string {
  const last = pathname.split('/').pop() ?? '';
  const dot = last.lastIndexOf('.');
  return dot >= 0 ? last.slice(dot + 1).toLowerCase() : '';
}

export function mediaTypeForExtension(ext: string): MediaType | null {
  if ((VIDEO_EXTENSIONS as readonly string[]).includes(ext)) return 'video';
  if ((AUDIO_EXTENSIONS as readonly string[]).includes(ext)) return 'audio';
  return null;
}

/** Файл атауынан оқуға ыңғайлы тақырып жасайды: "My.Movie_2024.mp4" → "My Movie 2024". */
export function titleFromFileName(fileName: string): string {
  let decoded = fileName;
  try {
    decoded = decodeURIComponent(fileName);
  } catch {
    // бұзылған кодтау — атауды сол күйінде қалдырамыз
  }
  const withoutExt = decoded.replace(/\.[A-Za-z0-9]{1,5}$/, '');
  const cleaned = withoutExt.replace(/[._]+/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned || decoded;
}

/**
 * Әкімші қойған сілтемені талдайды. Қолдау көрсетілетіндер:
 *  - YouTube (ресми ендірілген ойнатқыш арқылы),
 *  - бейне/аудио файлға тікелей сілтеме (.mp4, .webm, .mp3, .m3u8 т.б.).
 */
export function parseMediaUrl(input: string): ParseMediaResult {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > MEDIA_URL_MAX_LENGTH) return { ok: false, error: 'invalid_url' };
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, error: 'invalid_url' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { ok: false, error: 'invalid_url' };
  if (url.username || url.password) return { ok: false, error: 'invalid_url' };

  const youtubeId = extractYouTubeId(url);
  if (youtubeId) return { ok: true, media: { kind: 'youtube', videoId: youtubeId } };

  const ext = extensionOf(url.pathname);
  const mediaType = mediaTypeForExtension(ext);
  if (!mediaType) return { ok: false, error: 'unsupported_media' };
  const fileName = url.pathname.split('/').pop() ?? '';
  return { ok: true, media: { kind: 'url', url: url.toString(), mediaType, hls: ext === 'm3u8', fileName } };
}
