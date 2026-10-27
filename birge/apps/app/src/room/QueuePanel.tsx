import { Ionicons } from '@expo/vector-icons';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import type { PlaybackState, QueueItem } from '@birge/shared';
import { Button, IconButton, type IconName } from '@/components/ui';
import { useT } from '@/i18n';
import { colors, font, radius, space } from '@/theme';

function iconFor(item: QueueItem): IconName {
  if (item.kind === 'youtube') return 'logo-youtube';
  if (item.mediaType === 'audio') return 'musical-notes';
  return item.kind === 'upload' ? 'cloud-done-outline' : 'film-outline';
}

export function QueuePanel({
  queue,
  playback,
  canControl,
  onPlay,
  onRemove,
  onAdd,
}: {
  queue: QueueItem[];
  playback: PlaybackState | null;
  canControl: boolean;
  onPlay(itemId: string): void;
  onRemove(itemId: string): void;
  onAdd(): void;
}) {
  const t = useT();
  return (
    <FlatList
      testID="queue-list"
      data={queue}
      keyExtractor={(q) => q.id}
      contentContainerStyle={{ padding: space.sm, gap: space.xs }}
      ListHeaderComponent={
        canControl ? (
          <Button
            testID="queue-add"
            compact
            variant="secondary"
            icon="add"
            title={t('room.addMedia')}
            onPress={onAdd}
            style={{ marginBottom: space.sm }}
          />
        ) : undefined
      }
      ListEmptyComponent={<Text style={styles.empty}>{t('media.queueEmpty')}</Text>}
      renderItem={({ item, index }) => {
        const current = playback?.itemId === item.id;
        return (
          <View style={[styles.row, current && styles.current]}>
            <Text style={styles.index}>{index + 1}</Text>
            <Ionicons name={iconFor(item)} size={20} color={item.kind === 'youtube' ? '#FF3B30' : colors.textMuted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={2}>
                {item.title}
              </Text>
              {current ? <Text style={styles.now}>{t('media.nowPlaying')}</Text> : null}
            </View>
            {canControl && !current ? (
              <IconButton icon="play" label={t('media.playNow')} size={18} onPress={() => onPlay(item.id)} />
            ) : null}
            {canControl ? (
              <IconButton
                icon="trash-outline"
                label={t('media.remove')}
                size={18}
                color={colors.textFaint}
                onPress={() => onRemove(item.id)}
              />
            ) : null}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: space.xl, fontSize: font.small },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  current: { backgroundColor: colors.primarySoft },
  index: { color: colors.textFaint, width: 18, textAlign: 'center', fontSize: font.small },
  title: { color: colors.text, fontSize: font.small + 1, fontWeight: '600' },
  now: { color: colors.primary, fontSize: font.tiny, fontWeight: '700', marginTop: 2 },
});
