import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RoomInfo, RoomSummary } from '@birge/shared';
import { useAuth } from '@/auth/AuthProvider';
import { Body, Button, Card, ErrorBanner, H2, IconButton, TextField } from '@/components/ui';
import { useT } from '@/i18n';
import { api, toErrorCode } from '@/lib/api';
import { colors, font, radius, space } from '@/theme';
import type { InteractionState } from '@/components/pressable';

export default function HomeScreen() {
  const t = useT();
  const router = useRouter();
  const { me, status, onboarded } = useAuth();
  const { width } = useWindowDimensions();
  const wide = width >= 760;
  const [rooms, setRooms] = useState<RoomSummary[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [code, setCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    if (status !== 'signedIn' || !onboarded) return;
    try {
      setRooms(await api.get<RoomSummary[]>('/api/rooms'));
    } catch {
      setRooms((r) => r ?? []);
    }
  }, [status, onboarded]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const join = async () => {
    const clean = code.trim().toUpperCase();
    if (!clean) return;
    setJoining(true);
    setJoinError(null);
    try {
      const room = await api.post<RoomInfo>('/api/rooms/join', { code: clean });
      setCode('');
      router.push({ pathname: '/room/[id]', params: { id: room.id } });
    } catch (err) {
      setJoinError(t(`errors.${toErrorCode(err)}`));
    } finally {
      setJoining(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.textMuted}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        <View style={styles.inner}>
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <Image source={require('../../assets/images/icon.png')} style={styles.logo} />
              <Text style={styles.brand}>Birge</Text>
            </View>
            <IconButton
              testID="open-settings"
              icon="settings-outline"
              label={t('settings.title')}
              onPress={() => router.push('/settings')}
            />
          </View>

          <Text style={styles.greeting}>{t('home.greeting', { name: me?.displayName ?? '' })}</Text>

          <View style={[styles.actions, wide && styles.actionsWide]}>
            <Pressable
              testID="create-room"
              accessibilityRole="button"
              onPress={() => router.push('/rooms/new')}
              style={({ pressed, hovered }: InteractionState) => [
                styles.createCard,
                wide && styles.flex1,
                (pressed || hovered) && { opacity: 0.92 },
              ]}
            >
              <View style={styles.createIcon}>
                <Ionicons name="add" size={28} color={colors.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.createTitle}>{t('home.createTitle')}</Text>
                <Text style={styles.createSubtitle}>{t('home.createSubtitle')}</Text>
              </View>
            </Pressable>

            <Card style={wide ? styles.flex1 : undefined}>
              <Text style={styles.cardTitle}>{t('home.joinTitle')}</Text>
              <View style={styles.joinRow}>
                <TextField
                  testID="join-code"
                  style={{ flex: 1 }}
                  inputStyle={styles.codeInput}
                  value={code}
                  onChangeText={(v) => setCode(v.toUpperCase())}
                  placeholder={t('home.joinPlaceholder')}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={12}
                  returnKeyType="go"
                  onSubmitEditing={() => void join()}
                />
                <Button
                  testID="join-submit"
                  title={t('home.join')}
                  onPress={() => void join()}
                  loading={joining}
                  disabled={code.trim().length < 4}
                />
              </View>
              <ErrorBanner message={joinError} />
            </Card>
          </View>

          <H2 style={{ marginTop: space.md }}>{t('home.myRooms')}</H2>
          {rooms && rooms.length === 0 ? <Body muted>{t('home.empty')}</Body> : null}
          <View style={[styles.grid, wide && styles.gridWide]}>
            {rooms?.map((room) => (
              <Pressable
                key={room.id}
                testID={`room-${room.code}`}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/room/[id]', params: { id: room.id } })}
                style={({ pressed, hovered }: InteractionState) => [
                  styles.roomCard,
                  wide && styles.roomCardWide,
                  (pressed || hovered) && styles.roomCardHover,
                ]}
              >
                <View style={styles.roomTop}>
                  <Text style={styles.roomName} numberOfLines={1}>
                    {room.name}
                  </Text>
                  {room.role !== 'member' ? (
                    <Text style={styles.badge}>{room.role === 'owner' ? t('people.owner') : t('people.admin')}</Text>
                  ) : null}
                </View>
                <Text style={styles.roomMeta} numberOfLines={1}>
                  {t('home.host', { name: room.ownerName })}
                </Text>
                <View style={styles.roomBottom}>
                  <Text style={styles.roomMeta}>
                    <Ionicons name="people-outline" size={14} color={colors.textMuted} />{' '}
                    {t('home.members', { count: room.memberCount, capacity: room.capacity })}
                  </Text>
                  {room.onlineCount > 0 ? (
                    <View style={styles.online}>
                      <View style={styles.dot} />
                      <Text style={styles.onlineText}>{t('home.online', { count: room.onlineCount })}</Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingBottom: space.xxl },
  inner: { width: '100%', maxWidth: 1080, alignSelf: 'center', gap: space.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  logo: { width: 34, height: 34, borderRadius: 9 },
  brand: { color: colors.text, fontSize: font.h2, fontWeight: '800' },
  greeting: { color: colors.text, fontSize: font.title, fontWeight: '800' },
  actions: { gap: space.lg },
  actionsWide: { flexDirection: 'row', alignItems: 'stretch' },
  flex1: { flex: 1 },
  createCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    minHeight: 110,
  },
  createIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createTitle: { color: colors.white, fontSize: font.h2, fontWeight: '800' },
  createSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: font.small, marginTop: 4 },
  cardTitle: { color: colors.text, fontSize: font.h3, fontWeight: '700' },
  joinRow: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  codeInput: { letterSpacing: 3, fontWeight: '700' },
  grid: { gap: space.md },
  gridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  roomCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    gap: 6,
  },
  roomCardWide: { width: '32%', minWidth: 260, flexGrow: 1 },
  roomCardHover: { backgroundColor: colors.surfaceAlt },
  roomTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  roomName: { color: colors.text, fontSize: font.h3, fontWeight: '700', flex: 1 },
  badge: {
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    fontSize: font.tiny,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  roomMeta: { color: colors.textMuted, fontSize: font.small },
  roomBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  online: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  onlineText: { color: colors.success, fontSize: font.small, fontWeight: '600' },
});
