import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, ViewStyle, TextStyle, TextInputProps, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { radius, spacing, typography, shadow, touchTarget, borderWidth, borderWidthThick } from '../theme';

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
  const { colors } = useTheme();
  
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
    primary: { color: colors.surface },
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
        <ActivityIndicator size="small" color={variant === 'primary' || variant === 'ghost' ? colors.surface : colors.emeraldDeep} />
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
  const { colors } = useTheme();
  
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
            outlineStyle: 'none',
            outlineWidth: 0,
          } as any}
          {...props}
        />
        {rightElement}
      </View>
      {error ? <Text style={{ ...typography.caption, color: colors.error }}>{error}</Text> : null}
      {helperText && !error ? <Text style={{ ...typography.caption, color: colors.sage }}>{helperText}</Text> : null}
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
  const { colors } = useTheme();
  
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
  const { colors } = useTheme();
  
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
  const { colors } = useTheme();
  
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {Array.from({ length: totalSteps }, (_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            backgroundColor: i < currentStep ? colors.emeraldDeep : colors.lineSoft,
          }}
        />
      ))}
    </View>
  );
}

export function BrandHeader({ onBack }: { onBack?: () => void }) {
  const { colors } = useTheme();
  
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: onBack ? 'space-between' : 'center', paddingTop: onBack ? spacing.sm : spacing.lg }}>
      {!!onBack && (
        <TouchableOpacity
          style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
          onPress={onBack}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={20} color={colors.ink} />
        </TouchableOpacity>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Image
          source={require('../../assets/financial_hub_logo_transparent.png')}
          style={{ width: 26, height: 26 }}
          resizeMode="contain"
        />
        <Text style={{ ...typography.heading, color: colors.ink, letterSpacing: -0.18 }}>
          Financial Hub
        </Text>
      </View>
      {!!onBack && <View style={{ width: 36 }} />}
    </View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  
  return (
    <Text style={{ ...typography.eyebrow, color: colors.ink, marginTop: spacing.xxl, marginBottom: spacing.md }}>
      {children}
    </Text>
  );
}