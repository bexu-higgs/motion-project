import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import type { RoomInfo } from '@birge/shared';
import { useAuth } from '@/auth/AuthProvider';
import { Body, Button, Card, ErrorBanner, H1, Screen } from '@/components/ui';
import { useT } from '@/i18n';
import { api, toErrorCode } from '@/lib/api';
import { colors, space } from '@/theme';

interface Preview extends RoomInfo {
  memberCount: number;
  ownerName: string;
  isMember: boolean;
}

/** Шақыру сілтемесі: https://…/join/ABC123 немесе birge://join/ABC123 */
export default function JoinScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const t = useT();
  const router = useRouter();
  const { status, onboarded } = useAuth();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status !== 'signedIn' || !onboarded || !code) return;
    api
      .get<Preview>(`/api/rooms/code/${encodeURIComponent(code)}`)
      .then((p) => {
        if (p.isMember) router.replace({ pathname: '/room/[id]', params: { id: p.id } });
        else setPreview(p);
      })
      .catch((err) => setError(t(`errors.${toErrorCode(err)}`)));
  }, [code, status, onboarded, router, t]);

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      const room = await api.post<RoomInfo>('/api/rooms/join', { code });
      router.replace({ pathname: '/room/[id]', params: { id: room.id } });
    } catch (err) {
      setError(t(`errors.${toErrorCode(err)}`));
      setBusy(false);
    }
  };

  return (
    <Screen maxWidth={480}>
      {error ? (
        <>
          <ErrorBanner message={error} />
          <Button title={t('common.back')} variant="secondary" onPress={() => router.replace('/')} />
        </>
      ) : !preview ? (
        <View style={{ alignItems: 'center', paddingTop: space.xxl }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <Card>
          <H1>{t('join.confirm', { name: preview.name })}</H1>
          <Body muted>{t('join.details', { owner: preview.ownerName, count: preview.memberCount, capacity: preview.capacity })}</Body>
          <Button testID="join-confirm" title={t('join.submit')} icon="enter-outline" onPress={() => void join()} loading={busy} />
        </Card>
      )}
    </Screen>
  );
}
