import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { radius, spacing, typography } from '../../src/theme';
import { useTheme } from '@/theme/ThemeContext';
import { ScreenContainer, LoadingState, ErrorState } from '@/components/ui';
import { profileApi, pocketsApi } from '@/services/api';
import { useDataSync } from '@/services/data-sync';
import { safeGoBack } from '@/utils/navigation';
import { ArrowLeft, BarChart3, Calendar, Briefcase, PiggyBank, House, ShoppingBasket } from 'lucide-react-native';
import { formatMoney } from '@/utils/money';

function fmt(amount: number) {
  return formatMoney(amount);
}

const KIND_ICON: Record<string, any> = {
  savings: PiggyBank,
  fixed: House,
  spendable: ShoppingBasket,
};

const KIND_LABEL: Record<string, string> = {
  savings: 'Savings',
  fixed: 'Fixed & protected',
  spendable: 'Spendable',
};

export default function CurrentPlanScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [plan, setPlan] = React.useState<any>(null);
  const [pockets, setPockets] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [retakeAllowed, setRetakeAllowed] = React.useState(true);
  const [retakeNextOn, setRetakeNextOn] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const [planRes, pocketsRes, eligibility] = await Promise.all([
        profileApi.getPlan(),
        pocketsApi.getAll().catch(() => []),
        profileApi.getRetakeEligibility().catch(() => ({ allowed: true, nextRetakeAvailableOn: null, lastRetakenAt: null })),
      ]);
      setPlan(planRes);
      setPockets(Array.isArray(pocketsRes) ? pocketsRes : []);
      setRetakeAllowed(eligibility.allowed);
      setRetakeNextOn(eligibility.nextRetakeAvailableOn);
    } catch (e) {
      console.error('CurrentPlan load error:', e);
      setLoadError('Failed to load your plan. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [load])
  );

  // EXPO_APP_FULL_AUDIT.md item 8 / audit_team.md 2026-08-13 verification:
  // this screen shows monthly_allocation per pocket via pocketsApi.getAll(),
  // but previously only refetched on focus. A plan retake (or any other
  // mutating flow that finishes with router.replace('/(tabs)')) can skip
  // past this screen without a focus event, leaving it showing a stale
  // plan/allocation. Subscribing to useDataSync's version closes that gap —
  // same fix already applied to (pockets)/detail.tsx.
  const dataVersion = useDataSync((s) => s.version);
  const isFirstVersion = React.useRef(true);
  React.useEffect(() => {
    if (isFirstVersion.current) {
      isFirstVersion.current = false;
      return;
    }
    load();
  }, [dataVersion, load]);

  const totalAllocated = pockets.reduce((sum, p) => sum + (p.monthly_allocation ?? 0), 0);
  const grouped: Record<string, any[]> = { savings: [], fixed: [], spendable: [] };
  for (const p of pockets) {
    if (grouped[p.kind]) grouped[p.kind].push(p);
  }

  return (
    <ScreenContainer style={{ backgroundColor: colors.surface }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg }}>
        <Pressable onPress={() => safeGoBack(router, '/(tabs)/profile')} style={{ padding: spacing.sm }}>
          <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
        </Pressable>
        <Text style={{ ...typography.title, color: colors.ink, marginLeft: spacing.md }}>Current Plan</Text>
      </View>

      {isLoading ? (
        <LoadingState label="Loading your plan…" />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={load} />
      ) : !plan ? (
        <ErrorState message="You don't have an active plan yet." />
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
          <View
            style={{
              padding: spacing.xl,
              borderRadius: radius.md,
              backgroundColor: colors.ink,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View style={{ width: 40, height: 40, borderRadius: radius.xs, backgroundColor: `${colors.surface}1A`, alignItems: 'center', justifyContent: 'center' }}>
                <BarChart3 size={18} color={colors.surface} strokeWidth={2} />
              </View>
              <View>
                <Text style={{ ...typography.title, color: colors.surface, fontSize: 18 }}>
                  {plan.type === 'daily' ? 'Daily Budget' : 'Structured Salaried'}
                </Text>
                <Text style={{ ...typography.caption, color: `${colors.surface}99`, marginTop: 2 }}>
                  {plan.income_pattern === 'freelancer' ? 'Freelancer income' : 'Salaried income'}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.xl, marginTop: spacing.lg }}>
              <View>
                <Text style={{ ...typography.caption, color: `${colors.surface}88` }}>Total allocated</Text>
                <Text style={{ ...typography.heading, color: colors.surface, marginTop: 2 }}>{fmt(totalAllocated)}</Text>
              </View>
              <View>
                <Text style={{ ...typography.caption, color: `${colors.surface}88` }}>Started</Text>
                <Text style={{ ...typography.heading, color: colors.surface, marginTop: 2 }}>
                  {new Date(plan.created_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </View>
            </View>
          </View>

          {(['savings', 'fixed', 'spendable'] as const).map(kind =>
            grouped[kind].length > 0 ? (
              <View key={kind} style={{ marginTop: spacing.xl }}>
                <Text style={{ ...typography.eyebrow, color: colors.ink, marginBottom: spacing.md }}>{KIND_LABEL[kind]}</Text>
                {grouped[kind].map(pocket => {
                  const Icon = KIND_ICON[kind];
                  return (
                    <Pressable
                      key={pocket.id}
                      onPress={() => router.push({ pathname: '/(pockets)/detail', params: { id: pocket.id } })}
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
                        <Icon size={16} color={colors.ink} strokeWidth={2} />
                      </View>
                      <View style={{ marginLeft: spacing.md, flex: 1 }}>
                        <Text style={{ ...typography.heading, color: colors.ink }}>{pocket.name}</Text>
                        {pocket.category && (
                          <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2, textTransform: 'capitalize' }}>{pocket.category}</Text>
                        )}
                      </View>
                      <Text style={{ ...typography.body, color: colors.ink, fontVariant: ['tabular-nums'] }}>
                        {fmt(pocket.monthly_allocation ?? 0)}
                      </Text>
                    </Pressable>
                  );
                })}

                {/* Edit percentages button for spendable category */}
                {kind === 'spendable' && (
                  <Pressable
                    onPress={() => router.push('/(profile)/edit-plan-percentages')}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: spacing.sm,
                      marginTop: spacing.md,
                      padding: spacing.md,
                      borderRadius: radius.md,
                      backgroundColor: colors.emeraldDeep,
                    }}
                  >
                    <ShoppingBasket size={16} color={colors.surface} strokeWidth={2} />
                    <Text style={{ ...typography.heading, color: colors.surface }}>
                      Edit spendable percentages
                    </Text>
                  </Pressable>
                )}
              </View>
            ) : null
          )}

          <Pressable
            onPress={() => {
              if (!retakeAllowed) return;
              router.push('/(profile)/retake-checkin');
            }}
            disabled={!retakeAllowed}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
              marginTop: spacing.xl,
              padding: spacing.md,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.line,
              opacity: retakeAllowed ? 1 : 0.5,
            }}
          >
            <Briefcase size={16} color={colors.ink} strokeWidth={2} />
            <Text style={{ ...typography.heading, color: colors.ink }}>
              {retakeAllowed
                ? 'Retake behavior check-in'
                : retakeNextOn
                  ? `Retake available ${retakeNextOn}`
                  : 'Retake locked this month'}
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </ScreenContainer>
  );
}