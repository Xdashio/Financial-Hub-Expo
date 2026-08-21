import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { radius, spacing, typography, shadow, touchTarget } from '../../src/theme';
import { useTheme } from '@/theme/ThemeContext';
import { useAlertModal } from '@/hooks/useAlertModal';
import { useFixedExpensesStore, getFixedPocketBalance } from '@/services/fixed-expenses-store';
import { useHomeStore } from '@/services/home-store';
import { pocketsApi } from '@/services/api';
import { ScreenContainer, LoadingState, ErrorState, SearchBar, Toast, EmptyState } from '@/components/ui';
import { getExpenseIcon } from '@/utils/expenseIcon';
import { safeGoBack } from '@/utils/navigation';
import { formatMoney } from '@/utils/money';
import { CategoryIcon } from '@/components/icons';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit,
  Package,
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
  
  const { expenses, isLoading, error, fetchExpenses, deleteExpense } = useFixedExpensesStore();
  const { alert, confirm, modal } = useAlertModal();
  
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
    actionLabel?: string;
    onAction?: () => void;
  }>({
    visible: false,
    message: '',
    type: 'info',
  });

  const categories = [
    { id: 'food', name: 'Food & Groceries', icon: 'food' },
    { id: 'transport', name: 'Transport', icon: 'transport' },
    { id: 'leisure', name: 'Personal & Leisure', icon: 'leisure' },
    { id: 'personal', name: 'Personal Care', icon: 'personal' },
    { id: 'utilities', name: 'Utilities', icon: 'utilities' },
    { id: 'housing', name: 'Housing', icon: 'housing' },
    { id: 'family', name: 'Family & dependents', icon: 'family' },
    { id: 'healthcare', name: 'Healthcare', icon: 'healthcare' },
    { id: 'education', name: 'Education', icon: 'education' },
    { id: 'other', name: 'Other', icon: 'other' },
  ];

  const getIconFor = (name: string, categoryId: string) => {
    const IconComponent = getExpenseIcon(name, categoryId);
    return IconComponent;
  };

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  // Refresh data when screen comes into focus (after modal closes)
  useFocusEffect(
    React.useCallback(() => {
      fetchExpenses();
    }, [fetchExpenses])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchExpenses();
    setRefreshing(false);
  };

  const filteredExpenses = expenses.filter(expense =>
    expense.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    getCategoryDisplayName(expense.category).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDeleteExpense = async (expense: FixedExpense) => {
    let pocketsForCheck = useHomeStore.getState().pockets;
    try {
      const fresh = await pocketsApi.getAll();
      if (Array.isArray(fresh) && fresh.length > 0) {
        pocketsForCheck = fresh;
      }
    } catch {
      // Fall back to the last home-store snapshot if the network blips.
    }

    const balance = getFixedPocketBalance(pocketsForCheck, expense.name, expense.category);
    if (balance > 0.01) {
      await alert(
        'Cannot delete yet',
        `"${expense.name}" still has ${formatMoney(balance)} in its pocket. Move that money to another pocket first, then try again.`,
      );
      return;
    }

    const confirmed = await confirm(
      'Delete Fixed Expense',
      `Are you sure you want to delete "${expense.name}"? This also removes it from Fixed & Protected on the homepage.`,
      { confirmLabel: 'Delete', destructive: true }
    );
    if (!confirmed) return;

    try {
      await deleteExpense(expense.id);
      setToast({
        visible: true,
        message: `"${expense.name}" removed`,
        type: 'success',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to remove expense';
      setToast({ visible: true, message, type: 'error' });
    }
  };

  const handleEditExpense = (expense: FixedExpense) => {
    router.push(`/(modals)/fixed-expense-form?mode=edit&expenseId=${expense.id}`);
  };

  const handleAddExpense = () => {
    router.push('/(modals)/fixed-expense-form?mode=add');
  };

  const formatCurrency = (amount: number) => {
    return formatMoney(amount);
  };

  const getCategoryDisplayName = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || categoryId;
  };

  const getTotalMonthly = () => {
    return expenses.reduce((sum, exp) => sum + exp.amount, 0);
  };

  if (isLoading) {
    return (
      <ScreenContainer>
        <LoadingState label="Loading fixed expenses…" />
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer>
        <ErrorState message={error} onRetry={fetchExpenses} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer style={{ backgroundColor: colors.surface }}>
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
          <Pressable onPress={() => safeGoBack(router, '/(tabs)/profile')} hitSlop={8}>
            <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
          </Pressable>
          <Text style={{ ...typography.title, color: colors.ink, marginLeft: spacing.md }}>Fixed expenses</Text>
        </View>

        {/* Summary Card */}
        <View style={{ 
          marginHorizontal: spacing.lg, 
          marginTop: spacing.lg, 
          padding: spacing.lg, 
          borderRadius: radius.lg, 
          backgroundColor: colors.emeraldDeep 
        }}>
          <Text style={{ ...typography.caption, color: `${colors.surface}99`, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Total Monthly
          </Text>
          <Text style={{ ...typography.display, color: colors.surface, fontSize: 32, marginTop: spacing.xs }}>
            {formatCurrency(getTotalMonthly())}
          </Text>
          <Text style={{ ...typography.caption, color: `${colors.surface}80`, marginTop: spacing.xs }}>
            {expenses.length} expense{expenses.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Search Bar */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search expenses..."
            onClear={() => setSearchQuery('')}
          />
        </View>

        {/* Add Button */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
          <Pressable
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              padding: spacing.md,
              borderRadius: radius.md,
              backgroundColor: colors.emeraldDeep,
              gap: spacing.sm,
            }}
            onPress={handleAddExpense}
            accessibilityLabel="Add fixed expense"
            accessibilityRole="button"
          >
            <Plus size={20} color={colors.surface} strokeWidth={2} />
            <Text style={{ ...typography.heading, color: colors.surface }}>Add fixed expense</Text>
          </Pressable>
        </View>

        {/* Expenses List */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
          {filteredExpenses.length === 0 ? (
            <EmptyState
              variant={searchQuery ? 'no-results' : 'empty'}
              title={searchQuery ? 'No expenses found' : 'No fixed expenses yet'}
              description={searchQuery 
                ? 'Try a different search term' 
                : 'Add your recurring bills and subscriptions to track them automatically'
              }
              actionLabel={searchQuery ? undefined : 'Add Expense'}
              onAction={searchQuery ? undefined : handleAddExpense}
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
                    marginBottom: spacing.sm,
                    borderRadius: radius.md,
                    backgroundColor: colors.paper,
                    ...shadow.default,
                  }}
                >
                  <View style={{
                    width: 48,
                    height: 48,
                    borderRadius: radius.md,
                    backgroundColor: `${colors.emerald}20`,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <CategoryIcon size={24} strokeWidth={2} />
                  </View>
                  
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Text style={{ ...typography.heading, color: colors.ink }}>
                      {expense.name}
                    </Text>
                    <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.xs }}>
                      {getCategoryDisplayName(expense.category)} • Due day {expense.due_day}
                    </Text>
                  </View>
                  
                  <Text style={{ ...typography.heading, color: colors.ink, marginRight: spacing.md }}>
                    {formatCurrency(expense.amount)}
                  </Text>
                  
                  <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                    <Pressable
                      onPress={() => handleEditExpense(expense)}
                      hitSlop={12}
                      style={{
                        minWidth: touchTarget.minWidth,
                        minHeight: touchTarget.minHeight,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      accessibilityLabel={`Edit ${expense.name}`}
                      accessibilityRole="button"
                    >
                      <Edit size={20} color={colors.sage} strokeWidth={2} />
                    </Pressable>
                    <Pressable
                      onPress={() => handleDeleteExpense(expense)}
                      hitSlop={12}
                      style={{
                        minWidth: touchTarget.minWidth,
                        minHeight: touchTarget.minHeight,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      accessibilityLabel={`Delete ${expense.name}`}
                      accessibilityRole="button"
                    >
                      <Trash2 size={20} color={colors.clay} strokeWidth={2} />
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Confirm / alert modal — required for delete; without this the
          trash icon looked dead because confirm() never showed a dialog. */}
      {modal}

      {/* Toast */}
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        actionLabel={toast.actionLabel}
        onAction={toast.onAction}
        onDismiss={() => setToast(prev => ({ ...prev, visible: false }))}
        duration={3000}
      />
    </ScreenContainer>
  );
}