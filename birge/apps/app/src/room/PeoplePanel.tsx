import { Ionicons } from '@expo/vector-icons';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Member } from '@birge/shared';
import { Avatar } from '@/components/ui';
import { useT } from '@/i18n';
import { colors, font, radius, space } from '@/theme';
import type { InteractionState } from '@/components/pressable';

type Row = { kind: 'header'; id: string; title: string } | { kind: 'member'; id: string; member: Member };

export function PeoplePanel({
  members,
  meId,
  speaking,
  micOn,
  blocked,
  onMemberActions,
}: {
  members: Member[];
  meId: string;
  speaking: ReadonlySet<string>;
  micOn: ReadonlySet<string>;
  blocked: ReadonlySet<string>;
  onMemberActions(member: Member): void;
}) {
  const t = useT();
  const online = members.filter((m) => m.online);
  const offline = members.filter((m) => !m.online);
  const rows: Row[] = [
    { kind: 'header', id: 'h-on', title: `${t('people.online')} — ${online.length}` },
    ...online.map((m) => ({ kind: 'member' as const, id: m.id, member: m })),
    ...(offline.length ? [{ kind: 'header' as const, id: 'h-off', title: `${t('people.offline')} — ${offline.length}` }] : []),
    ...offline.map((m) => ({ kind: 'member' as const, id: m.id, member: m })),
  ];

  return (
    <FlatList
      testID="people-list"
      data={rows}
      keyExtractor={(r) => r.id}
      contentContainerStyle={{ padding: space.sm }}
      renderItem={({ item }) => {
        if (item.kind === 'header') return <Text style={styles.header}>{item.title}</Text>;
        const m = item.member;
        const me = m.id === meId;
        const isSpeaking = speaking.has(m.id);
        return (
          <Pressable
            testID={`member-${m.displayName}`}
            accessibilityRole="button"
            onPress={me ? undefined : () => onMemberActions(m)}
            style={({ hovered }: InteractionState) => [styles.row, hovered && !me && styles.rowHover, !m.online && { opacity: 0.55 }]}
          >
            <View style={[styles.avatarRing, isSpeaking && styles.speaking]}>
              <Avatar id={m.id} name={m.displayName} size={36} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {m.displayName}
                {me ? <Text style={styles.you}>{`  (${t('people.you')})`}</Text> : null}
              </Text>
              <View style={styles.badges}>
                {m.role !== 'member' ? (
                  <Text style={[styles.badge, m.role === 'owner' && styles.ownerBadge]}>{t(`people.${m.role}`)}</Text>
                ) : null}
                {blocked.has(m.id) ? <Text style={[styles.badge, styles.blockedBadge]}>{t('people.blocked')}</Text> : null}
              </View>
            </View>
            {micOn.has(m.id) ? (
              <Ionicons
                name="mic"
                size={18}
                color={isSpeaking ? colors.success : colors.textMuted}
                accessibilityLabel={t('people.micOn')}
              />
            ) : null}
            {!me ? <Ionicons name="ellipsis-vertical" size={16} color={colors.textFaint} /> : null}
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  header: {
    color: colors.textFaint,
    fontSize: font.tiny,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: space.md,
    marginBottom: space.xs,
    marginLeft: space.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm, borderRadius: radius.md },
  rowHover: { backgroundColor: colors.surfaceAlt },
  avatarRing: { borderRadius: 22, borderWidth: 2, borderColor: 'transparent', padding: 1 },
  speaking: { borderColor: colors.success },
  name: { color: colors.text, fontSize: font.body - 1, fontWeight: '600' },
  you: { color: colors.textFaint, fontWeight: '400' },
  badges: { flexDirection: 'row', gap: 6, marginTop: 2 },
  badge: { color: colors.primary, fontSize: font.tiny - 1, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  ownerBadge: { color: colors.warning },
  blockedBadge: { color: colors.danger },
});
