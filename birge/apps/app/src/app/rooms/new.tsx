import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ROOM_MAX_CAPACITY, ROOM_MIN_CAPACITY, ROOM_NAME_MAX_LENGTH, clampCapacity, type RoomInfo } from '@birge/shared';
import { Body, Button, ErrorBanner, IconButton, Screen, TextField } from '@/components/ui';
import { useT } from '@/i18n';
import { api, toErrorCode } from '@/lib/api';
import { colors, font, radius, space } from '@/theme';

const PRESETS = [2, 5, 10, 20, 30, 50];

export default function NewRoomScreen() {
  const t = useT();
  const router = useRouter();
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const room = await api.post<RoomInfo>('/api/rooms', { name, capacity });
      router.replace({ pathname: '/room/[id]', params: { id: room.id } });
    } catch (err) {
      setError(t(`errors.${toErrorCode(err)}`));
      setBusy(false);
    }
  };

  return (
    <Screen maxWidth={520}>
      <TextField
        testID="room-name"
        label={t('createRoom.nameLabel')}
        placeholder={t('createRoom.namePlaceholder')}
        value={name}
        onChangeText={setName}
        maxLength={ROOM_NAME_MAX_LENGTH}
        autoFocus
      />
      <View style={{ gap: space.sm }}>
        <Text style={styles.label}>{t('createRoom.capacityLabel')}</Text>
        <View style={styles.stepper}>
          <IconButton
            icon="remove"
            label="-"
            onPress={() => setCapacity((c) => clampCapacity(c - 1))}
            disabled={capacity <= ROOM_MIN_CAPACITY}
          />
          <Text testID="capacity-value" style={styles.capacity}>
            {capacity}
          </Text>
          <IconButton
            icon="add"
            label="+"
            onPress={() => setCapacity((c) => clampCapacity(c + 1))}
            disabled={capacity >= ROOM_MAX_CAPACITY}
          />
        </View>
        <View style={styles.presets}>
          {PRESETS.map((n) => (
            <Pressable
              key={n}
              accessibilityRole="button"
              onPress={() => setCapacity(n)}
              style={[styles.preset, capacity === n && styles.presetActive]}
            >
              <Text style={[styles.presetText, capacity === n && { color: colors.white }]}>{n}</Text>
            </Pressable>
          ))}
        </View>
        <Body muted style={{ fontSize: font.small }}>
          {t('createRoom.capacityHint')}
        </Body>
      </View>
      <ErrorBanner message={error} />
      <Button
        testID="create-room-submit"
        title={t('createRoom.submit')}
        icon="film-outline"
        onPress={() => void create()}
        loading={busy}
        disabled={!name.trim()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.textMuted, fontSize: font.small, fontWeight: '600' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.sm,
  },
  capacity: { color: colors.text, fontSize: 28, fontWeight: '800' },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  preset: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  presetActive: { backgroundColor: colors.primary },
  presetText: { color: colors.textMuted, fontWeight: '700' },
});
