import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radius, spacing, typography, shadow, touchTarget } from '@/theme';
import { useAuthStore } from '@/services/auth';
import { Button, Input, ScreenContainer, SafeScrollView, BrandHeader, ProgressIndicator, SectionTitle } from '@/components/ui';
import { ChevronLeft } from 'lucide-react-native';
import React from 'react';

export default function SignUpScreen() {
  const router = useRouter();
  const { sendOtp, signUp } = useAuthStore();
  const [phone, setPhone] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [phoneError, setPhoneError] = React.useState('');
  const [nameError, setNameError] = React.useState('');

  const validatePhone = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length === 9 && cleaned.startsWith('7')) {
      return true;
    }
    return false;
  };

  const formatPhone = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)}`;
  };

  const handlePhoneChange = (text: string) => {
    const formatted = formatPhone(text);
    setPhone(formatted);
    setPhoneError('');
  };

  const handleNameChange = (text: string) => {
    setFullName(text.trim());
    setNameError('');
  };

  const handleContinue = async () => {
    let hasError = false;
    
    if (!fullName.trim()) {
      setNameError('Please enter your full name');
      hasError = true;
    }
    
    if (!validatePhone(phone)) {
      setPhoneError('Please enter a valid Kenyan phone number (e.g., 712 345 678)');
      hasError = true;
    }
    
    if (hasError) return;
    
    setIsLoading(true);
    try {
      const fullPhone = `+254 ${phone.replace(/\s/g, '')}`;
      await sendOtp(fullPhone);
      
      // Navigate to OTP verification with the phone and name
      router.push({
        pathname: '/(auth)/verify-otp',
        params: {
          phone: fullPhone,
          fullName,
          mode: 'signup',
        },
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to send verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <SafeScrollView>
        <BrandHeader onBack={() => router.back()} />
        
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Your money, in pockets</Text>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtext}>Enter your phone number — we'll send a one-time code to verify you.</Text>
        </View>

        <Input
          label="Phone number"
          value={phone}
          onChangeText={handlePhoneChange}
          placeholder="712 345 678"
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          leftElement={<Text style={styles.prefix}>+254</Text>}
          error={phoneError}
          helperText="Uses the device's number pad — no custom keypad needed."
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

        <View style={styles.devNote}>
          <Text style={styles.devNoteText}>
            <Text style={styles.devNoteBold}>Dev build:</Text>{' '}
            SMS OTP needs a paid provider, so in the showcase the code appears on screen / in the terminal. 
            Phone OTP remains the real flow — only the delivery differs until funded.
          </Text>
        </View>

        <Button
          fullWidth
          size="lg"
          loading={isLoading}
          onPress={handleContinue}
          rightIcon={<ChevronLeft size={18} color="#fff" style={{ transform: [{ rotate: '180deg' }] }} />}
        >
          Send one-time code
        </Button>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Already have an account?{' '}
            <Text style={styles.link} onPress={() => router.replace('/(auth)/signin')}>Sign in</Text>
          </Text>
        </View>
      </SafeScrollView>
    </ScreenContainer>
  );
}
 
const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.xxl,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.sage,
  },
  title: {
    ...typography.display,
    fontWeight: '800',
    color: colors.ink,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  subtext: {
    ...typography.body,
    color: colors.sage,
    marginTop: spacing.sm,
    textAlign: 'center',
    lineHeight: 22,
  },
  prefix: {
    ...typography.body,
    fontSize: 15,
    color: colors.sage,
  },
  devNote: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.warningTint,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  devNoteText: {
    ...typography.caption,
    fontSize: 11.5,
    color: colors.warning,
    lineHeight: 18,
    textAlign: 'center',
  },
  devNoteBold: {
    fontWeight: '700',
  },
  footer: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  footerText: {
    ...typography.body,
    color: colors.sage,
  },
  link: {
    color: colors.emeraldDeep,
    fontWeight: '600',
  },
});