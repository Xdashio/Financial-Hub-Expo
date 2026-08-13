import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { radius, spacing, typography } from '../../src/theme';
import { useTheme } from '@/theme/ThemeContext';
import { useAlertModal } from '@/hooks/useAlertModal';
import { useFixedExpensesStore } from '@/services/fixed-expenses-store';
import { LoadingState } from '@/components/ui';
import { getExpenseIcon } from '@/utils/expenseIcon';
import {
  ArrowLeft,
  Check,
  ShoppingCart,
  Car,
  Film,
  Scissors,
  Lightbulb,
  HeartPulse,
  GraduationCap,
  MoreHorizontal,
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

export default function FixedExpenseFormScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { mode, expenseId } = useLocalSearchParams<{ mode: 'add' | 'edit'; expenseId?: string }>();
  const { alert } = useAlertModal();
  const { addExpense, updateExpense, expenses } = useFixedExpensesStore();
  const canGoBack = router.canGoBack();
  
  const [expense, setExpense] = useState<FixedExpense | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(mode === 'edit');
  
  // Form state - single object to prevent re-renders
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    dueDay: '1',
    category: '',
  });
  
  // Validation errors
  const [nameError, setNameError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [dueDayError, setDueDayError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  
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

  const suggestions = [
    { name: 'Rent', category: 'housing', amount: 15000, dueDay: 1 },
    { name: 'Electricity', category: 'utilities', amount: 2000, dueDay: 15 },
    { name: 'Water', category: 'utilities', amount: 500, dueDay: 15 },
    { name: 'Internet', category: 'utilities', amount: 1500, dueDay: 10 },
    { name: 'Mobile Data', category: 'utilities', amount: 1000, dueDay: 1 },
  ];

  useEffect(() => {
    if (mode === 'edit' && expenseId) {
      const found = expenses.find((e: FixedExpense) => e.id === expenseId);
      if (found) {
        setExpense(found);
        setFormData({
          name: found.name,
          amount: found.amount.toString(),
          dueDay: found.due_day.toString(),
          category: found.category,
        });
      }
      setIsLoading(false);
    }
  }, [mode, expenseId, expenses]);

  const handleSave = async () => {
    // Validate form
    let isValid = true;
    
    if (!formData.name.trim()) {
      setNameError('Name is required');
      isValid = false;
    } else {
      setNameError(null);
    }
    
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setAmountError('Enter a valid amount');
      isValid = false;
    } else {
      setAmountError(null);
    }
    
    if (!formData.dueDay || parseInt(formData.dueDay) < 1 || parseInt(formData.dueDay) > 31) {
      setDueDayError('Due day must be between 1 and 31');
      isValid = false;
    } else {
      setDueDayError(null);
    }
    
    if (!formData.category) {
      setCategoryError('Category is required');
      isValid = false;
    } else {
      setCategoryError(null);
    }
    
    if (!isValid) return;
    
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      
      if (mode === 'edit' && expense) {
        await updateExpense(expense.id, {
          name: formData.name,
          amount: parseFloat(formData.amount),
          due_day: parseInt(formData.dueDay),
          category: formData.category,
        });
        alert('Success', 'Fixed expense updated successfully.');
      } else {
        await addExpense({
          name: formData.name,
          amount: parseFloat(formData.amount),
          due_day: parseInt(formData.dueDay),
          category: formData.category,
        });
        alert('Success', 'Fixed expense added successfully.');
      }
      
      if (canGoBack) {
        router.back();
      } else {
        router.replace('/(profile)/fixed-expenses');
      }
    } catch (error) {
      alert('Error', 'Failed to save expense. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUseSuggestion = (suggestion: typeof suggestions[0]) => {
    setFormData({
      name: suggestion.name,
      amount: suggestion.amount.toString(),
      dueDay: suggestion.dueDay.toString(),
      category: suggestion.category,
    });
  };

  const formatCurrency = (amount: number) => {
    return `KES ${amount.toLocaleString()}`;
  };

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
        <LoadingState label="Loading..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView 
          style={{ flex: 1 }} 
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg }}>
            <Pressable 
              onPress={() => canGoBack ? router.back() : router.replace('/(profile)/fixed-expenses')} 
              hitSlop={8}
            >
              <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
            </Pressable>
            <Text style={{ ...typography.title, color: colors.ink, marginLeft: spacing.md }}>
              {mode === 'edit' ? 'Edit Fixed Expense' : 'Add Fixed Expense'}
            </Text>
          </View>

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
              value={formData.name}
              onChangeText={(text) => {
                setFormData(prev => ({ ...prev, name: text }));
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
              value={formData.amount}
              onChangeText={(text) => {
                setFormData(prev => ({ ...prev, amount: text }));
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
              value={formData.dueDay}
              onChangeText={(text) => {
                setFormData(prev => ({ ...prev, dueDay: text }));
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
                      backgroundColor: formData.category === cat.id ? colors.emeraldDeep : colors.surface,
                      borderWidth: 1,
                      borderColor: formData.category === cat.id ? colors.emeraldDeep : colors.line,
                    }}
                    onPress={() => {
                      setFormData(prev => ({ ...prev, category: cat.id }));
                      setCategoryError(null);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                      <CategoryIcon size={14} color={formData.category === cat.id ? colors.surface : colors.ink} strokeWidth={2} />
                      <Text style={{ 
                        ...typography.caption, 
                        color: formData.category === cat.id ? colors.surface : colors.ink 
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

          {/* Save Button */}
          <Pressable
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              padding: spacing.md,
              borderRadius: radius.md,
              backgroundColor: colors.emeraldDeep,
              opacity: isSubmitting ? 0.7 : 1,
              marginTop: spacing.lg,
            }}
            onPress={handleSave}
            disabled={isSubmitting}
            accessibilityLabel="Save expense"
            accessibilityRole="button"
          >
            <Check size={20} color={colors.surface} strokeWidth={2} />
            <Text style={{ ...typography.heading, color: colors.surface, marginLeft: spacing.sm }}>
              {isSubmitting ? 'Saving…' : (mode === 'edit' ? 'Update Expense' : 'Add Expense')}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Helper function to get icon for a suggestion
function getIconFor(name: string, category: string) {
  return getExpenseIcon(name, category);
}
