import type { Track } from 'livekit-client';

export function preparePlatform(): void {}
export async function startAudioSession(): Promise<void> {}
export async function stopAudioSession(): Promise<void> {}

const attached = new Map<string, HTMLMediaElement[]>();

/** Вебте әр қашықтағы аудио трек жасырын <audio> элементі арқылы ойнайды. */
export function attachAudio(track: Track): void {
  const key = track.sid ?? String(track.mediaStreamTrack?.id);
  if (attached.has(key)) return;
  const element = track.attach();
  element.style.display = 'none';
  document.body.appendChild(element);
  attached.set(key, [element]);
}

export function detachAudio(track: Track): void {
  const key = track.sid ?? String(track.mediaStreamTrack?.id);
  for (const el of track.detach()) el.remove();
  for (const el of attached.get(key) ?? []) el.remove();
  attached.delete(key);
}

/** Браузер қойындысын бөлісу тек компьютердегі браузерлерде бар. */
export const supportsScreenShare =
  typeof navigator !== 'undefined' &&
  Boolean(navigator.mediaDevices && 'getDisplayMedia' in navigator.mediaDevices) &&
  !/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

export async function ensureMicPermission(): Promise<boolean> {
  return true;
}
