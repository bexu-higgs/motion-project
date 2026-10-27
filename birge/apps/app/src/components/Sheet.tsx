import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, radius, space } from '@/theme';
import { IconButton, type IconName } from './ui';
import type { InteractionState } from './pressable';

/** Төменнен шығатын панель (вебте — экран ортасындағы терезе). */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  closeLabel,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  closeLabel: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType={Platform.OS === 'web' ? 'fade' : 'slide'} onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={closeLabel} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]} accessibilityViewIsModal>
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
              {title}
            </Text>
            <IconButton icon="close" label={closeLabel} onPress={onClose} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export interface SheetAction {
  key: string;
  label: string;
  icon: IconName;
  danger?: boolean;
  onPress: () => void;
}

export function ActionSheet({
  visible,
  onClose,
  title,
  actions,
  closeLabel,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  actions: SheetAction[];
  closeLabel: string;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title} closeLabel={closeLabel}>
      {actions.map((action) => (
        <Pressable
          key={action.key}
          testID={`action-${action.key}`}
          accessibilityRole="button"
          onPress={() => {
            onClose();
            action.onPress();
          }}
          style={({ pressed, hovered }: InteractionState) => [styles.action, (pressed || hovered) && styles.actionHover]}
        >
          <Ionicons name={action.icon} size={20} color={action.danger ? colors.danger : colors.textMuted} />
          <Text style={[styles.actionText, action.danger && { color: colors.danger }]}>{action.label}</Text>
        </Pressable>
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
    alignItems: 'center',
  },
  sheet: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '88%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderBottomLeftRadius: Platform.OS === 'web' ? radius.xl : 0,
    borderBottomRightRadius: Platform.OS === 'web' ? radius.xl : 0,
    borderWidth: 1,
    borderColor: colors.border,
    paddingTop: space.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingBottom: space.sm, gap: space.sm },
  title: { flex: 1, color: colors.text, fontSize: font.h3, fontWeight: '700' },
  content: { paddingHorizontal: space.lg, gap: space.md, paddingBottom: space.sm },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
    borderRadius: radius.md,
  },
  actionHover: { backgroundColor: colors.surfaceAlt },
  actionText: { color: colors.text, fontSize: font.body },
});
