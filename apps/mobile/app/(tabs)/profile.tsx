import React from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView, ActivityIndicator, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radius, spacing, typography, shadow } from '../../src/theme';
import {
  Lock,
  Timer,
  User,
  Bell,
  Moon,
  BarChart3,
  RefreshCw,
  List,
  LogOut,
} from 'lucide-react-native';
import { useAuthStore } from '@/services/auth';
import { profileApi } from '@/services/api';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  hero: {
    alignItems: 'center',
    paddingTop: spacing.xl,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.goldTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    ...typography.title,
    fontSize: 20,
    color: colors.ink,
    marginTop: spacing.md,
  },
  sub: {
    ...typography.body,
    color: colors.sage,
    marginTop: spacing.xs,
  },
  planChipRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  planChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  planChipText: {
    ...typography.caption,
    fontSize: 11,
  },
  planChipA: {
    backgroundColor: colors.emeraldTint,
  },
  planChipTextA: {
    color: colors.emeraldDeep,
  },
  settingsGroup: {
    marginTop: spacing.xl,
  },
  groupLabel: {
    ...typography.eyebrow,
    marginBottom: spacing.md,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  settingsIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsTitle: {
    ...typography.heading,
    color: colors.ink,
  },
  settingsDesc: {
    ...typography.caption,
    color: colors.sage,
    marginTop: 1,
  },
  chevron: {
    marginLeft: 'auto',
    color: colors.sage,
  },
  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  signOutIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.xs,
    backgroundColor: colors.clayTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutTitle: {
    ...typography.heading,
    color: colors.clay,
  },
});

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore(s => s.user);
  const signOut = useAuthStore(s => s.signOut);

  const [plan, setPlan] = React.useState<any>(null);
  const [fixedExpenseCount, setFixedExpenseCount] = React.useState<number | null>(null);
  const [isLoadingPlan, setIsLoadingPlan] = React.useState(true);

  React.useEffect(() => {
    let isMounted = true;
    Promise.all([
      profileApi.getPlan().catch(() => null),
      profileApi.getFixedExpenses().catch(() => []),
    ]).then(([planRes, expensesRes]) => {
      if (!isMounted) return;
      setPlan(planRes);
      setFixedExpenseCount(Array.isArray(expensesRes) ? expensesRes.length : null);
      setIsLoadingPlan(false);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const planLabel = plan?.type === 'daily' ? 'Daily Budget' : 'Structured Salaried';

  const settingsGroups = [
    {
      label: 'Security',
      items: [
        {
          icon: Lock,
          title: 'Biometric unlock',
          desc: 'Require Face ID to open app',
          trailing: user?.biometricEnabled ? 'On' : 'Off',
        },
        { icon: Timer, title: 'Savings time-lock', desc: '7-day delay on withdrawals', trailing: 'Active' },
        { icon: Lock, title: 'Change PIN', desc: 'Update your app PIN', trailing: '' },
      ],
    },
    {
      label: 'Account',
      items: [
        { icon: User, title: 'Personal info', desc: 'Name, email, phone number', trailing: '' },
        { icon: Bell, title: 'Notifications', desc: 'Push and in-app alerts', trailing: 'On' },
        { icon: Moon, title: 'Appearance', desc: 'Light / Dark / System', trailing: 'System' },
      ],
    },
    {
      label: 'Plan',
      items: [
        { icon: BarChart3, title: 'Current plan', desc: planLabel, trailing: '' },
        { icon: RefreshCw, title: 'Retake behavior check-in', desc: 'Update plan if habits changed', trailing: '' },
        {
          icon: List,
          title: 'Fixed expenses',
          desc: 'Manage detected recurring costs',
          trailing: fixedExpenseCount !== null ? `${fixedExpenseCount} item${fixedExpenseCount === 1 ? '' : 's'}` : '',
        },
      ],
    },
  ];

  const handleSignOut = () => {
    Alert.alert(
      'Sign out?',
      'You\u2019ll need to sign in again to access your money plan.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            // signOut() clears local session state synchronously and revokes
            // the Supabase session in the background, so this resolves fast.
            await signOut();
            router.replace('/(auth)/signin');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <User size={32} color={colors.gold} strokeWidth={2} />
          </View>
          <Text style={styles.name}>{user?.fullName || '—'}</Text>
          <Text style={styles.sub}>{user?.phone || user?.email || '—'}</Text>
          <View style={styles.planChipRow}>
            {isLoadingPlan ? (
              <ActivityIndicator size="small" color={colors.emeraldDeep} />
            ) : (
              <View style={[styles.planChip, styles.planChipA]}>
                <Text style={[styles.planChipText, styles.planChipTextA]}>{planLabel}</Text>
              </View>
            )}
          </View>
        </View>

        {settingsGroups.map((group, gi) => (
          <View key={gi} style={styles.settingsGroup}>
            <Text style={styles.groupLabel}>{group.label}</Text>
            {group.items.map((item, ii) => (
              <View key={ii} style={styles.settingsRow}>
                <View style={styles.settingsIcon}>
                  <item.icon size={18} color={colors.ink} strokeWidth={2.5} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingsTitle}>{item.title}</Text>
                  <Text style={styles.settingsDesc}>{item.desc}</Text>
                </View>
                {item.trailing ? (
                  <Text style={{ ...typography.caption, color: colors.sage }}>{item.trailing}</Text>
                ) : null}
                <Text style={styles.chevron}>›</Text>
              </View>
            ))}
          </View>
        ))}

        <Pressable style={styles.signOutRow} onPress={handleSignOut}>
          <View style={styles.signOutIcon}>
            <LogOut size={18} color={colors.clay} strokeWidth={2.5} />
          </View>
          <Text style={styles.signOutTitle}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}