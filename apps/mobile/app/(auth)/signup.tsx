import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, shadow, touchTarget } from '@/theme';
import { useAuthStore } from '@/services/auth';
import { useAlertModal } from '@/hooks/useAlertModal';
import { Button, Input, ScreenContainer, SafeScrollView, BrandHeader, ProgressIndicator, SectionTitle } from '@/components/ui';
import { ChevronLeft } from 'lucide-react-native';
import React from 'react';

export default function SignUpScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { sendSignupOtp } = useAuthStore();
  const { alert, modal } = useAlertModal();
  const [phone, setPhone] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [phoneError, setPhoneError] = React.useState('');
  const [nameError, setNameError] = React.useState('');

  const validatePhone = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    return cleaned.length === 9 && cleaned.startsWith('7');
  };

  const validateName = (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length < 2) return 'Please enter your full name';
    // Must be at least two words (first + last name)
    if (!/\s/.test(trimmed)) return 'Please enter both your first and last name';
    return null;
  };

  // Strip emojis and characters that aren't letters, spaces, hyphens, or apostrophes.
  // Uses \p{L} (unicode letter property) rather than a-zA-Z so names with
  // diacritics — common in Kikuyu/Kalenjin/Luo orthography, e.g. "Wanjirũ",
  // "Njũgũna" — aren't mangled character-by-character as the user types.
  const sanitiseName = (text: string) =>
    text.replace(/[^\p{L}\s'-]/gu, '');

  const formatPhone = (value: string) => {
    // Strip everything except digits first (blocks emojis, letters, symbols)
    const cleaned = value.replace(/\D/g, '').slice(0, 9);
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)}`;
  };

  const handlePhoneChange = (text: string) => {
    const formatted = formatPhone(text);
    setPhone(formatted);
    if (phoneError) setPhoneError('');
  };

  const handleNameChange = (text: string) => {
    // Sanitise but do NOT trim — trimming on change removes spaces as the user types
    const clean = sanitiseName(text);
    setFullName(clean);
    if (nameError) setNameError('');
  };

  const handleContinue = async () => {
    let hasError = false;

    const nameErr = validateName(fullName);
    if (nameErr) {
      setNameError(nameErr);
      hasError = true;
    }

    if (!validatePhone(phone)) {
      setPhoneError('Enter a valid Kenyan number starting with 7 (e.g., 712 345 678)');
      hasError = true;
    }

    if (hasError) return;
    
    setIsLoading(true);
    try {
      const fullPhone = `+254${phone.replace(/\s/g, '')}`;
      // sendSignupOtp checks whether the number is already registered
      // *before* creating anything — see auth.ts for why the plain
      // sendOtp(allowSignup: true) call could never actually detect this.
      await sendSignupOtp(fullPhone, fullName.trim());

      // Navigate to OTP verification with the phone and name
      router.push({
        pathname: '/(auth)/verify-otp',
        params: {
          phone: fullPhone,
          fullName,
          mode: 'signup',
        },
      });
    } catch (error: any) {
      // If user already exists, redirect to signin
      if (error?.message?.includes('already registered') || error?.message?.includes('already exists')) {
        await alert('Account exists', 'An account with this number already exists. Redirecting to sign in...');
        router.replace('/(auth)/signin');
      } else {
        await alert('Error', error?.message || 'Failed to send verification code. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <SafeScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
        <BrandHeader onBack={() => {}} fallbackHref="/landing" />
        
        <View style={{ alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.xxl }}>
          <Text style={{ ...typography.eyebrow, color: colors.sage }}>Your money, in pockets</Text>
          <Text style={{ ...typography.display, color: colors.ink, marginTop: spacing.sm, textAlign: 'center' }}>Create your account</Text>
          <Text style={{ ...typography.body, color: colors.sage, marginTop: spacing.md, textAlign: 'center', lineHeight: 22 }}>Enter your phone number — we'll send a one-time code to verify you.</Text>
        </View>

        <View style={{ gap: spacing.lg, marginBottom: spacing.xl }}>
          <Input
            label="Phone number"
            value={phone}
            onChangeText={handlePhoneChange}
            placeholder="712 345 678"
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
            leftElement={<Text style={{ ...typography.body, fontSize: 15, color: colors.sage }}>+254</Text>}
            error={phoneError}
            accessible={true}
            accessibilityLabel="Phone number"
          />

          <Input
            label="Full name"
            value={fullName}
            onChangeText={handleNameChange}
            placeholder="Amina Mwangi"
            textContentType="name"
            autoComplete="name"
            error={nameError}
            accessible={true}
            accessibilityLabel="Full name"
          />
        </View>

        <Button
          fullWidth
          size="lg"
          loading={isLoading}
          onPress={handleContinue}
          rightIcon={<ChevronLeft size={18} color={colors.surface} style={{ transform: [{ rotate: '180deg' }] }} />}
        >
          Send one-time code
        </Button>

        <View style={{ flexDirection: 'row', gap: 4, marginTop: spacing.xxl, alignItems: 'center', paddingBottom: spacing.xl }}>
          <Text style={{ ...typography.body, color: colors.sage }}>Already have an account?</Text>
          <Pressable onPress={() => router.replace('/(auth)/signin')} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
            <Text style={{ color: colors.emeraldDeep }}>Sign in</Text>
          </Pressable>
        </View>
      </SafeScrollView>
      {modal}
    </ScreenContainer>
  );
}