import { Alert, Platform } from 'react-native';

/** Alert.alert вебте жұмыс істемейді, сондықтан екі платформаға ортақ орама. */
export function confirmAsync(options: {
  title: string;
  message?: string;
  confirmText: string;
  cancelText: string;
  destructive?: boolean;
}): Promise<boolean> {
  if (Platform.OS === 'web') {
    const text = options.message ? `${options.title}\n\n${options.message}` : options.title;
    return Promise.resolve(typeof window !== 'undefined' && window.confirm(text));
  }
  return new Promise((resolve) => {
    Alert.alert(
      options.title,
      options.message,
      [
        { text: options.cancelText, style: 'cancel', onPress: () => resolve(false) },
        { text: options.confirmText, style: options.destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

export function alertMessage(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}
