import { AndroidAudioTypePresets, AudioSession, registerGlobals } from '@livekit/react-native';
import type { Track } from 'livekit-client';
import { PermissionsAndroid, Platform } from 'react-native';

let registered = false;

/** iOS/Android: WebRTC глобалдарын тіркеп, аудио сессиясын баптаймыз. */
export function preparePlatform(): void {
  if (registered) return;
  registerGlobals();
  registered = true;
}

export async function startAudioSession(): Promise<void> {
  await AudioSession.configureAudio({
    android: {
      preferredOutputList: ['bluetooth', 'headset', 'speaker', 'earpiece'],
      audioTypeOptions: AndroidAudioTypePresets.communication,
    },
    ios: { defaultOutput: 'speaker' },
  });
  await AudioSession.startAudioSession();
}

export async function stopAudioSession(): Promise<void> {
  await AudioSession.stopAudioSession();
}

/** Нативте қашықтағы дыбыс өздігінен ойнайды. */
export function attachAudio(_track: Track): void {}
export function detachAudio(_track: Track): void {}

export const supportsScreenShare = false;

/** Android-та микрофон рұқсатын алдын ала сұраймыз; iOS-та жүйе өзі сұрайды. */
export async function ensureMicPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}
