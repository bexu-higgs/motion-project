import { AccessToken, RoomServiceClient, TrackSource } from 'livekit-server-sdk';
import { canControl, type Role, type VoiceCredentials } from '@birge/shared';
import type { Config } from '../config';
import { AppError } from '../lib/errors';
import type { Logger } from '../notify';

/** Әкімшілер браузер қойындысын дыбысымен бөлісе алады, қалғандары — тек микрофон. */
function sourcesFor(role: Role): TrackSource[] {
  return canControl(role) ? [TrackSource.MICROPHONE, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO] : [TrackSource.MICROPHONE];
}

/** LiveKit SFU арқылы дауыстық чат (50 адамға дейін) және экранды бөлісу. */
export class VoiceService {
  private readonly client: RoomServiceClient | null;

  constructor(
    private readonly config: Config,
    private readonly log: Logger,
  ) {
    const lk = config.livekit;
    this.client = lk ? new RoomServiceClient(lk.apiUrl, lk.apiKey, lk.apiSecret) : null;
  }

  get enabled(): boolean {
    return Boolean(this.config.livekit);
  }

  async token(roomId: string, user: { id: string; displayName: string }, role: Role): Promise<VoiceCredentials> {
    const lk = this.config.livekit;
    if (!lk) throw new AppError('voice_unavailable');
    const at = new AccessToken(lk.apiKey, lk.apiSecret, { identity: user.id, name: user.displayName, ttl: '6h' });
    at.addGrant({
      roomJoin: true,
      room: roomId,
      canSubscribe: true,
      canPublish: true,
      canPublishData: false,
      canPublishSources: sourcesFor(role),
    });
    return { url: lk.url, token: await at.toJwt() };
  }

  private async safely(action: string, fn: (client: RoomServiceClient) => Promise<unknown>): Promise<void> {
    if (!this.client) return;
    try {
      await fn(this.client);
    } catch (err) {
      // Қатысушы дауысқа қосылмаған болуы мүмкін — бұл қалыпты жағдай.
      this.log.info({ err: (err as Error).message, action }, 'LiveKit request skipped');
    }
  }

  /** Шығарылған адам бұрын алған токенімен қайта қосыла алмасын — токендерін де жарамсыз етеміз. */
  removeParticipant(roomId: string, userId: string): Promise<void> {
    return this.safely('removeParticipant', (c) =>
      c.removeParticipant(roomId, userId, { revokeTokenTs: BigInt(Math.floor(Date.now() / 1000)) }),
    );
  }

  updateRole(roomId: string, userId: string, role: Role): Promise<void> {
    return this.safely('updateParticipant', (c) =>
      c.updateParticipant(roomId, userId, {
        permission: { canSubscribe: true, canPublish: true, canPublishData: false, canPublishSources: sourcesFor(role) },
      }),
    );
  }

  muteMicrophone(roomId: string, userId: string): Promise<void> {
    return this.safely('mute', async (c) => {
      const participant = await c.getParticipant(roomId, userId);
      for (const track of participant.tracks) {
        if (track.source === TrackSource.MICROPHONE && !track.muted) {
          await c.mutePublishedTrack(roomId, userId, track.sid, true);
        }
      }
    });
  }

  deleteRoom(roomId: string): Promise<void> {
    return this.safely('deleteRoom', (c) => c.deleteRoom(roomId));
  }
}
