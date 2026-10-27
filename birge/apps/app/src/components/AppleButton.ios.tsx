import * as AppleAuthentication from 'expo-apple-authentication';
import { ActivityIndicator, View } from 'react-native';
import { colors, radius } from '@/theme';

/** iOS: Apple-дың ресми «Sign in with Apple» батырмасы (App Store нұсқаулығы 4.8). */
export function AppleButton({ onPress, loading }: { title: string; onPress: () => void; loading?: boolean }) {
  if (loading) {
    return (
      <View style={{ height: 50, borderRadius: radius.md, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#000" />
      </View>
    );
  }
  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
      cornerRadius={radius.md}
      style={{ height: 50, width: '100%' }}
      onPress={onPress}
    />
  );
}
