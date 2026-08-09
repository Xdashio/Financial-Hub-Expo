import React, { useCallback, useRef, useState } from 'react';
import { ConfirmModal } from '@/components/ui';

interface AlertOptions {
  confirmLabel?: string;
}

interface ConfirmOptions {
  confirmLabel?: string;
  cancelLabel?: string;
  /** Renders the confirm button in the destructive (clay/red) color. */
  destructive?: boolean;
}

interface ModalState {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
}

/**
 * Themed replacement for the app's various Alert.alert() call sites.
 *
 * Alert.alert() is a no-op on react-native-web and, even on native, renders
 * unstyled OS chrome that ignores the app's palette and dark/light mode.
 * This hook renders the same on-brand ConfirmModal used for the sign-out
 * flow, behind an async API shaped like the old Alert.alert callback style
 * so existing call sites are a near-mechanical swap:
 *
 *   Alert.alert('Error', 'Please try again.');
 *   -->
 *   alert('Error', 'Please try again.');
 *
 *   Alert.alert('Delete pocket?', 'This cannot be undone.', [
 *     { text: 'Cancel', style: 'cancel' },
 *     { text: 'Delete', style: 'destructive', onPress: doDelete },
 *   ]);
 *   -->
 *   const ok = await confirm('Delete pocket?', 'This cannot be undone.', {
 *     confirmLabel: 'Delete',
 *     destructive: true,
 *   });
 *   if (ok) doDelete();
 *
 * Usage in a screen:
 *   const { alert, confirm, modal } = useAlertModal();
 *   ...
 *   return (
 *     <View>
 *       ...screen content...
 *       {modal}
 *     </View>
 *   );
 */
export function useAlertModal() {
  const [state, setState] = useState<ModalState | null>(null);
  const [loading, setLoading] = useState(false);
  const resolveRef = useRef<((confirmed: boolean) => void) | null>(null);

  const close = useCallback((confirmed: boolean) => {
    resolveRef.current?.(confirmed);
    resolveRef.current = null;
    setState(null);
    setLoading(false);
  }, []);

  // Single-button "alert" mode — no cancelLabel, so ConfirmModal renders
  // just the one dismiss/OK button.
  const alert = useCallback((title: string, message?: string, options?: AlertOptions) => {
    return new Promise<void>((resolve) => {
      resolveRef.current = () => resolve();
      setState({
        title,
        message,
        confirmLabel: options?.confirmLabel ?? 'OK',
      });
    });
  }, []);

  // Two-button "confirm" mode — resolves true/false depending on which
  // button the person tapped (or false on backdrop/back dismiss).
  const confirm = useCallback((title: string, message?: string, options?: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setState({
        title,
        message,
        confirmLabel: options?.confirmLabel ?? 'Confirm',
        cancelLabel: options?.cancelLabel ?? 'Cancel',
        destructive: options?.destructive,
      });
    });
  }, []);

  const modal = state ? (
    <ConfirmModal
      visible
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      destructive={state.destructive}
      loading={loading}
      onConfirm={() => close(true)}
      onCancel={state.cancelLabel ? () => close(false) : undefined}
    />
  ) : null;

  return { alert, confirm, modal, setLoading };
}