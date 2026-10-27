import { useKeepAwake } from 'expo-keep-awake';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { canControl as roleCanControl, type ChatMessage, type Member, type PublicUser, type RoomInfo } from '@birge/shared';
import { useAuth } from '@/auth/AuthProvider';
import { alertMessage, confirmAsync } from '@/components/dialogs';
import { ActionSheet, type SheetAction } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { Body, Button, H2, IconButton } from '@/components/ui';
import { useT } from '@/i18n';
import { api, apiBaseUrl, toErrorCode } from '@/lib/api';
import { prefs } from '@/lib/storage';
import { AddMediaSheet } from '@/room/AddMediaSheet';
import { ChatPanel } from '@/room/ChatPanel';
import { InviteSheet } from '@/room/InviteSheet';
import { MediaStage } from '@/room/MediaStage';
import { PeoplePanel } from '@/room/PeoplePanel';
import { QueuePanel } from '@/room/QueuePanel';
import { ReportSheet, type ReportRequest } from '@/room/ReportSheet';
import { RoomSettingsSheet } from '@/room/RoomSettingsSheet';
import { useBlocks } from '@/room/useBlocks';
import { useRoom, type RoomActions, type RoomState } from '@/room/useRoom';
import { VoiceProvider, useVoice } from '@/room/voice/VoiceProvider';
import { colors, font, radius, space, WIDE_BREAKPOINT } from '@/theme';

type Tab = 'chat' | 'people' | 'queue';

export default function RoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status, onboarded } = useAuth();
  // Сілтеме арқылы бірден ашылса — алдымен сессия жүктелсін, содан кейін ғана қосыламыз.
  if (status !== 'signedIn' || !onboarded || !id) {
    return (
      <SafeAreaView style={styles.full}>
        <View style={styles.centerBox}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }
  return <ConnectedRoom key={id} id={id} />;
}

function ConnectedRoom({ id }: { id: string }) {
  const { state, actions, clock } = useRoom(id);
  const blocks = useBlocks();
  // Кино көріп отырғанда экран сөнбесін.
  useKeepAwake();

  return (
    <VoiceProvider
      roomId={id}
      enabled={state.voice && state.status === 'ready'}
      blocked={blocks.ids}
      onLocalShareEnded={() => void actions.setShare(false)}
    >
      <Stack.Screen options={{ title: state.room?.name ?? 'Birge' }} />
      <RoomView roomId={id} state={state} actions={actions} clock={clock} blocks={blocks} />
    </VoiceProvider>
  );
}

