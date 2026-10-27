import { useEffect, useImperativeHandle, useRef } from 'react';
import type { PlayerHandle, PlayerProps } from './types';
import { YT_PLAYER_VARS, YT_STATE } from './youtube';

interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  mute(): void;
  unMute(): void;
  destroy(): void;
}

declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement, options: unknown) => YTPlayer };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;
function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (!apiPromise) {
    apiPromise = new Promise((resolve) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve();
      };
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    });
  }
  return apiPromise;
}

/** Веб: YouTube-тың ресми IFrame API ойнатқышы. */
export function YouTubePlayer({ item, ref, origin, locale, onReady, onEnded, onError }: PlayerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const callbacks = useRef({ onReady, onEnded, onError });
  useEffect(() => {
    callbacks.current = { onReady, onEnded, onError };
  });

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;
    const mount = document.createElement('div');
    host.appendChild(mount);
    void loadYouTubeApi().then(() => {
      if (cancelled || !window.YT) return;
      playerRef.current = new window.YT.Player(mount, {
        videoId: item.src,
        width: '100%',
        height: '100%',
        playerVars: { ...YT_PLAYER_VARS, origin: origin || window.location.origin, hl: locale },
        events: {
          onReady: () => callbacks.current.onReady(),
          onStateChange: (e: { data: number }) => {
            if (e.data === YT_STATE.ENDED) callbacks.current.onEnded();
          },
          onError: () => callbacks.current.onError(),
        },
      });
    });
    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
      host.innerHTML = '';
    };
  }, [item.src, origin, locale]);

  useImperativeHandle(
    ref,
    (): PlayerHandle => ({
      canAdjustRate: false,
      getCurrentTime: () => playerRef.current?.getCurrentTime?.() ?? 0,
      getDuration: () => playerRef.current?.getDuration?.() ?? 0,
      isPlaying: () => {
        const state = playerRef.current?.getPlayerState?.();
        return state === YT_STATE.PLAYING || state === YT_STATE.BUFFERING;
      },
      play: () => playerRef.current?.playVideo?.(),
      pause: () => playerRef.current?.pauseVideo?.(),
      seekTo: (seconds) => playerRef.current?.seekTo?.(seconds, true),
      setRate: () => undefined,
      setMuted: (muted) => (muted ? playerRef.current?.mute?.() : playerRef.current?.unMute?.()),
    }),
    [],
  );

  return (
    <div
      ref={hostRef}
      data-testid="youtube-player"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: '#000' }}
    />
  );
}
