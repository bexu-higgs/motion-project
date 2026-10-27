import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  decideSync,
  formatDuration,
  positionAt,
  type ClockSync,
  type PlaybackAction,
  type PlaybackState,
  type QueueItem,
} from '@birge/shared';
import { IconButton } from '@/components/ui';
import { useI18n } from '@/i18n';
import { colors, font, radius, space } from '@/theme';
import { DirectPlayer } from './DirectPlayer';
import { SeekBar } from './SeekBar';
import type { PlayerHandle } from './types';
import { YouTubePlayer } from './YouTubePlayer';

const TICK_MS = 1000;
const SEEK_COOLDOWN_MS = 3000;

interface Props {
  item: QueueItem;
  playback: PlaybackState;
  clock: ClockSync;
  canControl: boolean;
  hasNext: boolean;
  origin: string;
  onControl(action: PlaybackAction, position: number): void;
  onEnded(itemId: string, seq: number): void;
  onNext(): void;
  onFullscreen(): void;
}

/**
 * Ойнатқышты сервердегі күйге үнемі «тартып» отырады:
 * кішкене алшақтықта жылдамдықты сәл өзгертеді, үлкенінде секіреді.
 * Ойнатуды тек әкімшілер басқарады — қалғандардың ойнатқышы соларға еседі.
 */
