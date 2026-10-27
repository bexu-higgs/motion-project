import type { AccountService } from './accounts';
import type { OAuthService } from './auth/oauth';
import type { AuthService } from './auth/service';
import type { Config } from './config';
import type { Db } from './db';
import type { MediaStore } from './media/store';
import type { ModerationService } from './moderation/service';
import type { Logger, Notifier } from './notify';
import type { RoomHub } from './rooms/hub';
import type { RoomRepo } from './rooms/repo';
import type { VoiceService } from './voice/livekit';

export interface Services {
  config: Config;
  db: Db;
  log: Logger;
  notifier: Notifier;
  auth: AuthService;
  oauth: OAuthService;
  rooms: RoomRepo;
  hub: RoomHub;
  media: MediaStore;
  voice: VoiceService;
  moderation: ModerationService;
  accounts: AccountService;
}
