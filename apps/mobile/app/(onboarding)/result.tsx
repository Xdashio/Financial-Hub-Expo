import React from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radius, spacing, typography, shadow, touchTarget } from '@/theme';
import { useOnboardingStore } from '@/services/onboarding-store';
import { Button, ScreenContainer, SafeScrollView, ProgressIndicator, SectionTitle } from '@/components/ui';
import { ChevronLeft, Check, Shield, TrendingUp, Home, DollarSign, Lock } from 'lucide-react-native';

export default function ResultScreen() {
  const router = useRouter();
  const { assignResult, commitPlan, goBack, reset } = useOnboardingStore();
  
  const [isCommitting, setIsCommitting] = React.useState(false);

  if (!assignResult) {
    // Redirect back if no result
    React.useEffect(() => {
      router.replace('/(onboarding)/income');
    }, []);
    return null;
  }

  const { plan, planType, incomePattern, reasons, remainingAfterFixed, savingsTarget, spendableAmount } = assignResult;
  const incomeAmount = remainingAfterFixed + savingsTarget + spendableAmount;

  const handleEnterPlan = async () => {
    setIsCommitting(true);
    try {
      await commitPlan();
      // Navigate to home after successful commit
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Error', 'Failed to create your plan. Please try again.');
    } finally {
      setIsCommitting(false);
    }
  };

  const handleAdjust = () => {
    goBack();
  };

  const getPlanTag = () => {
    const patternLabel = incomePattern === 'salaried' ? 'Salaried income' : 'Freelancer income';
    const styleLabel = planType === 'structured' ? 'Planner behaviour' : 'Daily budget style';
    return `${patternLabel} · ${styleLabel}`;
  };

  const getPocketColor = (kind: string, category?: string) => {
    if (kind === 'fixed') return colors.gold;
    if (kind === 'savings') return colors.emeraldDeep;
    if (kind === 'spendable') {
      switch (category) {
        case 'food': return colors.emerald;
        case 'transport': return colors.plum;
        case 'leisure': return colors.clay;
        default: return colors.emerald;
      }
    }
    return colors.emerald;
  };

  const getPocketIcon = (kind: string, category?: string) => {
    if (kind === 'fixed') return Home;
    if (kind === 'savings') return Shield;
    if (kind === 'spendable') {
      switch (category) {
        case 'food': return DollarSign;
        case 'transport': return TrendingUp;
        case 'leisure': return Home;
        default: return DollarSign;
      }
    }
    return DollarSign;
  };

  const getPocketName = (kind: string, category?: string) => {
    if (kind === 'fixed') return 'Fixed costs';
    if (kind === 'savings') return 'Savings';
    if (kind === 'spendable') {
      switch (category) {
        case 'food': return 'Food & Groceries';
        case 'transport': return 'Transport';
        case 'leisure': return 'Personal & Leisure';
        default: return 'Spendable';
      }
    }
    return 'Pocket';
  };

  const getPocketMeta = (kind: string, category?: string, percentage?: number) => {
    if (kind === 'fixed') return { label: 'Set aside before anything else', status: 'Settled' };
    if (kind === 'savings') return { label: 'Minimum 10% — enforced, not optional', status: `${percentage?.toFixed(1)}% of income` };
    if (kind === 'spendable') return { label: 'Divided across your spendable pockets', status: `${percentage?.toFixed(1)}% of income` };
    return { label: '', status: '' };
  };

  const getProgressWidth = (kind: string) => {
    if (kind === 'fixed') return '100%';
    if (kind === 'savings') return `${(savingsTarget / incomeAmount * 100).toFixed(1)}%`;
    if (kind === 'spendable') return `${(spendableAmount / incomeAmount * 100).toFixed(1)}%`;
    return '0%';
  };

  const SPENDABLE_CATEGORIES = ['food', 'transport', 'leisure'] as const;
  const perPocketAmount = spendableAmount / SPENDABLE_CATEGORIES.length;
  const savingsPercentage = (savingsTarget / incomeAmount * 100);
  const spendablePercentage = (spendableAmount / incomeAmount * 100);
  const fixedPercentage = (remainingAfterFixed + savingsTarget + spendableAmount - spendableAmount - savingsTarget) / incomeAmount * 100;
  // Actually fixed = incomeAmount - spendableAmount - savingsTarget
  const fixedAmount = incomeAmount - spendableAmount - savingsTarget;
  const fixedPercentageCorrect = (fixedAmount / incomeAmount * 100);

  return (
    <ScreenContainer>
      <SafeScrollView>
        <ProgressIndicator currentStep={4} totalSteps={4} />

        <View style={styles.resultHero}>
          <View style={styles.resultBadge}>
            <Check size={26} color="#fff" strokeWidth={1.7} />
          </View>
          <Text style={styles.eyebrow}>Your money plan is ready</Text>
          <Text style={styles.planName}>{plan}</Text>
          <Text style={styles.planTag}>{getPlanTag()}</Text>
        </View>

        <View style={styles.whyCard}>
          <Text style={styles.whyTitle}>Why this plan</Text>
          {reasons.map((reason, index) => (
            <View key={index} style={styles.whyRow}>
              <View style={styles.whyIcon}>
                {index === 0 && <Home size={15} color={colors.ink} strokeWidth={2} />}
                {index === 1 && <TrendingUp size={15} color={colors.ink} strokeWidth={2} />}
                {index === 2 && <Check size={15} color={colors.ink} strokeWidth={2} />}
              </View>
              <Text style={styles.whyText}>{reason.reason}</Text>
            </View>
          ))}
        </View>

        <SectionTitle>Your monthly split</SectionTitle>

        {/* Income strip */}
        <View style={styles.incomeStrip}>
          <View>
            <Text style={styles.incomeLabel}>Monthly income</Text>
            <Text style={styles.incomeValue}>KSh {incomeAmount.toLocaleString()}</Text>
          </View>
          <TrendingUp size={22} color={colors.emeraldDeep} strokeWidth={2} />
        </View>

        {/* Fixed costs pocket card */}
        <PocketCard
          kind="fixed"
          color={getPocketColor('fixed')}
          name={getPocketName('fixed')}
          amount={fixedAmount.toLocaleString()}
          progress={1}
          meta={getPocketMeta('fixed')}
          highlight={false}
        />

        {/* Savings pocket card */}
        <PocketCard
          kind="savings"
          color={getPocketColor('savings')}
          name={getPocketName('savings')}
          amount={savingsTarget.toLocaleString()}
          progress={savingsPercentage / 100}
          meta={getPocketMeta('savings', undefined, savingsPercentage)}
          locked={true}
          highlight={false}
        />

        {/* Safe to spend pocket card */}
        <PocketCard
          kind="spendable"
          color="#fff"
          name="Safe to spend"
          amount={spendableAmount.toLocaleString()}
          progress={spendablePercentage / 100}
          meta={getPocketMeta('spendable', undefined, spendablePercentage)}
          highlight={true}
        />

        <Text style={styles.note}>Portions shown to scale · savings minimum is enforced at allocation, not just displayed</Text>

        <View style={styles.actions}>
          <Button
            fullWidth
            size="lg"
            loading={isCommitting}
            onPress={handleEnterPlan}
            rightIcon={<ChevronLeft size={18} color="#fff" style={{ transform: [{ rotate: '180deg' }] }} />}
          >
            Enter my plan
          </Button>
          <View style={styles.adjustLink}>
            <Button variant="ghost" onPress={handleAdjust}>
              Adjust before I start
            </Button>
          </View>
        </View>
      </SafeScrollView>
    </ScreenContainer>
  );
}

