import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { radius, spacing, typography } from '../../src/theme';
import { useTheme } from '@/theme/ThemeContext';
import { Bell, ToggleRight, LucideIcon } from 'lucide-react-native';
import { Card, useMakeStyles, LoadingState, ErrorState } from '@/components/ui';
import { notificationsApi } from '@/services/api';

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
}

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

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
    toggleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: theme.surface,
      marginBottom: spacing.sm,
    },
    toggleTrack: {
      width: 48,
      height: 28,
      borderRadius: 14,
      padding: 2,
    },
    toggleThumb: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.ink,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
  }));

  useEffect(() => {
    loadPreferences();
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

  const updatePreference = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!preferences) return;

    const previous = preferences;
    const updatedPreferences = { ...preferences, [key]: value };
    setPreferences(updatedPreferences);
    setUpdateError(null);

    try {
      setIsUpdating(true);
      const { preferences: saved } = await notificationsApi.updateSettings({ [key]: value });
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

  const NotificationToggle = ({ 
    icon: Icon, 
    title, 
    description, 
    value, 
    onToggle 
  }: { 
    icon: LucideIcon; 
    title: string; 
    description: string; 
    value: boolean; 
    onToggle: (value: boolean) => void; 
  }) => (
    <Pressable
      style={[
        styles.toggleContainer,
        { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }
      ]}
      onPress={() => onToggle(!value)}
      disabled={isUpdating}
    >
      <View style={{ 
        width: 36, 
        height: 36, 
        borderRadius: radius.xs, 
        backgroundColor: colors.lineSoft, 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <Icon size={18} color={colors.ink} strokeWidth={2} />
      </View>
      <View style={{ marginLeft: spacing.md, flex: 1 }}>
        <Text style={{ ...typography.heading, color: colors.ink }}>
          {title}
        </Text>
        <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>
          {description}
        </Text>
      </View>
      <View style={[
        styles.toggleTrack,
        { backgroundColor: value ? colors.emeraldDeep : colors.lineSoft }
      ]}>
        <View style={[
          styles.toggleThumb,
          value && { 
            transform: [{ translateX: 20 }],
            backgroundColor: colors.surface 
          }
        ]}>
          {value && <ToggleRight size={14} color={colors.emeraldDeep} strokeWidth={2} />}
        </View>
      </View>
    </Pressable>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
        <View style={styles.header}>
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
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={{ ...typography.title, color: colors.ink }}>
            Notifications
          </Text>
        </View>

        {preferences && (
          <>
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
              
              <NotificationToggle
                icon={Bell}
                title="Reallocation confirms"
                description="Confirm before moving money between pockets"
                value={preferences.reallocation_confirms}
                onToggle={(value) => updatePreference('reallocation_confirms', value)}
              />
              
              <NotificationToggle
                icon={Bell}
                title="Cooling-off reminders"
                description="Remind when cooling-off period ends"
                value={preferences.cooling_off_reminders}
                onToggle={(value) => updatePreference('cooling_off_reminders', value)}
              />
              
              <NotificationToggle
                icon={Bell}
                title="Savings milestones"
                description="Celebrate when you reach savings goals"
                value={preferences.savings_milestones}
                onToggle={(value) => updatePreference('savings_milestones', value)}
              />
            </View>

            {/* Promotional Section */}
            <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
              <Text style={{ ...typography.eyebrow, color: colors.ink, marginBottom: spacing.md }}>
                Promotional
              </Text>
              
              <NotificationToggle
                icon={Bell}
                title="Monthly insights"
                description="Receive monthly spending summaries"
                value={preferences.monthly_insights}
                onToggle={(value) => updatePreference('monthly_insights', value)}
              />
              
              <NotificationToggle
                icon={Bell}
                title="Tips & nudges"
                description="Helpful money management tips"
                value={preferences.tips_nudges}
                onToggle={(value) => updatePreference('tips_nudges', value)}
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