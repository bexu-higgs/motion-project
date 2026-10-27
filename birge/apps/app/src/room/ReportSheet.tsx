import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { REPORT_DETAILS_MAX_LENGTH, REPORT_REASONS, type PublicUser, type ReportReason, type ReportTarget } from '@birge/shared';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { Body, Button, Checkbox, ErrorBanner, TextField } from '@/components/ui';
import { useT } from '@/i18n';
import { api, toErrorCode } from '@/lib/api';
import { colors, font, radius, space } from '@/theme';

export interface ReportRequest {
  targetType: ReportTarget;
  targetId: string;
  roomId?: string;
  /** Шағым жасалған адам (бұғаттауды ұсыну үшін). */
  user?: PublicUser | null;
}

export function ReportSheet({
  request,
  onClose,
  onBlock,
}: {
  request: ReportRequest | null;
  onClose(): void;
  onBlock?(user: PublicUser): Promise<void>;
}) {
  const t = useT();
  const toast = useToast();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setReason(null);
    setDetails('');
    setError(null);
    onClose();
  };

  const submit = async () => {
    if (!request || !reason) return;
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/reports', {
        targetType: request.targetType,
        targetId: request.targetId,
        roomId: request.roomId,
        reason,
        details,
      });
      if (alsoBlock && request.user && onBlock) await onBlock(request.user);
      toast(t('report.thanks'));
      close();
    } catch (err) {
      setError(t(`errors.${toErrorCode(err)}`));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={Boolean(request)} onClose={close} title={t('report.title')} closeLabel={t('common.close')}>
      <Body muted style={{ fontSize: font.small }}>
        {t('report.subtitle')}
      </Body>
      <View style={styles.reasons}>
        {REPORT_REASONS.map((r) => (
          <Pressable
            key={r}
            testID={`reason-${r}`}
            accessibilityRole="radio"
            accessibilityState={{ selected: reason === r }}
            onPress={() => setReason(r)}
            style={[styles.reason, reason === r && styles.reasonActive]}
          >
            <Text style={[styles.reasonText, reason === r && { color: colors.white }]}>{t(`report.reasons.${r}`)}</Text>
          </Pressable>
        ))}
      </View>
      <TextField
        label={t('report.details')}
        value={details}
        onChangeText={setDetails}
        multiline
        maxLength={REPORT_DETAILS_MAX_LENGTH}
        inputStyle={{ minHeight: 80, paddingTop: space.md, textAlignVertical: 'top' }}
      />
      {request?.user && onBlock ? (
        <Checkbox checked={alsoBlock} onChange={setAlsoBlock}>
          <Text style={{ color: colors.text }}>{t('report.alsoBlock')}</Text>
        </Checkbox>
      ) : null}
      <ErrorBanner message={error} />
      <Button
        testID="report-submit"
        variant="danger"
        title={t('report.submit')}
        onPress={() => void submit()}
        loading={busy}
        disabled={!reason}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  reason: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reasonActive: { backgroundColor: colors.danger, borderColor: colors.danger },
  reasonText: { color: colors.text, fontSize: font.small },
});
