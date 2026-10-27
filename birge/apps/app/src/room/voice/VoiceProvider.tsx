import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AudioPresets,
  ConnectionState,
  Room,
  RoomEvent,
  Track,
  VideoPresets,
  type Participant,
  type RemoteTrack,
  type TrackPublication,
} from 'livekit-client';
import type { VoiceCredentials } from '@birge/shared';
import { api, toErrorCode, type ClientErrorCode } from '@/lib/api';
import {
  attachAudio,
  detachAudio,
  ensureMicPermission,
  preparePlatform,
  startAudioSession,
  stopAudioSession,
  supportsScreenShare,
} from './platform';

export type VoiceStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface ShareTrackRef {
  participant: Participant;
  publication: TrackPublication;
  source: Track.Source;
}

interface VoiceValue {
  available: boolean;
  status: VoiceStatus;
  micEnabled: boolean;
  micBusy: boolean;
  /** Қазір сөйлеп тұрғандар (қолданушы ID). */
  speaking: ReadonlySet<string>;
  /** Микрофоны қосулы адамдар. */
  micOn: ReadonlySet<string>;
  canPlaybackAudio: boolean;
  share: ShareTrackRef | null;
  sharingLocally: boolean;
  supportsScreenShare: boolean;
  startAudio(): void;
  toggleMic(): Promise<ClientErrorCode | 'permission_denied' | null>;
  startScreenShare(): Promise<boolean>;
  stopScreenShare(): Promise<void>;
}

const VoiceContext = createContext<VoiceValue | null>(null);

interface Snapshot {
  micEnabled: boolean;
  speaking: Set<string>;
  micOn: Set<string>;
  canPlaybackAudio: boolean;
  share: ShareTrackRef | null;
  sharingLocally: boolean;
}

const EMPTY: Snapshot = {
  micEnabled: false,
  speaking: new Set(),
  micOn: new Set(),
  canPlaybackAudio: true,
  share: null,
  sharingLocally: false,
};

function micIsOn(p: Participant): boolean {
  const pub = p.getTrackPublication(Track.Source.Microphone);
  return Boolean(pub && !pub.isMuted);
}

/**
 * LiveKit (SFU) арқылы дауыстық чат. Бөлмеге кірген әр адам тыңдаушы ретінде қосылады,
 * микрофон тек өзі қосқанда ғана іске қосылады.
 */
