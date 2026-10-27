import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';
import { Button } from './ui';

/** Android мен вебте: Apple-дың дизайн нұсқаулығына сай қара батырма. */
export function AppleButton({ title, onPress, loading }: { title: string; onPress: () => void; loading?: boolean }) {
  return (
    <Button
      testID="sign-in-apple"
      variant="dark"
      title={title}
      onPress={onPress}
      loading={loading}
      icon={<Ionicons name="logo-apple" size={20} color={colors.white} />}
    />
  );
}
