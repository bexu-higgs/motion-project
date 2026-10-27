import { Ionicons } from '@expo/vector-icons';
import { useRef, type ComponentRef } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { nextItemId, type ClockSync, type Member } from '@birge/shared';
import { Button } from '@/components/ui';
import { useT } from '@/i18n';
import { colors, font, radius, space } from '@/theme';
import { SyncedPlayer } from './player/SyncedPlayer';
import type { RoomActions, RoomState } from './useRoom';
import { ScreenShareView } from './voice/ScreenShareView';
import { useVoice } from './voice/VoiceProvider';

/** Бөлменің «экраны»: синхронды ойнатқыш, бөлісілген қойынды немесе бос күй. */
export function MediaStage({
  state,
  clock,
  canControl,
  meId,
  actions,
  origin,
  onAddMedia,
}: {
  state: RoomState;
  clock: ClockSync;
  canControl: boolean;
  meId: string;
  actions: RoomActions;
  origin: string;
  onAddMedia(): void;
}) {
  const t = useT();
  const voice = useVoice();
  const containerRef = useRef<ComponentRef<typeof View>>(null);
  const { share, playback, queue, members } = state;
  const item = playback?.itemId ? queue.find((q) => q.id === playback.itemId) : undefined;
  const next = nextItemId(
    queue.map((q) => q.id),
    playback?.itemId ?? null,
  );

  const fullscreen = () => {
    if (Platform.OS !== 'web') return;
    const el = containerRef.current as unknown as HTMLElement | null;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el?.requestFullscreen?.().catch(() => undefined);
  };

  if (share) {
    const sharer = members.find((m: Member) => m.id === share.userId);
    const mine = share.userId === meId;
    return (
      <View ref={containerRef} style={styles.column}>
        <View style={styles.stage} testID="share-stage">
          {voice.share ? (
            <ScreenShareView share={voice.share} />
          ) : (
            <View style={styles.center}>
              {voice.status === 'connecting' ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Ionicons name="desktop-outline" size={36} color={colors.textMuted} />
              )}
              <Text style={styles.centerText}>{voice.available ? t('room.shareLoading') : t('room.shareNeedsVoice')}</Text>
            </View>
          )}
        </View>
        <View style={styles.shareBar}>
          <View style={styles.liveDot} />
          <Text style={styles.shareText} numberOfLines={1}>
            {mine ? t('room.youAreSharing') : t('room.sharing', { name: sharer?.displayName ?? '' })}
          </Text>
          {Platform.OS === 'web' ? (
            <Button compact variant="ghost" icon="expand" title={t('room.fullscreen')} onPress={fullscreen} />
          ) : null}
          {mine || canControl ? (
            <Button
              testID="stop-share"
              compact
              variant="danger"
              icon="stop-circle-outline"
              title={t('room.stopSharing')}
              onPress={() => {
                if (mine) void voice.stopScreenShare();
                void actions.setShare(false);
              }}
            />
          ) : null}
        </View>
      </View>
    );
  }

  if (item && playback) {
    return (
      <View ref={containerRef} style={styles.column}>
        <SyncedPlayer
          item={item}
          playback={playback}
          clock={clock}
          canControl={canControl}
          hasNext={Boolean(next)}
          origin={origin}
          onControl={(action, position) => void actions.control(action, position)}
          onEnded={(itemId, seq) => actions.ended(itemId, seq)}
          onNext={() => next && void actions.select(next)}
          onFullscreen={fullscreen}
        />
      </View>
    );
  }

  return (
    <View style={[styles.stage, styles.empty]} testID="empty-stage">
      <Ionicons name="film-outline" size={40} color={colors.textFaint} />
      <Text style={styles.emptyTitle}>{t('room.nothingPlaying')}</Text>
      <Text style={styles.emptyText}>{canControl ? t('room.nothingPlayingAdmin') : t('room.nothingPlayingMember')}</Text>
      {canControl ? <Button testID="stage-add-media" compact icon="add" title={t('room.addMedia')} onPress={onAddMedia} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { gap: space.sm, backgroundColor: colors.bg },
  stage: { width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.black, borderRadius: radius.md, overflow: 'hidden' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: space.sm },
  centerText: { color: colors.textMuted, fontSize: font.small, textAlign: 'center', paddingHorizontal: space.lg },
  shareBar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.xs },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.danger },
  shareText: { color: colors.text, flex: 1, fontWeight: '600' },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    padding: space.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: { color: colors.text, fontSize: font.h3, fontWeight: '700', textAlign: 'center' },
  emptyText: { color: colors.textMuted, fontSize: font.small, textAlign: 'center', maxWidth: 360 },
});
