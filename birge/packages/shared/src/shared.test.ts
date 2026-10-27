import { describe, expect, it } from 'vitest';
import {
  ClockSync,
  clampCapacity,
  decideSync,
  formatDuration,
  normalizeEmail,
  normalizePhone,
  parseMediaUrl,
  positionAt,
  titleFromFileName,
  type PlaybackState,
} from './index';

const base: PlaybackState = { itemId: 'a', status: 'playing', position: 10, rate: 1, updatedAt: 1_000_000, seq: 1 };

describe('positionAt', () => {
  it('advances while playing', () => {
    expect(positionAt(base, 1_005_000)).toBeCloseTo(15);
    expect(positionAt({ ...base, rate: 2 }, 1_005_000)).toBeCloseTo(20);
  });
  it('stays put while paused', () => {
    expect(positionAt({ ...base, status: 'paused' }, 1_005_000)).toBe(10);
  });
  it('never goes backwards on clock skew', () => {
    expect(positionAt(base, 999_000)).toBe(10);
  });
});

describe('decideSync', () => {
  it('does nothing when close enough', () => {
    expect(decideSync(10.1, 10, { canAdjustRate: true })).toEqual({ kind: 'none', rate: 1 });
  });
  it('slows down when ahead and speeds up when behind', () => {
    const ahead = decideSync(10.8, 10, { canAdjustRate: true });
    const behind = decideSync(9.2, 10, { canAdjustRate: true });
    expect(ahead.kind).toBe('rate');
    expect(ahead.rate).toBeLessThan(1);
    expect(behind.rate).toBeGreaterThan(1);
    expect(Math.abs(ahead.rate - 1)).toBeLessThanOrEqual(0.0501);
  });
  it('seeks on large drift', () => {
    expect(decideSync(30, 10, { canAdjustRate: true })).toEqual({ kind: 'seek', position: 10, rate: 1 });
  });
  it('uses seeks only when rate cannot be adjusted', () => {
    expect(decideSync(10.8, 10, { canAdjustRate: false }).kind).toBe('none');
    expect(decideSync(11.6, 10, { canAdjustRate: false }).kind).toBe('seek');
  });
});

describe('ClockSync', () => {
  it('estimates offset and prefers low-latency samples', () => {
    const clock = new ClockSync();
    expect(clock.ready).toBe(false);
    // Сервер сағаты клиенттен 5000 мс алда, RTT 100 мс.
    clock.addSample(1000, 6050, 1100);
    // Кідірісі үлкен әрі асимметриялы үлгі.
    clock.addSample(2000, 7900, 3000);
    clock.addSample(4000, 9040, 4080);
    expect(clock.ready).toBe(true);
    expect(clock.offset).toBeCloseTo(5000, -1);
    expect(clock.rtt).toBe(80);
    expect(clock.serverNow(10_000)).toBeCloseTo(15_000, -1);
  });
});

describe('parseMediaUrl', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?si=abc', 'dQw4w9WgXcQ'],
    ['https://m.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://music.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ])('recognises YouTube link %s', (url, id) => {
    expect(parseMediaUrl(url)).toEqual({ ok: true, media: { kind: 'youtube', videoId: id } });
  });

  it('recognises direct video, audio and HLS files', () => {
    const video = parseMediaUrl('https://cdn.example.com/films/My.Film.2024.mp4?token=1');
    expect(video).toMatchObject({ ok: true, media: { kind: 'url', mediaType: 'video', hls: false, fileName: 'My.Film.2024.mp4' } });
    expect(parseMediaUrl('https://x.kz/song.MP3')).toMatchObject({ ok: true, media: { mediaType: 'audio' } });
    expect(parseMediaUrl('https://x.kz/live/index.m3u8')).toMatchObject({ ok: true, media: { mediaType: 'video', hls: true } });
  });

  it('rejects other links and schemes', () => {
    expect(parseMediaUrl('https://example.com/page')).toEqual({ ok: false, error: 'unsupported_media' });
    expect(parseMediaUrl('javascript:alert(1)')).toEqual({ ok: false, error: 'invalid_url' });
    expect(parseMediaUrl('file:///etc/passwd.mp4')).toEqual({ ok: false, error: 'invalid_url' });
    expect(parseMediaUrl('https://user:pass@x.kz/a.mp4')).toEqual({ ok: false, error: 'invalid_url' });
    expect(parseMediaUrl('not a url')).toEqual({ ok: false, error: 'invalid_url' });
    expect(parseMediaUrl('https://www.youtube.com/watch?v=short')).toEqual({ ok: false, error: 'unsupported_media' });
  });
});

describe('contacts', () => {
  it('normalizes emails', () => {
    expect(normalizeEmail('  Aru@Mail.KZ ')).toBe('aru@mail.kz');
    expect(normalizeEmail('nope')).toBeNull();
  });
  it('normalizes Kazakhstan phone numbers to E.164', () => {
    expect(normalizePhone('8 701 123 45 67')).toBe('+77011234567');
    expect(normalizePhone('+7 (701) 123-45-67')).toBe('+77011234567');
    expect(normalizePhone('+44 20 7946 0958')).toBe('+442079460958');
    expect(normalizePhone('12345')).toBeNull();
  });
});

describe('helpers', () => {
  it('clamps room capacity to 2..50', () => {
    expect(clampCapacity(1)).toBe(2);
    expect(clampCapacity(51)).toBe(50);
    expect(clampCapacity(12.4)).toBe(12);
    expect(clampCapacity(Number.NaN)).toBe(50);
  });
  it('formats durations', () => {
    expect(formatDuration(5)).toBe('0:05');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(3725)).toBe('1:02:05');
  });
  it('builds titles from file names', () => {
    expect(titleFromFileName('My.Movie_2024.mp4')).toBe('My Movie 2024');
    expect(titleFromFileName('%D0%9A%D0%B8%D0%BD%D0%BE.mp4')).toBe('Кино');
  });
});
