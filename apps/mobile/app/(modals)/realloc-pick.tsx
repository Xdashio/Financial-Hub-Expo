import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeftRight, Lock, ArrowRight } from 'lucide-react-native';
import { colors, radius, spacing, typography, borderWidth, borderWidthThick } from '@/theme';
import { useHomeStore, Pocket } from '@/services/home-store';
import { Button, Input, ScreenContainer, SafeScrollView, BrandHeader, SectionTitle } from '@/components/ui';

const POCKET_DOT_COLORS: Record<string, string> = {
  food: colors.emerald,
  transport: colors.plum,
  leisure: colors.clay,
  savings: colors.emeraldDeep,
  fixed: colors.gold,
};

function dotColor(pocket: Pocket): string {
  if (pocket.kind === 'savings') return POCKET_DOT_COLORS.savings;
  if (pocket.kind === 'fixed') return POCKET_DOT_COLORS.fixed;
  return POCKET_DOT_COLORS[pocket.category || 'food'] || POCKET_DOT_COLORS.food;
}

function subtitle(pocket: Pocket): string {
  if (pocket.isTimeLocked) return 'Time-locked · cannot be moved from';
  if (pocket.kind === 'fixed') return 'Essential · Fixed';
  if (pocket.kind === 'savings') return 'Protected · Savings';
  if (pocket.category === 'leisure') return 'Discretionary · Spendable';
  return 'Essential · Spendable';
}

function formatCurrency(amount: number) {
  return `KES ${Math.round(amount).toLocaleString()}`;
}

export default function ReallocPickScreen() {
  const router = useRouter();
  const pockets = useHomeStore((s) => s.pockets);

  const [fromId, setFromId] = React.useState<string | null>(null);
  const [toId, setToId] = React.useState<string | null>(null);
  const [amount, setAmount] = React.useState('');

  const fromPocket = pockets.find((p) => p.id === fromId) || null;
  const toOptions = pockets.filter((p) => p.id !== fromId);

  const parsedAmount = Number(amount);
  const hasValidAmount = amount.length > 0 && !Number.isNaN(parsedAmount) && parsedAmount > 0;
  const withinBalance = fromPocket ? parsedAmount <= fromPocket.monthlyAllocation : false;
  const canContinue = !!fromPocket && !!toId && hasValidAmount && withinBalance;

  const handleSelectFrom = (pocket: Pocket) => {
    if (pocket.isTimeLocked) return;
    setFromId(pocket.id);
    if (toId === pocket.id) setToId(null);
  };

  const handleContinue = () => {
    if (!canContinue || !fromPocket || !toId) return;
    router.push({
      pathname: '/(modals)/realloc-review',
      params: {
        fromId: fromPocket.id,
        toId,
        amount: String(parsedAmount),
      },
    });
  };

  return (
    <ScreenContainer>
      <BrandHeader onBack={() => router.canGoBack() && router.back()} />
      <SafeScrollView>
        <Text style={styles.title}>Move money between pockets</Text>
        <Text style={styles.subtext}>
          Pick where it's coming from, then where it's going. Locked pockets can't be used as a source.
        </Text>

        <SectionTitle>From</SectionTitle>
        {pockets.map((pocket) => (
          <PocketRow
            key={`from-${pocket.id}`}
            pocket={pocket}
            selected={pocket.id === fromId}
            disabled={!!pocket.isTimeLocked}
            onPress={() => handleSelectFrom(pocket)}
          />
        ))}

        <View style={styles.swapDivider}>
          <View style={styles.swapCircle}>
            <ArrowLeftRight size={16} color={colors.sage} />
          </View>
        </View>

        <SectionTitle>To</SectionTitle>
        {toOptions.length === 0 ? (
          <Text style={styles.subtext}>Pick a "From" pocket to see destination options.</Text>
        ) : (
          toOptions.map((pocket) => (
            <PocketRow
              key={`to-${pocket.id}`}
              pocket={pocket}
              selected={pocket.id === toId}
              disabled={false}
              onPress={() => setToId(pocket.id)}
            />
          ))
        )}

        {!!fromPocket && (
          <View style={{ marginTop: spacing.lg }}>
            <Input
              label="Amount"
              placeholder="0"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
              helperText={`Available: ${formatCurrency(fromPocket.monthlyAllocation)}`}
              error={hasValidAmount && !withinBalance ? 'Amount exceeds available balance' : undefined}
            />
          </View>
        )}

        <View style={{ marginTop: spacing.xxl }}>
          <Button
            fullWidth
            size="lg"
            disabled={!canContinue}
            onPress={handleContinue}
            rightIcon={<ArrowRight size={16} color="#fff" />}
          >
            Continue to review
          </Button>
        </View>
      </SafeScrollView>
    </ScreenContainer>
  );
}

function PocketRow({
  pocket,
  selected,
  disabled,
  onPress,
}: {
  pocket: Pocket;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={disabled ? 1 : 0.7}
      onPress={disabled ? undefined : onPress}
      style={[styles.pocketRow, selected && styles.pocketRowSelected, disabled && styles.pocketRowDisabled]}
    >
      <View style={[styles.dot, { backgroundColor: dotColor(pocket) }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.pocketName}>{pocket.name}</Text>
        <Text style={styles.pocketSub}>{subtitle(pocket)}</Text>
      </View>
      {disabled && <Lock size={14} color={colors.sage} style={{ marginRight: spacing.xs }} />}
      <Text style={styles.pocketAmount}>{formatCurrency(pocket.monthlyAllocation)}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
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
  pocketRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  pocketRowDisabled: {
    opacity: 0.55,
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
    fontVariant: ['tabular-nums'],
  },
  swapDivider: {
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  swapCircle: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: borderWidth,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
});