export function SyncedPlayer({ item, playback, clock, canControl, hasNext, origin, onControl, onEnded, onNext, onFullscreen }: Props) {
  const { t, locale } = useI18n();
  const playerRef = useRef<PlayerHandle | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [needsUnmute, setNeedsUnmute] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState({ position: 0, duration: 0 });
  const [syncing, setSyncing] = useState(false);
  const lastSeek = useRef(0);
  const stalledTicks = useRef(0);
  const playbackRef = useRef(playback);
  const mutedRef = useRef(muted);

  useEffect(() => {
    playbackRef.current = playback;
    mutedRef.current = muted;
  });

  const handleAutoplayBlocked = useCallback(() => {
    // Браузер дыбыспен бастауға рұқсат бермеді: дыбыссыз ойнатып, қосуды ұсынамыз.
    playerRef.current?.setMuted(true);
    playerRef.current?.play();
    setNeedsUnmute(true);
  }, []);

  const tick = useCallback(() => {
    const player = playerRef.current;
    const pb = playbackRef.current;
    if (!player || !ready || pb.itemId !== item.id) return;
    const expected = positionAt(pb, clock.serverNow());
    const actual = player.getCurrentTime();
    const now = Date.now();

    if (pb.status === 'paused') {
      if (player.isPlaying()) player.pause();
      if (Math.abs(actual - expected) > 0.5 && now - lastSeek.current > 500) {
        player.seekTo(expected);
        lastSeek.current = now;
      }
      if (player.canAdjustRate) player.setRate(1);
      setSyncing(false);
      setProgress({ position: expected, duration: player.getDuration() });
      return;
    }

    if (!player.isPlaying()) {
      player.play();
      stalledTicks.current += 1;
      // Вебте YouTube автоматты ойнатуды үнсіз бұғаттауы мүмкін.
      if (Platform.OS === 'web' && stalledTicks.current >= 4 && !mutedRef.current) {
        stalledTicks.current = 0;
        handleAutoplayBlocked();
      }
    } else {
      stalledTicks.current = 0;
    }

    const decision = decideSync(actual, expected, { canAdjustRate: player.canAdjustRate, baseRate: pb.rate });
    if (decision.kind === 'seek' && now - lastSeek.current > SEEK_COOLDOWN_MS) {
      player.seekTo(decision.position);
      lastSeek.current = now;
    }
    if (player.canAdjustRate) player.setRate(decision.rate);
    setSyncing(decision.kind !== 'none');
    setProgress({ position: actual, duration: player.getDuration() });
  }, [clock, handleAutoplayBlocked, item.id, ready]);

  useEffect(() => {
    tick();
    const timer = setInterval(tick, TICK_MS);
    return () => clearInterval(timer);
  }, [tick, playback]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setNeedsUnmute(false);
    playerRef.current?.setMuted(next);
    if (!next) playerRef.current?.play();
  };

  const unmute = () => {
    setNeedsUnmute(false);
    setMuted(false);
    playerRef.current?.setMuted(false);
    if (playbackRef.current.status === 'playing') playerRef.current?.play();
  };

  const playing = playback.status === 'playing';
  const current = progress.position;
  const PlayerComponent = item.kind === 'youtube' ? YouTubePlayer : DirectPlayer;

  return (
    <View style={styles.wrap}>
      <View style={styles.stage} testID="player-stage">
        <PlayerComponent
          key={item.id}
          ref={playerRef}
          item={item}
          origin={origin}
          locale={locale}
          onReady={() => {
            setReady(true);
            setFailed(false);
          }}
          onEnded={() => {
            if (canControl && playbackRef.current.itemId === item.id) onEnded(item.id, playbackRef.current.seq);
          }}
          onError={() => setFailed(true)}
          onAutoplayBlocked={handleAutoplayBlocked}
        />
        {item.mediaType === 'audio' && item.kind !== 'youtube' ? (
          <View style={styles.artwork} pointerEvents="none">
            <View style={styles.disc}>
              <Ionicons name="musical-notes" size={44} color={colors.white} />
            </View>
            <Text style={styles.artworkTitle} numberOfLines={2}>
              {item.title}
            </Text>
          </View>
        ) : null}
        {failed && item.kind !== 'youtube' ? (
          <View style={styles.center} pointerEvents="none">
            <Ionicons name="warning-outline" size={32} color={colors.warning} />
            <Text style={styles.centerText}>{t('room.playbackError')}</Text>
          </View>
        ) : null}
      </View>

      {/* Басқару панелі ойнатқыштың астында (YouTube ойнатқышын ештеңе жаппауы керек). */}
      {needsUnmute ? (
        <Pressable testID="unmute" accessibilityRole="button" onPress={unmute} style={styles.unmute}>
          <Ionicons name="volume-high" size={18} color={colors.white} />
          <Text style={styles.unmuteText}>{t('room.tapForSound')}</Text>
        </Pressable>
      ) : null}
      {failed && item.kind === 'youtube' ? <Text style={styles.errorLine}>{t('room.playbackError')}</Text> : null}

      <View style={styles.controls}>
        <SeekBar
          position={current}
          duration={progress.duration}
          disabled={!canControl}
          label={item.title}
          onSeek={(seconds) => {
            playerRef.current?.seekTo(seconds);
            lastSeek.current = Date.now();
            setProgress((p) => ({ ...p, position: seconds }));
            onControl('seek', seconds);
          }}
        />
        <View style={styles.row}>
          {canControl ? (
            <IconButton
              testID="play-pause"
              icon={playing ? 'pause' : 'play'}
              label={playing ? t('room.pause') : t('room.play')}
              size={26}
              onPress={() => {
                const position = playerRef.current?.getCurrentTime() ?? 0;
                if (playing) playerRef.current?.pause();
                else playerRef.current?.play();
                onControl(playing ? 'pause' : 'play', position);
              }}
            />
          ) : null}
          {canControl && hasNext ? <IconButton icon="play-skip-forward" label={t('room.next')} onPress={onNext} /> : null}
          <Text style={styles.time} testID="playback-time">
            {formatDuration(current)} / {formatDuration(progress.duration)}
          </Text>
          <View style={{ flex: 1 }} />
          <View style={[styles.pill, syncing && styles.pillSyncing]}>
            <View style={[styles.dot, { backgroundColor: syncing ? colors.warning : colors.success }]} />
            <Text style={styles.pillText}>{syncing ? t('room.syncing') : t('room.synced')}</Text>
          </View>
          <IconButton icon={muted ? 'volume-mute' : 'volume-high'} label={t('room.tapForSound')} onPress={toggleMute} />
          {item.kind !== 'youtube' || Platform.OS === 'web' ? (
            <IconButton
              icon="expand"
              label={t('room.fullscreen')}
              onPress={() => (Platform.OS === 'web' ? onFullscreen() : playerRef.current?.enterFullscreen?.())}
            />
          ) : null}
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  stage: { width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.black, overflow: 'hidden', borderRadius: radius.md },
  artwork: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: space.md, backgroundColor: '#120F24' },
  disc: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  artworkTitle: { color: colors.text, fontSize: font.h3, fontWeight: '700', paddingHorizontal: space.xl, textAlign: 'center' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: space.sm, backgroundColor: 'rgba(0,0,0,0.6)' },
  centerText: { color: colors.text, fontSize: font.small },
  unmute: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    alignSelf: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
  },
  unmuteText: { color: colors.white, fontWeight: '700' },
  errorLine: { color: colors.warning, textAlign: 'center', fontSize: font.small },
  controls: { paddingHorizontal: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  time: { color: colors.textMuted, fontSize: font.small, fontVariant: ['tabular-nums'], marginLeft: space.xs },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(51,214,159,0.12)',
  },
  pillSyncing: { backgroundColor: 'rgba(255,181,71,0.14)' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { color: colors.textMuted, fontSize: font.tiny },
  title: { color: colors.text, fontSize: font.h3, fontWeight: '700', marginTop: space.xs },
});
