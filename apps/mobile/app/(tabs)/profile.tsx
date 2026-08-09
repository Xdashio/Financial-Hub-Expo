import React from 'react';
import { View, Text, ScrollView, SafeAreaView, ActivityIndicator, Pressable, Alert, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { radius, spacing, typography, shadow } from '../../src/theme';
import { useTheme, ThemeMode } from '@/theme/ThemeContext';
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
  Sun,
  Monitor,
  X,
  LucideIcon,
} from 'lucide-react-native';
import { useAuthStore } from '@/services/auth';
import { profileApi } from '@/services/api';

interface SettingsItem {
  icon: LucideIcon;
  title: string;
  desc: string;
  trailing: string;
  onPress?: () => void;
}

interface SettingsGroup {
  label: string;
  items: SettingsItem[];
}

export default function ProfileScreen() {
  const { colors, mode, setMode } = useTheme();
  const router = useRouter();
  const user = useAuthStore(s => s.user);
  const signOut = useAuthStore(s => s.signOut);
  const [showThemePicker, setShowThemePicker] = React.useState(false);

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

  const themeOptions = [
    { id: 'light' as ThemeMode, label: 'Light', icon: Sun, desc: 'Always light mode' },
    { id: 'dark' as ThemeMode, label: 'Dark', icon: Moon, desc: 'Always dark mode' },
    { id: 'system' as ThemeMode, label: 'System', icon: Monitor, desc: 'Follow device setting' },
  ];

  const handleThemePress = () => {
    setShowThemePicker(true);
  };

  const handleNotificationsPress = () => {
    router.push('/(settings)/notifications');
  };

  const handleFixedExpensesPress = () => {
    router.push('/(profile)/fixed-expenses');
  };

  const handleTimeLockPress = () => {
    // For now, navigate to time-lock screen
    // In production, this would be a modal or nested screen
    router.push('/(security)/time-lock');
  };

  const settingsGroups: SettingsGroup[] = [
    {
      label: 'Security',
      items: [
        {
          icon: Lock,
          title: 'Biometric unlock',
          desc: 'Require Face ID to open app',
          trailing: user?.biometricEnabled ? 'On' : 'Off',
        },
        { icon: Timer, title: 'Savings time-lock', desc: '7-day delay on withdrawals', trailing: 'Active', onPress: handleTimeLockPress },
        { icon: Lock, title: 'Change PIN', desc: 'Update your app PIN', trailing: '' },
      ],
    },
    {
      label: 'Account',
      items: [
        { icon: User, title: 'Personal info', desc: 'Name, email, phone number', trailing: '' },
        { icon: Bell, title: 'Notifications', desc: 'Push and in-app alerts', trailing: 'On', onPress: handleNotificationsPress },
        { icon: Moon, title: 'Appearance', desc: 'Light / Dark / System', trailing: mode.charAt(0).toUpperCase() + mode.slice(1), onPress: handleThemePress },
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
          onPress: handleFixedExpensesPress,
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        <View style={{ alignItems: 'center', paddingTop: spacing.lg }}>
          <View style={{ width: 72, height: 72, borderRadius: radius.lg, backgroundColor: colors.goldTint, alignItems: 'center', justifyContent: 'center' }}>
            <User size={32} color={colors.gold} strokeWidth={2} />
          </View>
          <Text style={{ ...typography.title, fontSize: 20, color: colors.ink, marginTop: spacing.md }}>{user?.fullName || '—'}</Text>
          <Text style={{ ...typography.body, color: colors.sage, marginTop: spacing.xs }}>{user?.phone || user?.email || '—'}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.md }}>
            {isLoadingPlan ? (
              <ActivityIndicator size="small" color={colors.emeraldDeep} />
            ) : (
              <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, backgroundColor: colors.emeraldTint }}>
                <Text style={{ ...typography.caption, fontSize: 11, color: colors.emeraldDeep }}>{planLabel}</Text>
              </View>
            )}
          </View>
        </View>

        {settingsGroups.map((group, gi) => (
          <View key={gi} style={{ marginTop: spacing.xl }}>
            <Text style={{ ...typography.eyebrow, marginBottom: spacing.md }}>{group.label}</Text>
            {group.items.map((item, ii) => (
              <Pressable 
                key={ii} 
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.lineSoft }}
                onPress={item.onPress}
                disabled={!item.onPress}
              >
                <View style={{ width: 34, height: 34, borderRadius: radius.xs, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}>
                  <item.icon size={18} color={colors.ink} strokeWidth={2.5} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...typography.heading, color: colors.ink }}>{item.title}</Text>
                  <Text style={{ ...typography.caption, color: colors.sage, marginTop: 1 }}>{item.desc}</Text>
                </View>
                {item.trailing ? (
                  <Text style={{ ...typography.caption, color: colors.sage }}>{item.trailing}</Text>
                ) : null}
                {item.onPress ? <Text style={{ marginLeft: 'auto', color: colors.sage }}>›</Text> : null}
              </Pressable>
            ))}
          </View>
        ))}

        <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, marginTop: spacing.md }} onPress={handleSignOut}>
          <View style={{ width: 34, height: 34, borderRadius: radius.xs, backgroundColor: colors.clayTint, alignItems: 'center', justifyContent: 'center' }}>
            <LogOut size={18} color={colors.clay} strokeWidth={2.5} />
          </View>
          <Text style={{ ...typography.heading, color: colors.clay }}>Sign out</Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={showThemePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowThemePicker(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: `${colors.ink}80` }}>
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingBottom: spacing.xxl }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.line }}>
                <Text style={{ ...typography.title, color: colors.ink }}>Appearance</Text>
                <Pressable onPress={() => setShowThemePicker(false)} style={{ padding: spacing.sm }}>
                  <X size={24} color={colors.ink} />
                </Pressable>
              </View>
              <View style={{ padding: spacing.lg }}>
                {themeOptions.map((option) => (
                  <Pressable
                    key={option.id}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: mode === option.id ? colors.emeraldTint : 'transparent' }}
                    onPress={() => {
                      setMode(option.id);
                      setShowThemePicker(false);
                    }}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}>
                      <option.icon size={20} color={colors.ink} strokeWidth={2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...typography.heading, color: colors.ink }}>{option.label}</Text>
                      <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>{option.desc}</Text>
                    </View>
                    {mode === option.id && (
                      <View style={{ width: 20, height: 20, borderRadius: radius.pill, backgroundColor: colors.emeraldDeep, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: colors.surface, fontSize: 12, fontWeight: 'bold' }}>✓</Text>
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}