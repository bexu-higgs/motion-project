import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { mediaTypeForExtension, type MediaType } from '@birge/shared';
import type { Config } from '../config';
import type { Db } from '../db';
import { hmac, safeEqual } from '../lib/crypto';
import { AppError } from '../lib/errors';

const MIME: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  ogv: 'video/ogg',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  wav: 'audio/wav',
  flac: 'audio/flac',
};

export function uploadTypeFor(fileName: string): { ext: string; mime: string; mediaType: MediaType } | null {
  const ext = path.extname(fileName).slice(1).toLowerCase();
  const mediaType = mediaTypeForExtension(ext);
  const mime = MIME[ext];
  if (!mediaType || !mime) return null;
  return { ext, mime, mediaType };
}

const URL_TTL_MS = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

/** Әкімші жүктеген бейне/аудио файлдар: дискіде сақтау, қол қойылған сілтемелер, Range арқылы беру. */
export class MediaStore {
  constructor(
    private readonly config: Config,
    private readonly db: Db,
  ) {}

  private filePath(id: string): string {
    return path.join(this.config.uploadDir, id);
  }

  /** Сілтеме бөлме мүшелеріне ғана беріледі және 24 сағаттан соң жарамсыз болады. */
  signedUrl(id: string, now = Date.now()): string {
    // Бір сағат ішінде сілтеме өзгермейді — ойнатқыштың кэші бұзылмасын.
    const exp = Math.ceil((now + URL_TTL_MS) / HOUR) * HOUR;
    const sig = hmac(this.config.secret, `media:${id}:${exp}`);
    return `${this.config.publicUrl}/api/media/${id}?exp=${exp}&sig=${sig}`;
  }

  verify(id: string, exp: string | undefined, sig: string | undefined, now = Date.now()): boolean {
    if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < now) return false;
    return safeEqual(sig, hmac(this.config.secret, `media:${id}:${exp}`));
  }

  async save(input: {
    roomId: string;
    userId: string;
    fileName: string;
    stream: Readable;
  }): Promise<{ id: string; size: number; mime: string; mediaType: MediaType }> {
    const type = uploadTypeFor(input.fileName);
    if (!type) throw new AppError('unsupported_media');
    await mkdir(this.config.uploadDir, { recursive: true });
    const id = randomUUID();
    const target = this.filePath(id);
    try {
      await pipeline(input.stream, createWriteStream(target, { flags: 'wx' }));
    } catch (err) {
      await rm(target, { force: true });
      if ((err as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') throw new AppError('upload_too_large');
      throw err;
    }
    if ((input.stream as Readable & { truncated?: boolean }).truncated) {
      await rm(target, { force: true });
      throw new AppError('upload_too_large');
    }
    const { size } = await stat(target);
    await this.db.query('INSERT INTO uploads (id, room_id, user_id, file_name, mime, size) VALUES ($1, $2, $3, $4, $5, $6)', [
      id,
      input.roomId,
      input.userId,
      input.fileName.slice(0, 255),
      type.mime,
      size,
    ]);
    return { id, size, mime: type.mime, mediaType: type.mediaType };
  }

  async deleteFiles(ids: string[]): Promise<void> {
    await Promise.all(ids.map((id) => rm(this.filePath(id), { force: true })));
  }

  async serve(request: FastifyRequest, reply: FastifyReply, id: string): Promise<FastifyReply> {
    const { rows } = await this.db.query<{ mime: string; file_name: string }>('SELECT mime, file_name FROM uploads WHERE id = $1', [id]);
    const row = rows[0];
    if (!row) throw new AppError('not_found');
    const file = this.filePath(id);
    let size: number;
    try {
      size = (await stat(file)).size;
    } catch {
      throw new AppError('not_found');
    }
    reply
      .header('Content-Type', row.mime)
      .header('Accept-Ranges', 'bytes')
      .header('Cache-Control', 'private, max-age=3600')
      .header('Content-Disposition', 'inline');

    const range = request.headers.range;
    if (!range) {
      reply.header('Content-Length', size);
      return reply.send(createReadStream(file));
    }
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    let start: number;
    let end: number;
    if (!match || (match[1] === '' && match[2] === '')) {
      return reply.code(416).header('Content-Range', `bytes */${size}`).send();
    }
    if (match[1] === '') {
      start = Math.max(0, size - Number(match[2]));
      end = size - 1;
    } else {
      start = Number(match[1]);
      end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    }
    if (start > end || start >= size) {
      return reply.code(416).header('Content-Range', `bytes */${size}`).send();
    }
    reply
      .code(206)
      .header('Content-Range', `bytes ${start}-${end}/${size}`)
      .header('Content-Length', end - start + 1);
    return reply.send(createReadStream(file, { start, end }));
  }
}
