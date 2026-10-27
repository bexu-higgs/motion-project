import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SUPPORTED_LOCALES, type Locale } from '@birge/shared';
import { useI18n } from '@/i18n';
import { colors, font, radius } from '@/theme';

const SHORT: Record<Locale, string> = { kk: 'ҚАЗ', en: 'ENG' };

/** Тек екі тіл: қазақша және ағылшынша. */
export function LanguageSwitch({ full }: { full?: boolean }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel={t('lang.title')}>
      {SUPPORTED_LOCALES.map((code) => {
        const active = code === locale;
        return (
          <Pressable
            key={code}
            testID={`lang-${code}`}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => setLocale(code)}
            style={[styles.item, full && styles.itemFull, active && styles.active]}
          >
            <Text style={[styles.text, active && styles.activeText]}>{full ? t(`lang.${code}`) : SHORT[code]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  item: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  itemFull: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  active: { backgroundColor: colors.primary },
  text: { color: colors.textMuted, fontSize: font.tiny + 1, fontWeight: '700' },
  activeText: { color: colors.white },
});
