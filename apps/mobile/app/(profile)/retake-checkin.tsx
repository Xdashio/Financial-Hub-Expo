import React from 'react';
import { View, Text, ScrollView, SafeAreaView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { radius, spacing, typography } from '../../src/theme';
import { useTheme } from '@/theme/ThemeContext';
import { Button } from '@/components/ui';
import { useOnboardingStore } from '@/services/onboarding-store';
import { ArrowLeft, RefreshCw, Wallet, ListChecks, CalendarClock } from 'lucide-react-native';

const REASONS = [
  { icon: Wallet, title: 'Income changed', desc: 'New job, raise, or a shift in how you get paid' },
  { icon: ListChecks, title: 'Fixed costs changed', desc: 'Rent, bills, or other recurring expenses moved' },
  { icon: CalendarClock, title: 'Habits changed', desc: 'Your spending pattern looks different now' },
];

export default function RetakeCheckinScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const startRetake = useOnboardingStore(s => s.startRetake);

  const handleStart = () => {
    // Resets the onboarding store back to the income step with isRetake
    // flagged so the flow knows to update the existing plan instead of
    // creating a brand new one on completion.
    startRetake();
    router.push('/(onboarding)/income');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg }}>
        <Pressable onPress={() => router.back()} style={{ padding: spacing.sm }}>
          <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
        </Pressable>
        <Text style={{ ...typography.title, color: colors.ink, marginLeft: spacing.md }}>Retake Check-in</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        <View
          style={{
            padding: spacing.xl,
            borderRadius: radius.md,
            backgroundColor: colors.ink,
            alignItems: 'center',
          }}
        >
          <View style={{ width: 48, height: 48, borderRadius: radius.md, backgroundColor: `${colors.surface}1A`, alignItems: 'center', justifyContent: 'center' }}>
            <RefreshCw size={22} color={colors.surface} strokeWidth={2} />
          </View>
          <Text style={{ ...typography.title, color: colors.surface, fontSize: 18, marginTop: spacing.md, textAlign: 'center' }}>
            Update your plan
          </Text>
          <Text style={{ ...typography.body, color: `${colors.surface}99`, marginTop: spacing.xs, textAlign: 'center' }}>
            A quick check-in re-runs the same questions from onboarding so your pockets match how you actually earn and spend today.
          </Text>
        </View>

        <Text style={{ ...typography.eyebrow, color: colors.ink, marginTop: spacing.xl, marginBottom: spacing.md }}>Good reasons to retake it</Text>
        {REASONS.map(reason => (
          <View
            key={reason.title}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: spacing.md,
              borderRadius: radius.md,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.line,
              marginBottom: spacing.sm,
            }}
          >
            <View style={{ width: 36, height: 36, borderRadius: radius.xs, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' }}>
              <reason.icon size={16} color={colors.ink} strokeWidth={2} />
            </View>
            <View style={{ marginLeft: spacing.md, flex: 1 }}>
              <Text style={{ ...typography.heading, color: colors.ink }}>{reason.title}</Text>
              <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>{reason.desc}</Text>
            </View>
          </View>
        ))}

        <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.md }}>
          Your existing pockets stay active until the new check-in is complete — nothing changes until you finish.
        </Text>

        <Button fullWidth size="md" onPress={handleStart} style={{ marginTop: spacing.xl }}>
          Start check-in
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}