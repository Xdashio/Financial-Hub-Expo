import { View, Text, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
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
} from 'lucide-react-native';

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
  avatarText: {
    color: colors.gold,
    fontSize: 24,
    fontFamily: typography.fontFamilyExtraBold,
  },
  name: {
    ...typography.title,
    fontWeight: '700',
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
    fontWeight: '600',
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
    fontWeight: '600',
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
});

const SETTINGS_GROUPS = [
  {
    label: 'Security',
    items: [
      { icon: Lock, title: 'Biometric unlock', desc: 'Require Face ID to open app', trailing: 'On' },
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
      { icon: BarChart3, title: 'Current plan', desc: 'Structured Salaried — 50/30/20', trailing: '' },
      { icon: RefreshCw, title: 'Retake behavior check-in', desc: 'Update plan if habits changed', trailing: '' },
      { icon: List, title: 'Fixed expenses', desc: 'Manage detected recurring costs', trailing: '4 items' },
    ],
  },
];

export default function ProfileScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>JD</Text>
          </View>
          <Text style={styles.name}>Jane Doe</Text>
          <Text style={styles.sub}>jane@financialhub.app</Text>
          <View style={styles.planChipRow}>
            <View style={[styles.planChip, styles.planChipA]}>
              <Text style={[styles.planChipText, styles.planChipTextA]}>Structured Salaried</Text>
            </View>
            <View style={[styles.planChip, { backgroundColor: colors.goldTint }]}>
              <Text style={[styles.planChipText, { color: colors.gold }]}>50/30/20</Text>
            </View>
          </View>
        </View>

        {SETTINGS_GROUPS.map((group, gi) => (
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
      </ScrollView>
    </SafeAreaView>
  );
}