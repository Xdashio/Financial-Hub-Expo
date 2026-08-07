import { View, Text, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { colors, radius, spacing, typography, shadow } from '../../src/theme';

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
  title: {
    ...typography.title,
    fontWeight: '700',
    color: colors.ink,
    marginTop: spacing.lg,
  },
  scoreHero: {
    marginTop: spacing.xl,
    borderRadius: radius.lg,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.emeraldDeep,
    alignItems: 'center',
  },
  scoreRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 8,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  scoreValue: {
    ...typography.display,
    fontWeight: '700',
    color: 'white',
    fontSize: 36,
  },
  scoreLabel: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.xs,
  },
  scoreDelta: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  scoreDeltaText: {
    ...typography.caption,
    color: 'white',
  },
  metricGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  metricIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.xs,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  metricValue: {
    ...typography.heading,
    fontWeight: '700',
    fontSize: 20,
    color: colors.ink,
  },
  metricLabel: {
    ...typography.caption,
    fontSize: 11,
    color: colors.sage,
    marginTop: spacing.xs,
    lineHeight: 14,
  },
  sectionLabel: {
    ...typography.eyebrow,
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  eventRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  eventDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  eventContent: {
    flex: 1,
  },
  eventTitle: {
    ...typography.heading,
    fontWeight: '600',
    color: colors.ink,
  },
  eventDesc: {
    ...typography.caption,
    color: colors.sage,
    marginTop: spacing.xs,
    lineHeight: 16,
  },
  eventTime: {
    ...typography.caption,
    fontSize: 10,
    color: colors.sage,
    marginLeft: 'auto',
  },
});

const METRICS = [
  { label: 'Days savings untouched', value: '12', color: colors.emerald },
  { label: 'Reallocations this month', value: '3', color: colors.plum },
  { label: 'Plan adherence', value: '94%', color: colors.gold },
  { label: 'Cooling-off skips', value: '0', color: colors.clay },
];

const EVENTS = [
  { type: 'positive', title: 'Savings streak', desc: '12 days without touching Savings pocket', time: 'Today', color: colors.emerald },
  { type: 'positive', title: 'Daily cap respected', desc: 'Food & groceries stayed under KES 250', time: 'Yesterday', color: colors.emerald },
  { type: 'caution', title: 'Reallocation', desc: 'Moved KES 500 from Transport → Personal', time: '2 days ago', color: colors.plum },
  { type: 'positive', title: 'Plan assigned', desc: 'Structured Salaried plan from onboarding', time: '1 week ago', color: colors.gold },
];

export default function InsightsScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Insights</Text>

        <View style={styles.scoreHero}>
          <View style={styles.scoreRing}>
            <Text style={styles.scoreValue}>87</Text>
          </View>
          <Text style={styles.scoreLabel}>Discipline Score</Text>
          <View style={styles.scoreDelta}>
            <Text style={styles.scoreDeltaText}>+3 vs last week</Text>
          </View>
        </View>

        <View style={styles.metricGrid}>
          {METRICS.map((metric, i) => (
            <View key={i} style={styles.metricCard}>
              <View style={styles.metricIcon}>
                <Text style={{ fontSize: 16, color: metric.color }}>●</Text>
              </View>
              <Text style={styles.metricValue}>{metric.value}</Text>
              <Text style={styles.metricLabel}>{metric.label}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Recent activity</Text>

        {EVENTS.map((event, i) => (
          <View key={i} style={styles.eventRow}>
            <View style={[styles.eventDot, { backgroundColor: event.color }]} />
            <View style={styles.eventContent}>
              <Text style={styles.eventTitle}>{event.title}</Text>
              <Text style={styles.eventDesc}>{event.desc}</Text>
            </View>
            <Text style={styles.eventTime}>{event.time}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}