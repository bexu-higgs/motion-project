import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { useI18n } from '@/i18n';
import type { LegalDoc } from '@/legal/content';
import { colors, font, space } from '@/theme';
import { LanguageSwitch } from './LanguageSwitch';
import { Screen } from './ui';

const OPERATOR = process.env.EXPO_PUBLIC_OPERATOR_NAME || 'Birge';

export function LegalView({ docs }: { docs: Record<'kk' | 'en', LegalDoc> }) {
  const { locale } = useI18n();
  const { config } = useAuth();
  const doc = docs[locale];
  const fill = (text: string) => text.replaceAll('{operator}', OPERATOR).replaceAll('{email}', config?.supportEmail ?? 'support@birge.app');

  return (
    <Screen maxWidth={760}>
      <View style={styles.top}>
        <LanguageSwitch />
      </View>
      <Text accessibilityRole="header" style={styles.title}>
        {doc.title}
      </Text>
      <Text style={styles.updated}>{doc.updated}</Text>
      {doc.sections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <Text accessibilityRole="header" style={styles.heading}>
            {section.heading}
          </Text>
          {section.body.map((p, i) => (
            <Text key={i} style={styles.body} selectable>
              {fill(p)}
            </Text>
          ))}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'flex-end' },
  title: { color: colors.text, fontSize: font.title, fontWeight: '800' },
  updated: { color: colors.textFaint, fontSize: font.small },
  section: { gap: space.sm },
  heading: { color: colors.text, fontSize: font.h3, fontWeight: '700' },
  body: { color: colors.textMuted, fontSize: font.body - 1, lineHeight: 23 },
});
