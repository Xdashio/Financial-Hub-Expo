import React from 'react';
import { View, Text, StyleSheet, AppState } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Clock } from 'lucide-react-native';
import { colors, radius, spacing, typography, borderWidth } from '@/theme';
import { reallocationsApi } from '@/services/api';
import { useHomeStore } from '@/services/home-store';
import { showAlert, showConfirm } from '@/utils/alert';
import { Button, ScreenContainer, SafeScrollView, BrandHeader } from '@/components/ui';

type CooloffParams = {
  reallocationId: string;
  coolingOffEndsAt: string;
  fromName: string;
  toName: string;
  amount: string;
};

function formatCurrency(amount: number) {
  return `KES ${Math.round(amount).toLocaleString()}`;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Landing now…';
  const totalMinutes = Math.ceil(ms / 60000);
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`;
  }
  return `${totalMinutes} min`;
}

export default function ReallocCooloffScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<CooloffParams>();
  const refreshData = useHomeStore((s) => s.refreshData);

  const endsAt = React.useMemo(() => new Date(params.coolingOffEndsAt).getTime(), [params.coolingOffEndsAt]);
  const startedAt = React.useMemo(() => Date.now(), []);
  const totalMs = Math.max(1, endsAt - startedAt);

  const [now, setNow] = React.useState(Date.now());
  const [isResolving, setIsResolving] = React.useState(false);
  const resolvedRef = React.useRef(false);

  const remainingMs = Math.max(0, endsAt - now);
  const progress = Math.min(1, Math.max(0, 1 - remainingMs / totalMs));

  const goToSuccess = React.useCallback(() => {
    router.replace({
      pathname: '/(modals)/realloc-success',
      params: {
        fromName: params.fromName,
        toName: params.toName,
        amount: params.amount,
      },
    });
  }, [router, params.fromName, params.toName, params.amount]);

  const complete = React.useCallback(
    async (skipCoolingOff: boolean) => {
      if (resolvedRef.current) return;
      resolvedRef.current = true;
      setIsResolving(true);
      try {
        await reallocationsApi.complete(params.reallocationId, { skipCoolingOff });
        await refreshData();
        goToSuccess();
      } catch (err) {
        resolvedRef.current = false;
        setIsResolving(false);
        showAlert('Could not complete this move', err instanceof Error ? err.message : 'Please try again.');
      }
    },
    [params.reallocationId, refreshData, goToSuccess]
  );

  // Tick the countdown, and auto-complete once the wait is over.
  React.useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    if (remainingMs <= 0 && !resolvedRef.current) {
      complete(false);
    }
  }, [remainingMs, complete]);

  // On app resume, re-check whether the pause has already elapsed while the
  // user was away, so a returning user lands straight on success.
  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && Date.now() >= endsAt && !resolvedRef.current) {
        complete(false);
      }
    });
    return () => sub.remove();
  }, [endsAt, complete]);

  const handleSkip = async () => {
    const confirmed = await showConfirm(
      'Move it now anyway?',
      'This costs 5 discipline points. Your choice — the pause is support, not a trap.',
      'Skip the wait',
      'Keep waiting'
    );
    if (confirmed) {
      complete(true);
    }
  };

  const handleWait = () => {
    router.canGoBack() ? router.back() : router.replace('/(tabs)');
  };

  return (
    <ScreenContainer>
      <BrandHeader onBack={() => router.canGoBack() && router.back()} />
      <SafeScrollView>
        <View style={styles.hero}>
          <View style={styles.icon}>
            <Clock size={28} color={colors.plum} strokeWidth={1.7} />
          </View>
          <Text style={styles.title}>This move can wait a bit</Text>
          <Text style={styles.subtext}>
            Moving {formatCurrency(Number(params.amount) || 0)} from {params.fromName} to {params.toName} triggers a
            short pause — a chance to sit with it. Nothing is lost, no judgement.
          </Text>
        </View>

        <View style={styles.timerCard}>
          <Text style={styles.timerLabel}>Pause ends in</Text>
          <Text style={styles.timerValue}>{formatRemaining(remainingMs)}</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.timerSub}>Your move is confirmed and safe — it lands when the pause ends.</Text>
        </View>

        <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
          <Button fullWidth size="lg" onPress={handleWait} disabled={isResolving}>
            Remind me when it's done
          </Button>
          <Button fullWidth size="lg" variant="secondary" onPress={handleSkip} loading={isResolving}>
            Move it now anyway · costs 5 points
          </Button>
        </View>
        <Text style={styles.skipNote}>
          Skipping the pause lowers your discipline score by 5 points. Your choice — the pause is support, not a
          trap.
        </Text>
      </SafeScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.plumTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.title,
    color: colors.ink,
    textAlign: 'center',
  },
  subtext: {
    ...typography.body,
    color: colors.sage,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  timerCard: {
    marginTop: spacing.xl,
    backgroundColor: colors.surface,
    borderWidth: borderWidth,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  timerLabel: {
    ...typography.caption,
    color: colors.sage,
  },
  timerValue: {
    ...typography.display,
    color: colors.plum,
    marginTop: spacing.xs,
  },
  barTrack: {
    width: '100%',
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.lineSoft,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.plum,
    borderRadius: radius.pill,
  },
  timerSub: {
    ...typography.caption,
    color: colors.sage,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  skipNote: {
    ...typography.caption,
    color: colors.sage,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});