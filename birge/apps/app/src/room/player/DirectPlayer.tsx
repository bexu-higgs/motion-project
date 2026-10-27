import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import type { PlayerHandle, PlayerProps } from './types';

/** iOS/Android: бейне, аудио және HLS — expo-video (AVPlayer / ExoPlayer). */
export function DirectPlayer({ item, ref, onReady, onEnded, onError }: PlayerProps) {
  const viewRef = useRef<VideoView>(null);
  const player = useVideoPlayer(
    { uri: item.src, contentType: item.hls ? 'hls' : 'auto', metadata: { title: item.title, artist: 'Birge' } },
    (p) => {
      p.timeUpdateEventInterval = 0.5;
      // Дауыстық чатпен (WebRTC) қатар ойнау үшін.
      p.audioMixingMode = 'mixWithOthers';
      p.staysActiveInBackground = item.mediaType === 'audio';
      p.loop = false;
    },
  );

  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'readyToPlay') onReady();
    if (status === 'error') onError();
  });
  useEventListener(player, 'playToEnd', () => onEnded());

  useImperativeHandle(
    ref,
    (): PlayerHandle => ({
      canAdjustRate: true,
      getCurrentTime: () => player.currentTime,
      getDuration: () => player.duration,
      isPlaying: () => player.playing,
      play: () => player.play(),
      pause: () => player.pause(),
      seekTo: (seconds) => {
        player.currentTime = seconds;
      },
      setRate: (rate) => {
        if (Math.abs(player.playbackRate - rate) > 0.001) player.playbackRate = rate;
      },
      setMuted: (muted) => {
        player.muted = muted;
      },
      enterFullscreen: () => void viewRef.current?.enterFullscreen(),
    }),
    [player],
  );

  return (
    <VideoView
      ref={viewRef}
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
      nativeControls={false}
      allowsPictureInPicture
      fullscreenOptions={{ enable: true }}
    />
  );
}
