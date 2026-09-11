import React from 'react';
import { View, Text, AppState } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Clock } from 'lucide-react-native';
import { radius, spacing, typography, borderWidth } from '@/theme';
import { useTheme } from '@/theme/ThemeContext';
import { reallocationsApi } from '@/services/api';
import { useHomeStore } from '@/services/home-store';
import { useDataSync } from '@/services/data-sync';
import { useAlertModal } from '@/hooks/useAlertModal';
import { Button, ScreenContainer, SafeScrollView, BrandHeader } from '@/components/ui';
import { showReallocationConfirm } from '@/services/notifications';
import { safeGoBack } from '@/utils/navigation';
import { formatMoney } from '@/utils/money';

type CooloffParams = {
  reallocationId: string;
  coolingOffEndsAt: string;
  fromName: string;
  toName: string;
  amount: string;
  // Money-personality modifier layer (§2.3) — optional; falls back to the
  // existing static copy below when the API didn't send framing (e.g. an
  // older client/server pairing).
  coolingOffTitle?: string;
  coolingOffMessage?: string;
};

function formatCurrency(amount: number) {
  return formatMoney(amount);
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Landing now...';
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
  const { colors } = useTheme();
  const { alert, confirm, modal } = useAlertModal();

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
        void showReallocationConfirm(
          Number(params.amount) || 0,
          params.fromName,
          params.toName,
        );
        useDataSync.getState().bump();
        await refreshData();
        goToSuccess();
      } catch (err) {
        resolvedRef.current = false;
        setIsResolving(false);
        await alert('Could not complete this move', err instanceof Error ? err.message : 'Please try again.');
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
    const confirmed = await confirm(
      'Move it now anyway?',
      'This costs 5 discipline points. Your choice — the pause is support, not a trap.',
      { confirmLabel: 'Skip the wait', cancelLabel: 'Keep waiting' }
    );
    if (confirmed) {
      complete(true);
    }
  };

  const handleWait = () => {
    safeGoBack(router, '/(tabs)');
  };

  const styles = {
    hero: {
      alignItems: 'center' as const,
      marginTop: spacing.lg,
      paddingHorizontal: spacing.md,
    },
    icon: {
      width: 56,
      height: 56,
      borderRadius: radius.pill,
      backgroundColor: colors.plumTint,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      marginBottom: spacing.md,
    },
    title: {
      ...typography.title,
      color: colors.ink,
      textAlign: 'center' as const,
    },
    subtext: {
      ...typography.body,
      color: colors.sage,
      textAlign: 'center' as const,
      marginTop: spacing.sm,
    },
    timerCard: {
      marginTop: spacing.xl,
      backgroundColor: colors.surface,
      borderWidth: borderWidth,
      borderColor: colors.line,
      borderRadius: radius.lg,
      padding: spacing.lg,
      alignItems: 'center' as const,
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
      flex: 1,
      height: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.lineSoft,
      marginTop: spacing.md,
      overflow: 'hidden' as const,
    },
    barFill: {
      height: 6,
      backgroundColor: colors.plum,
      borderRadius: radius.pill,
    },
    timerSub: {
      ...typography.caption,
      color: colors.sage,
      marginTop: spacing.sm,
      textAlign: 'center' as const,
    },
    skipNote: {
      ...typography.caption,
      color: colors.sage,
      textAlign: 'center' as const,
      marginTop: spacing.md,
    },
  };

  return (
    <ScreenContainer>
      <BrandHeader onBack={() => {}} fallbackHref="/(tabs)" />
      <SafeScrollView>
        <View style={styles.hero}>
          <View style={styles.icon}>
            <Clock size={28} color={colors.plum} strokeWidth={1.7} />
          </View>
          <Text style={styles.title}>{params.coolingOffTitle || 'This move can wait a bit'}</Text>
          <Text style={styles.subtext}>
            {params.coolingOffMessage ||
              `Moving ${formatCurrency(Number(params.amount) || 0)} from ${params.fromName} to ${params.toName} triggers a short pause — a chance to sit with it. Nothing is lost, no judgement.`}
          </Text>
        </View>

        <View style={styles.timerCard}>
          <Text style={styles.timerLabel}>Pause ends in</Text>
          <Text style={styles.timerValue}>{formatRemaining(remainingMs)}</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${progress * 100}%` } as any]} />
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
      {modal}
    </ScreenContainer>
  );
}