import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View, type TextInputKeyPressEvent } from 'react-native';
import { CHAT_MAX_LENGTH, type ChatMessage, type RoomNotice } from '@birge/shared';
import { useToast } from '@/components/Toast';
import { Avatar, IconButton } from '@/components/ui';
import { useT, type Translate } from '@/i18n';
import { colors, font, radius, space } from '@/theme';
import type { ChatEntry, RoomActions } from './useRoom';
import type { InteractionState } from '@/components/pressable';

function clock(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function noticeText(t: Translate, notice: RoomNotice): string {
  switch (notice.type) {
    case 'joined':
    case 'left':
    case 'share_started':
    case 'removed':
      return t(`notices.${notice.type}`, { name: notice.userName });
    case 'share_stopped':
      return t('notices.share_stopped');
    case 'now_playing':
      return t('notices.now_playing', { name: notice.userName, title: notice.title });
    case 'role_changed':
      return t(notice.role === 'admin' ? 'notices.role_admin' : 'notices.role_member', { name: notice.userName });
  }
}

export function ChatPanel({
  entries,
  blocked,
  meId,
  onSend,
  onMessageActions,
}: {
  entries: ChatEntry[];
  blocked: ReadonlySet<string>;
  meId: string;
  onSend: RoomActions['sendChat'];
  onMessageActions(message: ChatMessage): void;
}) {
  const t = useT();
  const toast = useToast();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const visible = useMemo(
    () => entries.filter((e) => e.kind === 'notice' || !e.message.userId || !blocked.has(e.message.userId)).reverse(),
    [entries, blocked],
  );

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const res = await onSend(body);
    setSending(false);
    if (res.ok) setText('');
    else toast(t(`errors.${res.error}`), 'error');
  };

  const onKeyPress = (e: TextInputKeyPressEvent) => {
    // Вебте Enter — жіберу, Shift+Enter — жаңа жол.
    const ev = e.nativeEvent as TextInputKeyPressEvent['nativeEvent'] & { shiftKey?: boolean };
    if (Platform.OS === 'web' && ev.key === 'Enter' && !ev.shiftKey) {
      (e as unknown as { preventDefault(): void }).preventDefault();
      void send();
    }
  };

  return (
    <View style={styles.wrap}>
      <FlatList
        testID="chat-list"
        data={visible}
        inverted
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Text style={[styles.empty, styles.flip]}>{t('chat.empty')}</Text>}
        renderItem={({ item }) =>
          item.kind === 'notice' ? (
            <Text style={styles.notice}>{noticeText(t, item.notice)}</Text>
          ) : (
            <MessageRow message={item.message} mine={item.message.userId === meId} onActions={() => onMessageActions(item.message)} />
          )
        }
      />
      <View style={styles.inputRow}>
        <TextInput
          testID="chat-input"
          value={text}
          onChangeText={setText}
          placeholder={t('chat.placeholder')}
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          multiline
          maxLength={CHAT_MAX_LENGTH}
          onKeyPress={onKeyPress}
          blurOnSubmit={false}
        />
        <IconButton
          testID="chat-send"
          icon="send"
          label={t('common.send')}
          color={text.trim() ? colors.primary : colors.textFaint}
          onPress={() => void send()}
          disabled={!text.trim() || sending}
        />
      </View>
    </View>
  );
}

function MessageRow({ message, mine, onActions }: { message: ChatMessage; mine: boolean; onActions(): void }) {
  const t = useT();
  return (
    <Pressable
      onLongPress={onActions}
      delayLongPress={350}
      style={({ hovered }: InteractionState) => [styles.message, hovered && styles.messageHover]}
      accessibilityHint={t('chat.actions')}
    >
      <Avatar id={message.userId ?? 'x'} name={message.displayName} size={32} />
      <View style={{ flex: 1 }}>
        <View style={styles.meta}>
          <Text style={[styles.name, mine && { color: colors.primary }]} numberOfLines={1}>
            {message.displayName}
          </Text>
          <Text style={styles.time}>{clock(message.createdAt)}</Text>
        </View>
        <Text style={styles.body} selectable>
          {message.body}
        </Text>
      </View>
      <Pressable
        testID="message-actions"
        accessibilityRole="button"
        accessibilityLabel={t('chat.actions')}
        onPress={onActions}
        hitSlop={8}
        style={styles.more}
      >
        <Ionicons name="ellipsis-horizontal" size={16} color={colors.textFaint} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  list: { padding: space.sm, gap: 2, flexGrow: 1 },
  flip: { transform: [{ scaleY: -1 }] },
  empty: { color: colors.textMuted, textAlign: 'center', marginVertical: space.xl, fontSize: font.small },
  notice: { color: colors.textFaint, fontSize: font.tiny + 1, textAlign: 'center', paddingVertical: 6 },
  message: { flexDirection: 'row', gap: space.sm, paddingVertical: 6, paddingHorizontal: space.sm, borderRadius: radius.md },
  messageHover: { backgroundColor: colors.surfaceAlt },
  meta: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  name: { color: colors.text, fontWeight: '700', fontSize: font.small, flexShrink: 1 },
  time: { color: colors.textFaint, fontSize: font.tiny },
  body: { color: colors.text, fontSize: font.body - 1, lineHeight: 21, marginTop: 1 },
  more: { padding: 4, alignSelf: 'flex-start' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    padding: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    borderRadius: radius.lg,
    paddingHorizontal: space.md,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: font.body - 1,
    outlineWidth: 0,
  },
});
