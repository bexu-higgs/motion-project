import { describe, expect, it } from 'vitest';
import { decrypt, encrypt } from '../src/lib/crypto';
import { RateLimiter } from '../src/lib/rate-limit';
import { filterText } from '../src/moderation/filter';
import { applyControl, initialPlayback, nextItemId, pauseAt, selectItem } from '../src/rooms/playback';

describe('chat filter', () => {
  it('masks profanity in English, Russian and Kazakh', () => {
    expect(filterText('fucking hell').text).toBe('f****** hell');
    expect(filterText('Ну ты бляд').text).toBe('Ну ты б***');
    expect(filterText('қотақбас').flagged).toBe(true);
    expect(filterText('sh1t').flagged).toBe(true);
  });
  it('leaves ordinary words alone', () => {
    for (const text of ['Есікті жап', 'Адам көп', 'художник', 'мандарин жедім', 'Charles Dickens', 'Ассалаумағалейкум', 'сукпа']) {
      expect(filterText(text)).toEqual({ text, flagged: false });
    }
  });
});

describe('playback transitions', () => {
  it('plays, pauses and seeks with increasing sequence numbers', () => {
    let s = selectItem(initialPlayback(0), 'a', 1000, false);
    expect(s).toMatchObject({ itemId: 'a', status: 'paused', position: 0, seq: 1 });
    s = applyControl(s, 'play', 5, 2000);
    expect(s).toMatchObject({ status: 'playing', position: 5, updatedAt: 2000, seq: 2 });
    s = applyControl(s, 'seek', 60, 3000);
    expect(s).toMatchObject({ status: 'playing', position: 60, seq: 3 });
    s = pauseAt(s, 13_000);
    expect(s).toMatchObject({ status: 'paused', position: 70, seq: 4 });
    expect(applyControl(s, 'seek', -5, 0).position).toBe(0);
    expect(applyControl(s, 'seek', Number.NaN, 0).position).toBe(0);
  });
  it('finds the next queue item', () => {
    expect(nextItemId(['a', 'b'], null)).toBe('a');
    expect(nextItemId(['a', 'b'], 'a')).toBe('b');
    expect(nextItemId(['a', 'b'], 'b')).toBeNull();
    expect(nextItemId([], 'a')).toBeNull();
  });
});

describe('helpers', () => {
  it('encrypts secrets at rest', () => {
    const box = encrypt('k'.repeat(32), 'apple-refresh-token');
    expect(box).not.toContain('apple');
    expect(decrypt('k'.repeat(32), box)).toBe('apple-refresh-token');
    expect(() => decrypt('x'.repeat(32), box)).toThrow();
  });
  it('rate limits per key within a window', () => {
    const limiter = new RateLimiter(2, 1000);
    expect(limiter.take('a', 0)).toBe(true);
    expect(limiter.take('a', 10)).toBe(true);
    expect(limiter.take('a', 20)).toBe(false);
    expect(limiter.take('b', 20)).toBe(true);
    expect(limiter.take('a', 1500)).toBe(true);
  });
});
