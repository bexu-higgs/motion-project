import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { decodeJwt } from 'jose';
import type { PublicConfig, RoomInfo, VoiceCredentials } from '@birge/shared';
import { startServer, type TestServer } from './helpers';

let server: TestServer;

beforeAll(async () => {
  server = await startServer({
    LIVEKIT_URL: 'wss://lk.example.kz',
    LIVEKIT_API_KEY: 'devkey',
    LIVEKIT_API_SECRET: 'secret-secret-secret-secret-secret',
  });
}, 60_000);

afterAll(async () => {
  await server.close();
});

describe('voice tokens', () => {
  it('lets admins share a tab while members may only use the microphone', async () => {
    expect((await server.api<PublicConfig>('GET', '/api/config')).body.voice).toBe(true);
    const owner = await server.signUp('voice-owner@birge.kz', 'Owner');
    const member = await server.signUp('voice-member@birge.kz', 'Member');
    const outsider = await server.signUp('voice-outsider@birge.kz', 'Outsider');
    const room = (await server.api<RoomInfo>('POST', '/api/rooms', { token: owner.token, body: { name: 'Voice', capacity: 5 } })).body;
    await server.api('POST', '/api/rooms/join', { token: member.token, body: { code: room.code } });

    const grant = async (token: string) => {
      const res = await server.api<VoiceCredentials>('POST', `/api/rooms/${room.id}/voice`, { token });
      expect(res.body.url).toBe('wss://lk.example.kz');
      return decodeJwt(res.body.token) as { sub: string; name: string; video: { room: string; canPublishSources: string[] } };
    };

    const ownerClaims = await grant(owner.token);
    expect(ownerClaims).toMatchObject({ sub: owner.userId, name: 'Owner', video: { room: room.id } });
    expect(ownerClaims.video.canPublishSources.sort()).toEqual(['microphone', 'screen_share', 'screen_share_audio']);

    const memberClaims = await grant(member.token);
    expect(memberClaims.video.canPublishSources).toEqual(['microphone']);

    expect((await server.api('POST', `/api/rooms/${room.id}/voice`, { token: outsider.token })).body).toEqual({ error: 'room_not_joined' });
  });
});
