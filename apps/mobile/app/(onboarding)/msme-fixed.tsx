import { View, Text, Pressable, Keyboard, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import React from 'react';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, touchTarget } from '@/theme';
import { useOnboardingStore, BUSINESS_CATEGORIES } from '@/services/onboarding-store';
import { useAlertModal } from '@/hooks/useAlertModal';
import { Button, Input, ScreenContainer, SafeScrollView, BrandHeader, SectionTitle } from '@/components/ui';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react-native';
import { getCategoryIcon } from '@/utils/categoryIcons';
import type { BusinessPocketCategory } from '@financial-hub/shared';

function CategoryChips({
  selected,
  onSelect,
  multiple = false,
}: {
  selected: string[];
  onSelect: (id: BusinessPocketCategory) => void;
  multiple?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, width: '100%' }}>
      {BUSINESS_CATEGORIES.map((option) => {
        const isSelected = selected.includes(option.id);
        return (
          <Pressable
            key={option.id}
            style={({ pressed }) => [
              { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface, minHeight: touchTarget.minHeight, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', flexShrink: 0, maxWidth: '100%' },
              isSelected && { borderColor: colors.emeraldDeep, backgroundColor: colors.emeraldDeep },
              { opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={() => onSelect(option.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={option.label}
          >
            <Text style={[
              { ...typography.caption, color: colors.ink, flexShrink: 1 },
              isSelected && { color: colors.surface },
            ]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * MSME onboarding step 2 (ADR-001 §6.2): business fixed expenses plus the
 * up-to-6 business pocket definitions. Fixed expenses share the existing
 * personal-flow fixedExpenses store list (itemized → locked fixed pockets);
 * business pockets become the spendable grid on the MSME home.
 */
export default function MsmeFixedScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { alert, modal } = useAlertModal();
  const {
    fixedExpenses,
    addFixedExpense,
    removeFixedExpense,
    msmeCustomPockets,
    addCustomPocket,
    removeCustomPocket,
    previewMsmePlan,
    msmeInput,
  } = useOnboardingStore();

  const [isLoading, setIsLoading] = React.useState(false);
  const [formName, setFormName] = React.useState('');
  const [formAmount, setFormAmount] = React.useState('');
  const [formDueDay, setFormDueDay] = React.useState('1');
  const [formCategory, setFormCategory] = React.useState<BusinessPocketCategory>('rent');
  const [pocketName, setPocketName] = React.useState('');
  const [pocketCategory, setPocketCategory] = React.useState<BusinessPocketCategory>('stock');
  const [pocketPercent, setPocketPercent] = React.useState('');

  const totalFixed = fixedExpenses.reduce((sum, e) => sum + e.amount, 0);
  const displayName = msmeInput.businessName || '';
  const totalPocketPercent = msmeCustomPockets.reduce((sum, p) => sum + (p.percentage ?? 0), 0);

  const formatAmount = (text: string) => {
    const cleaned = text.replace(/[^\d]/g, '');
    if (!cleaned) return '';
    return Number(cleaned).toLocaleString();
  };

  const handleAddFixed = () => {
    Keyboard.dismiss();
    const amount = Number(formAmount.replace(/,/g, ''));
    if (!amount || amount <= 0) {
      alert('Error', 'Please enter a valid amount');
      return;
    }
    if (!formName.trim()) {
      alert('Error', 'Please enter a name');
      return;
    }
    const dueDay = Number(formDueDay);
    if (!dueDay || dueDay < 1 || dueDay > 31) {
      alert('Error', 'Please enter a valid due day (1-31)');
      return;
    }
    addFixedExpense({ name: formName.trim(), amount, dueDay, category: formCategory });
    setFormName('');
    setFormAmount('');
    setFormDueDay('1');
  };

  const handleAddPocket = () => {
    if (msmeCustomPockets.length >= 6) {
      alert('Pocket limit', 'You can have up to 6 business pockets.');
      return;
    }
    if (!pocketName.trim()) {
      alert('Error', 'Please name the pocket');
      return;
    }
    const pct = parseFloat(pocketPercent.replace(/[^\d.]/g, ''));
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      alert('Invalid Percentage', 'Please enter a valid percentage between 1% and 100% (e.g. 50% for Restocking).');
      return;
    }
    if (totalPocketPercent + pct > 100) {
      alert('Exceeds 100%', `Total allocation cannot exceed 100%. Currently allocated: ${totalPocketPercent}%. Adding ${pct}% would reach ${totalPocketPercent + pct}%.`);
      return;
    }
    addCustomPocket({ name: pocketName.trim(), category: pocketCategory, percentage: pct });
    setPocketName('');
    setPocketPercent('');
  };

  const handleContinue = async () => {
    if (msmeCustomPockets.length > 0 && Math.abs(totalPocketPercent - 100) > 0.01) {
      await alert(
        'Allocation must equal 100%',
        `Your business pockets currently total ${totalPocketPercent}%. Please adjust pocket percentages or add another pocket so they equal exactly 100%.`
      );
      return;
    }

    setIsLoading(true);
    try {
      await previewMsmePlan();
      router.push('/(onboarding)/msme-result');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again.';
      await alert('Could not generate your plan', message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <SafeScrollView>
        <BrandHeader onBack={() => {}} fallbackHref="/(onboarding)/income" />
        <View style={{ marginTop: spacing.xl, marginBottom: spacing.xl }}>
          <Text style={{ ...typography.eyebrow, color: colors.sage }}>Business plan — {displayName}</Text>
          <Text style={{ ...typography.display, color: colors.ink, marginTop: spacing.sm }}>What repeats monthly?</Text>
          <Text style={{ ...typography.body, color: colors.sage, marginTop: spacing.sm, lineHeight: 22 }}>
            Add your recurring business costs and the pockets you want to run your money in.
          </Text>
        </View>

        <SectionTitle>Recurring business costs</SectionTitle>
        {fixedExpenses.length > 0 && (
          <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.sm, marginVertical: spacing.md }}>
            {fixedExpenses.map((expense) => {
              const Icon = getCategoryIcon(expense.category as any) || (() => null);
              return (
                <View key={expense.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.lineSoft }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1, minHeight: touchTarget.minHeight }}>
                    <View style={{ width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.emeraldTint, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={16} color={colors.ink} strokeWidth={2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...typography.body, color: colors.ink }}>{expense.name}</Text>
                      <Text style={{ ...typography.caption, fontSize: 12, color: colors.sage }}>Paid by the {expense.dueDay}</Text>
                    </View>
                    <Text style={{ ...typography.body, color: colors.ink }}>KSh {expense.amount.toLocaleString()}</Text>
                    <Pressable onPress={() => removeFixedExpense(expense.id)} hitSlop={8} accessibilityLabel={`Delete ${expense.name}`} accessibilityRole="button">
                      <Trash2 size={16} color={colors.error} strokeWidth={2} />
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md }}>
          <Input label="Cost name" value={formName} onChangeText={setFormName} placeholder="e.g. Rent for the shop" accessible accessibilityLabel="Cost name" />
          <Input label="Amount (KSh)" value={formAmount} onChangeText={(t) => setFormAmount(formatAmount(t))} placeholder="0" keyboardType="numeric" accessible accessibilityLabel="Amount in Kenyan shillings" />
          <Input label="Due day" value={formDueDay} onChangeText={(t) => setFormDueDay(t.replace(/\D/g, '').slice(0, 2))} placeholder="1" keyboardType="numeric" accessible accessibilityLabel="Due day of the month" />
          <Text style={{ ...typography.caption, fontSize: 12, color: colors.sage }}>Category</Text>
          <CategoryChips
            multiple={false}
            selected={[formCategory]}
            onSelect={(id) => setFormCategory(id)}
          />
          <Pressable
            style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.xs, paddingVertical: spacing.sm + 2, borderRadius: radius.pill, backgroundColor: colors.emeraldTint }, { opacity: pressed ? 0.7 : 1 }]}
            onPress={handleAddFixed}
            accessibilityLabel="Add recurring cost"
            accessibilityRole="button"
          >
            <Plus size={14} color={colors.emeraldDeep} strokeWidth={2.4} />
            <Text style={{ ...typography.caption, color: colors.emeraldDeep }}>Add cost</Text>
          </Pressable>
        </View>

        <Text style={{ ...typography.body, color: colors.sage, marginTop: spacing.md }}>
          Total recurring: <Text style={{ ...typography.body, color: colors.ink, fontWeight: '600' }}>KSh {totalFixed.toLocaleString()}</Text>
        </Text>

        <SectionTitle>Business pockets ({msmeCustomPockets.length}/6)</SectionTitle>
        <Text style={{ ...typography.caption, fontSize: 12, color: colors.sage, marginBottom: spacing.sm, lineHeight: 18 }}>
          Name your spendable business pockets and assign what percentage of your spendable revenue goes into each.
        </Text>

        {/* Live percentage allocation meter */}
        <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
            <Text style={{ ...typography.caption, color: colors.sage }}>Spendable revenue allocation</Text>
            <View style={{
              backgroundColor: Math.abs(totalPocketPercent - 100) < 0.01 ? colors.emeraldTint : totalPocketPercent > 100 ? colors.clayTint : colors.goldTint,
              borderRadius: radius.pill,
              paddingHorizontal: spacing.sm,
              paddingVertical: 3,
            }}>
              <Text style={{
                ...typography.caption,
                fontSize: 11,
                fontWeight: '700',
                color: Math.abs(totalPocketPercent - 100) < 0.01 ? colors.emeraldDeep : totalPocketPercent > 100 ? colors.error : colors.gold,
              }}>
                {Math.abs(totalPocketPercent - 100) < 0.01
                  ? '100% Allocated'
                  : totalPocketPercent > 100
                  ? `${totalPocketPercent}% (+${totalPocketPercent - 100}% over)`
                  : `${totalPocketPercent}% / 100% (${100 - totalPocketPercent}% left)`}
              </Text>
            </View>
          </View>
          <View style={{ height: 8, backgroundColor: colors.lineSoft, borderRadius: radius.pill, overflow: 'hidden', marginTop: spacing.xs }}>
            <View style={{
              height: '100%',
              width: `${Math.min(100, totalPocketPercent)}%`,
              backgroundColor: Math.abs(totalPocketPercent - 100) < 0.01 ? colors.emeraldDeep : totalPocketPercent > 100 ? colors.error : colors.gold,
              borderRadius: radius.pill,
            }} />
          </View>
        </View>

        {msmeCustomPockets.length > 0 && (
          <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.sm, marginBottom: spacing.md }}>
            {msmeCustomPockets.map((pocket) => {
              const label = BUSINESS_CATEGORIES.find((c) => c.id === pocket.category)?.label ?? pocket.category;
              const Icon = getCategoryIcon(pocket.category) || (() => null);
              return (
                <View key={pocket.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.lineSoft }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 }}>
                    <View style={{ width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.emeraldTint, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={16} color={colors.ink} strokeWidth={2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...typography.body, color: colors.ink }} numberOfLines={1}>{pocket.name}</Text>
                      <Text style={{ ...typography.caption, fontSize: 12, color: colors.sage }}>{label}</Text>
                    </View>
                    <View style={{ backgroundColor: colors.emeraldTint, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 4, marginRight: spacing.xs }}>
                      <Text style={{ ...typography.caption, fontSize: 12, color: colors.emeraldDeep, fontWeight: '700' }}>
                        {pocket.percentage != null ? `${pocket.percentage}%` : '—'}
                      </Text>
                    </View>
                    <Pressable onPress={() => removeCustomPocket(pocket.id)} hitSlop={8} accessibilityLabel={`Delete ${pocket.name}`} accessibilityRole="button">
                      <Trash2 size={16} color={colors.error} strokeWidth={2} />
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md }}>
          <Input label="Pocket name" value={pocketName} onChangeText={setPocketName} placeholder="e.g. Restocking & Inventory" accessible accessibilityLabel="Business pocket name" />
          <Input
            label="Percentage of spendable pool (%)"
            value={pocketPercent}
            onChangeText={setPocketPercent}
            placeholder={totalPocketPercent < 100 ? `e.g. ${100 - totalPocketPercent}` : 'e.g. 50'}
            keyboardType="numeric"
            accessible
            accessibilityLabel="Pocket allocation percentage"
          />
          <Text style={{ ...typography.caption, fontSize: 12, color: colors.sage }}>Category</Text>
          <CategoryChips
            multiple={false}
            selected={[pocketCategory]}
            onSelect={setPocketCategory}
          />
          <Pressable
            style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.sm + 2, borderRadius: radius.pill, backgroundColor: colors.emeraldTint, opacity: msmeCustomPockets.length >= 6 ? 0.4 : (pressed ? 0.7 : 1) }]}
            onPress={handleAddPocket}
            accessibilityLabel={msmeCustomPockets.length >= 6 ? 'Maximum 6 business pockets' : 'Add business pocket'}
            accessibilityRole="button"
          >
            <Plus size={14} color={colors.emeraldDeep} strokeWidth={2.4} />
            <Text style={{ ...typography.caption, color: colors.emeraldDeep }}>{msmeCustomPockets.length >= 6 ? 'Max 6 pockets' : 'Add pocket'}</Text>
          </Pressable>
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <Button
            fullWidth
            size="lg"
            loading={isLoading}
            onPress={handleContinue}
            rightIcon={<ChevronLeft size={18} color={colors.surface} style={{ transform: [{ rotate: '180deg' }] }} />}
          >
            Preview my business plan
          </Button>
        </View>
      </SafeScrollView>
      {modal}
    </ScreenContainer>
  );
}