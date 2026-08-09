import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, SafeAreaView, ActivityIndicator, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { radius, spacing, typography } from '../../src/theme';
import { useTheme } from '@/theme/ThemeContext';
import { Bell, ToggleRight, LucideIcon } from 'lucide-react-native';
import { Card, makeStyles } from '@/components/ui';

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

  const styles = makeStyles((theme) => ({
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
      // TODO: Replace with actual API call
      // const prefs = await notificationsApi.getSettings();
      
      // Mock data for now
      setPreferences({
        reallocation_confirms: true,
        cooling_off_reminders: true,
        savings_milestones: true,
        monthly_insights: false,
        tips_nudges: false,
      });
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updatePreference = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!preferences) return;

    try {
      setIsUpdating(true);
      const updatedPreferences = { ...preferences, [key]: value };
      setPreferences(updatedPreferences);

      // TODO: Replace with actual API call
      // await notificationsApi.updateSettings(updatedPreferences);
    } catch (error) {
      console.error('Error updating preference:', error);
      // Revert on error
      setPreferences(preferences);
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
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.emeraldDeep} />
        </View>
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
            {/* Alert Section */}
            <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
              <Text style={{ ...typography.eyebrow, marginBottom: spacing.md }}>
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
              <Text style={{ ...typography.eyebrow, marginBottom: spacing.md }}>
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
