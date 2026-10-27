import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ChatMessage, Member, PlaybackState, QueueItem, RoomInfo, RoomSnapshot, RoomSummary } from '@birge/shared';
import { emit, nextEvent, startServer, type TestServer } from './helpers';

let server: TestServer;
let owner: { token: string; userId: string };
let guest: { token: string; userId: string };
let room: RoomInfo;

beforeAll(async () => {
  server = await startServer();
  owner = await server.signUp('owner@birge.kz', 'Иесі');
  guest = await server.signUp('guest@birge.kz', 'Қонақ');
  const res = await server.api<RoomInfo>('POST', '/api/rooms', { token: owner.token, body: { name: '  Жұма кинокеші ', capacity: 10 } });
  expect(res.status).toBe(200);
  room = res.body;
  expect(room).toMatchObject({ name: 'Жұма кинокеші', capacity: 10, ownerId: owner.userId });
  expect(room.code).toMatch(/^[A-Z2-9]{6}$/);
}, 60_000);

afterAll(async () => {
  await server.close();
});

describe('rooms over REST', () => {
  it('validates capacity between 2 and 50', async () => {
    for (const capacity of [1, 51]) {
      const res = await server.api('POST', '/api/rooms', { token: owner.token, body: { name: 'X', capacity } });
      expect(res.body).toEqual({ error: 'invalid_input' });
    }
  });

  it('lets a guest preview and join by code', async () => {
    const preview = await server.api<{ name: string; isMember: boolean; ownerName: string }>(
      'GET',
      `/api/rooms/code/${room.code.toLowerCase()}`,
      {
        token: guest.token,
      },
    );
    expect(preview.body).toMatchObject({ name: 'Жұма кинокеші', isMember: false, ownerName: 'Иесі', memberCount: 1 });
    const join = await server.api<RoomInfo>('POST', '/api/rooms/join', { token: guest.token, body: { code: room.code } });
    expect(join.body.id).toBe(room.id);
    const list = await server.api<RoomSummary[]>('GET', '/api/rooms', { token: guest.token });
    expect(list.body).toEqual([expect.objectContaining({ id: room.id, role: 'member', memberCount: 2 })]);
    expect((await server.api('POST', '/api/rooms/join', { token: guest.token, body: { code: 'ZZZZZZ' } })).body).toEqual({
      error: 'not_found',
    });
  });

  it('only lets the owner rename the room', async () => {
    expect((await server.api('PATCH', `/api/rooms/${room.id}`, { token: guest.token, body: { name: 'Hack' } })).body).toEqual({
      error: 'forbidden',
    });
    const res = await server.api<RoomInfo>('PATCH', `/api/rooms/${room.id}`, { token: owner.token, body: { name: 'Сенбі кинокеші' } });
    expect(res.body.name).toBe('Сенбі кинокеші');
    room = res.body;
  });

  it('reports voice as unavailable when LiveKit is not configured', async () => {
    expect((await server.api('POST', `/api/rooms/${room.id}/voice`, { token: guest.token })).body).toEqual({ error: 'voice_unavailable' });
  });
});

describe('capacity', () => {
  it('never lets more than 50 people into one room', async () => {
    const host = await server.signUp('host50@birge.kz', 'Host');
    const big = (await server.api<RoomInfo>('POST', '/api/rooms', { token: host.token, body: { name: 'Big', capacity: 50 } })).body;
    const joins: Promise<{ status: number }>[] = [];
    for (let i = 0; i < 50; i++) {
      const u = await server.signUp(`user${i}@birge.kz`, `User ${i}`);
      joins.push(server.api('POST', '/api/rooms/join', { token: u.token, body: { code: big.code } }));
    }
    const statuses = (await Promise.all(joins)).map((r) => r.status);
    // Иесімен бірге 50 адам: 49 қосылады, 1 — орын жоқ.
    expect(statuses.filter((s) => s === 200)).toHaveLength(49);
    expect(statuses.filter((s) => s === 409)).toHaveLength(1);
    const preview = await server.api<{ memberCount: number }>('GET', `/api/rooms/code/${big.code}`, { token: host.token });
    expect(preview.body.memberCount).toBe(50);
  }, 120_000);

  it('keeps small rooms small', async () => {
    const a = await server.signUp('small-a@birge.kz', 'Ali');
    const b = await server.signUp('small-b@birge.kz', 'Bek');
    const c = await server.signUp('small-c@birge.kz', 'Cira');
    const duo = (await server.api<RoomInfo>('POST', '/api/rooms', { token: a.token, body: { name: 'Duo', capacity: 2 } })).body;
    expect((await server.api('POST', '/api/rooms/join', { token: b.token, body: { code: duo.code } })).status).toBe(200);
    expect((await server.api('POST', '/api/rooms/join', { token: c.token, body: { code: duo.code } })).body).toEqual({
      error: 'room_full',
    });
  });
});

