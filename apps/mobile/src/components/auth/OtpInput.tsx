import { View, TextInput, Text, Pressable } from 'react-native';
import { useRef } from 'react';
import { useTheme } from '../../theme/ThemeContext';
import { spacing, typography, radius } from '../../theme';

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
  const { colors } = useTheme();
  const inputRef = useRef<TextInput>(null);
  
  // For accessibility, we use a single hidden input that screen readers can interact with
  // The visual cells are decorative and tappable to focus the hidden input
  
  const handleChange = (text: string) => {
    const numericText = text.replace(/\D/g, '').slice(0, OTP_LENGTH);
    onChangeText(numericText);
    
    if (numericText.length === OTP_LENGTH && onComplete) {
      onComplete(numericText);
    }
  };

  const handleCellPress = () => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus();
    }
  };

  const shouldShowError = error && value.length < OTP_LENGTH;

  return (
    <View style={{ gap: spacing.sm, alignItems: 'center', paddingHorizontal: spacing.lg }}>
      {/* Accessible single input for screen readers */}
      <TextInput
        ref={inputRef}
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          opacity: 0,
          top: 0,
          left: 0,
        }}
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
      
      {/* Visual cells for sighted users - matching mockup design */}
      <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center', width: '100%' }} importantForAccessibility="no">
        {Array.from({ length: OTP_LENGTH }, (_, i) => {
          const isFilled = value.length > i;
          const isActive = value.length === i;
          const isError = error && shouldShowError;
          
          return (
            <Pressable
              key={i}
              onPress={handleCellPress}
              disabled={disabled}
              accessibilityLabel={`Digit ${i + 1}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              style={{ flex: 1, maxWidth: 52 }}
            >
              <View
                style={{
                  width: 52,
                  height: 60,
                  borderWidth: 1.5,
                  borderColor: isError ? colors.error : (isActive ? colors.emeraldDeep : colors.line),
                  borderRadius: radius.sm,
                  backgroundColor: isFilled ? colors.emeraldTint : colors.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                  ...(isActive && !disabled && !isError && {
                    shadowColor: colors.emeraldTint,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 1,
                    shadowRadius: 12,
                    elevation: 4,
                  }),
                  ...(disabled && {
                    opacity: 0.5,
                  }),
                }}
              >
                <Text
                  style={{
                    ...typography.display,
                    fontSize: 24,
                    color: isFilled ? colors.ink : colors.sage,
                    lineHeight: 32,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {value[i] || ''}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      
      {shouldShowError ? <Text style={{ ...typography.caption, color: colors.error, marginTop: spacing.sm }}>{error}</Text> : null}
    </View>
  );
}