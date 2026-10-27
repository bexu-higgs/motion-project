import { useState } from 'react';
import { ROOM_MAX_CAPACITY, ROOM_MIN_CAPACITY, ROOM_NAME_MAX_LENGTH, clampCapacity, type RoomInfo } from '@birge/shared';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { Button, ErrorBanner, TextField } from '@/components/ui';
import { useT } from '@/i18n';
import { api, toErrorCode } from '@/lib/api';

export function RoomSettingsSheet({ room, visible, onClose }: { room: RoomInfo; visible: boolean; onClose(): void }) {
  const t = useT();
  const toast = useToast();
  const [name, setName] = useState(room.name);
  const [capacity, setCapacity] = useState(String(room.capacity));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/api/rooms/${room.id}`, { name, capacity: clampCapacity(Number(capacity)) });
      toast(t('settings.saved'));
      onClose();
    } catch (err) {
      setError(t(`errors.${toErrorCode(err)}`));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('room.settings')} closeLabel={t('common.close')}>
      <TextField label={t('createRoom.nameLabel')} value={name} onChangeText={setName} maxLength={ROOM_NAME_MAX_LENGTH} />
      <TextField
        label={t('createRoom.capacityLabel')}
        hint={t('createRoom.capacityHint')}
        value={capacity}
        onChangeText={(v) => setCapacity(v.replace(/\D/g, '').slice(0, 2))}
        keyboardType="number-pad"
        maxLength={2}
        error={Number(capacity) < ROOM_MIN_CAPACITY || Number(capacity) > ROOM_MAX_CAPACITY ? t('createRoom.capacityHint') : null}
      />
      <ErrorBanner message={error} />
      <Button title={t('common.save')} onPress={() => void save()} loading={busy} disabled={!name.trim()} />
    </Sheet>
  );
}
