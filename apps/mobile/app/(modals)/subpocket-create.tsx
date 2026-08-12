import React from 'react';
import { View, Text } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowRight, Layers } from 'lucide-react-native';
import { radius, spacing, typography, borderWidth } from '@/theme';
import { useTheme } from '@/theme/ThemeContext';
import { pocketsApi } from '@/services/api';
import { useDataSync } from '@/services/data-sync';
import { Button, Input, ScreenContainer, SafeScrollView, BrandHeader } from '@/components/ui';

/**
 * Create a sub-pocket nested under `parentId` (audit_team.md item 10).
 * Reachable from the Pocket Detail screen's "Sub-pockets" section, for
 * top-level pockets only — a sub-pocket can't itself have sub-pockets, so
 * this screen is never opened with a sub-pocket's own id as the parent.
 *
 * Category is intentionally not exposed here yet: the schema
 * (SubPocketCreateInputSchema) supports an optional category that can
 * differ from the parent's (e.g. a Loan pocket's purpose sub-pockets), but
 * that's only meaningful once item 9 (loans) lands and needs it. Keeping
 * this form to name + amount for now avoids designing a category picker
 * for a case nothing uses yet.
 */
export default function SubPocketCreateScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const bump = useDataSync((s) => s.bump);
  const { parentId } = useLocalSearchParams<{ parentId: string }>();

  const [name, setName] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const parsedAmount = Number(amount);
  const hasValidAmount = amount.length > 0 && !Number.isNaN(parsedAmount) && parsedAmount > 0;
  const hasValidName = name.trim().length > 0;
  const canSubmit = hasValidName && hasValidAmount && !submitting;

  const handleCreate = async () => {
    if (!canSubmit || !parentId) return;
    setSubmitting(true);
    setError(null);
    try {
      await pocketsApi.createSubPocket(parentId, {
        name: name.trim(),
        monthlyAllocation: parsedAmount,
      });
      bump();
      if (router.canGoBack()) router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create this sub-pocket.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer>
      <BrandHeader onBack={() => router.canGoBack() && router.back()} />
      <SafeScrollView>
        <View style={{ marginTop: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.pill,
              backgroundColor: colors.emeraldTint,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Layers size={18} color={colors.emeraldDeep} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.title, color: colors.ink }}>New sub-pocket</Text>
            <Text style={{ ...typography.body, color: colors.sage, marginTop: 2 }}>
              Earmark part of this pocket for something specific.
            </Text>
          </View>
        </View>

        <View style={{ marginTop: spacing.xl, gap: spacing.lg }}>
          <Input
            label="Name"
            placeholder="e.g. School fees"
            value={name}
            onChangeText={setName}
            maxLength={100}
            autoFocus
          />
          <Input
            label="Amount to earmark"
            placeholder="0"
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
            helperText="This is split off from the parent pocket's own allocation — siblings can't add up to more than it."
            error={amount.length > 0 && !hasValidAmount ? 'Enter a valid amount' : undefined}
          />
        </View>

        {!!error && (
          <View
            style={{
              marginTop: spacing.lg,
              backgroundColor: colors.clayTint,
              borderRadius: radius.sm,
              borderWidth,
              borderColor: colors.clay + '30',
              padding: spacing.md,
            }}
          >
            <Text style={{ ...typography.caption, color: colors.clay, lineHeight: 18 }}>{error}</Text>
          </View>
        )}

        <View style={{ marginTop: spacing.xxl }}>
          <Button
            fullWidth
            size="lg"
            disabled={!canSubmit}
            loading={submitting}
            onPress={handleCreate}
            rightIcon={<ArrowRight size={16} color={colors.surface} />}
          >
            Create sub-pocket
          </Button>
        </View>
      </SafeScrollView>
    </ScreenContainer>
  );
}