export function VoiceProvider({
  roomId,
  enabled,
  blocked,
  onLocalShareEnded,
  children,
}: {
  roomId: string;
  enabled: boolean;
  blocked: ReadonlySet<string>;
  onLocalShareEnded(): void;
  children: ReactNode;
}) {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY);
  const [micBusy, setMicBusy] = useState(false);
  const roomRef = useRef<Room | null>(null);
  const blockedRef = useRef(blocked);
  const shareEndedRef = useRef(onLocalShareEnded);

  useEffect(() => {
    blockedRef.current = blocked;
    shareEndedRef.current = onLocalShareEnded;
  });

  const refresh = useCallback(() => {
    const room = roomRef.current;
    if (!room) return setSnapshot(EMPTY);
    const participants: Participant[] = [room.localParticipant, ...room.remoteParticipants.values()];
    let share: ShareTrackRef | null = null;
    for (const p of participants) {
      const pub = p.getTrackPublication(Track.Source.ScreenShare);
      if (pub?.track && !pub.isMuted) share = { participant: p, publication: pub, source: Track.Source.ScreenShare };
    }
    setSnapshot({
      micEnabled: room.localParticipant.isMicrophoneEnabled,
      speaking: new Set(room.activeSpeakers.map((p) => p.identity)),
      micOn: new Set(participants.filter(micIsOn).map((p) => p.identity)),
      canPlaybackAudio: room.canPlaybackAudio,
      share,
      sharingLocally: room.localParticipant.isScreenShareEnabled,
    });
  }, []);

  /** Бұғатталған адамдардың дауысын мүлдем қабылдамаймыз. */
  const applyBlocks = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    for (const p of room.remoteParticipants.values()) {
      const pub = p.getTrackPublication(Track.Source.Microphone);
      if (pub && 'setSubscribed' in pub) (pub as { setSubscribed(v: boolean): void }).setSubscribed(!blockedRef.current.has(p.identity));
    }
  }, []);

  useEffect(() => {
    applyBlocks();
  }, [blocked, applyBlocks]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    preparePlatform();
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    roomRef.current = room;

    const onSubscribed = (track: RemoteTrack) => {
      if (track.kind === Track.Kind.Audio) attachAudio(track);
      applyBlocks();
      refresh();
    };
    const onUnsubscribed = (track: RemoteTrack) => {
      if (track.kind === Track.Kind.Audio) detachAudio(track);
      refresh();
    };
    room
      .on(RoomEvent.TrackSubscribed, onSubscribed)
      .on(RoomEvent.TrackUnsubscribed, onUnsubscribed)
      .on(RoomEvent.TrackPublished, () => {
        applyBlocks();
        refresh();
      })
      .on(RoomEvent.TrackUnpublished, refresh)
      .on(RoomEvent.TrackMuted, refresh)
      .on(RoomEvent.TrackUnmuted, refresh)
      .on(RoomEvent.ParticipantConnected, refresh)
      .on(RoomEvent.ParticipantDisconnected, refresh)
      .on(RoomEvent.ActiveSpeakersChanged, refresh)
      .on(RoomEvent.AudioPlaybackStatusChanged, refresh)
      .on(RoomEvent.LocalTrackPublished, refresh)
      .on(RoomEvent.LocalTrackUnpublished, (pub) => {
        // Қолданушы браузердің «Бөлісуді тоқтату» батырмасын басқанда.
        if (pub.source === Track.Source.ScreenShare) shareEndedRef.current();
        refresh();
      })
      .on(RoomEvent.Reconnecting, () => setStatus('connecting'))
      .on(RoomEvent.Reconnected, () => {
        setStatus('connected');
        refresh();
      })
      .on(RoomEvent.Disconnected, () => {
        if (!cancelled) setStatus('error');
        refresh();
      });

    (async () => {
      setStatus('connecting');
      try {
        const creds = await api.post<VoiceCredentials>(`/api/rooms/${roomId}/voice`);
        if (cancelled) return;
        await startAudioSession();
        await room.connect(creds.url, creds.token, { autoSubscribe: true });
        if (cancelled) return;
        setStatus('connected');
        applyBlocks();
        refresh();
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      roomRef.current = null;
      void room.disconnect();
      void stopAudioSession().catch(() => undefined);
      setSnapshot(EMPTY);
      setStatus('idle');
    };
  }, [enabled, roomId, refresh, applyBlocks]);

  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return 'voice_unavailable' as const;
    setMicBusy(true);
    try {
      const next = !room.localParticipant.isMicrophoneEnabled;
      if (next && !(await ensureMicPermission())) return 'permission_denied' as const;
      await room.localParticipant.setMicrophoneEnabled(next);
      refresh();
      return null;
    } catch (err) {
      const name = (err as { name?: string }).name;
      if (name === 'NotAllowedError' || name === 'SecurityError') return 'permission_denied' as const;
      return toErrorCode(err);
    } finally {
      setMicBusy(false);
    }
  }, [refresh]);

  const startScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room || !supportsScreenShare) return false;
    try {
      // Фильм үшін: қозғалысқа бейімделген 1080p, дыбысы — жоғары сапалы стерео.
      await room.localParticipant.setScreenShareEnabled(
        true,
        {
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
          video: { displaySurface: 'browser' },
          selfBrowserSurface: 'exclude',
          surfaceSwitching: 'include',
          systemAudio: 'include',
          contentHint: 'motion',
          resolution: VideoPresets.h1080.resolution,
        },
        {
          screenShareEncoding: { maxBitrate: 4_500_000, maxFramerate: 30 },
          audioPreset: AudioPresets.musicHighQualityStereo,
          dtx: false,
          red: false,
        },
      );
      refresh();
      return room.localParticipant.isScreenShareEnabled;
    } catch {
      refresh();
      return false;
    }
  }, [refresh]);

  const stopScreenShare = useCallback(async () => {
    await roomRef.current?.localParticipant.setScreenShareEnabled(false).catch(() => undefined);
    refresh();
  }, [refresh]);

  const startAudio = useCallback(() => {
    void roomRef.current
      ?.startAudio()
      .then(refresh)
      .catch(() => undefined);
  }, [refresh]);

  const value = useMemo<VoiceValue>(
    () => ({
      available: enabled,
      status,
      micBusy,
      ...snapshot,
      supportsScreenShare,
      startAudio,
      toggleMic,
      startScreenShare,
      stopScreenShare,
    }),
    [enabled, status, micBusy, snapshot, startAudio, toggleMic, startScreenShare, stopScreenShare],
  );

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}

export function useVoice(): VoiceValue {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error('useVoice must be used inside VoiceProvider');
  return ctx;
}
