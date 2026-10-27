import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, radius, space } from '@/theme';

type ToastKind = 'info' | 'error';
interface ToastState {
  id: number;
  message: string;
  kind: ToastKind;
}

const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const show = useCallback((message: string, kind: ToastKind = 'info') => {
    setToast({ id: Date.now(), message, kind });
  }, []);

  useEffect(() => {
    if (!toast) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), toast.kind === 'error' ? 4000 : 2500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [toast]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? (
        <View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 24 }]}>
          <View style={[styles.toast, toast.kind === 'error' && styles.error]} accessibilityLiveRegion="polite" accessibilityRole="alert">
            <Text style={styles.text}>{toast.message}</Text>
          </View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: space.lg },
  toast: {
    backgroundColor: colors.surfaceHover,
    borderRadius: radius.pill,
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.lg,
    maxWidth: 520,
    borderWidth: 1,
    borderColor: colors.border,
  },
  error: { backgroundColor: '#3A1820', borderColor: '#5C2530' },
  text: { color: colors.text, fontSize: font.small, textAlign: 'center' },
});
