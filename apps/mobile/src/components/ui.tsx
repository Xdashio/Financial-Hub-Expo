import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, ViewStyle, TextStyle, TextInputProps, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { colors, radius, spacing, typography, shadow, touchTarget, borderWidth, borderWidthThick } from '../theme';

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
  // Buttons are tappable, high-intent surfaces — they get the crisper
  // 1.5px border treatment from the mockups, not the softer hairline used
  // for passive containers like Card. `radius.button` is the single radius
  // token every Button variant/size uses, so buttons stay visually
  // consistent everywhere they appear.
  const baseStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.button,
    borderWidth: borderWidthThick,
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
      borderWidth: 0,
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
    primary: { color: '#fff' },
    secondary: { color: colors.ink },
    ghost: { color: colors.emeraldDeep },
    outline: { color: colors.emeraldDeep },
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
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}>
          {leftIcon && <View style={{ flexShrink: 0 }}>{leftIcon}</View>}
          <Text style={[{ ...typography.body, ...textStyles[variant] }, loading && { opacity: 0 }]}>{children}</Text>
          {rightIcon && (
            <View style={{ flexShrink: 0, marginLeft: spacing.xs }}>
              {rightIcon}
            </View>
          )}
        </View>
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
  gap?: number;
}

export function Input({
  label,
  error,
  helperText,
  leftElement,
  rightElement,
  style,
  gap = spacing.md,
  ...props
}: InputProps) {
  return (
    <View style={{ gap, ...style }}>
      {!!label && (
        <Text style={{ ...typography.caption, color: colors.ink, letterSpacing: 0.36 }}>
          {label}
        </Text>
      )}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          backgroundColor: colors.surface,
          borderWidth: borderWidth,
          borderColor: error ? colors.error : colors.line,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          minHeight: touchTarget.minHeight,
        }}
      >
        {leftElement}
        <TextInput
          style={{
            flex: 1,
            ...typography.body,
            color: colors.ink,
            paddingVertical: spacing.sm,
          }}
          {...props}
        />
        {rightElement}
      </View>
      {!!error && <Text style={{ ...typography.caption, color: colors.error }}>{error}</Text>}
      {!!helperText && !error && <Text style={{ ...typography.caption, color: colors.sage }}>{helperText}</Text>}
    </View>
  );
}

export interface CardProps extends React.ComponentPropsWithoutRef<typeof View> {
  children: React.ReactNode;
  elevated?: boolean;
  interactive?: boolean;
  style?: ViewStyle;
}

export function Card({ children, elevated = false, interactive = false, style, ...props }: CardProps) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          // Static display cards (balances, summaries) get the quiet 1px
          // line from the mockups; interactive/selectable cards (option
          // rows, pocket picks) get the crisper 1.5px so they read as
          // tappable — matching .option-card / .flow-pocket in the mockups.
          borderWidth: interactive ? borderWidthThick : borderWidth,
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
  const insets = useSafeAreaInsets();
  return (
    <View style={[{ flex: 1, backgroundColor: colors.paper, paddingTop: insets.top }, style]}>
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
      {!!onBack && (
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={20} color={colors.ink} />
        </TouchableOpacity>
      )}
      <View style={styles.brandMark}>
        <Image
          source={require('../../assets/financial_hub_logo_transparent.png')}
          style={styles.brandLogo}
          resizeMode="contain"
        />
        <Text style={styles.brandWordmark}>Financial Hub</Text>
      </View>
      {!!onBack && <View style={{ width: touchTarget.minWidth }} />}
    </View>

  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text style={[typography.eyebrow, { marginTop: spacing.xl, marginBottom: spacing.md }]}>{children}</Text>
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
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  backButton: {
    width: touchTarget.minWidth,
    height: touchTarget.minHeight,
    // Pull the tap target back toward the screen edge — brandBar already
    // has paddingHorizontal(lg), so a fixed-width box with no extra
    // padding of its own would sit ~44px in from the edge. The negative
    // margin brings the chevron glyph close to flush while alignItems/
    // justifyContent center keep it (and not just its padded box)
    // vertically centered in the row.
    marginLeft: -spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  brandLogo: {
    width: 32,
    height: 32,
  },
  brandWordmark: {
    ...typography.heading,
    color: colors.ink,
    letterSpacing: -0.18,
  },
});