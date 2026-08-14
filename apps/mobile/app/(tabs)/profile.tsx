import React from 'react';
import { View, Text, ScrollView, Pressable, Modal, RefreshControl } from 'react-native';
import { PocketLoader } from '@/components/ui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
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
  Check,
  LucideIcon,
} from 'lucide-react-native';
import { useAuthStore } from '@/services/auth';
import { profileApi, notificationsApi, pocketsApi, type NotificationPreferences } from '@/services/api';
import { ConfirmModal } from '@/components/ui';
import { showAlert } from '@/utils/alert';

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
  const [showSignOutConfirm, setShowSignOutConfirm] = React.useState(false);
  const [isSigningOut, setIsSigningOut] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  const [plan, setPlan] = React.useState<any>(null);
  const [fixedExpenseCount, setFixedExpenseCount] = React.useState<number | null>(null);
  const [isLoadingPlan, setIsLoadingPlan] = React.useState(true);
  const [timeLockActive, setTimeLockActive] = React.useState<boolean | null>(null);
  const [notificationsOn, setNotificationsOn] = React.useState<boolean | null>(null);
  const [retakeEligibility, setRetakeEligibility] = React.useState<{
    allowed: boolean;
    nextRetakeAvailableOn: string | null;
    message?: string;
  } | null>(null);

  const loadProfileMeta = React.useCallback(async () => {
    const [planRes, expensesRes, eligibility, notifRes, pocketsRes] = await Promise.all([
      profileApi.getPlan().catch(() => null),
      profileApi.getFixedExpenses().catch(() => []),
      profileApi.getRetakeEligibility().catch(() => null),
      notificationsApi.getSettings().catch(() => null),
      pocketsApi.getAll().catch(() => []),
    ]);
    setPlan(planRes);
    setFixedExpenseCount(Array.isArray(expensesRes) ? expensesRes.length : null);
    setRetakeEligibility(eligibility);
    const prefs = notifRes?.preferences as NotificationPreferences | undefined;
    if (prefs) {
      setNotificationsOn(
        prefs.reallocation_confirms ||
          prefs.cooling_off_reminders ||
          prefs.savings_milestones ||
          prefs.monthly_insights ||
          prefs.tips_nudges ||
          prefs.loan_reminders,
      );
    } else {
      setNotificationsOn(null);
    }
    const pockets = Array.isArray(pocketsRes) ? pocketsRes : [];
    setTimeLockActive(
      pockets.some((p: any) => p.kind === 'savings' && (p.is_time_locked || p.isTimeLocked)),
    );
  }, []);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await loadProfileMeta();
    setRefreshing(false);
  }, [loadProfileMeta]);

  React.useEffect(() => {
    let isMounted = true;
    loadProfileMeta().finally(() => {
      if (isMounted) setIsLoadingPlan(false);
    });
    return () => {
      isMounted = false;
    };
  }, [loadProfileMeta]);

  // Editing fixed expenses or retaking the check-in happens on screens pushed
  // on top of this tab; without refetching on focus, coming back here kept
  // showing the pre-edit plan type and fixed-expense count until a full app
  // reload. Same stale-tab pattern already fixed on Home and already
  // avoided on Insights.
  const isFirstFocus = React.useRef(true);
  useFocusEffect(
    React.useCallback(() => {
      if (isFirstFocus.current) { isFirstFocus.current = false; return; }
      let isMounted = true;
      loadProfileMeta().finally(() => {
        if (!isMounted) return;
      });
      return () => {
        isMounted = false;
      };
    }, [loadProfileMeta])
  );

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

  const handleCurrentPlanPress = () => {
    router.push('/(profile)/current-plan');
  };

  const handleRetakeCheckinPress = () => {
    if (retakeEligibility && !retakeEligibility.allowed) {
      const next = retakeEligibility.nextRetakeAvailableOn
        ? ` Next available on ${retakeEligibility.nextRetakeAvailableOn}.`
        : '';
      showAlert(
        'Retake unavailable',
        (retakeEligibility.message ?? 'You can only retake the behavior check-in once per month.') + next,
      );
      return;
    }
    router.push('/(profile)/retake-checkin');
  };

  const handleTimeLockPress = () => {
    // For now, navigate to time-lock screen
    // In production, this would be a modal or nested screen
    router.push('/(security)/time-lock');
  };

  const handlePersonalInfoPress = () => {
    router.push('/(profile)/personal-info');
  };

  const handleBiometricPress = () => {
    router.push('/(auth)/biometric-enable');
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
          onPress: handleBiometricPress,
        },
        {
          icon: Timer,
          title: 'Savings time-lock',
          desc: '7-day delay on withdrawals',
          trailing: timeLockActive === null ? '…' : timeLockActive ? 'Active' : 'Off',
          onPress: handleTimeLockPress,
        },
      ],
    },
    {
      label: 'Account',
      items: [
        { icon: User, title: 'Personal info', desc: 'Name and phone number', trailing: '', onPress: handlePersonalInfoPress },
        {
          icon: Bell,
          title: 'Notifications',
          desc: 'Push and in-app alerts',
          trailing: notificationsOn === null ? '…' : notificationsOn ? 'On' : 'Off',
          onPress: handleNotificationsPress,
        },
        { icon: Moon, title: 'Appearance', desc: 'Light / Dark / System', trailing: mode.charAt(0).toUpperCase() + mode.slice(1), onPress: handleThemePress },
      ],
    },
    {
      label: 'Plan',
      items: [
        { icon: BarChart3, title: 'Current plan', desc: planLabel, trailing: '', onPress: handleCurrentPlanPress },
        {
          icon: RefreshCw,
          title: 'Retake behavior check-in',
          desc: retakeEligibility && !retakeEligibility.allowed
            ? (retakeEligibility.nextRetakeAvailableOn
              ? `Available again ${retakeEligibility.nextRetakeAvailableOn}`
              : 'Once per month')
            : 'Update plan if habits changed',
          trailing: retakeEligibility && !retakeEligibility.allowed ? 'Locked' : '',
          onPress: handleRetakeCheckinPress,
        },
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

  // Was previously wired straight to Alert.alert(), which is a documented
  // no-op on react-native-web — tapping "Sign out" in a browser showed no
  // dialog at all and, since the actual signOut() call only ever ran from
  // inside the (never-fired) button callback, silently did nothing. Now
  // handled by a real Modal-based ConfirmModal below, which works on every
  // platform.
  const handleSignOutPress = () => {
    setShowSignOutConfirm(true);
  };

  const handleConfirmSignOut = async () => {
    setIsSigningOut(true);
    try {
      // signOut() now awaits Supabase's own sign-out before resolving (see
      // auth.ts) so we know the persisted session is actually gone before
      // navigating away — previously this was fire-and-forget, so a slow or
      // failed network call could leave a valid session token in storage
      // and silently sign the user back in on next app launch.
      await signOut();
      setShowSignOutConfirm(false);
      router.replace('/(auth)/signin');
    } catch {
      // signOut() is designed to always clear local state even if the
      // remote Supabase call fails (see auth.ts), so the user is signed out
      // locally either way — just let them know the device may still show
      // as an active session in Supabase until it syncs.
      setShowSignOutConfirm(false);
      router.replace('/(auth)/signin');
      showAlert('Signed out', 'You were signed out on this device. Some cleanup may finish once you\u2019re back online.');
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.emeraldDeep}
            colors={[colors.emeraldDeep]}
          />
        }
      >
        <View style={{ alignItems: 'center', paddingTop: spacing.lg }}>
          <View style={{ width: 72, height: 72, borderRadius: radius.lg, backgroundColor: colors.goldTint, alignItems: 'center', justifyContent: 'center' }}>
            <User size={32} color={colors.gold} strokeWidth={2} />
          </View>
          <Text style={{ ...typography.title, fontSize: 20, color: colors.ink, marginTop: spacing.md }}>{user?.fullName || '—'}</Text>
          <Text style={{ ...typography.body, color: colors.sage, marginTop: spacing.xs }}>{user?.phone || user?.email || '—'}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.md }}>
            {isLoadingPlan ? (
              <PocketLoader size={20} color={colors.emeraldDeep} />
            ) : (
              <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, backgroundColor: colors.emeraldTint }}>
                <Text style={{ ...typography.caption, fontSize: 11, color: colors.emeraldDeep }}>{planLabel}</Text>
              </View>
            )}
          </View>
        </View>

        {settingsGroups.map((group, gi) => (
          <View key={gi} style={{ marginTop: spacing.xl }}>
            <Text style={{ ...typography.eyebrow, color: colors.ink, marginBottom: spacing.md }}>{group.label}</Text>
            {group.items.map((item, ii) => (
              <Pressable 
                key={ii} 
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, minHeight: 44, borderBottomWidth: 1, borderBottomColor: colors.lineSoft }}
                onPress={item.onPress}
                disabled={!item.onPress}
                accessibilityRole={item.onPress ? 'button' : undefined}
                accessibilityLabel={
                  item.trailing
                    ? `${item.title}, ${item.desc}, ${item.trailing}`
                    : `${item.title}, ${item.desc}`
                }
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

        <Pressable 
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, minHeight: 44, marginTop: spacing.md }} 
          onPress={handleSignOutPress}
          accessibilityLabel="Sign out"
          accessibilityRole="button"
        >
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
                <Pressable
                  onPress={() => setShowThemePicker(false)}
                  style={{ padding: spacing.sm, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
                  accessibilityLabel="Close"
                  accessibilityRole="button"
                >
                  <X size={24} color={colors.ink} />
                </Pressable>
              </View>
              <View style={{ padding: spacing.lg }}>
                {themeOptions.map((option) => (
                  <Pressable
                    key={option.id}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md, minHeight: 44, borderRadius: radius.md, backgroundColor: mode === option.id ? colors.emeraldTint : 'transparent' }}
                    onPress={() => {
                      setMode(option.id);
                      setShowThemePicker(false);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: mode === option.id }}
                    accessibilityLabel={`${option.label}, ${option.desc}`}
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
                        <Check size={12} color={colors.surface} strokeWidth={3} />
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      <ConfirmModal
        visible={showSignOutConfirm}
        title="Sign out?"
        message="You’ll need to sign in again to access your money plan."
        confirmLabel="Sign out"
        cancelLabel="Cancel"
        destructive
        loading={isSigningOut}
        onConfirm={handleConfirmSignOut}
        onCancel={() => setShowSignOutConfirm(false)}
      />
    </SafeAreaView>
  );
}