import { Ionicons } from '@expo/vector-icons';
import { useState, type ComponentProps, type ComponentRef, type ReactNode, type Ref } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colorFor, colors, font, radius, space } from '@/theme';
import type { InteractionState } from './pressable';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Screen({
  children,
  scroll = true,
  maxWidth = 560,
  edges = ['bottom', 'left', 'right'],
  style,
}: {
  children: ReactNode;
  scroll?: boolean;
  maxWidth?: number;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
}) {
  const inner = <View style={[styles.screenInner, { maxWidth }, style]}>{children}</View>;
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'light' | 'dark';

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  style,
  compact,
  testID,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: IconName | ReactNode;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
  testID?: string;
}) {
  const v = VARIANTS[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: Boolean(inactive), busy: Boolean(loading) }}
      onPress={inactive ? undefined : onPress}
      style={({ pressed, hovered }: InteractionState) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: pressed ? v.pressed : hovered ? v.hover : v.bg, borderColor: v.border },
        inactive && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text} />
      ) : (
        <>
          {typeof icon === 'string' ? <Ionicons name={icon as IconName} size={compact ? 16 : 20} color={v.text} /> : icon}
          <Text style={[styles.buttonText, compact && styles.buttonTextCompact, { color: v.text }]} numberOfLines={1}>
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const VARIANTS: Record<ButtonVariant, { bg: string; hover: string; pressed: string; text: string; border: string }> = {
  primary: { bg: colors.primary, hover: '#8B6EFF', pressed: colors.primaryPressed, text: colors.white, border: colors.primary },
  secondary: { bg: colors.surfaceAlt, hover: colors.surfaceHover, pressed: colors.surface, text: colors.text, border: colors.border },
  ghost: { bg: 'transparent', hover: colors.surfaceAlt, pressed: colors.surface, text: colors.text, border: 'transparent' },
  danger: {
    bg: colors.dangerSoft,
    hover: 'rgba(255,90,95,0.22)',
    pressed: 'rgba(255,90,95,0.3)',
    text: colors.danger,
    border: 'transparent',
  },
  light: { bg: colors.white, hover: '#ECECF2', pressed: '#DCDCE4', text: '#111111', border: colors.white },
  dark: { bg: colors.black, hover: '#16161C', pressed: '#202028', text: colors.white, border: '#3A3A44' },
};

export function IconButton({
  icon,
  label,
  onPress,
  color = colors.text,
  size = 22,
  style,
  active,
  disabled,
  testID,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
  active?: boolean;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      // Вебте тінтуірді апарғанда түсіндірме шығады.
      {...({ title: label } as object)}
      hitSlop={8}
      onPress={disabled ? undefined : onPress}
      style={({ pressed, hovered }: InteractionState) => [
        styles.iconButton,
        active && styles.iconButtonActive,
        (pressed || hovered) && !disabled && styles.iconButtonHover,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

export function TextField({
  label,
  hint,
  error,
  style,
  inputStyle,
  ref,
  ...props
}: TextInputProps & {
  label?: string;
  hint?: string;
  error?: string | null;
  inputStyle?: StyleProp<TextStyle>;
  ref?: Ref<ComponentRef<typeof TextInput>>;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, style as StyleProp<ViewStyle>]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.textFaint}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        style={[styles.input, focused && styles.inputFocused, error ? styles.inputError : null, inputStyle]}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Avatar({ id, name, size = 36 }: { id: string; name: string; size?: number }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join('') || '?';
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: colorFor(id) }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function H1({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <Text accessibilityRole="header" style={[styles.h1, style]}>
      {children}
    </Text>
  );
}

export function H2({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <Text accessibilityRole="header" style={[styles.h2, style]}>
      {children}
    </Text>
  );
}

export function Body({
  children,
  style,
  muted,
  selectable,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  muted?: boolean;
  selectable?: boolean;
}) {
  return (
    <Text selectable={selectable} style={[styles.body, muted && styles.muted, style]}>
      {children}
    </Text>
  );
}

export function ErrorBanner({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <View style={styles.errorBanner} accessibilityRole="alert">
      <Ionicons name="alert-circle" size={18} color={colors.danger} />
      <Text style={styles.errorBannerText}>{message}</Text>
    </View>
  );
}

export function Checkbox({
  checked,
  onChange,
  children,
  testID,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={styles.checkboxRow}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked ? <Ionicons name="checkmark" size={16} color={colors.white} /> : null}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </Pressable>
  );
}

export function ListRow({
  icon,
  title,
  subtitle,
  onPress,
  right,
  danger,
  testID,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: ReactNode;
  danger?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed, hovered }: InteractionState) => [styles.row, (pressed || hovered) && onPress ? styles.rowHover : null]}
    >
      {icon ? <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.textMuted} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, danger && { color: colors.danger }]}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textFaint} /> : null)}
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { flexGrow: 1, paddingHorizontal: space.lg, paddingVertical: space.xl },
  screenInner: { width: '100%', alignSelf: 'center', gap: space.lg, flexGrow: 1 },
  button: {
    minHeight: 50,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    borderWidth: 1,
  },
  buttonCompact: { minHeight: 38, paddingHorizontal: space.md, borderRadius: radius.sm },
  buttonText: { fontSize: font.body, fontWeight: '600' },
  buttonTextCompact: { fontSize: font.small },
  disabled: { opacity: 0.5 },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  iconButtonHover: { backgroundColor: colors.surfaceAlt },
  iconButtonActive: { backgroundColor: colors.primarySoft },
  field: { gap: space.xs + 2 },
  label: { color: colors.textMuted, fontSize: font.small, fontWeight: '600' },
  input: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: space.md + 2,
    fontSize: font.body,
    outlineWidth: 0,
  },
  inputFocused: { borderColor: colors.primary },
  inputError: { borderColor: colors.danger },
  hint: { color: colors.textFaint, fontSize: font.tiny + 1 },
  errorText: { color: colors.danger, fontSize: font.tiny + 1 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontWeight: '700' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    gap: space.md,
  },
  h1: { color: colors.text, fontSize: font.title, fontWeight: '800', letterSpacing: -0.3 },
  h2: { color: colors.text, fontSize: font.h2, fontWeight: '700' },
  body: { color: colors.text, fontSize: font.body, lineHeight: 22 },
  muted: { color: colors.textMuted },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: space.md,
  },
  errorBannerText: { color: colors.danger, flex: 1, fontSize: font.small },
  checkboxRow: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.textFaint,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
  },
  rowHover: { backgroundColor: colors.surfaceAlt },
  rowTitle: { color: colors.text, fontSize: font.body },
  rowSubtitle: { color: colors.textMuted, fontSize: font.small, marginTop: 2 },
});
