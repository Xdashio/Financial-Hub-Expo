import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { radius, spacing, typography, shadow } from '../../src/theme';
import { useTheme } from '@/theme/ThemeContext';
import { useAlertModal } from '@/hooks/useAlertModal';
import { profileApi } from '@/services/api';
import { LoadingState, ErrorState, SearchBar, Toast, BottomSheetModal, EmptyState } from '@/components/ui';
import { getExpenseIcon } from '@/utils/expenseIcon';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit,
  Check,
  X,
  LucideIcon,
  ShoppingCart,
  Car,
  Film,
  Scissors,
  Lightbulb,
  HeartPulse,
  GraduationCap,
  MoreHorizontal,
  Package,
  Home,
  Users,
} from 'lucide-react-native';

interface FixedExpense {
  id: string;
  name: string;
  amount: number;
  due_day: number;
  category: string;
  user_id: string;
  created_at: string;
}

export default function FixedExpensesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  
  const [expenses, setExpenses] = useState<FixedExpense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<FixedExpense | null>(null);
  const { alert, confirm, modal } = useAlertModal();
  
  // Form state
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [category, setCategory] = useState('');
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);
  
  // Validation errors
  const [nameError, setNameError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [dueDayError, setDueDayError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' | 'info'; actionLabel?: string; onAction?: () => void }>({
    visible: false,
    message: '',
    type: 'info',
  });
  const [deletedExpense, setDeletedExpense] = useState<FixedExpense | null>(null);

  const categories = [
    { id: 'food', name: 'Food & Groceries', icon: ShoppingCart },
    { id: 'transport', name: 'Transport', icon: Car },
    { id: 'leisure', name: 'Personal & Leisure', icon: Film },
    { id: 'personal', name: 'Personal Care', icon: Scissors },
    { id: 'utilities', name: 'Utilities', icon: Lightbulb },
    { id: 'housing', name: 'Housing', icon: Home },
    { id: 'family', name: 'Family & dependents', icon: Users },
    { id: 'healthcare', name: 'Healthcare', icon: HeartPulse },
    { id: 'education', name: 'Education', icon: GraduationCap },
    { id: 'other', name: 'Other', icon: MoreHorizontal },
  ];

  const getCategoryIcon = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    return category?.icon || Package;
  };

  // Preferred over getCategoryIcon() wherever the item's own name is
  // available — see apps/mobile/src/utils/expenseIcon.ts for why category
  // alone isn't distinctive enough (e.g. Electricity and Water are both
  // 'utilities').
  const getIconFor = (name: string, categoryId: string) => getExpenseIcon(name, categoryId);

  const suggestions = [
    { name: 'Rent', category: 'housing', amount: 15000, dueDay: 1 },
    { name: 'Electricity', category: 'utilities', amount: 2000, dueDay: 15 },
    { name: 'Water', category: 'utilities', amount: 500, dueDay: 15 },
    { name: 'Internet', category: 'utilities', amount: 1500, dueDay: 10 },
    { name: 'Mobile Data', category: 'utilities', amount: 1000, dueDay: 1 },
  ];

  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const data = await profileApi.getFixedExpenses();
      setExpenses(data);
    } catch (error) {
      console.error('Error loading expenses:', error);
      setLoadError('Failed to load fixed expenses. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadExpenses();
    setRefreshing(false);
  };

  const filteredExpenses = expenses.filter(expense =>
    expense.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    getCategoryDisplayName(expense.category).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddExpense = async () => {
    // Validate form
    let isValid = true;
    
    if (!name.trim()) {
      setNameError('Name is required');
      isValid = false;
    } else {
      setNameError(null);
    }
    
    if (!amount || parseFloat(amount) <= 0) {
      setAmountError('Enter a valid amount');
      isValid = false;
    } else {
      setAmountError(null);
    }
    
    if (!dueDay || parseInt(dueDay) < 1 || parseInt(dueDay) > 31) {
      setDueDayError('Due day must be between 1 and 31');
      isValid = false;
    } else {
      setDueDayError(null);
    }
    
    if (!category) {
      setCategoryError('Category is required');
      isValid = false;
    } else {
      setCategoryError(null);
    }
    
    if (!isValid) return;
    
    // Without this guard, a double-tap on "Add Expense" (slow network, or
    // just an eager tap) fired profileApi.createFixedExpense twice —
    // createFixedExpense always inserts unconditionally, so that produced
    // two identical fixed-expense rows. This is a different code path from
    // OnboardingService.commit's retake-checkin flow, which already guards
    // against duplicates via delete-then-recreate.
    if (isSubmittingExpense) return;

    try {
      setIsSubmittingExpense(true);
      const created = await profileApi.createFixedExpense({
        name,
        amount: parseFloat(amount),
        dueDay: parseInt(dueDay),
        category,
      });

      setExpenses([...expenses, created]);

      setShowAddModal(false);
      resetForm();
      alert('Success', 'Fixed expense added successfully.');
    } catch (error) {
      alert('Error', 'Failed to add expense. Please try again.');
    } finally {
      setIsSubmittingExpense(false);
    }
  };

  const handleUpdateExpense = async () => {
    // Validate form
    let isValid = true;
    
    if (!editingExpense || !name || !amount || !dueDay || !category) {
      return;
    }
    
    if (!name.trim()) {
      setNameError('Name is required');
      isValid = false;
    } else {
      setNameError(null);
    }
    
    if (!amount || parseFloat(amount) <= 0) {
      setAmountError('Enter a valid amount');
      isValid = false;
    } else {
      setAmountError(null);
    }
    
    if (!dueDay || parseInt(dueDay) < 1 || parseInt(dueDay) > 31) {
      setDueDayError('Due day must be between 1 and 31');
      isValid = false;
    } else {
      setDueDayError(null);
    }
    
    if (!category) {
      setCategoryError('Category is required');
      isValid = false;
    } else {
      setCategoryError(null);
    }
    
    if (!isValid) return;
    
    if (isSubmittingExpense) return;

    try {
      setIsSubmittingExpense(true);
      const updated = await profileApi.updateFixedExpense(editingExpense.id, {
        name,
        amount: parseFloat(amount),
        dueDay: parseInt(dueDay),
        category,
      });

      setExpenses(
        expenses.map((exp) => (exp.id === editingExpense.id ? updated : exp))
      );

      setShowEditModal(false);
      setEditingExpense(null);
      resetForm();
      alert('Success', 'Fixed expense updated successfully.');
    } catch (error) {
      alert('Error', 'Failed to update expense. Please try again.');
    } finally {
      setIsSubmittingExpense(false);
    }
  };

  const handleDeleteExpense = async (expense: FixedExpense) => {
    const confirmed = await confirm(
      'Delete Fixed Expense',
      `Are you sure you want to delete "${expense.name}"?`,
      { confirmLabel: 'Delete', destructive: true }
    );
    if (!confirmed) return;

    try {
      await profileApi.deleteFixedExpense(expense.id);

      // Store for undo
      setDeletedExpense(expense);
      setExpenses(expenses.filter((exp) => exp.id !== expense.id));
      
      // Show toast with undo
      setToast({
        visible: true,
        message: `"${expense.name}" removed`,
        type: 'success',
        actionLabel: 'Undo',
        onAction: async () => {
          if (deletedExpense) {
            try {
              const restored = await profileApi.createFixedExpense({
                name: deletedExpense.name,
                amount: deletedExpense.amount,
                dueDay: deletedExpense.due_day,
                category: deletedExpense.category,
              });
              setExpenses([...expenses, restored]);
              setDeletedExpense(null);
              setToast({ visible: true, message: 'Expense restored', type: 'success' });
            } catch (error) {
              setToast({ visible: true, message: 'Unable to restore expense', type: 'error' });
            }
          }
        },
      });
    } catch (error) {
      setToast({ visible: true, message: 'Unable to remove expense', type: 'error' });
    }
  };

  const handleEditExpense = (expense: FixedExpense) => {
    setEditingExpense(expense);
    setName(expense.name);
    setAmount(expense.amount.toString());
    setDueDay(expense.due_day.toString());
    setCategory(expense.category);
    setShowEditModal(true);
  };

  const handleUseSuggestion = (suggestion: typeof suggestions[0]) => {
    setName(suggestion.name);
    setAmount(suggestion.amount.toString());
    setDueDay(suggestion.dueDay.toString());
    setCategory(suggestion.category);
  };

  const resetForm = () => {
    setName('');
    setAmount('');
    setDueDay('');
    setCategory('');
    setNameError(null);
    setAmountError(null);
    setDueDayError(null);
    setCategoryError(null);
  };

  const formatCurrency = (amount: number) => {
    return `KES ${amount.toLocaleString()}`;
  };

  const getCategoryDisplayName = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || categoryId;
  };

  const getTotalMonthly = () => {
    return expenses.reduce((sum, exp) => sum + exp.amount, 0);
  };

  const AddExpenseModal = () => (
    <BottomSheetModal
      visible={showAddModal}
      onClose={() => { setShowAddModal(false); resetForm(); }}
      title="Add Fixed Expense"
    >
      <ScrollView>
        {/* Quick Suggestions */}
        <View style={{ marginBottom: spacing.lg }}>
          <Text style={{ ...typography.eyebrow, color: colors.ink, marginBottom: spacing.md }}>Quick Add</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {suggestions.map((suggestion) => {
              const CategoryIcon = getIconFor(suggestion.name, suggestion.category);
              return (
                <Pressable
                  key={suggestion.name}
                  style={{
                    marginRight: spacing.sm,
                    padding: spacing.md,
                    borderRadius: radius.md,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.line,
                    minWidth: 120,
                  }}
                  onPress={() => handleUseSuggestion(suggestion)}
                  accessibilityLabel={`Add ${suggestion.name} suggestion`}
                  accessibilityRole="button"
                >
                  <View style={{ alignItems: 'center' }}>
                    <CategoryIcon size={18} color={colors.sage} strokeWidth={2} />
                    <Text style={{ ...typography.heading, color: colors.ink, marginTop: spacing.xs }}>
                      {suggestion.name}
                    </Text>
                    <Text style={{ ...typography.caption, color: colors.sage }}>
                      {formatCurrency(suggestion.amount)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

              {/* Form Fields */}
              <View style={{ marginBottom: spacing.md }}>
                <Text style={{ ...typography.caption, color: colors.sage, marginBottom: spacing.xs }}>Name</Text>
                <TextInput
                  style={{
                    ...typography.body,
                    color: colors.ink,
                    padding: spacing.md,
                    borderRadius: radius.md,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: nameError ? colors.clay : colors.line,
                  }}
                  placeholder="e.g., Rent, Electricity"
                  placeholderTextColor={colors.sage}
                  value={name}
                  onChangeText={(text) => {
                    setName(text);
                    if (text.trim()) setNameError(null);
                  }}
                />
                {nameError && <Text style={{ ...typography.caption, color: colors.clay, marginTop: spacing.xs }}>{nameError}</Text>}
              </View>

              <View style={{ marginBottom: spacing.md }}>
                <Text style={{ ...typography.caption, color: colors.sage, marginBottom: spacing.xs }}>Amount (KES)</Text>
                <TextInput
                  style={{
                    ...typography.body,
                    color: colors.ink,
                    padding: spacing.md,
                    borderRadius: radius.md,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: amountError ? colors.clay : colors.line,
                  }}
                  placeholder="0.00"
                  placeholderTextColor={colors.sage}
                  value={amount}
                  onChangeText={(text) => {
                    setAmount(text);
                    if (text && parseFloat(text) > 0) setAmountError(null);
                  }}
                  keyboardType="numeric"
                />
                {amountError && <Text style={{ ...typography.caption, color: colors.clay, marginTop: spacing.xs }}>{amountError}</Text>}
              </View>

              <View style={{ marginBottom: spacing.md }}>
                <Text style={{ ...typography.caption, color: colors.sage, marginBottom: spacing.xs }}>Due Day (1-31)</Text>
                <TextInput
                  style={{
                    ...typography.body,
                    color: colors.ink,
                    padding: spacing.md,
                    borderRadius: radius.md,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: dueDayError ? colors.clay : colors.line,
                  }}
                  placeholder="e.g., 1 for 1st, 15 for 15th"
                  placeholderTextColor={colors.sage}
                  value={dueDay}
                  onChangeText={(text) => {
                    setDueDay(text);
                    const day = parseInt(text);
                    if (day >= 1 && day <= 31) setDueDayError(null);
                  }}
                  keyboardType="numeric"
                  maxLength={2}
                />
                {dueDayError && <Text style={{ ...typography.caption, color: colors.clay, marginTop: spacing.xs }}>{dueDayError}</Text>}
              </View>

              <View style={{ marginBottom: spacing.lg }}>
                <Text style={{ ...typography.caption, color: colors.sage, marginBottom: spacing.xs }}>Category</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  {categories.map((cat) => {
                    const CategoryIcon = cat.icon;
                    return (
                      <Pressable
                        key={cat.id}
                        style={{
                          padding: spacing.sm,
                          borderRadius: radius.xs,
                          backgroundColor: category === cat.id ? colors.emeraldDeep : colors.surface,
                          borderWidth: 1,
                          borderColor: category === cat.id ? colors.emeraldDeep : colors.line,
                        }}
                        onPress={() => {
                          setCategory(cat.id);
                          setCategoryError(null);
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                          <CategoryIcon size={14} color={category === cat.id ? colors.surface : colors.ink} strokeWidth={2} />
                          <Text style={{ 
                            ...typography.caption, 
                            color: category === cat.id ? colors.surface : colors.ink 
                          }}>
                            {cat.name}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
                {categoryError && <Text style={{ ...typography.caption, color: colors.clay, marginTop: spacing.xs }}>{categoryError}</Text>}
              </View>

              <Pressable
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: spacing.md,
                  borderRadius: radius.md,
                  backgroundColor: colors.emeraldDeep,
                  opacity: isSubmittingExpense ? 0.7 : 1,
                }}
                onPress={handleAddExpense}
                disabled={isSubmittingExpense}
                accessibilityLabel="Add expense"
                accessibilityRole="button"
              >
                <Plus size={20} color={colors.surface} strokeWidth={2} />
                <Text style={{ ...typography.heading, color: colors.surface, marginLeft: spacing.sm }}>
                  {isSubmittingExpense ? 'Adding…' : 'Add Expense'}
                </Text>
              </Pressable>
      </ScrollView>
    </BottomSheetModal>
  );

  const EditExpenseModal = () => (
    <BottomSheetModal
      visible={showEditModal}
      onClose={() => { setShowEditModal(false); setEditingExpense(null); resetForm(); }}
      title="Edit Fixed Expense"
    >
      <ScrollView>
        <View style={{ marginBottom: spacing.md }}>
          <Text style={{ ...typography.caption, color: colors.sage, marginBottom: spacing.xs }}>Name</Text>
          <TextInput
            style={{
              ...typography.body,
              color: colors.ink,
              padding: spacing.md,
              borderRadius: radius.md,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: nameError ? colors.clay : colors.line,
            }}
            placeholder="e.g., Rent, Electricity"
            placeholderTextColor={colors.sage}
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (text.trim()) setNameError(null);
            }}
            accessibilityLabel="Expense name"
          />
          {nameError && <Text style={{ ...typography.caption, color: colors.clay, marginTop: spacing.xs }}>{nameError}</Text>}
        </View>

              <View style={{ marginBottom: spacing.md }}>
                <Text style={{ ...typography.caption, color: colors.sage, marginBottom: spacing.xs }}>Amount (KES)</Text>
                <TextInput
                  style={{
                    ...typography.body,
                    color: colors.ink,
                    padding: spacing.md,
                    borderRadius: radius.md,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: amountError ? colors.clay : colors.line,
                  }}
                  placeholder="0.00"
                  placeholderTextColor={colors.sage}
                  value={amount}
                  onChangeText={(text) => {
                    setAmount(text);
                    if (text && parseFloat(text) > 0) setAmountError(null);
                  }}
                  keyboardType="numeric"
                />
                {amountError && <Text style={{ ...typography.caption, color: colors.clay, marginTop: spacing.xs }}>{amountError}</Text>}
              </View>

              <View style={{ marginBottom: spacing.md }}>
                <Text style={{ ...typography.caption, color: colors.sage, marginBottom: spacing.xs }}>Due Day (1-31)</Text>
                <TextInput
                  style={{
                    ...typography.body,
                    color: colors.ink,
                    padding: spacing.md,
                    borderRadius: radius.md,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: dueDayError ? colors.clay : colors.line,
                  }}
                  placeholder="e.g., 1 for 1st, 15 for 15th"
                  placeholderTextColor={colors.sage}
                  value={dueDay}
                  onChangeText={(text) => {
                    setDueDay(text);
                    const day = parseInt(text);
                    if (day >= 1 && day <= 31) setDueDayError(null);
                  }}
                  keyboardType="numeric"
                  maxLength={2}
                />
                {dueDayError && <Text style={{ ...typography.caption, color: colors.clay, marginTop: spacing.xs }}>{dueDayError}</Text>}
              </View>

              <View style={{ marginBottom: spacing.lg }}>
                <Text style={{ ...typography.caption, color: colors.sage, marginBottom: spacing.xs }}>Category</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  {categories.map((cat) => {
                    const CategoryIcon = cat.icon;
                    return (
                      <Pressable
                        key={cat.id}
                        style={{
                          padding: spacing.sm,
                          borderRadius: radius.xs,
                          backgroundColor: category === cat.id ? colors.emeraldDeep : colors.surface,
                          borderWidth: 1,
                          borderColor: category === cat.id ? colors.emeraldDeep : colors.line,
                        }}
                        onPress={() => {
                          setCategory(cat.id);
                          setCategoryError(null);
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                          <CategoryIcon size={14} color={category === cat.id ? colors.surface : colors.ink} strokeWidth={2} />
                          <Text style={{ 
                            ...typography.caption, 
                            color: category === cat.id ? colors.surface : colors.ink 
                          }}>
                            {cat.name}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
                {categoryError && <Text style={{ ...typography.caption, color: colors.clay, marginTop: spacing.xs }}>{categoryError}</Text>}
              </View>

              <Pressable
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: spacing.md,
                  borderRadius: radius.md,
                  backgroundColor: colors.emeraldDeep,
                  opacity: isSubmittingExpense ? 0.7 : 1,
                }}
                onPress={handleUpdateExpense}
                disabled={isSubmittingExpense}
                accessibilityLabel="Update expense"
                accessibilityRole="button"
              >
                <Check size={20} color={colors.surface} strokeWidth={2} />
                <Text style={{ ...typography.heading, color: colors.surface, marginLeft: spacing.sm }}>
                  {isSubmittingExpense ? 'Saving…' : 'Update Expense'}
                </Text>
              </Pressable>
      </ScrollView>
    </BottomSheetModal>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
        <LoadingState label="Loading fixed expenses…" />
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
        <ErrorState message={loadError} onRetry={loadExpenses} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.emeraldDeep}
            colors={[colors.emeraldDeep]}
          />
        }
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg }}>
          <Pressable onPress={() => router.back()} style={{ padding: spacing.sm }}>
            <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
          </Pressable>
          <Text style={{ ...typography.title, color: colors.ink, marginLeft: spacing.md }}>
            Fixed Expenses
          </Text>
        </View>

        {/* Summary Card */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
          <View style={{ 
            padding: spacing.lg, 
            borderRadius: radius.md, 
            backgroundColor: colors.surface, 
            borderWidth: 1, 
            borderColor: colors.line 
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={{ ...typography.caption, color: colors.sage }}>
                  Total Monthly
                </Text>
                <Text style={{ ...typography.title, color: colors.ink, fontSize: 24, marginTop: spacing.xs }}>
                  {formatCurrency(getTotalMonthly())}
                </Text>
              </View>
              <Text style={{ ...typography.caption, color: colors.sage }}>
                {expenses.length} expense{expenses.length !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        </View>

        {/* Expenses List */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
            <Text style={{ ...typography.eyebrow, color: colors.ink }}>
              Your Expenses
            </Text>
            <Pressable
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: spacing.sm,
                borderRadius: radius.xs,
                backgroundColor: colors.emeraldDeep,
              }}
              onPress={() => setShowAddModal(true)}
              accessibilityLabel="Add fixed expense"
              accessibilityRole="button"
            >
              <Plus size={16} color={colors.surface} strokeWidth={2} />
              <Text style={{ ...typography.caption, color: colors.surface, marginLeft: spacing.xs }}>
                Add
              </Text>
            </Pressable>
          </View>

          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search expenses..."
            onClear={() => setSearchQuery('')}
          />

          {filteredExpenses.length === 0 && expenses.length > 0 ? (
            <EmptyState
              icon={Package}
              title="No expenses match your search"
              description="Try a different search term"
              actionLabel="Clear search"
              onAction={() => setSearchQuery('')}
            />
          ) : expenses.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No fixed expenses yet"
              description="Add your recurring costs to track them better"
              actionLabel="Add expense"
              onAction={() => setShowAddModal(true)}
            />
          ) : (
            filteredExpenses.map((expense) => {
              const CategoryIcon = getIconFor(expense.name, expense.category);
              return (
                <View 
                  key={expense.id} 
                  style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    padding: spacing.md, 
                    borderRadius: radius.md, 
                    backgroundColor: colors.surface, 
                    borderWidth: 1, 
                    borderColor: colors.line, 
                    marginBottom: spacing.sm 
                  }}
                >
                  <View style={{ 
                    width: 40, 
                    height: 40, 
                    borderRadius: radius.xs, 
                    backgroundColor: colors.goldTint, 
                    alignItems: 'center', 
                    justifyContent: 'center' 
                  }}>
                    <CategoryIcon size={20} color={colors.gold} strokeWidth={2} />
                  </View>
                  <View style={{ marginLeft: spacing.md, flex: 1 }}>
                    <Text style={{ ...typography.heading, color: colors.ink }}>
                      {expense.name}
                    </Text>
                    <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>
                      Due day {expense.due_day} • {getCategoryDisplayName(expense.category)}
                    </Text>
                  </View>
                <View style={{ marginRight: spacing.md }}>
                  <Text style={{ ...typography.title, color: colors.ink, fontSize: 18 }}>
                    {formatCurrency(expense.amount)}
                  </Text>
                </View>
                <Pressable
                  style={{ padding: spacing.sm }}
                  onPress={() => handleEditExpense(expense)}
                  accessibilityLabel={`Edit ${expense.name}`}
                  accessibilityRole="button"
                >
                  <Edit size={18} color={colors.sage} strokeWidth={2} />
                </Pressable>
                <Pressable
                  style={{ padding: spacing.sm }}
                  onPress={() => handleDeleteExpense(expense)}
                  accessibilityLabel={`Delete ${expense.name}`}
                  accessibilityRole="button"
                >
                  <Trash2 size={18} color={colors.clay} strokeWidth={2} />
                </Pressable>
              </View>
              );
            })
          )}
        </View>

        {/* Modals */}
        <AddExpenseModal />
        <EditExpenseModal />
      </ScrollView>
      {modal}
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        actionLabel={toast.actionLabel}
        onAction={toast.onAction}
        onDismiss={() => setToast({ ...toast, visible: false })}
      />
    </SafeAreaView>
  );
}