describe('watching together over Socket.IO', () => {
  it('syncs playback, chat and moderation between members', async () => {
    const ownerSocket = await server.connect(owner.token);
    const guestSocket = await server.connect(guest.token);

    const serverTime = await emit(ownerSocket, 'time:sync', Date.now());
    expect(Math.abs((serverTime as unknown as number) - Date.now())).toBeLessThan(1000);

    const ownerJoin = (await emit(ownerSocket, 'room:join', { roomId: room.id })) as { ok: true; data: RoomSnapshot };
    expect(ownerJoin.ok).toBe(true);
    expect(ownerJoin.data.role).toBe('owner');

    const membersSeen = nextEvent(ownerSocket, 'room:members');
    const guestJoin = (await emit(guestSocket, 'room:join', { roomId: room.id })) as { ok: true; data: RoomSnapshot };
    expect(guestJoin.data.role).toBe('member');
    expect(guestJoin.data.playback.itemId).toBeNull();
    const members = (await membersSeen) as Member[];
    expect(
      members
        .filter((m) => m.online)
        .map((m) => m.displayName)
        .sort(),
    ).toEqual(['Иесі', 'Қонақ']);

    // Қатардағы мүше ойнатуды басқара алмайды.
    expect(await emit(guestSocket, 'queue:add', { roomId: room.id, url: 'https://youtu.be/dQw4w9WgXcQ' })).toEqual({
      ok: false,
      error: 'forbidden',
    });

    // Әкімші YouTube сілтемесін қосады — бірінші элемент таңдалады (кідіртілген күйде).
    const queueSeen = nextEvent(guestSocket, 'room:queue');
    const firstSelected = nextEvent(guestSocket, 'room:playback');
    const added = (await emit(ownerSocket, 'queue:add', { roomId: room.id, url: 'https://youtu.be/dQw4w9WgXcQ' })) as {
      ok: true;
      data: QueueItem;
    };
    expect(added.data).toMatchObject({ kind: 'youtube', src: 'dQw4w9WgXcQ', title: 'Test video', mediaType: 'video' });
    expect(((await queueSeen) as QueueItem[]).map((q) => q.id)).toEqual([added.data.id]);
    expect(await firstSelected).toMatchObject({ itemId: added.data.id, status: 'paused', position: 0 });

    const second = (await emit(ownerSocket, 'queue:add', { roomId: room.id, url: 'https://cdn.example.com/music/Abai_Zholy.mp3' })) as {
      ok: true;
      data: QueueItem;
    };
    expect(second.data).toMatchObject({ kind: 'url', mediaType: 'audio', title: 'Abai Zholy' });
    expect(await emit(ownerSocket, 'queue:add', { roomId: room.id, url: 'https://example.com/page' })).toEqual({
      ok: false,
      error: 'unsupported_media',
    });

    // Ойнату — қонаққа таралады.
    const played = nextEvent(guestSocket, 'room:playback');
    await emit(ownerSocket, 'playback:control', { roomId: room.id, action: 'play', position: 12.5 });
    const state = (await played) as PlaybackState;
    expect(state).toMatchObject({ itemId: added.data.id, status: 'playing', position: 12.5 });
    expect(await emit(guestSocket, 'playback:control', { roomId: room.id, action: 'pause', position: 0 })).toEqual({
      ok: false,
      error: 'forbidden',
    });

    // Бейне біткенде — кезектегі келесісі.
    const advanced = nextEvent(guestSocket, 'room:playback');
    await emit(ownerSocket, 'playback:ended', { roomId: room.id, itemId: added.data.id, seq: state.seq });
    expect((await advanced) as PlaybackState).toMatchObject({ itemId: second.data.id, status: 'playing', position: 0 });

    // Экранды бөлісу ойнатуды тоқтатады.
    const shared = nextEvent(guestSocket, 'room:share');
    const share = await emit(ownerSocket, 'share:set', { roomId: room.id, active: true });
    expect(share.ok).toBe(true);
    expect(await shared).toMatchObject({ userId: owner.userId });
    expect(await emit(guestSocket, 'share:set', { roomId: room.id, active: true })).toEqual({ ok: false, error: 'forbidden' });
    await emit(ownerSocket, 'share:set', { roomId: room.id, active: false });

    // Чат: балағат сөздер жабылады.
    const received = nextEvent(ownerSocket, 'chat:message');
    const sent = (await emit(guestSocket, 'chat:send', { roomId: room.id, body: '  Сәлем! What the fuck  ' })) as {
      ok: true;
      data: ChatMessage;
    };
    expect(sent.data.body).toBe('Сәлем! What the f***');
    expect(((await received) as ChatMessage).displayName).toBe('Қонақ');
    expect(await emit(guestSocket, 'chat:send', { roomId: room.id, body: '   ' })).toEqual({ ok: false, error: 'invalid_input' });

    // Шектен тыс жылдам жазуға болмайды.
    const burst = [];
    for (let i = 0; i < 6; i++) burst.push(emit(guestSocket, 'chat:send', { roomId: room.id, body: `msg ${i}` }));
    expect((await Promise.all(burst)).some((r) => !r.ok && r.error === 'rate_limited')).toBe(true);

    // Бұғаттаған адамның хабарламалары тарихта көрінбейді.
    await server.api('POST', '/api/blocks', { token: owner.token, body: { userId: guest.userId } });
    const rejoin = (await emit(ownerSocket, 'room:join', { roomId: room.id })) as { ok: true; data: RoomSnapshot };
    expect(rejoin.data.messages.some((m) => m.userId === guest.userId)).toBe(false);
    expect((await server.api<{ id: string }[]>('GET', '/api/blocks', { token: owner.token })).body.map((u) => u.id)).toEqual([
      guest.userId,
    ]);
    await server.api('DELETE', `/api/blocks/${guest.userId}`, { token: owner.token });

    // Шағым жіберу.
    expect(
      (
        await server.api('POST', '/api/reports', {
          token: owner.token,
          body: { targetType: 'message', targetId: sent.data.id, reason: 'harassment' },
        })
      ).status,
    ).toBe(204);

    // Хабарламаны өшіру: өзгенікін — тек әкімші.
    const deleted = nextEvent(guestSocket, 'chat:deleted');
    expect((await emit(ownerSocket, 'chat:delete', { roomId: room.id, messageId: sent.data.id })).ok).toBe(true);
    expect(await deleted).toEqual({ id: sent.data.id });

    // Рөл беру: қонақ әкімші болады, енді басқара алады.
    const roleSeen = nextEvent(guestSocket, 'room:role');
    expect((await emit(ownerSocket, 'member:role', { roomId: room.id, userId: guest.userId, role: 'admin' })).ok).toBe(true);
    expect(await roleSeen).toBe('admin');
    expect((await emit(guestSocket, 'playback:control', { roomId: room.id, action: 'pause', position: 3 })).ok).toBe(true);
    // Әкімші иесін шығара алмайды.
    expect(await emit(guestSocket, 'member:remove', { roomId: room.id, userId: owner.userId, ban: false })).toEqual({
      ok: false,
      error: 'cannot_moderate_owner',
    });

    // Кезектен өшіру.
    expect((await emit(guestSocket, 'queue:remove', { roomId: room.id, itemId: added.data.id })).ok).toBe(true);

    // Бұғаттап шығару: қонақ хабар алады және қайта кіре алмайды.
    const removed = nextEvent(guestSocket, 'room:removed');
    expect((await emit(ownerSocket, 'member:remove', { roomId: room.id, userId: guest.userId, ban: true })).ok).toBe(true);
    expect(await removed).toEqual({ roomId: room.id, reason: 'banned' });
    expect(await emit(guestSocket, 'chat:send', { roomId: room.id, body: 'hi' })).toEqual({ ok: false, error: 'room_not_joined' });
    expect((await server.api('POST', '/api/rooms/join', { token: guest.token, body: { code: room.code } })).body).toEqual({
      error: 'room_banned',
    });
  });

  it('refuses sockets without a valid session', async () => {
    await expect(server.connect('bg_invalid')).rejects.toThrow('unauthorized');
  });
});

