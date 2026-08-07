import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, ActivityIndicator, ScrollView, ViewStyle, TextStyle, TextInputProps } from 'react-native';
import { colors, radius, spacing, typography, shadow, touchTarget, borderWidth } from '../theme';

export interface ButtonProps extends Omit<React.ComponentPropsWithoutRef<typeof TouchableOpacity>, 'children' | 'style'> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: ViewStyle;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  leftIcon,
  rightIcon,
  style,
  disabled,
  ...props
}: ButtonProps) {
  const baseStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: borderWidth,
    minHeight: touchTarget.minHeight,
  };

  const variantStyles: Record<string, ViewStyle> = {
    primary: {
      backgroundColor: colors.emeraldDeep,
      borderColor: colors.emeraldDeep,
    },
    secondary: {
      backgroundColor: colors.surface,
      borderColor: colors.line,
    },
    ghost: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
    },
    outline: {
      backgroundColor: 'transparent',
      borderColor: colors.emeraldDeep,
    },
  };

  const sizeStyles: Record<string, ViewStyle> = {
    sm: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    md: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
    lg: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  };

  const textStyles: Record<string, TextStyle> = {
    primary: { color: '#fff', fontWeight: '600' },
    secondary: { color: colors.ink, fontWeight: '600' },
    ghost: { color: colors.emeraldDeep, fontWeight: '600' },
    outline: { color: colors.emeraldDeep, fontWeight: '600' },
  };

  return (
    <TouchableOpacity
      style={[
        baseStyle,
        variantStyles[variant],
        sizeStyles[size],
        fullWidth && { width: '100%' },
        { opacity: loading || disabled ? 0.6 : 1 },
        style,
      ]}
      disabled={loading || disabled}
      activeOpacity={0.85}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'primary' || variant === 'ghost' ? '#fff' : colors.emeraldDeep} />
      ) : (
        <>
          {leftIcon}
          <Text style={[{ ...typography.body, ...textStyles[variant] }, loading && { opacity: 0 }]}>{children}</Text>
          {rightIcon}
        </>
      )}
    </TouchableOpacity>
  );
}

export interface InputProps extends Omit<React.ComponentPropsWithoutRef<typeof TextInput>, 'style' | 'autoComplete'> {
  label?: string;
  error?: string;
  helperText?: string;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
  style?: ViewStyle;
  autoComplete?: TextInputProps['autoComplete'];
}

export function Input({
  label,
  error,
  helperText,
  leftElement,
  rightElement,
  style,
  ...props
}: InputProps) {
  return (
    <View style={{ gap: spacing.xs, ...style }}>
      {label && (
        <Text style={{ ...typography.caption, fontWeight: '600', color: colors.ink, letterSpacing: 0.36 }}>
          {label}
        </Text>
      )}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surface,
          borderWidth: borderWidth,
          borderColor: error ? colors.error : colors.line,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          minHeight: touchTarget.minHeight,
        }}
      >
        {leftElement && <View style={{ marginRight: spacing.sm }}>{leftElement}</View>}
        <TextInput
          style={{
            flex: 1,
            ...typography.body,
            color: colors.ink,
            paddingVertical: spacing.sm,
          }}
          {...props}
        />
        {rightElement && <View style={{ marginLeft: spacing.sm }}>{rightElement}</View>}
      </View>
      {error && <Text style={{ ...typography.caption, color: colors.error }}>{error}</Text>}
      {helperText && !error && <Text style={{ ...typography.caption, color: colors.sage }}>{helperText}</Text>}
    </View>
  );
}

export interface CardProps extends React.ComponentPropsWithoutRef<typeof View> {
  children: React.ReactNode;
  elevated?: boolean;
  style?: ViewStyle;
}

export function Card({ children, elevated = false, style, ...props }: CardProps) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderWidth: borderWidth,
          borderColor: colors.line,
          borderRadius: radius.lg,
          padding: spacing.lg,
          ...shadow.default,
        },
        elevated && shadow.elevated,
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

export function ScreenContainer({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View style={[{ flex: 1, backgroundColor: colors.paper }, style]}>
      {children}
    </View>
  );
}

export function SafeScrollView({ children, contentContainerStyle, ...props }: {
  children: React.ReactNode;
  contentContainerStyle?: ViewStyle;
}) {
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }, contentContainerStyle]}
        showsVerticalScrollIndicator={false}
        {...props}
      >
        {children}
      </ScrollView>
    </View>
  );
}

export function ProgressIndicator({ currentStep, totalSteps = 4 }: { currentStep: number; totalSteps?: number }) {
  return (
    <View style={styles.progressRow}>
      {Array.from({ length: totalSteps }, (_, i) => (
        <View
          key={i}
          style={[
            styles.progressSeg,
            i < currentStep && styles.progressSegDone,
            i === currentStep && styles.progressSegActive,
          ]}
        />
      ))}
    </View>
  );
}

export function BrandHeader({ onBack }: { onBack?: () => void }) {
  return (
    <View style={styles.brandBar}>
      {onBack && (
        <TouchableOpacity
          style={{ padding: spacing.sm, minWidth: touchTarget.minWidth, minHeight: touchTarget.minHeight }}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <Image
            source={require('../../../assets/chevron-left.png')}
            style={{ width: 20, height: 20, tintColor: colors.ink }}
          />
        </TouchableOpacity>
      )}
      <View style={styles.brandMark}>
        <View style={styles.brandGlyph}>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>FH</Text>
        </View>
        <Text style={styles.brandWordmark}>Financial Hub</Text>
      </View>
      {onBack && <View style={{ width: 40 }} />}
    </View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text style={[typography.eyebrow, { marginTop: spacing.xxl, marginBottom: spacing.md }]}>{children}</Text>
  );
}

const styles = StyleSheet.create({
  progressRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: spacing.lg,
  },
  progressSeg: {
    flex: 1,
    height: 4,
    backgroundColor: colors.lineSoft,
    borderRadius: radius.pill,
  },
  progressSegDone: {
    backgroundColor: colors.emeraldDeep,
  },
  progressSegActive: {
    backgroundColor: colors.emeraldDeep,
  },
  brandBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
  },
  brandMark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brandGlyph: {
    width: 26,
    height: 26,
    borderRadius: radius.xs,
    backgroundColor: colors.emeraldDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandWordmark: {
    ...typography.heading,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.18,
  },
});