interface PocketCardProps {
  kind: 'fixed' | 'savings' | 'spendable';
  color: string;
  name: string;
  amount: string;
  progress: number;
  meta: { label: string; status: string };
  locked?: boolean;
  highlight?: boolean;
}

function PocketCard({ kind, color, name, amount, progress, meta, locked, highlight }: PocketCardProps) {
  const IconComponent = getPocketIcon(kind);
  
  const backgroundStyle = highlight ? {
    backgroundColor: colors.ink,
    borderWidth: 0,
  } : {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  };

  const textColor = highlight ? '#fff' : colors.ink;
  const metaColor = highlight ? 'rgba(255,255,255,0.7)' : colors.sage;
  const barBgColor = highlight ? 'rgba(255,255,255,0.15)' : colors.lineSoft;

  return (
    <View style={[styles.pocketCard, backgroundStyle, { borderRadius: radius.lg, overflow: 'hidden' }]}>
      <View style={styles.pocketTab} />
      <View style={styles.pocketTop}>
        <View style={styles.pocketNameRow}>
          <IconComponent 
            size={14} 
            color={highlight ? '#fff' : color} 
            strokeWidth={2} 
            style={styles.pocketIcon}
          />
          <Text style={[styles.pocketName, { color: textColor }]}>{name}</Text>
          {locked && (
            <Lock size={13} color={metaColor} strokeWidth={2.5} style={styles.lockIcon} />
          )}
        </View>
        <Text style={[styles.pocketAmount, { color: textColor }]}>{amount}</Text>
      </View>
      <View style={[styles.pocketBarTrack, { backgroundColor: barBgColor }]}>
        <View
          style={[
            styles.pocketBarFill,
            { 
              backgroundColor: highlight ? '#fff' : color, 
              width: `${Math.min(Math.max(progress * 100, 0), 100)}%` 
            },
          ]}
        />
      </View>
      <View style={styles.pocketMeta}>
        <Text style={[styles.pocketMetaText, { color: metaColor }]}>{meta.label}</Text>
        <Text style={[styles.pocketMetaText, { color: metaColor }]}>{meta.status}</Text>
      </View>
    </View>
  );
}

