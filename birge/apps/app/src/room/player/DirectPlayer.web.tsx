import { useEffect, useImperativeHandle, useRef } from 'react';
import type { PlayerHandle, PlayerProps } from './types';

/** Веб: <video> элементі; HLS (.m3u8) браузер өзі ойната алмаса — hls.js. */
export function DirectPlayer({ item, ref, onReady, onEnded, onError, onAutoplayBlocked }: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let destroyed = false;
    let hls: { destroy(): void } | null = null;
    if (item.hls && !video.canPlayType('application/vnd.apple.mpegurl')) {
      void import('hls.js').then(({ default: Hls }) => {
        if (destroyed) return;
        if (!Hls.isSupported()) return onError();
        const instance = new Hls({ enableWorker: true });
        instance.on(Hls.Events.ERROR, (_e, data) => {
          if (data.fatal) onError();
        });
        instance.loadSource(item.src);
        instance.attachMedia(video);
        hls = instance;
      });
    } else {
      video.src = item.src;
    }
    return () => {
      destroyed = true;
      hls?.destroy();
      video.removeAttribute('src');
      video.load();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.src, item.hls]);

  useImperativeHandle(
    ref,
    (): PlayerHandle => ({
      canAdjustRate: true,
      getCurrentTime: () => videoRef.current?.currentTime ?? 0,
      getDuration: () => {
        const d = videoRef.current?.duration ?? 0;
        return Number.isFinite(d) ? d : 0;
      },
      isPlaying: () => {
        const v = videoRef.current;
        return Boolean(v && !v.paused && !v.ended);
      },
      play: () => {
        const v = videoRef.current;
        if (!v) return;
        v.play().catch((err: DOMException) => {
          if (err?.name === 'NotAllowedError') onAutoplayBlocked();
        });
      },
      pause: () => videoRef.current?.pause(),
      seekTo: (seconds) => {
        if (videoRef.current) videoRef.current.currentTime = seconds;
      },
      setRate: (rate) => {
        const v = videoRef.current;
        if (v && Math.abs(v.playbackRate - rate) > 0.001) v.playbackRate = rate;
      },
      setMuted: (muted) => {
        if (videoRef.current) videoRef.current.muted = muted;
      },
      enterFullscreen: () => {
        const v = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
        const container = v?.parentElement?.parentElement;
        if (container?.requestFullscreen) void container.requestFullscreen().catch(() => v?.webkitEnterFullscreen?.());
        else v?.webkitEnterFullscreen?.();
      },
    }),
    [onAutoplayBlocked],
  );

  return (
    <video
      ref={videoRef}
      data-testid="media-video"
      playsInline
      preload="auto"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
      onLoadedMetadata={() => onReady()}
      onEnded={() => onEnded()}
      onError={() => onError()}
    />
  );
}
