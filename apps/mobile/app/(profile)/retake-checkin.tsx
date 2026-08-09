import React from 'react';
import { View, Text, ScrollView, SafeAreaView, Pressable, TouchableOpacity, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { radius, spacing, typography, shadow, touchTarget } from '../../src/theme';
import { useTheme } from '@/theme/ThemeContext';
import { Button, Input, LoadingState, SectionTitle } from '@/components/ui';
import { useAlertModal } from '@/hooks/useAlertModal';
import { profileApi } from '@/services/api';
import { useAuthStore } from '@/services/auth';
import { getExpenseIcon } from '@/utils/expenseIcon';
import {
  ArrowLeft, RefreshCw, Wallet, ListChecks, CalendarClock, Building2, TrendingUp, Clock,
  AlertCircle, Plus, Trash2, GraduationCap, Bus, CreditCard, X, Check,
} from 'lucide-react-native';
import { IncomePattern, IncomeIntervalBand, SpendingHabit, OnboardingInput } from '@financial-hub/shared';

const REASONS = [
  { icon: Wallet, title: 'Income changed', desc: 'New job, raise, or a shift in how you get paid' },
  { icon: ListChecks, title: 'Fixed costs changed', desc: 'Rent, bills, or other recurring expenses moved' },
  { icon: CalendarClock, title: 'Habits changed', desc: 'Your spending pattern looks different now' },
];

const INCOME_PATTERNS = [
  { id: 'salaried', label: 'Fixed salary, same day each month', description: 'Predictable — easy to plan around', icon: Building2 },
  { id: 'freelancer', label: 'Irregular freelance or business', description: 'Amounts and dates vary', icon: TrendingUp },
  { id: 'mix', label: 'A mix of both', description: 'Base salary plus side income', icon: Clock },
] as const;

const SOURCE_COUNTS = [
  { id: 1, label: '1 source' },
  { id: 2, label: '2–3 sources' },
  { id: 3, label: '4+ sources' },
] as const;

// Deliberately banded, not exact — see docs/FREELANCER_RUNWAY.md.
const INCOME_INTERVAL_BANDS: { id: IncomeIntervalBand; label: string }[] = [
  { id: 'weekly', label: 'Weekly' },
  { id: 'biweekly', label: 'Every 2 weeks' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'irregular', label: 'No clear pattern' },
];

const HABIT_OPTIONS = [
  { id: 'tracker', label: 'I track closely, rarely surprised', description: 'You check balances often', icon: Wallet },
  { id: 'week3', label: 'I notice around week 3', description: 'Some months tighter than others', icon: Clock },
  { id: 'off_guard', label: 'It catches me off guard', description: 'Income arrives irregularly', icon: AlertCircle },
] as const;

interface FixedExpenseItem {
  id: string;
  name: string;
  amount: number;
  dueDay: number;
  category: string;
  icon?: string;
}

const SUGGESTIONS = [
  { name: 'School fees', icon: GraduationCap, category: 'education' },
  { name: 'Transport pass', icon: Bus, category: 'transport' },
  { name: 'Subscriptions', icon: CreditCard, category: 'other' },
];

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

function formatAmount(text: string) {
  const cleaned = text.replace(/[^\d]/g, '');
  if (!cleaned) return '';
  return Number(cleaned).toLocaleString();
}

/**
 * Enhanced, self-contained retake check-in. Unlike the original flow this
 * does NOT navigate into (onboarding)/* — it stays on this screen the whole
 * time, prefills what it can from the user's current plan, and submits
 * directly to /profile/plan/retake. See docs/FREELANCER_RUNWAY.md for the
 * incomeIntervalBand piece.
 */
export default function RetakeCheckinScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { alert, modal } = useAlertModal();
  const insets = useSafeAreaInsets();

  const [showForm, setShowForm] = React.useState(false);
  const [isPrefilling, setIsPrefilling] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  // Form state — same fields OnboardingInput needs, prefilled where the
  // backend actually persists them (plan + fixed expenses); the rest start
  // from sensible defaults exactly like fresh onboarding does.
  const [incomePattern, setIncomePattern] = React.useState<IncomePattern>('salaried');
  const [incomeIntervalBand, setIncomeIntervalBand] = React.useState<IncomeIntervalBand | null>(null);
  const [incomeAmount, setIncomeAmount] = React.useState('');
  const [sourceCount, setSourceCount] = React.useState(1);
  const [spendingHabit, setSpendingHabit] = React.useState<SpendingHabit>('tracker');
  const [fixedExpenses, setFixedExpenses] = React.useState<FixedExpenseItem[]>([]);

  const [showAddModal, setShowAddModal] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [newAmount, setNewAmount] = React.useState('');
  const [newDueDay, setNewDueDay] = React.useState('1');
  const [newCategory, setNewCategory] = React.useState('other');
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState('');
  const [editAmount, setEditAmount] = React.useState('');
  const [editDueDay, setEditDueDay] = React.useState('1');
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);

  const totalFixed = fixedExpenses.reduce((sum, e) => sum + e.amount, 0);
  const deleteTarget = fixedExpenses.find((e) => e.id === deleteTargetId);

  const loadPrefill = React.useCallback(async () => {
    setIsPrefilling(true);
    try {
      const [planRes, fixedRes] = await Promise.all([
        profileApi.getPlan().catch(() => null),
        profileApi.getFixedExpenses().catch(() => []),
      ]);
      if (planRes) {
        if (planRes.income_pattern) setIncomePattern(planRes.income_pattern);
        // income_interval_days is only ever persisted for freelancer plans
        // (see docs/FREELANCER_RUNWAY.md) — map the stored day count back
        // to the closest band so the picker starts on a sensible default
        // instead of forcing the user to re-answer from scratch.
        if (planRes.income_interval_days) {
          const days = planRes.income_interval_days;
          if (days <= 7) setIncomeIntervalBand('weekly');
          else if (days <= 14) setIncomeIntervalBand('biweekly');
          else setIncomeIntervalBand('monthly');
        }
      }
      if (Array.isArray(fixedRes) && fixedRes.length > 0) {
        setFixedExpenses(
          fixedRes.map((e: any) => ({
            id: e.id ?? generateId(),
            name: e.name,
            amount: e.amount,
            dueDay: e.due_day ?? e.dueDay ?? 1,
            category: e.category ?? 'other',
          }))
        );
      }
    } finally {
      setIsPrefilling(false);
    }
  }, []);

  const handleStart = async () => {
    setShowForm(true);
    await loadPrefill();
  };

  const handleAddSuggestion = (suggestion: typeof SUGGESTIONS[0]) => {
    setShowAddModal(true);
    setNewName(suggestion.name);
    setNewAmount('');
    setNewDueDay('1');
    setNewCategory(suggestion.category);
    setEditingId(null);
  };

  const handleAddCustom = () => {
    setShowAddModal(true);
    setNewName('');
    setNewAmount('');
    setNewDueDay('1');
    setNewCategory('other');
    setEditingId(null);
  };

  const handleEdit = (expense: FixedExpenseItem) => {
    setEditingId(expense.id);
    setEditName(expense.name);
    setEditAmount(expense.amount.toLocaleString());
    setEditDueDay(String(expense.dueDay));
    setShowAddModal(true);
  };

  const resetExpenseForm = () => {
    setNewName(''); setNewAmount(''); setNewDueDay('1'); setNewCategory('other');
    setEditingId(null); setEditName(''); setEditAmount(''); setEditDueDay('1');
  };

  const handleSaveExpense = () => {
    if (editingId) {
      const amount = Number(editAmount.replace(/,/g, ''));
      if (!amount || amount <= 0) { alert('Error', 'Please enter a valid amount'); return; }
      if (!editName.trim()) { alert('Error', 'Please enter a name'); return; }
      const dueDay = Number(editDueDay);
      if (!dueDay || dueDay < 1 || dueDay > 31) { alert('Error', 'Please enter a valid due day (1-31)'); return; }
      setFixedExpenses((prev) => prev.map((e) => (e.id === editingId ? { ...e, name: editName, amount, dueDay } : e)));
    } else {
      const amount = Number(newAmount.replace(/,/g, ''));
      if (!amount || amount <= 0) { alert('Error', 'Please enter a valid amount'); return; }
      if (!newName.trim()) { alert('Error', 'Please enter a name'); return; }
      const dueDay = Number(newDueDay);
      if (!dueDay || dueDay < 1 || dueDay > 31) { alert('Error', 'Please enter a valid due day (1-31)'); return; }
      setFixedExpenses((prev) => [...prev, { id: generateId(), name: newName, amount, dueDay, category: newCategory }]);
    }
    setShowAddModal(false);
    resetExpenseForm();
  };

  const confirmDelete = () => {
    if (deleteTargetId) setFixedExpenses((prev) => prev.filter((e) => e.id !== deleteTargetId));
    setDeleteTargetId(null);
  };

  const handleSubmit = async () => {
    const amount = Number(incomeAmount.replace(/,/g, ''));
    if (!amount || amount <= 0) {
      alert('Error', 'Please enter your average monthly income');
      return;
    }
    if (incomePattern === 'freelancer' && !incomeIntervalBand) {
      alert('Error', 'Let us know roughly how often payments land');
      return;
    }
    if (totalFixed >= amount) {
      alert('Error', 'Fixed expenses cannot exceed or equal income');
      return;
    }

    const payload: OnboardingInput = {
      incomePattern,
      incomeAmount: amount,
      sourceCount,
      spendingHabit,
      fixedTotal: totalFixed,
      fixedExpenses: fixedExpenses.map((e) => ({
        name: e.name,
        amount: e.amount,
        dueDay: e.dueDay,
        category: e.category as any,
      })),
      incomeIntervalBand: incomePattern === 'freelancer' ? incomeIntervalBand ?? undefined : undefined,
    };

    setIsSubmitting(true);
    try {
      // Hits /profile/plan/retake directly — this replaces the active plan
      // in place. No navigation to (onboarding)/*, so the user never
      // leaves this stack.
      await profileApi.retakeBehaviorCheckin(payload);
      useAuthStore.setState({ hasPlan: true });
      setSubmitted(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again.';
      await alert('Could not update your plan', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl }}>
          <View style={{ width: 64, height: 64, borderRadius: radius.pill, backgroundColor: colors.emeraldTint, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg }}>
            <Check size={28} color={colors.emeraldDeep} strokeWidth={2.5} />
          </View>
          <Text style={{ ...typography.title, color: colors.ink, textAlign: 'center' }}>Your plan is updated</Text>
          <Text style={{ ...typography.body, color: colors.sage, marginTop: spacing.sm, textAlign: 'center', lineHeight: 21 }}>
            Your pockets now match how you actually earn and spend today.
          </Text>
          <Button fullWidth size="lg" style={{ marginTop: spacing.xl }} onPress={() => router.replace('/(tabs)')}>
            Back to home
          </Button>
        </View>
        {modal}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg }}>
        <Pressable onPress={() => (showForm ? setShowForm(false) : router.back())} style={{ padding: spacing.sm }}>
          <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
        </Pressable>
        <Text style={{ ...typography.title, color: colors.ink, marginLeft: spacing.md }}>Retake Check-in</Text>
      </View>

      {!showForm && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
          <View style={{ padding: spacing.xl, borderRadius: radius.md, backgroundColor: colors.ink, alignItems: 'center' }}>
            <View style={{ width: 48, height: 48, borderRadius: radius.md, backgroundColor: `${colors.surface}1A`, alignItems: 'center', justifyContent: 'center' }}>
              <RefreshCw size={22} color={colors.surface} strokeWidth={2} />
            </View>
            <Text style={{ ...typography.title, color: colors.surface, fontSize: 18, marginTop: spacing.md, textAlign: 'center' }}>
              Update your plan
            </Text>
            <Text style={{ ...typography.body, color: `${colors.surface}99`, marginTop: spacing.xs, textAlign: 'center' }}>
              A quick check-in updates your plan right here — no need to redo onboarding from scratch.
            </Text>
          </View>

          <Text style={{ ...typography.eyebrow, color: colors.ink, marginTop: spacing.xl, marginBottom: spacing.md }}>Good reasons to retake it</Text>
          {REASONS.map((reason) => (
            <View key={reason.title} style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, marginBottom: spacing.sm }}>
              <View style={{ width: 36, height: 36, borderRadius: radius.xs, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' }}>
                <reason.icon size={16} color={colors.ink} strokeWidth={2} />
              </View>
              <View style={{ marginLeft: spacing.md, flex: 1 }}>
                <Text style={{ ...typography.heading, color: colors.ink }}>{reason.title}</Text>
                <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>{reason.desc}</Text>
              </View>
            </View>
          ))}

          <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.md }}>
            Your existing pockets stay active until you save — nothing changes until you finish.
          </Text>

          <Button fullWidth size="md" onPress={handleStart} style={{ marginTop: spacing.xl }}>
            Start check-in
          </Button>
        </ScrollView>
      )}

      {showForm && isPrefilling && <LoadingState label="Loading your current plan…" />}

      {showForm && !isPrefilling && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
          <SectionTitle>Income pattern</SectionTitle>
          <View style={{ marginTop: spacing.md, gap: spacing.md }}>
            {INCOME_PATTERNS.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={[
                  { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.lg, minHeight: touchTarget.minHeight * 2 },
                  incomePattern === option.id && { borderColor: colors.emeraldDeep, backgroundColor: colors.emeraldDeep },
                ]}
                onPress={() => setIncomePattern(option.id)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected: incomePattern === option.id }}
              >
                <View style={[{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.emeraldTint, alignItems: 'center', justifyContent: 'center' }, incomePattern === option.id && { backgroundColor: `${colors.surface}33` }]}>
                  <option.icon size={18} color={incomePattern === option.id ? colors.surface : colors.ink} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[{ ...typography.heading, color: colors.ink }, incomePattern === option.id && { color: colors.surface }]}>{option.label}</Text>
                  <Text style={[{ ...typography.caption, fontSize: 12, color: colors.sage, marginTop: 2 }, incomePattern === option.id && { color: `${colors.surface}CC` }]}>{option.description}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {incomePattern === 'freelancer' && (
            <View style={{ marginTop: spacing.xl }}>
              <SectionTitle>Roughly how often do payments land?</SectionTitle>
              <Text style={{ ...typography.caption, fontSize: 12, color: colors.sage, marginTop: 4, marginBottom: spacing.md, lineHeight: 18 }}>
                Freelance income comes in bursts — that&apos;s normal, not a budgeting failure. A rough estimate is all we need.
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {INCOME_INTERVAL_BANDS.map((band) => (
                  <TouchableOpacity
                    key={band.id}
                    style={[
                      { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface, minWidth: 88, alignItems: 'center', justifyContent: 'center' },
                      incomeIntervalBand === band.id && { borderColor: colors.emeraldDeep, backgroundColor: colors.emeraldDeep },
                    ]}
                    onPress={() => setIncomeIntervalBand(band.id)}
                    hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: incomeIntervalBand === band.id }}
                  >
                    <Text style={[{ ...typography.caption, color: colors.ink, textAlign: 'center' }, incomeIntervalBand === band.id && { color: colors.surface }]}>{band.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View style={{ marginTop: spacing.xl }}>
            <Input
              label="Average monthly income (after tax)"
              value={incomeAmount}
              onChangeText={(t) => setIncomeAmount(formatAmount(t))}
              placeholder="68,000"
              keyboardType="numeric"
              textContentType="none"
              leftElement={<Text style={{ ...typography.body, fontSize: 15, color: colors.sage }}>KSh</Text>}
            />
          </View>

          <SectionTitle>Income sources</SectionTitle>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.xl }}>
            {SOURCE_COUNTS.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={[
                  { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface, minWidth: 88, alignItems: 'center', justifyContent: 'center' },
                  sourceCount === option.id && { borderColor: colors.emeraldDeep, backgroundColor: colors.emeraldDeep },
                ]}
                onPress={() => setSourceCount(option.id)}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                accessibilityRole="button"
                accessibilityState={{ selected: sourceCount === option.id }}
              >
                <Text style={[{ ...typography.caption, color: colors.ink, textAlign: 'center' }, sourceCount === option.id && { color: colors.surface }]}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <SectionTitle>When money runs low, what usually happens?</SectionTitle>
          <View style={{ marginTop: spacing.md, marginBottom: spacing.xl, gap: spacing.md }}>
            {HABIT_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={[
                  { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.lg, minHeight: touchTarget.minHeight * 2 },
                  spendingHabit === option.id && { borderColor: colors.emeraldDeep, backgroundColor: colors.emeraldDeep },
                ]}
                onPress={() => setSpendingHabit(option.id)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected: spendingHabit === option.id }}
              >
                <View style={[{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.emeraldTint, alignItems: 'center', justifyContent: 'center' }, spendingHabit === option.id && { backgroundColor: `${colors.surface}33` }]}>
                  <option.icon size={18} color={spendingHabit === option.id ? colors.surface : colors.ink} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[{ ...typography.heading, color: colors.ink }, spendingHabit === option.id && { color: colors.surface }]}>{option.label}</Text>
                  <Text style={[{ ...typography.caption, fontSize: 12, color: colors.sage, marginTop: 2 }, spendingHabit === option.id && { color: `${colors.surface}CC` }]}>{option.description}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <SectionTitle>What repeats every month?</SectionTitle>
          {fixedExpenses.length > 0 && (
            <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.sm, marginTop: spacing.md, marginBottom: spacing.md }}>
              {fixedExpenses.map((expense) => {
                const IconComponent = getExpenseIcon(expense.name, expense.category);
                return (
                  <View key={expense.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.lineSoft }}>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1, minHeight: touchTarget.minHeight }}
                      onPress={() => handleEdit(expense)}
                      activeOpacity={0.85}
                    >
                      <View style={{ width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.emeraldTint, alignItems: 'center', justifyContent: 'center' }}>
                        <IconComponent size={16} color={colors.ink} strokeWidth={2} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ ...typography.body, color: colors.ink }}>{expense.name}</Text>
                        <Text style={{ ...typography.caption, fontSize: 12, color: colors.sage }}>Paid by the {expense.dueDay}{expense.dueDay === 1 ? 'st' : expense.dueDay === 2 ? 'nd' : expense.dueDay === 3 ? 'rd' : 'th'}</Text>
                      </View>
                      <Text style={{ ...typography.body, color: colors.ink }}>KSh {expense.amount.toLocaleString()}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ padding: spacing.sm, minWidth: touchTarget.minWidth, minHeight: touchTarget.minHeight }}
                      onPress={() => setDeleteTargetId(expense.id)}
                    >
                      <Trash2 size={16} color={colors.error} strokeWidth={2} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm }}>
            {SUGGESTIONS.map((suggestion) => (
              <TouchableOpacity
                key={suggestion.name}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface, minHeight: touchTarget.minHeight }}
                onPress={() => handleAddSuggestion(suggestion)}
              >
                <suggestion.icon size={12} color={colors.ink} strokeWidth={2.2} />
                <Text style={{ ...typography.caption, color: colors.ink }}>{suggestion.name}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.emeraldDeep, backgroundColor: colors.surface, minHeight: touchTarget.minHeight }}
              onPress={handleAddCustom}
            >
              <Plus size={12} color={colors.emeraldDeep} strokeWidth={2.2} />
              <Text style={{ ...typography.caption, color: colors.emeraldDeep }}>Custom</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, marginTop: spacing.md, marginBottom: spacing.xl, backgroundColor: colors.emeraldTint, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line }}>
            <Text style={{ ...typography.heading, color: colors.ink }}>Total fixed per month</Text>
            <Text style={{ ...typography.title, color: colors.emeraldDeep }}>KSh {totalFixed.toLocaleString()}</Text>
          </View>

          <Button fullWidth size="lg" loading={isSubmitting} onPress={handleSubmit}>
            Save updated plan
          </Button>

          {/* Add/Edit fixed expense modal */}
          <Modal visible={showAddModal} transparent animationType="slide" statusBarTranslucent onRequestClose={() => { setShowAddModal(false); resetExpenseForm(); }}>
            <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <TouchableOpacity style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: `${colors.ink}73` }} onPress={() => { setShowAddModal(false); resetExpenseForm(); }} activeOpacity={1} />
              <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: spacing.lg, paddingTop: spacing.md, maxHeight: '85%', ...shadow.elevated, paddingBottom: insets.bottom + spacing.lg }}>
                <View style={{ width: 36, height: 4, borderRadius: radius.pill, backgroundColor: colors.line, alignSelf: 'center', marginBottom: spacing.lg }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl }}>
                  <Text style={{ ...typography.title, color: colors.ink }}>{editingId ? 'Edit fixed expense' : 'Add fixed expense'}</Text>
                  <TouchableOpacity style={{ width: 32, height: 32, borderRadius: radius.pill, backgroundColor: colors.lineSoft, alignItems: 'center', justifyContent: 'center' }} onPress={() => { setShowAddModal(false); resetExpenseForm(); }} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <X size={18} color={colors.inkSoft} strokeWidth={2} />
                  </TouchableOpacity>
                </View>
                <View style={{ gap: spacing.lg }}>
                  <Input label="Name" value={editingId ? editName : newName} onChangeText={editingId ? setEditName : setNewName} placeholder="e.g., Rent" autoFocus />
                  <Input
                    label="Amount (KSh)"
                    value={editingId ? editAmount : newAmount}
                    onChangeText={(t) => { const f = formatAmount(t); editingId ? setEditAmount(f) : setNewAmount(f); }}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                  <Input label="Due day" value={editingId ? editDueDay : newDueDay} onChangeText={(t) => (editingId ? setEditDueDay(t) : setNewDueDay(t))} placeholder="1" keyboardType="numeric" />
                </View>
                <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}>
                  <Button variant="secondary" style={{ flex: 1 }} onPress={() => { setShowAddModal(false); resetExpenseForm(); }}>Cancel</Button>
                  <Button style={{ flex: 1 }} onPress={handleSaveExpense}>{editingId ? 'Save changes' : 'Add expense'}</Button>
                </View>
              </View>
            </KeyboardAvoidingView>
          </Modal>

          {/* Delete confirmation modal */}
          <Modal visible={!!deleteTargetId} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setDeleteTargetId(null)}>
            <View style={{ flex: 1, justifyContent: 'flex-end' }}>
              <TouchableOpacity style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: `${colors.ink}73` }} onPress={() => setDeleteTargetId(null)} activeOpacity={1} />
              <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: spacing.lg, paddingTop: spacing.md, maxHeight: '85%', ...shadow.elevated, paddingBottom: insets.bottom + spacing.lg }}>
                <View style={{ width: 36, height: 4, borderRadius: radius.pill, backgroundColor: colors.line, alignSelf: 'center', marginBottom: spacing.lg }} />
                <Text style={{ ...typography.title, color: colors.ink, marginBottom: spacing.md }}>Delete expense</Text>
                <Text style={{ ...typography.body, color: colors.inkSoft, lineHeight: 21 }}>
                  Are you sure you want to remove {deleteTarget ? `"${deleteTarget.name}"` : 'this fixed expense'}? This can&apos;t be undone.
                </Text>
                <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}>
                  <Button variant="secondary" style={{ flex: 1 }} onPress={() => setDeleteTargetId(null)}>Cancel</Button>
                  <Button style={{ flex: 1, backgroundColor: colors.error, borderColor: colors.error }} onPress={confirmDelete}>Delete</Button>
                </View>
              </View>
            </View>
          </Modal>
        </ScrollView>
      )}
      {modal}
    </SafeAreaView>
  );
}