import { Alert, Platform } from 'react-native';

/**
 * Alert.alert() is a no-op on react-native-web (see
 * react-native-web/dist/exports/Alert), so any code relying on it for error
 * or confirmation messaging fails completely silently in a browser — the
 * user sees no dialog, no console output, nothing. This wrapper falls back
 * to window.alert / window.confirm on web so messages are still visible,
 * while native platforms keep using the real native Alert UI.
 *
 * Drop-in replacement: `showAlert(title, message)` instead of
 * `Alert.alert(title, message)`.
 */
export function showAlert(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;
    const win = (globalThis as any).window;
    if (win && typeof win.alert === 'function') {
      win.alert(text);
    } else {
      console.warn(`[Alert] ${text}`);
    }
    return;
  }
  Alert.alert(title, message);
}

/**
 * Cross-platform confirm dialog. Resolves true if the user confirms.
 * Web uses window.confirm; native uses Alert.alert with Cancel/Confirm buttons.
 */
export function showConfirm(
  title: string,
  message?: string,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel'
): Promise<boolean> {
  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;
    const win = (globalThis as any).window;
    const result = win && typeof win.confirm === 'function' ? win.confirm(text) : false;
    return Promise.resolve(result);
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, onPress: () => resolve(true) },
    ]);
  });
}