function RoomView({
  roomId,
  state,
  actions,
  clock,
  blocks,
}: {
  roomId: string;
  state: RoomState;
  actions: RoomActions;
  clock: ReturnType<typeof useRoom>['clock'];
  blocks: ReturnType<typeof useBlocks>;
}) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const voice = useVoice();
  const { me, config } = useAuth();
  const { width, height } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;
  const [tab, setTab] = useState<Tab>('chat');
  const [sheet, setSheet] = useState<'media' | 'invite' | 'menu' | 'settings' | null>(null);
  const [memberTarget, setMemberTarget] = useState<Member | null>(null);
  const [messageTarget, setMessageTarget] = useState<ChatMessage | null>(null);
  const [report, setReport] = useState<ReportRequest | null>(null);

  const meId = me?.id ?? '';
  const canControl = roleCanControl(state.role);
  const isOwner = state.role === 'owner';
  const room = state.room;
  const origin = config?.webUrl || apiBaseUrl();
  const goHome = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (state.status === 'removed' || state.status === 'error') {
    const message =
      state.status === 'removed' && state.removedReason
        ? t(`room.removed_${state.removedReason}`)
        : t(`errors.${state.error ?? 'server_error'}`);
    return (
      <SafeAreaView style={styles.full}>
        <View style={styles.centerBox}>
          <H2 style={{ textAlign: 'center' }}>{message}</H2>
          <Button title={t('common.back')} onPress={() => router.replace('/')} />
        </View>
      </SafeAreaView>
    );
  }

  if (!room || !state.playback) {
    return (
      <SafeAreaView style={styles.full}>
        <View style={styles.centerBox}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Body muted>{t('room.connecting')}</Body>
        </View>
      </SafeAreaView>
    );
  }

  const block = async (user: PublicUser) => {
    await blocks.block(user);
  };

  const toggleMic = async () => {
    if (!voice.micEnabled) {
      const seen = await prefs.get('birge.micPrimer');
      if (!seen) {
        const ok = await confirmAsync({
          title: t('voice.permissionTitle'),
          message: t('voice.permissionBody'),
          confirmText: t('common.continue'),
          cancelText: t('common.cancel'),
        });
        if (!ok) return;
        await prefs.set('birge.micPrimer', '1');
      }
    }
    const err = await voice.toggleMic();
    if (err === 'permission_denied') alertMessage(t('voice.permissionTitle'), t('voice.permissionDenied'));
    else if (err) toast(t(`errors.${err}`), 'error');
  };

  const memberActions = (m: Member): SheetAction[] => {
    const list: SheetAction[] = [];
    const targetIsOwner = m.role === 'owner';
    const canModerate = !targetIsOwner && (isOwner || (canControl && m.role === 'member'));
    const run = async (p: Promise<{ ok: boolean; error?: string }>) => {
      const res = await p;
      if (!res.ok) toast(t(`errors.${toErrorCode(res.error)}`), 'error');
    };
    if (isOwner && !targetIsOwner) {
      list.push(
        m.role === 'admin'
          ? {
              key: 'demote',
              label: t('people.removeAdmin'),
              icon: 'shield-outline',
              onPress: () => void run(actions.setRole(m.id, 'member')),
            }
          : {
              key: 'promote',
              label: t('people.makeAdmin'),
              icon: 'shield-checkmark-outline',
              onPress: () => void run(actions.setRole(m.id, 'admin')),
            },
      );
    }
    if (canModerate && voice.micOn.has(m.id)) {
      list.push({ key: 'mute', label: t('people.mute'), icon: 'mic-off-outline', onPress: () => void run(actions.mute(m.id)) });
    }
    if (canModerate) {
      list.push({
        key: 'kick',
        label: t('people.kick'),
        icon: 'exit-outline',
        danger: true,
        onPress: async () => {
          if (
            await confirmAsync({
              title: t('people.kickConfirm', { name: m.displayName }),
              confirmText: t('people.kick'),
              cancelText: t('common.cancel'),
              destructive: true,
            })
          )
            await run(actions.removeMember(m.id, false));
        },
      });
      list.push({
        key: 'ban',
        label: t('people.ban'),
        icon: 'ban-outline',
        danger: true,
        onPress: async () => {
          if (
            await confirmAsync({
              title: t('people.banConfirm', { name: m.displayName }),
              confirmText: t('people.ban'),
              cancelText: t('common.cancel'),
              destructive: true,
            })
          )
            await run(actions.removeMember(m.id, true));
        },
      });
    }
    list.push(
      blocks.ids.has(m.id)
        ? { key: 'unblock', label: t('people.unblock'), icon: 'person-add-outline', onPress: () => void blocks.unblock(m.id) }
        : {
            key: 'block',
            label: t('people.block'),
            icon: 'person-remove-outline',
            onPress: async () => {
              if (
                await confirmAsync({
                  title: t('people.block'),
                  message: t('people.blockConfirm', { name: m.displayName }),
                  confirmText: t('people.block'),
                  cancelText: t('common.cancel'),
                })
              )
                await block(m);
            },
          },
    );
    list.push({
      key: 'report',
      label: t('people.report'),
      icon: 'flag-outline',
      danger: true,
      onPress: () => setReport({ targetType: 'user', targetId: m.id, roomId, user: m }),
    });
    return list;
  };

  const messageActions = (msg: ChatMessage): SheetAction[] => {
    const mine = msg.userId === meId;
    const list: SheetAction[] = [];
    if (mine || canControl) {
      list.push({
        key: 'delete',
        label: t('chat.deleteMessage'),
        icon: 'trash-outline',
        danger: true,
        onPress: async () => {
          const res = await actions.deleteMessage(msg.id);
          if (!res.ok) toast(t(`errors.${res.error}`), 'error');
        },
      });
    }
    if (!mine && msg.userId) {
      const author = { id: msg.userId, displayName: msg.displayName };
      list.push({
        key: 'report',
        label: t('chat.reportMessage'),
        icon: 'flag-outline',
        danger: true,
        onPress: () => setReport({ targetType: 'message', targetId: msg.id, roomId, user: author }),
      });
      if (!blocks.ids.has(msg.userId))
        list.push({ key: 'block', label: t('people.block'), icon: 'person-remove-outline', onPress: () => void block(author) });
    }
    return list;
  };

  const menuActions: SheetAction[] = [
    { key: 'invite', label: t('room.invite'), icon: 'person-add-outline', onPress: () => setSheet('invite') },
    ...(isOwner
      ? [{ key: 'settings', label: t('room.settings'), icon: 'options-outline' as const, onPress: () => setSheet('settings') }]
      : []),
    ...(!isOwner
      ? [
          {
            key: 'report',
            label: t('room.reportRoom'),
            icon: 'flag-outline' as const,
            onPress: () => setReport({ targetType: 'room', targetId: room.id }),
          },
          {
            key: 'leave',
            label: t('room.leave'),
            icon: 'exit-outline' as const,
            danger: true,
            onPress: async () => {
              if (
                !(await confirmAsync({
                  title: t('room.leave'),
                  message: t('room.leaveConfirm'),
                  confirmText: t('room.leave'),
                  cancelText: t('common.cancel'),
                  destructive: true,
                }))
              )
                return;
              await api.post(`/api/rooms/${room.id}/leave`).catch(() => undefined);
              router.replace('/');
            },
          },
        ]
      : [
          {
            key: 'close',
            label: t('room.closeRoom'),
            icon: 'trash-outline' as const,
            danger: true,
            onPress: async () => {
              if (
                !(await confirmAsync({
                  title: t('room.closeRoom'),
                  message: t('room.closeConfirm'),
                  confirmText: t('room.closeRoom'),
                  cancelText: t('common.cancel'),
                  destructive: true,
                }))
              )
                return;
              await api.delete(`/api/rooms/${room.id}`).catch(() => undefined);
              router.replace('/');
            },
          },
        ]),
  ];

  const onlineCount = state.members.filter((m) => m.online).length;
  const tabs: { key: Tab; label: string }[] = [
    { key: 'chat', label: t('room.chat') },
    { key: 'people', label: `${t('room.people')} ${onlineCount}` },
    { key: 'queue', label: `${t('room.queue')} ${state.queue.length}` },
  ];

  const panel =
    tab === 'chat' ? (
      <ChatPanel entries={state.chat} blocked={blocks.ids} meId={meId} onSend={actions.sendChat} onMessageActions={setMessageTarget} />
    ) : tab === 'people' ? (
      <PeoplePanel
        members={state.members}
        meId={meId}
        speaking={voice.speaking}
        micOn={voice.micOn}
        blocked={blocks.ids}
        onMemberActions={setMemberTarget}
      />
    ) : (
      <QueuePanel
        queue={state.queue}
        playback={state.playback}
        canControl={canControl}
        onAdd={() => setSheet('media')}
        onPlay={(itemId) => void actions.select(itemId)}
        onRemove={(itemId) => void actions.remove(itemId)}
      />
    );

  const tabBar = (
    <View style={styles.tabs} accessibilityRole="tablist">
      {tabs.map((item) => (
        <Pressable
          key={item.key}
          testID={`tab-${item.key}`}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === item.key }}
          onPress={() => setTab(item.key)}
          style={[styles.tab, tab === item.key && styles.tabActive]}
        >
          <Text style={[styles.tabText, tab === item.key && styles.tabTextActive]}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );

  const stage = (
    <MediaStage
      state={state}
      clock={clock}
      canControl={canControl}
      meId={meId}
      actions={actions}
      origin={origin}
      onAddMedia={() => setSheet('media')}
    />
  );

  const header = (
    <View style={styles.header}>
      <IconButton icon="chevron-back" label={t('common.back')} onPress={goHome} />
      <View style={{ flex: 1 }}>
        <Text style={styles.roomName} numberOfLines={1} testID="room-title">
          {room.name}
        </Text>
        <Text style={styles.roomMeta} numberOfLines={1}>
          {state.status === 'reconnecting'
            ? t('room.reconnecting')
            : `${t('home.members', { count: state.members.length, capacity: room.capacity })} · ${room.code}`}
        </Text>
      </View>
      {voice.available && !voice.canPlaybackAudio ? (
        <Button compact icon="volume-high" title={t('voice.enableAudio')} onPress={voice.startAudio} />
      ) : null}
      {voice.available ? (
        <IconButton
          testID="mic-toggle"
          icon={voice.micEnabled ? 'mic' : 'mic-off'}
          label={voice.micEnabled ? t('voice.micOn') : t('voice.micOff')}
          color={voice.micEnabled ? colors.success : voice.status === 'connected' ? colors.text : colors.textFaint}
          active={voice.micEnabled}
          disabled={voice.status !== 'connected' || voice.micBusy}
          onPress={() => void toggleMic()}
        />
      ) : null}
      {canControl ? (
        <IconButton testID="header-add-media" icon="add-circle-outline" label={t('room.addMedia')} onPress={() => setSheet('media')} />
      ) : null}
      <IconButton testID="invite" icon="person-add-outline" label={t('room.invite')} onPress={() => setSheet('invite')} />
      <IconButton testID="room-menu" icon="ellipsis-vertical" label={t('room.menu')} onPress={() => setSheet('menu')} />
    </View>
  );

  // Кең экранда ойнатқыш биіктікке сыйсын.
  const stageMaxWidth = Math.max(420, ((height - 220) * 16) / 9);

  return (
    <SafeAreaView style={styles.full} edges={wide ? ['top', 'bottom', 'left', 'right'] : ['top', 'left', 'right']}>
      {header}
      {wide ? (
        <View style={styles.wideBody}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ alignItems: 'center' }}>
            <View style={{ width: '100%', maxWidth: stageMaxWidth }}>{stage}</View>
          </ScrollView>
          <View style={styles.sidebar}>
            {tabBar}
            <View style={{ flex: 1 }}>{panel}</View>
          </View>
        </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
          <View style={styles.narrowStage}>{stage}</View>
          {tabBar}
          <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
            {panel}
          </SafeAreaView>
        </KeyboardAvoidingView>
      )}

      <AddMediaSheet
        roomId={room.id}
        visible={sheet === 'media'}
        onClose={() => setSheet(null)}
        actions={actions}
        maxUploadMb={config?.maxUploadMb ?? 2048}
      />
      <InviteSheet room={room as RoomInfo} visible={sheet === 'invite'} onClose={() => setSheet(null)} />
      {isOwner ? (
        <RoomSettingsSheet
          key={`${room.name}-${room.capacity}`}
          room={room}
          visible={sheet === 'settings'}
          onClose={() => setSheet(null)}
        />
      ) : null}
      <ActionSheet
        visible={sheet === 'menu'}
        onClose={() => setSheet(null)}
        title={room.name}
        actions={menuActions}
        closeLabel={t('common.close')}
      />
      <ActionSheet
        visible={Boolean(memberTarget)}
        onClose={() => setMemberTarget(null)}
        title={memberTarget?.displayName ?? ''}
        actions={memberTarget ? memberActions(memberTarget) : []}
        closeLabel={t('common.close')}
      />
      <ActionSheet
        visible={Boolean(messageTarget)}
        onClose={() => setMessageTarget(null)}
        title={t('chat.actions')}
        actions={messageTarget ? messageActions(messageTarget) : []}
        closeLabel={t('common.close')}
      />
      <ReportSheet request={report} onClose={() => setReport(null)} onBlock={block} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1, backgroundColor: colors.bg },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.sm, paddingVertical: space.xs },
  roomName: { color: colors.text, fontSize: font.h3, fontWeight: '800' },
  roomMeta: { color: colors.textMuted, fontSize: font.tiny + 1 },
  wideBody: { flex: 1, flexDirection: 'row', gap: space.lg, padding: space.lg, paddingTop: space.sm },
  sidebar: {
    width: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  narrowStage: { paddingHorizontal: space.sm, paddingBottom: space.xs },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: space.sm },
  tab: { paddingVertical: space.md, paddingHorizontal: space.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { color: colors.textMuted, fontWeight: '700', fontSize: font.small },
  tabTextActive: { color: colors.text },
});
