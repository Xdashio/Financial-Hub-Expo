import React from 'react';
import { ScreenContainer } from '@/components/ui';
import { View, Text, ScrollView, Pressable, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { radius, spacing, typography, shadow } from '../../src/theme';
import { useTheme } from '@/theme/ThemeContext';
import { useAlertModal } from '@/hooks/useAlertModal';
import { useAuthStore } from '@/services/auth';
import { safeGoBack } from '@/utils/navigation';
import { ArrowLeft, User, Phone, Check, Calendar } from 'lucide-react-native';

function formatJoinedDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PersonalInfoScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const updateFullName = useAuthStore((s) => s.updateFullName);
  const { alert, modal } = useAlertModal();

  const [name, setName] = React.useState(user?.fullName || '');
  const [isSaving, setIsSaving] = React.useState(false);

  const hasChanges = name.trim() !== (user?.fullName || '').trim();

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      alert('Name required', 'Please enter your name.');
      return;
    }

    try {
      setIsSaving(true);
      await updateFullName(trimmed);
      await alert('Saved', 'Your name has been updated.');
    } catch (error) {
      alert('Error', 'Failed to update your name. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg }}>
          <Pressable onPress={() => safeGoBack(router, '/(tabs)/profile')} style={{ padding: spacing.sm }}>
            <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
          </Pressable>
          <Text style={{ ...typography.title, color: colors.ink, marginLeft: spacing.md }}>
            Personal info
          </Text>
        </View>

        {/* Name field */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
          <Text style={{ ...typography.eyebrow, color: colors.ink, marginBottom: spacing.md }}>
            Name
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              borderRadius: radius.md,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.line,
              paddingHorizontal: spacing.md,
            }}
          >
            <User size={18} color={colors.sage} strokeWidth={2} />
            <TextInput
              style={{
                ...typography.body,
                color: colors.ink,
                flex: 1,
                padding: spacing.md,
              }}
              placeholder="Your full name"
              placeholderTextColor={colors.sage}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />
          </View>
        </View>

        {/* Phone field — read-only. Phone is the verified sign-in
            identifier (OTP), so it isn't editable from here; changing it
            would need its own re-verification flow, not a plain text edit. */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
          <Text style={{ ...typography.eyebrow, color: colors.ink, marginBottom: spacing.md }}>
            Phone number
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              borderRadius: radius.md,
              backgroundColor: colors.lineSoft,
              borderWidth: 1,
              borderColor: colors.line,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.md,
            }}
          >
            <Phone size={18} color={colors.sage} strokeWidth={2} />
            <Text style={{ ...typography.body, color: colors.sage, marginLeft: spacing.md, flex: 1 }}>
              {user?.phone || '—'}
            </Text>
          </View>
          <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.sm }}>
            Your phone number is how you sign in and can't be changed here.
          </Text>
        </View>

        {/* Joined date — from auth account creation; read-only identity metadata. */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
          <Text style={{ ...typography.eyebrow, color: colors.ink, marginBottom: spacing.md }}>
            Date joined
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              borderRadius: radius.md,
              backgroundColor: colors.lineSoft,
              borderWidth: 1,
              borderColor: colors.line,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.md,
            }}
          >
            <Calendar size={18} color={colors.sage} strokeWidth={2} />
            <Text style={{ ...typography.body, color: colors.sage, marginLeft: spacing.md, flex: 1 }}>
              {formatJoinedDate(user?.createdAt)}
            </Text>
          </View>
        </View>

        {/* Save button */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <Pressable
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              padding: spacing.md,
              borderRadius: radius.md,
              backgroundColor: hasChanges ? colors.emeraldDeep : colors.lineSoft,
              ...shadow.default,
            }}
            onPress={handleSave}
            disabled={!hasChanges || isSaving}
          >
            {isSaving ? (
              <Text style={{ ...typography.heading, color: colors.surface }}>Saving...</Text>
            ) : (
              <>
                <Check size={20} color={hasChanges ? colors.surface : colors.sage} strokeWidth={2} />
                <Text
                  style={{
                    ...typography.heading,
                    color: hasChanges ? colors.surface : colors.sage,
                    marginLeft: spacing.sm,
                  }}
                >
                  Save changes
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
      {modal}
    </ScreenContainer>
  );
}