import type { OAuthService } from './auth/oauth';
import type { AuthService } from './auth/service';
import type { Db } from './db';
import type { MediaStore } from './media/store';
import type { ModerationService } from './moderation/service';
import type { RoomHub } from './rooms/hub';
import type { RoomRepo } from './rooms/repo';

/** Аккаунтты толық жою (App Store 5.1.1(v), Google Play «Account deletion» талабы). */
export class AccountService {
  constructor(
    private readonly db: Db,
    private readonly auth: AuthService,
    private readonly oauth: OAuthService,
    private readonly rooms: RoomRepo,
    private readonly hub: RoomHub,
    private readonly media: MediaStore,
    private readonly moderation: ModerationService,
  ) {}

  async closeRoom(roomId: string): Promise<void> {
    await this.hub.roomDeleted(roomId);
    await this.media.deleteFiles(await this.rooms.delete(roomId));
  }

  async deleteAccount(userId: string): Promise<void> {
    // 1. Иесі болған бөлмелер жабылады (ішіндегі файлдармен бірге).
    for (const roomId of await this.rooms.ownedRoomIds(userId)) await this.closeRoom(roomId);

    // 2. Басқа бөлмелерге жүктеген файлдары да өшіріледі.
    const { rows: uploads } = await this.db.query<{ id: string; room_id: string }>('SELECT id, room_id FROM uploads WHERE user_id = $1', [
      userId,
    ]);
    if (uploads.length) {
      await this.db.query('DELETE FROM uploads WHERE user_id = $1', [userId]);
      await this.media.deleteFiles(uploads.map((u) => u.id));
      for (const roomId of new Set(uploads.map((u) => u.room_id))) await this.hub.queueChanged(roomId).catch(() => undefined);
    }

    // 3. Sign in with Apple токендерін қайтарып аламыз.
    await this.oauth.revokeApple(userId);

    // 4. Қолданушы мен оған байланысты деректер (сессиялар, хабарламалар, мүшеліктер) өшіріледі.
    const memberRooms = await this.rooms.memberRoomIds(userId);
    await this.db.query('DELETE FROM users WHERE id = $1', [userId]);
    this.hub.endUserSessions(userId);
    for (const roomId of memberRooms) await this.hub.userRemoved(roomId, userId, 'left').catch(() => undefined);
  }

  async banUser(userId: string): Promise<void> {
    await this.moderation.banUser(userId);
    this.hub.endUserSessions(userId);
    for (const roomId of await this.rooms.ownedRoomIds(userId)) await this.closeRoom(roomId);
  }

  async logoutEverywhere(userId: string): Promise<void> {
    await this.auth.revokeAllSessions(userId);
    this.hub.endUserSessions(userId);
  }
}
