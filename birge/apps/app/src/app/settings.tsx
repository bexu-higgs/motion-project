import * as Application from 'expo-application';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { DISPLAY_NAME_MAX_LENGTH, formatPhone, type Me } from '@birge/shared';
import { useAuth } from '@/auth/AuthProvider';
import { alertMessage, confirmAsync } from '@/components/dialogs';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { useToast } from '@/components/Toast';
import { Button, Card, ErrorBanner, ListRow, Screen, TextField } from '@/components/ui';
import { useT } from '@/i18n';
import { toErrorCode } from '@/lib/api';
import { useBlocks } from '@/room/useBlocks';
import { colors, font, space } from '@/theme';

export default function SettingsScreen() {
  const { me } = useAuth();
  // Бет тікелей ашылса, профиль жүктелгенше күтеміз — өрістер бос қалмасын.
  return me ? <SettingsForm key={me.id} me={me} /> : null;
}

function SettingsForm({ me }: { me: Me }) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const { config, updateMe, signOut, deleteAccount } = useAuth();
  const blocks = useBlocks();
  const [name, setName] = useState(me.displayName);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveName = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateMe({ displayName: name });
      toast(t('settings.saved'));
    } catch (err) {
      setError(t(`errors.${toErrorCode(err)}`));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const ok = await confirmAsync({
      title: t('settings.deleteConfirmTitle'),
      message: t('settings.deleteConfirm'),
      confirmText: t('settings.deleteAccount'),
      cancelText: t('common.cancel'),
      destructive: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteAccount();
      alertMessage(t('settings.deleted'));
    } catch (err) {
      setError(t(`errors.${toErrorCode(err)}`));
      setDeleting(false);
    }
  };

  const providers = me.providers.map((p) => t(`settings.providers.${p}`)).join(', ');
  const contact = me.email ?? (me.phone ? formatPhone(me.phone) : '');
  const version = Application.nativeApplicationVersion ?? '1.0.0';

  return (
    <Screen maxWidth={620}>
      <Text style={styles.section}>{t('settings.profile')}</Text>
      <Card>
        <TextField
          testID="settings-name"
          label={t('settings.displayName')}
          value={name}
          onChangeText={setName}
          maxLength={DISPLAY_NAME_MAX_LENGTH}
        />
        <Button
          compact
          title={t('common.save')}
          onPress={() => void saveName()}
          loading={saving}
          disabled={name.trim() === me.displayName || name.trim().length < 2}
        />
        <ErrorBanner message={error} />
      </Card>

      <Text style={styles.section}>{t('settings.language')}</Text>
      <LanguageSwitch full />

      <Text style={styles.section}>{t('settings.account')}</Text>
      <Card style={{ padding: space.sm }}>
        <ListRow icon="key-outline" title={t('settings.signedInWith')} subtitle={[providers, contact].filter(Boolean).join(' · ')} />
        <ListRow
          icon="person-remove-outline"
          title={t('settings.blockedUsers')}
          subtitle={blocks.users.length ? undefined : t('settings.noBlocked')}
        />
        {blocks.users.map((u) => (
          <ListRow
            key={u.id}
            title={u.displayName}
            right={<Button compact variant="secondary" title={t('people.unblock')} onPress={() => void blocks.unblock(u.id)} />}
          />
        ))}
        {me.isModerator ? (
          <ListRow icon="shield-checkmark-outline" title={t('settings.moderation')} onPress={() => router.push('/moderation')} />
        ) : null}
      </Card>

      <Text style={styles.section}>{t('settings.legal')}</Text>
      <Card style={{ padding: space.sm }}>
        <ListRow icon="document-text-outline" title={t('settings.terms')} onPress={() => router.push('/terms')} />
        <ListRow icon="lock-closed-outline" title={t('settings.privacy')} onPress={() => router.push('/privacy')} />
        <ListRow
          icon="help-buoy-outline"
          title={t('settings.support')}
          subtitle={config?.supportEmail}
          onPress={config?.supportEmail ? () => void Linking.openURL(`mailto:${config.supportEmail}`) : undefined}
        />
      </Card>

      <View style={{ gap: space.md, marginTop: space.md }}>
        <Button
          testID="sign-out"
          variant="secondary"
          icon="log-out-outline"
          title={t('settings.signOut')}
          onPress={async () => {
            if (
              await confirmAsync({
                title: t('settings.signOutConfirm'),
                confirmText: t('settings.signOut'),
                cancelText: t('common.cancel'),
              })
            )
              await signOut();
          }}
        />
        <Button
          testID="delete-account"
          variant="danger"
          icon="trash-outline"
          title={t('settings.deleteAccount')}
          onPress={() => void remove()}
          loading={deleting}
        />
      </View>
      <Text style={styles.version}>{t('settings.version', { version })}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    color: colors.textFaint,
    fontSize: font.tiny,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: space.sm,
  },
  version: { color: colors.textFaint, fontSize: font.tiny, textAlign: 'center', marginTop: space.lg },
});
