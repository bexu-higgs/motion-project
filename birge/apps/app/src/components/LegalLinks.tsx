import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useT } from '@/i18n';
import { colors, font, space } from '@/theme';

export function LegalLinks({ center }: { center?: boolean }) {
  const t = useT();
  return (
    <View style={[styles.row, center && { justifyContent: 'center' }]}>
      <Link href="/terms" style={styles.link}>
        {t('settings.terms')}
      </Link>
      <Text style={styles.dot}>·</Text>
      <Link href="/privacy" style={styles.link}>
        {t('settings.privacy')}
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' },
  link: { color: colors.primary, fontSize: font.small, fontWeight: '600' },
  dot: { color: colors.textFaint },
});
