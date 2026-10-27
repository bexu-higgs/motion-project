import * as Clipboard from 'expo-clipboard';
import { Platform, Share, StyleSheet, Text, View } from 'react-native';
import type { RoomInfo } from '@birge/shared';
import { useAuth } from '@/auth/AuthProvider';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { Body, Button } from '@/components/ui';
import { useT } from '@/i18n';
import { apiBaseUrl } from '@/lib/api';
import { colors, font, radius, space } from '@/theme';

export function inviteLink(webUrl: string | undefined, code: string): string {
  const base = webUrl || (Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : apiBaseUrl());
  return `${base.replace(/\/+$/, '')}/join/${code}`;
}

export function InviteSheet({ room, visible, onClose }: { room: RoomInfo; visible: boolean; onClose(): void }) {
  const t = useT();
  const toast = useToast();
  const { config } = useAuth();
  const link = inviteLink(config?.webUrl, room.code);
  const message = t('room.inviteText', { name: room.name, link, code: room.code });

  const copy = async (value: string) => {
    await Clipboard.setStringAsync(value);
    toast(t('common.copied'));
  };

  const share = async () => {
    if (Platform.OS === 'web') {
      const nav = navigator as Navigator & { share?: (data: { text: string; url: string }) => Promise<void> };
      if (nav.share) {
        await nav.share({ text: message, url: link }).catch(() => undefined);
        return;
      }
      return copy(message);
    }
    await Share.share({ message });
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('room.inviteTitle')} closeLabel={t('common.close')}>
      <View style={styles.codeBox}>
        <Text style={styles.codeLabel}>{t('room.codeLabel')}</Text>
        <Text testID="room-code" style={styles.code} selectable>
          {room.code}
        </Text>
      </View>
      <Body muted style={{ fontSize: font.small }} selectable>
        {link}
      </Body>
      <Button title={t('room.copyLink')} icon="link-outline" variant="secondary" onPress={() => void copy(link)} />
      <Button title={t('common.share')} icon="share-outline" onPress={() => void share()} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  codeBox: { alignItems: 'center', gap: space.xs, backgroundColor: colors.surfaceAlt, borderRadius: radius.lg, padding: space.lg },
  codeLabel: { color: colors.textMuted, fontSize: font.small },
  code: { color: colors.text, fontSize: 36, fontWeight: '800', letterSpacing: 8 },
});
