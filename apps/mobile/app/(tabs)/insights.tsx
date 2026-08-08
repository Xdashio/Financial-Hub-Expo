import React from 'react';
import { View, Text, ScrollView, SafeAreaView, ActivityIndicator } from 'react-native';
import { radius, spacing, typography, shadow } from '../../src/theme';
import { useTheme } from '@/theme/ThemeContext';
import { insightsApi } from '@/services/api';



interface DisplayEvent {
  title: string;
  desc: string;
  time: string;
  color: string;
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffDays = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  return diffWeeks === 1 ? '1 week ago' : `${diffWeeks} weeks ago`;
}

// Maps a raw behavior_events row (type + payload) to something displayable.
// Only `plan_created` is emitted by the API today (see onboarding.service.ts);
// `reallocation_completed` and `savings_streak_*` are handled defensively for
// when reallocation/streak tracking lands, per ROADMAP.md.
function mapBehaviorEvent(event: any, colors: any): DisplayEvent {
  const payload = event.payload || {};
  const time = formatRelativeTime(event.created_at);

  if (event.type === 'plan_created') {
    return { title: 'Plan assigned', desc: 'Your money plan is ready', time, color: colors.gold };
  }
  if (event.type === 'reallocation_completed') {
    const desc = payload.amount && payload.fromPocket && payload.toPocket
      ? `Moved ${payload.amount} from ${payload.fromPocket} → ${payload.toPocket}`
      : 'Funds moved between pockets';
    return { title: 'Reallocation', desc, time, color: colors.plum };
  }
  if (typeof event.type === 'string' && event.type.startsWith('savings_streak')) {
    const desc = payload.days ? `${payload.days} days without touching Savings pocket` : 'Savings streak continues';
    return { title: 'Savings streak', desc, time, color: colors.emerald };
  }
  // Unknown/future event type — show something reasonable rather than nothing.
  return { title: String(event.type ?? 'Activity').replace(/_/g, ' '), desc: '', time, color: colors.sage };
}

export default function InsightsScreen() {
  const { colors } = useTheme();

  const METRICS = [
    { label: 'Days savings untouched', value: '12', color: colors.emerald },
    { label: 'Reallocations this month', value: '3', color: colors.plum },
    { label: 'Plan adherence', value: '94%', color: colors.gold },
    { label: 'Cooling-off skips', value: '0', color: colors.clay },
  ];

  const [score, setScore] = React.useState<number | null>(null);
  const [delta, setDelta] = React.useState(0);
  const [events, setEvents] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let isMounted = true;
    Promise.all([
      insightsApi.getDisciplineScore(),
      insightsApi.getBehaviorEvents(),
    ])
      .then(([scoreRes, eventsRes]) => {
        if (!isMounted) return;
        setScore(scoreRes?.score ?? null);
        setDelta(scoreRes?.delta ?? 0);
        setEvents(Array.isArray(eventsRes) ? eventsRes : []);
      })
      .catch(() => {
        if (!isMounted) return;
        setScore(null);
        setEvents([]);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const displayEvents = events.map(event => mapBehaviorEvent(event, colors));

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        <Text style={{ ...typography.title, color: colors.ink, marginTop: spacing.xl }}>Insights</Text>

        <View style={{ marginTop: spacing.xl, borderRadius: radius.lg, paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl, backgroundColor: colors.emeraldDeep, alignItems: 'center' }}>
          <View style={{ width: 120, height: 120, borderRadius: 60, borderWidth: 8, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginTop: spacing.md }}>
            <Text style={{ ...typography.display, color: 'white', fontSize: 36 }}>{isLoading ? '—' : score ?? '—'}</Text>
          </View>
          <Text style={{ ...typography.caption, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.xs }}>Discipline Score</Text>
          <View style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill }}>
            <Text style={{ ...typography.caption, color: 'white' }}>
              {delta > 0 ? `+${delta}` : delta} vs last week
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}>
          {METRICS.map((metric, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.lg }}>
              <View style={{ width: 28, height: 28, borderRadius: radius.xs, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }}>
                <Text style={{ fontSize: 16, color: metric.color }}>●</Text>
              </View>
              <Text style={{ ...typography.heading, fontSize: 20, color: colors.ink }}>{metric.value}</Text>
              <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage, marginTop: spacing.xs, lineHeight: 14 }}>{metric.label}</Text>
            </View>
          ))}
        </View>

        <Text style={{ ...typography.eyebrow, marginTop: spacing.xxl, marginBottom: spacing.md }}>Recent activity</Text>

        {isLoading ? (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl }}>
            <ActivityIndicator size="large" color={colors.emeraldDeep} />
          </View>
        ) : displayEvents.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
            <Text style={{ ...typography.body, color: colors.sage, textAlign: 'center' }}>No activity yet — complete a week to see insights</Text>
          </View>
        ) : (
          displayEvents.map((event, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.lineSoft }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 6, backgroundColor: event.color }} />
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.heading, color: colors.ink }}>{event.title}</Text>
                {event.desc ? <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.xs, lineHeight: 16 }}>{event.desc}</Text> : null}
              </View>
              <Text style={{ ...typography.caption, fontSize: 10, color: colors.sage, marginLeft: 'auto' }}>{event.time}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}