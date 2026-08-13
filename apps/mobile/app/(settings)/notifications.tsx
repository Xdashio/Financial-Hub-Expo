import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { spacing, typography } from '../../src/theme';
import { useTheme } from '@/theme/ThemeContext';
import { ArrowLeft, Bell } from 'lucide-react-native';
import { Card, useMakeStyles, LoadingState, ErrorState, ToggleRow } from '@/components/ui';
import { notificationsApi } from '@/services/api';
import {
  clearNotificationPreferencesCache,
  registerForPushNotifications,
  requestNotificationPermissions,
  isExpoGo,
} from '@/services/notifications';
import { safeGoBack } from '@/utils/navigation';
// Define the theme shape if not imported from your UI library
interface Theme {
  surface: string;
  line: string;
  ink: string;
  paper: string;
  emeraldDeep: string;
  emeraldTint: string;
  lineSoft: string;
  sage: string;
}

interface NotificationPreferences {
  reallocation_confirms: boolean;
  cooling_off_reminders: boolean;
  savings_milestones: boolean;
  monthly_insights: boolean;
  tips_nudges: boolean;
  loan_reminders: boolean;
}

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const goBack = () => {
    safeGoBack(router, '/(tabs)/profile');
  };

  // useMakeStyles returns the styles object directly, so we assign it to 'styles'
  const styles = useMakeStyles((theme: Theme) => ({
    container: {
      flex: 1,
      backgroundColor: theme.surface,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.line,
    },
    sectionTitle: {
      ...typography.eyebrow,
      color: theme.ink,
      marginBottom: spacing.md,
    },
  }));

  useEffect(() => {
    loadPreferences();
    // Ask for OS permission when the user opens the settings screen — more
    // contextual than a cold-start prompt, and re-registers the push token
    // if permission was newly granted.
    void requestNotificationPermissions().then((granted) => {
      if (granted) void registerForPushNotifications();
    });
  }, []);

  const loadPreferences = async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const { preferences: prefs } = await notificationsApi.getSettings();
      setPreferences(prefs);
    } catch (error) {
      console.error('Error loading preferences:', error);
      setLoadError('Failed to load notification settings. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPreferences();
    setRefreshing(false);
  };

  const updatePreference = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!preferences) return;

    const previous = preferences;
    const updatedPreferences = { ...preferences, [key]: value };
    setPreferences(updatedPreferences);
    setUpdateError(null);

    try {
      setIsUpdating(true);
      const { preferences: saved } = await notificationsApi.updateSettings({ [key]: value });
      clearNotificationPreferencesCache();
      setPreferences(saved);
    } catch (error) {
      console.error('Error updating preference:', error);
      // Revert on error — and unlike before, actually tell the user why the
      // toggle snapped back instead of leaving them to assume it just didn't
      // register their tap.
      setPreferences(previous);
      setUpdateError("Couldn't save that change. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
        <View style={styles.header}>
          <Pressable
            onPress={goBack}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ padding: spacing.xs, marginRight: spacing.sm }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
          </Pressable>
          <Text style={{ ...typography.title, color: colors.ink }}>
            Notifications
          </Text>
        </View>
        <LoadingState label="Loading your preferences…" />
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
        <View style={styles.header}>
          <Pressable
            onPress={goBack}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ padding: spacing.xs, marginRight: spacing.sm }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
          </Pressable>
          <Text style={{ ...typography.title, color: colors.ink }}>
            Notifications
          </Text>
        </View>
        <ErrorState message={loadError} onRetry={loadPreferences} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.emeraldDeep}
            colors={[colors.emeraldDeep]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={goBack}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ padding: spacing.xs, marginRight: spacing.sm }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
          </Pressable>
          <Text style={{ ...typography.title, color: colors.ink }}>
            Notifications
          </Text>
        </View>

        {preferences && (
          <>
            {isExpoGo() && Platform.OS === 'android' && (
              <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
                <Card style={{ backgroundColor: colors.goldTint, borderColor: colors.gold }}>
                  <Text style={{ ...typography.caption, color: colors.ink, lineHeight: 18 }}>
                    Remote push is not available in Expo Go on Android (SDK 53+). Use a development build (`eas build --profile development`) to receive push alerts on device.
                  </Text>
                </Card>
              </View>
            )}
            {updateError && (
              <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
                <Card style={{ backgroundColor: colors.clayTint, borderColor: colors.clay }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
                    <Text style={{ ...typography.caption, color: colors.clay, flex: 1 }}>{updateError}</Text>
                    <Pressable onPress={() => setUpdateError(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={{ ...typography.caption, color: colors.clay, fontWeight: '700' }}>Dismiss</Text>
                    </Pressable>
                  </View>
                </Card>
              </View>
            )}

            {/* Alert Section */}
            <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
              <Text style={{ ...typography.eyebrow, color: colors.ink, marginBottom: spacing.md }}>
                Alerts
              </Text>
              
              <ToggleRow
                icon={Bell}
                title="Reallocation confirms"
                description="Confirm before moving money between pockets"
                value={preferences.reallocation_confirms}
                onToggle={(value) => updatePreference('reallocation_confirms', value)}
                disabled={isUpdating}
              />
              
              <ToggleRow
                icon={Bell}
                title="Cooling-off reminders"
                description="Remind when cooling-off period ends"
                value={preferences.cooling_off_reminders}
                onToggle={(value) => updatePreference('cooling_off_reminders', value)}
                disabled={isUpdating}
              />
              
              <ToggleRow
                icon={Bell}
                title="Savings milestones"
                description="Celebrate streak milestones, daily rollovers, and income allocations"
                value={preferences.savings_milestones}
                onToggle={(value) => updatePreference('savings_milestones', value)}
                disabled={isUpdating}
              />
              
              <ToggleRow
                icon={Bell}
                title="Loan reminders"
                description="Get notified when loan payments are due"
                value={preferences.loan_reminders}
                onToggle={(value) => updatePreference('loan_reminders', value)}
                disabled={isUpdating}
              />
            </View>

            {/* Promotional Section */}
            <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
              <Text style={{ ...typography.eyebrow, color: colors.ink, marginBottom: spacing.md }}>
                Promotional
              </Text>
              
              <ToggleRow
                icon={Bell}
                title="Monthly insights"
                description="Receive monthly spending summaries"
                value={preferences.monthly_insights}
                onToggle={(value) => updatePreference('monthly_insights', value)}
                disabled={isUpdating}
              />
              
              <ToggleRow
                icon={Bell}
                title="Tips & nudges"
                description="Helpful money management tips"
                value={preferences.tips_nudges}
                onToggle={(value) => updatePreference('tips_nudges', value)}
                disabled={isUpdating}
              />
            </View>

            {/* Information */}
            <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
              <Card style={{ backgroundColor: colors.emeraldTint, borderColor: colors.emeraldDeep }}>
                <Text style={{ ...typography.caption, color: colors.emeraldDeep }}>
                  Essential alerts (like reallocation confirms) are enabled by default to help you stay in control of your money. You can customize additional notifications above.
                </Text>
              </Card>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}