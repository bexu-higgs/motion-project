import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ModerationReport } from '@birge/shared';
import { useAuth } from '@/auth/AuthProvider';
import { confirmAsync } from '@/components/dialogs';
import { useToast } from '@/components/Toast';
import { Body, Button, Card, Screen } from '@/components/ui';
import { useT } from '@/i18n';
import { api, toErrorCode } from '@/lib/api';
import { colors, font, radius, space } from '@/theme';

/** Модераторларға арналған бет: шағымдарды қарау, мазмұнды өшіру, бұзушыларды бұғаттау. */
export default function ModerationScreen() {
  const t = useT();
  const toast = useToast();
  const { me, status: authStatus } = useAuth();
  const [status, setStatus] = useState<'open' | 'resolved'>('open');
  const [reports, setReports] = useState<ModerationReport[] | null>(null);

  const load = useCallback(async () => {
    try {
      setReports(await api.get<ModerationReport[]>(`/api/mod/reports?status=${status}`));
    } catch (err) {
      toast(t(`errors.${toErrorCode(err)}`), 'error');
      setReports([]);
    }
  }, [status, t, toast]);

  useEffect(() => {
    if (authStatus === 'signedIn') void load();
  }, [authStatus, load]);

  if (!me?.isModerator) {
    return (
      <Screen>
        <Body muted>{t('errors.forbidden')}</Body>
      </Screen>
    );
  }

  const act = async (request: () => Promise<unknown>, confirmText?: string) => {
    if (confirmText && !(await confirmAsync({ title: confirmText, confirmText, cancelText: t('common.cancel'), destructive: true })))
      return;
    try {
      await request();
      await load();
    } catch (err) {
      toast(t(`errors.${toErrorCode(err)}`), 'error');
    }
  };

  return (
    <Screen maxWidth={860}>
      <View style={styles.tabs}>
        {(['open', 'resolved'] as const).map((s) => (
          <Pressable key={s} onPress={() => setStatus(s)} style={[styles.tab, status === s && styles.tabActive]}>
            <Text style={[styles.tabText, status === s && { color: colors.white }]}>{t(`moderation.${s}`)}</Text>
          </Pressable>
        ))}
      </View>
      {reports?.length === 0 ? <Body muted>{t('moderation.empty')}</Body> : null}
      {reports?.map((r) => (
        <Card key={r.id}>
          <View style={styles.row}>
            <Text style={styles.reason}>{t(`report.reasons.${r.reason}`)}</Text>
            <Text style={styles.date}>{new Date(r.createdAt).toLocaleString()}</Text>
          </View>
          <Text style={styles.meta}>
            {t('moderation.reporter')}: {r.reporter?.displayName ?? '—'} · {t('moderation.target')}: {r.targetUser?.displayName ?? '—'}
            {r.room ? ` · ${t('moderation.room')}: ${r.room.name}` : ''}
          </Text>
          {r.messageBody ? <Text style={styles.quote}>“{r.messageBody}”</Text> : null}
          {r.details ? <Text style={styles.details}>{r.details}</Text> : null}
          {r.status === 'open' ? (
            <View style={styles.actions}>
              <Button
                compact
                variant="secondary"
                title={t('moderation.resolve')}
                onPress={() => void act(() => api.post(`/api/mod/reports/${r.id}/resolve`))}
              />
              {r.targetUser ? (
                <Button
                  compact
                  variant="danger"
                  title={t('moderation.banUser')}
                  onPress={() => void act(() => api.post(`/api/mod/users/${r.targetUser!.id}/ban`), t('moderation.banUser'))}
                />
              ) : null}
              {r.room && r.targetType === 'room' ? (
                <Button
                  compact
                  variant="danger"
                  title={t('moderation.closeRoom')}
                  onPress={() => void act(() => api.delete(`/api/mod/rooms/${r.room!.id}`), t('moderation.closeRoom'))}
                />
              ) : null}
            </View>
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: space.sm },
  tab: { paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  tabActive: { backgroundColor: colors.primary },
  tabText: { color: colors.textMuted, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  reason: { color: colors.danger, fontWeight: '800' },
  date: { color: colors.textFaint, fontSize: font.tiny },
  meta: { color: colors.textMuted, fontSize: font.small },
  quote: { color: colors.text, fontStyle: 'italic', backgroundColor: colors.surfaceAlt, padding: space.sm, borderRadius: radius.sm },
  details: { color: colors.textMuted, fontSize: font.small },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