function getPocketIcon(kind: string) {
  switch (kind) {
    case 'fixed': return Home;
    case 'savings': return Shield;
    case 'spendable': return DollarSign;
    default: return DollarSign;
  }
}

const styles = StyleSheet.create({
  resultHero: {
    alignItems: 'center',
    paddingTop: spacing.md,
    marginBottom: spacing.xl,
  },
  resultBadge: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.emeraldDeep,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.sage,
  },
  planName: {
    ...typography.display,
    fontWeight: '800',
    color: colors.ink,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  planTag: {
    ...typography.body,
    color: colors.sage,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  whyCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    ...shadow.default,
  },
  whyTitle: {
    ...typography.heading,
    fontWeight: '600',
    fontSize: 13,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  whyRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  whyRowLast: {
    marginBottom: 0,
  },
  whyIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    backgroundColor: colors.emeraldTint,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  whyText: {
    ...typography.body,
    color: colors.ink,
    flex: 1,
    lineHeight: 21,
  },
  incomeStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  incomeLabel: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.sage,
  },
  incomeValue: {
    ...typography.title,
    fontWeight: '700',
    color: colors.emeraldDeep,
    marginTop: 2,
  },
  pocketCard: {
    marginBottom: spacing.md,
    minHeight: touchTarget.minHeight * 3,
  },
  pocketTab: {
    position: 'absolute',
    top: 0,
    left: spacing.md,
    right: spacing.md,
    height: 4,
    backgroundColor: colors.emeraldDeep,
    borderRadius: radius.pill,
  },
  pocketTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg + 4,
    paddingBottom: spacing.md,
  },
  pocketNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pocketIcon: {},
  pocketName: {
    ...typography.heading,
    fontWeight: '600',
  },
  pocketAmount: {
    ...typography.body,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  lockIcon: {
    marginLeft: spacing.xs,
  },
  pocketBarTrack: {
    height: 6,
    borderRadius: radius.pill,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  pocketBarFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  pocketMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  pocketMetaText: {
    ...typography.caption,
    fontSize: 11,
  },
  note: {
    ...typography.caption,
    fontSize: 11,
    color: colors.sage,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  actions: {
    gap: spacing.md,
  },
  adjustLink: {
    alignItems: 'center',
  },
});