describe('uploads', () => {
  it('stores an uploaded file and serves it with byte ranges to signed links only', async () => {
    const host = await server.signUp('uploader@birge.kz', 'Uploader');
    const viewer = await server.signUp('viewer@birge.kz', 'Viewer');
    const r = (await server.api<RoomInfo>('POST', '/api/rooms', { token: host.token, body: { name: 'Files', capacity: 5 } })).body;
    await server.api('POST', '/api/rooms/join', { token: viewer.token, body: { code: r.code } });

    const bytes = new Uint8Array(1000).map((_, i) => i % 256);
    const upload = async (token: string, name: string) => {
      const form = new FormData();
      form.append('file', new Blob([bytes], { type: 'video/mp4' }), name);
      const res = await fetch(`${server.url}/api/rooms/${r.id}/uploads?title=${encodeURIComponent('Менің фильмім')}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      return { status: res.status, body: await res.json() };
    };

    expect((await upload(viewer.token, 'film.mp4')).body).toEqual({ error: 'forbidden' });
    expect((await upload(host.token, 'virus.exe')).body).toEqual({ error: 'unsupported_media' });
    const ok = await upload(host.token, 'film.mp4');
    expect(ok.status).toBe(200);

    const socket = await server.connect(viewer.token);
    const snap = (await emit(socket, 'room:join', { roomId: r.id })) as { ok: true; data: RoomSnapshot };
    const item = snap.data.queue[0]!;
    expect(item).toMatchObject({ kind: 'upload', title: 'Менің фильмім', mediaType: 'video' });
    expect(snap.data.playback.itemId).toBe(item.id);
    expect(item.src).toContain('/api/media/');

    const full = await fetch(item.src);
    expect(full.status).toBe(200);
    expect(full.headers.get('content-type')).toBe('video/mp4');
    expect((await full.arrayBuffer()).byteLength).toBe(1000);

    const part = await fetch(item.src, { headers: { Range: 'bytes=100-199' } });
    expect(part.status).toBe(206);
    expect(part.headers.get('content-range')).toBe('bytes 100-199/1000');
    expect(new Uint8Array(await part.arrayBuffer())[0]).toBe(100);

    const tail = await fetch(item.src, { headers: { Range: 'bytes=-10' } });
    expect(tail.headers.get('content-range')).toBe('bytes 990-999/1000');
    expect((await fetch(item.src, { headers: { Range: 'bytes=5000-' } })).status).toBe(416);

    const forged = item.src.replace(/sig=[^&]+/, 'sig=forged');
    expect((await fetch(forged)).status).toBe(403);

    // Бөлме жабылса — файл да жойылады.
    expect((await server.api('DELETE', `/api/rooms/${r.id}`, { token: host.token })).status).toBe(204);
    expect((await fetch(item.src)).status).toBe(404);
  });
});

describe('moderators', () => {
  it('lists reports and bans users', async () => {
    const mod = await startServer({ MODERATOR_EMAILS: 'mod@birge.kz' });
    try {
      const moderator = await mod.signUp('mod@birge.kz', 'Moderator');
      const bad = await mod.signUp('bad@birge.kz', 'Bad');
      expect((await mod.api('GET', '/api/mod/reports', { token: bad.token })).body).toEqual({ error: 'forbidden' });
      await mod.api('POST', '/api/reports', {
        token: moderator.token,
        body: { targetType: 'user', targetId: bad.userId, reason: 'spam', details: 'spam links' },
      });
      const reports = await mod.api<{ id: string; targetUser: { id: string } }[]>('GET', '/api/mod/reports', { token: moderator.token });
      expect(reports.body).toHaveLength(1);
      expect(reports.body[0]!.targetUser.id).toBe(bad.userId);
      expect((await mod.api('POST', `/api/mod/users/${bad.userId}/ban`, { token: moderator.token })).status).toBe(204);
      expect((await mod.api('GET', '/api/me', { token: bad.token })).status).toBe(401);
      const relogin = await mod.api<{ devCode: string }>('POST', '/api/auth/otp/request', {
        body: { channel: 'email', target: 'bad@birge.kz' },
        ip: '10.9.9.9',
      });
      const verify = await mod.api('POST', '/api/auth/otp/verify', {
        body: { channel: 'email', target: 'bad@birge.kz', code: relogin.body.devCode },
        ip: '10.9.9.9',
      });
      expect(verify.body).toEqual({ error: 'account_banned' });
      await mod.api('POST', `/api/mod/reports/${reports.body[0]!.id}/resolve`, { token: moderator.token });
      expect((await mod.api<unknown[]>('GET', '/api/mod/reports', { token: moderator.token })).body).toHaveLength(0);
    } finally {
      await mod.close();
    }
  });
});
