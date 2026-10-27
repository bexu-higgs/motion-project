import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { Body, Button, ErrorBanner, TextField } from '@/components/ui';
import { useT } from '@/i18n';
import { toErrorCode, uploadFile } from '@/lib/api';
import { colors, font, radius, space } from '@/theme';
import type { RoomActions } from './useRoom';
import { useVoice } from './voice/VoiceProvider';

type Tab = 'link' | 'upload' | 'share';

/** Әкімші медиа қосады: сілтеме, құрылғыдағы файл немесе браузер қойындысы. */
export function AddMediaSheet({
  roomId,
  visible,
  onClose,
  actions,
  maxUploadMb,
}: {
  roomId: string;
  visible: boolean;
  onClose(): void;
  actions: RoomActions;
  maxUploadMb: number;
}) {
  const t = useT();
  const toast = useToast();
  const voice = useVoice();
  const [tab, setTab] = useState<Tab>('link');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setUrl('');
    setTitle('');
    setError(null);
    setProgress(null);
  };

  const addLink = async () => {
    setBusy(true);
    setError(null);
    const res = await actions.addUrl(url.trim(), title.trim());
    setBusy(false);
    if (!res.ok) return setError(t(`errors.${res.error}`));
    toast(t('media.added'));
    reset();
    onClose();
  };

  const pickAndUpload = async () => {
    setError(null);
    const result = await DocumentPicker.getDocumentAsync({ type: ['video/*', 'audio/*'], copyToCacheDirectory: false, multiple: false });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (asset.size && asset.size > maxUploadMb * 1024 * 1024) return setError(t('errors.upload_too_large'));
    setBusy(true);
    setProgress(0);
    try {
      const query = title.trim() ? `?title=${encodeURIComponent(title.trim())}` : '';
      await uploadFile(
        `/api/rooms/${roomId}/uploads${query}`,
        { file: asset.file, uri: asset.uri, name: asset.name, mimeType: asset.mimeType },
        (f) => setProgress(f),
      );
      toast(t('media.added'));
      reset();
      onClose();
    } catch (err) {
      setError(t(`errors.${toErrorCode(err)}`));
      setProgress(null);
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    setError(null);
    setBusy(true);
    const started = await voice.startScreenShare();
    setBusy(false);
    if (!started) return;
    const res = await actions.setShare(true);
    if (!res.ok) {
      await voice.stopScreenShare();
      return setError(t(`errors.${res.error}`));
    }
    onClose();
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'link', label: t('media.linkTab') },
    { key: 'upload', label: t('media.uploadTab') },
    { key: 'share', label: t('media.shareTab') },
  ];

  return (
    <Sheet visible={visible} onClose={onClose} title={t('media.title')} closeLabel={t('common.close')}>
      <View style={styles.tabs} accessibilityRole="tablist">
        {tabs.map((item) => (
          <Pressable
            key={item.key}
            testID={`media-tab-${item.key}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === item.key }}
            onPress={() => {
              setTab(item.key);
              setError(null);
            }}
            style={[styles.tab, tab === item.key && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === item.key && { color: colors.white }]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'link' ? (
        <>
          <TextField
            testID="media-url"
            label={t('media.linkLabel')}
            placeholder={t('media.linkPlaceholder')}
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            hint={t('media.linkHint')}
          />
          <TextField label={t('media.titleLabel')} value={title} onChangeText={setTitle} maxLength={200} />
          <ErrorBanner message={error} />
          <Button
            testID="media-add"
            title={t('media.add')}
            icon="add"
            onPress={() => void addLink()}
            loading={busy}
            disabled={!url.trim()}
          />
        </>
      ) : null}

      {tab === 'upload' ? (
        <>
          <Body muted style={{ fontSize: font.small }}>
            {t('media.uploadHint', { mb: maxUploadMb })}
          </Body>
          <TextField label={t('media.titleLabel')} value={title} onChangeText={setTitle} maxLength={200} />
          {progress !== null ? (
            <View style={styles.progressWrap}>
              <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
              <Text style={styles.progressText}>{t('media.uploading', { percent: Math.round(progress * 100) })}</Text>
            </View>
          ) : null}
          <ErrorBanner message={error} />
          <Button
            testID="media-pick"
            title={t('media.pickFile')}
            icon="cloud-upload-outline"
            onPress={() => void pickAndUpload()}
            loading={busy}
          />
        </>
      ) : null}

      {tab === 'share' ? (
        <>
          <Body muted style={{ fontSize: font.small }}>
            {voice.supportsScreenShare ? t('media.shareHint') : t('media.shareDesktopOnly')}
          </Body>
          {voice.supportsScreenShare && !voice.available ? <ErrorBanner message={t('media.shareNeedsVoice')} /> : null}
          <ErrorBanner message={error} />
          {voice.supportsScreenShare ? (
            <Button
              testID="media-share"
              title={t('media.shareStart')}
              icon="desktop-outline"
              onPress={() => void share()}
              loading={busy}
              disabled={voice.status !== 'connected'}
            />
          ) : null}
        </>
      ) : null}

      <Text style={styles.rights}>{t('media.rights')}</Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 3 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: space.sm, borderRadius: radius.sm },
  tabActive: { backgroundColor: colors.primary },
  tabText: { color: colors.textMuted, fontWeight: '700', fontSize: font.small },
  progressWrap: { height: 32, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, overflow: 'hidden', justifyContent: 'center' },
  progressFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.primarySoft },
  progressText: { color: colors.text, textAlign: 'center', fontSize: font.small },
  rights: { color: colors.textFaint, fontSize: font.tiny, textAlign: 'center' },
});
