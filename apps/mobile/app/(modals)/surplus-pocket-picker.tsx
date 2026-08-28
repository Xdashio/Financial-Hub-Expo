import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowRight, Check } from 'lucide-react-native';
import { radius, spacing, typography, borderWidth, borderWidthThick } from '@/theme';
import { useTheme } from '@/theme/ThemeContext';
import { useHomeStore, Pocket } from '@/services/home-store';
import { Button, ScreenContainer, SafeScrollView, BrandHeader, SectionTitle } from '@/components/ui';
import { useAlertModal } from '@/hooks/useAlertModal';
import { incomeApi, pocketsApi } from '@/services/api';
import { useDataSync } from '@/services/data-sync';
import { formatMoney } from '@/utils/money';

function dotColor(pocket: Pocket, colors: any): string {
  if (pocket.kind === 'savings') return colors.emeraldDeep;
  if (pocket.kind === 'fixed') return colors.gold;
  const categoryColors: Record<string, string> = {
    food: colors.emerald,
    transport: colors.plum,
    leisure: colors.clay,
  };
  return categoryColors[pocket.category || 'food'] || colors.emerald;
}

function subtitle(pocket: Pocket): string {
  if (pocket.kind === 'fixed') return 'Essential · Fixed';
  if (pocket.kind === 'savings') return 'Protected · Savings';
  if (pocket.category === 'leisure') return 'Discretionary · Spendable';
  return 'Essential · Spendable';
}

function formatCurrency(amount: number) {
  return formatMoney(amount);
}

export default function SurplusPocketPickerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ incomeEventId: string; surplusAmount: string; segment?: string }>();
  const segmentParam = params.segment === 'msme' ? 'msme' : undefined;
  const homePockets = useHomeStore((s) => s.pockets);
  const { colors } = useTheme();
  const { alert } = useAlertModal();

  const [msmePockets, setMsmePockets] = React.useState<Pocket[] | null>(null);
  const pockets = segmentParam === 'msme' ? (msmePockets ?? []) : homePockets;

  React.useEffect(() => {
    if (segmentParam === 'msme') {
      pocketsApi
        .getAll('msme')
        .then((res: any[]) =>
          setMsmePockets(
            res.map((p: any) => ({
              id: p.id,
              name: p.name,
              kind: p.kind,
              category: p.category,
              monthlyAllocation: p.monthly_allocation,
              availableBalance: p.available_balance,
              isTimeLocked: p.is_time_locked,
            })),
          ),
        )
        .catch(() => setMsmePockets([]));
    }
  }, [segmentParam]);

  const [selectedPocketId, setSelectedPocketId] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const surplusAmount = Number(params.surplusAmount) || 0;
  const selectedPocket = pockets.find((p) => p.id === selectedPocketId);

  const handleSelectPocket = (pocket: Pocket) => {
    setSelectedPocketId(pocket.id);
  };

  const handleContinue = async () => {
    if (!selectedPocketId || !params.incomeEventId) return;

    try {
      setIsSubmitting(true);

      await incomeApi.allocateSurplus(params.incomeEventId, {
        target: 'pocket',
        pocket_id: selectedPocketId,
        ...(segmentParam ? { segment: segmentParam } : {}),
      } as any);

      // Refresh data and navigate to success
      useDataSync.getState().bump();

      router.replace({
        pathname: '/(income)/success',
        params: {
          amount: String(surplusAmount),
          triggered: 'true',
          allocations: JSON.stringify([]),
          totalAllocated: String(surplusAmount),
          unallocated: '0',
          ...(segmentParam ? { segment: segmentParam } : {}),
        },
      });
    } catch (error: any) {
      const message = error?.message || 'Failed to allocate surplus. Please try again.';
      alert('Allocation failed', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const styles = {
    title: {
      ...typography.title,
      color: colors.ink,
      marginTop: spacing.md,
    },
    subtext: {
      ...typography.body,
      color: colors.sage,
      marginTop: spacing.xs,
    },
  };

  return (
    <ScreenContainer>
      <BrandHeader onBack={() => {}} fallbackHref="/(tabs)" />
      <SafeScrollView>
        <View style={{ marginTop: spacing.lg }}>
          <Text style={styles.title}>Choose a pocket</Text>
          <Text style={styles.subtext}>
            Select which pocket should receive the surplus of {formatCurrency(surplusAmount)}.
          </Text>
        </View>

        <SectionTitle>Available pockets</SectionTitle>
        {pockets.map((pocket) => (
          <PocketRow
            key={pocket.id}
            pocket={pocket}
            selected={pocket.id === selectedPocketId}
            onPress={() => handleSelectPocket(pocket)}
            colors={colors}
          />
        ))}

        <View style={{ marginTop: spacing.xxl }}>
          <Button
            fullWidth
            size="lg"
            disabled={!selectedPocketId || isSubmitting}
            onPress={handleContinue}
            loading={isSubmitting}
            rightIcon={<ArrowRight size={16} color={colors.surface} />}
          >
            Allocate surplus
          </Button>
        </View>
      </SafeScrollView>
    </ScreenContainer>
  );
}

function PocketRow({
  pocket,
  selected,
  onPress,
  colors,
}: {
  pocket: Pocket;
  selected: boolean;
  onPress: () => void;
  colors: any;
}) {
  const styles = {
    pocketRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderWidth: borderWidth,
      borderColor: colors.line,
      borderRadius: radius.md,
      padding: spacing.md,
      marginTop: spacing.sm,
    },
    pocketRowSelected: {
      borderWidth: borderWidthThick,
      borderColor: colors.emeraldDeep,
      backgroundColor: colors.emeraldTint,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: radius.pill,
    },
    pocketName: {
      ...typography.heading,
      color: colors.ink,
    },
    pocketSub: {
      ...typography.caption,
      color: colors.sage,
      marginTop: 2,
    },
    pocketAmount: {
      ...typography.body,
      color: colors.ink,
      fontVariant: ['tabular-nums'] as any,
    },
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.pocketRow, selected && styles.pocketRowSelected, { opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={[styles.dot, { backgroundColor: dotColor(pocket, colors) }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.pocketName}>{pocket.name}</Text>
        <Text style={styles.pocketSub}>{subtitle(pocket)}</Text>
      </View>
      {selected && <Check size={18} color={colors.emeraldDeep} strokeWidth={2} />}
      <Text style={styles.pocketAmount}>{formatCurrency(pocket.monthlyAllocation)}</Text>
    </Pressable>
  );
}