import { View, TextInput, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing, typography, touchTarget } from '../../theme';

interface OtpInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onComplete?: (code: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
  error?: string;
  accessibilityLabel?: string;
}

const OTP_LENGTH = 6;

export function OtpInput({
  value,
  onChangeText,
  onComplete,
  autoFocus = true,
  disabled = false,
  error,
  accessibilityLabel = 'Enter the 6-digit verification code',
}: OtpInputProps) {
  // For accessibility, we use a single hidden input that screen readers can interact with
  // The visual cells are decorative and don't receive focus
  
  const handleChange = (text: string) => {
    const numericText = text.replace(/\D/g, '').slice(0, OTP_LENGTH);
    onChangeText(numericText);
    
    if (numericText.length === OTP_LENGTH && onComplete) {
      onComplete(numericText);
    }
  };

  return (
    <View style={styles.container}>
      {/* Accessible single input for screen readers */}
      <TextInput
        style={styles.hiddenInput}
        value={value}
        onChangeText={handleChange}
        maxLength={OTP_LENGTH}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoFocus={autoFocus}
        editable={!disabled}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Enter the 6-digit code sent to your phone"
        accessibilityRole="text"
        importantForAccessibility="yes"
        autoComplete="one-time-code"
      />
      
      {/* Visual cells for sighted users */}
      <View style={styles.cellsContainer} pointerEvents="none" importantForAccessibility="no">
        {Array.from({ length: OTP_LENGTH }, (_, i) => (
          <View
            key={i}
            style={[
              styles.cell,
              value.length > i && styles.cellFilled,
              value.length === i && !disabled && styles.cellActive,
              error && styles.cellError,
            ]}
          >
            <Text
              style={[
                styles.cellText,
                value.length > i && styles.cellTextFilled,
                value.length === i && !disabled && styles.cellTextActive,
              ]}
            >
              {value[i] || '·'}
            </Text>
          </View>
        ))}
      </View>
      
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    alignItems: 'center',
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    // This ensures the input is accessible but not visible
  },
  cellsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  cell: {
    width: 52,
    height: 56,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: touchTarget.minWidth,
    minHeight: touchTarget.minHeight,
  },
  cellFilled: {
    borderColor: colors.emeraldDeep,
    backgroundColor: colors.emeraldTint,
  },
  cellActive: {
    borderColor: colors.emeraldDeep,
    borderWidth: 2,
  },
  cellError: {
    borderColor: colors.error,
  },
  cellText: {
    ...typography.display,
    fontSize: 24,
    fontWeight: '700',
    color: colors.sage,
  },
  cellTextFilled: {
    color: colors.emeraldDeep,
  },
  cellTextActive: {
    color: colors.emeraldDeep,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
  },
});