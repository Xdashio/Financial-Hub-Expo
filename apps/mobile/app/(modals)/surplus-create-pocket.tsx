import React from 'react';
import { View, Text } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowRight, Layers } from 'lucide-react-native';
import { radius, spacing, typography, borderWidth } from '@/theme';
import { useTheme } from '@/theme/ThemeContext';
import { useDataSync } from '@/services/data-sync';
import { Button, Input, ScreenContainer, SafeScrollView, BrandHeader } from '@/components/ui';
import { useAlertModal } from '@/hooks/useAlertModal';
import { incomeApi } from '@/services/api';

export default function SurplusCreatePocketScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { alert } = useAlertModal();
  const params = useLocalSearchParams<{ incomeEventId: string; surplusAmount: string }>();

  const [name, setName] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const surplusAmount = Number(params.surplusAmount) || 0;
  const hasValidName = name.trim().length > 0;
  const canSubmit = hasValidName && !isSubmitting;

  const handleCreate = async () => {
    if (!canSubmit || !params.incomeEventId) return;

    setIsSubmitting(true);
    try {
      await incomeApi.allocateSurplus(params.incomeEventId, {
        target: 'new_pocket',
        new_pocket_name: name.trim(),
      });

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
        },
      });
    } catch (error: any) {
      const message = error?.message || 'Could not create this pocket.';
      alert('Creation failed', message);
    } finally {
      setIsSubmitting(false);
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
            <Text style={{ ...typography.title, color: colors.ink }}>Create new pocket</Text>
            <Text style={{ ...typography.body, color: colors.sage, marginTop: 2 }}>
              Your surplus of KES {surplusAmount.toLocaleString()} will be allocated here.
            </Text>
          </View>
        </View>

        <View style={{ marginTop: spacing.xl, gap: spacing.lg }}>
          <Input
            label="Pocket name"
            placeholder="e.g. Vacation fund"
            value={name}
            onChangeText={setName}
            maxLength={100}
            autoFocus
          />
        </View>

        <View style={{ marginTop: spacing.xxl }}>
          <Button
            fullWidth
            size="lg"
            disabled={!canSubmit}
            loading={isSubmitting}
            onPress={handleCreate}
            rightIcon={<ArrowRight size={16} color={colors.surface} />}
          >
            Create and allocate
          </Button>
        </View>
      </SafeScrollView>
    </ScreenContainer>
  );
}
