import { View, Text, TextInput, TouchableOpacity, Keyboard, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import React from 'react';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, shadow, touchTarget } from '@/theme';
import { useOnboardingStore } from '@/services/onboarding-store';
import { showAlert } from '@/utils/alert';
import { Button, Input, ScreenContainer, SafeScrollView, BrandHeader, ProgressIndicator, SectionTitle } from '@/components/ui';
import { ChevronLeft, Plus, Trash2, Home, Zap, Droplets, Wifi, GraduationCap, Bus, CreditCard, X } from 'lucide-react-native';

interface SuggestionItem {
  name: string;
  icon: React.ComponentType<any>;
  category: string;
}

interface FixedExpenseItem {
  id: string;
  name: string;
  amount: number;
  dueDay: number;
  category: string;
  icon?: string;
}

const SUGGESTIONS: readonly SuggestionItem[] = [
  { name: 'School fees', icon: GraduationCap, category: 'education' },
  { name: 'Transport pass', icon: Bus, category: 'transport' },
  { name: 'Subscriptions', icon: CreditCard, category: 'other' },
];

const DEFAULT_FIXED: FixedExpenseItem[] = [
  { id: '1', name: 'Rent', amount: 15000, dueDay: 5, category: 'utilities', icon: 'Home' },
  { id: '2', name: 'Electricity', amount: 2200, dueDay: 15, category: 'utilities', icon: 'Zap' },
  { id: '3', name: 'Water', amount: 800, dueDay: 20, category: 'utilities', icon: 'Droplets' },
  { id: '4', name: 'Internet', amount: 3000, dueDay: 25, category: 'utilities', icon: 'Wifi' },
];

const iconMap: Record<string, React.ComponentType<any>> = {
  Home, Zap, Droplets, Wifi, GraduationCap, Bus, CreditCard,
};

function getIconComponent(iconName: string) {
  return iconMap[iconName] || CreditCard;
}

export default function FixedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { 
    fixedExpenses, 
    addFixedExpense, 
    removeFixedExpense, 
    setFixedExpenses,
    previewPlan, 
    input,
  } = useOnboardingStore();
  
  const [isLoading, setIsLoading] = React.useState(false);
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [newAmount, setNewAmount] = React.useState('');
  const [newDueDay, setNewDueDay] = React.useState('');
  const [newCategory, setNewCategory] = React.useState('other');
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState('');
  const [editAmount, setEditAmount] = React.useState('');
  const [editDueDay, setEditDueDay] = React.useState('');
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (fixedExpenses.length === 0) {
      // Initialize with defaults
      setFixedExpenses(DEFAULT_FIXED as any);
    }
  }, []);

  const totalFixed = fixedExpenses.reduce((sum: number, e: FixedExpenseItem) => sum + e.amount, 0);
  const deleteTarget = fixedExpenses.find((e: FixedExpenseItem) => e.id === deleteTargetId);

  const formatAmount = (text: string) => {
    const cleaned = text.replace(/[^\d]/g, '');
    if (!cleaned) return '';
    return Number(cleaned).toLocaleString();
  };

  const handleAddSuggestion = (suggestion: typeof SUGGESTIONS[0]) => {
  setShowAddModal(true);
  setNewName(suggestion.name);
  setNewAmount('');
  setNewDueDay(1);
  setNewCategory(suggestion.category);
  setEditingId(null);
};

  const handleAddCustom = () => {
    setShowAddModal(true);
    setNewName('');
    setNewAmount('');
    setNewDueDay('');
    setNewCategory('other');
    setEditingId(null);
  };

  const handleEdit = (expense: typeof fixedExpenses[0]) => {
    setEditingId(expense.id);
    setEditName(expense.name);
    setEditAmount(expense.amount.toLocaleString());
    setEditDueDay(String(expense.dueDay));
    setShowAddModal(true);
  };

  const handleSave = () => {
    Keyboard.dismiss();
    
    if (editingId) {
      // Update existing
      const amount = Number(editAmount.replace(/,/g, ''));
      if (!amount || amount <= 0) {
        showAlert('Error', 'Please enter a valid amount');
        return;
      }
      if (!editName.trim()) {
        showAlert('Error', 'Please enter a name');
        return;
      }
      const dueDay = Number(editDueDay);
      if (!dueDay || dueDay < 1 || dueDay > 31) {
        showAlert('Error', 'Please enter a valid due day (1-31)');
        return;
      }
      
      // Update in store
      const updated = fixedExpenses.map((e: FixedExpenseItem) => 
        e.id === editingId ? { ...e, name: editName, amount, dueDay } : e
      );
      setFixedExpenses(updated);
    } else {
      // Add new
      const amount = Number(newAmount.replace(/,/g, ''));
      if (!amount || amount <= 0) {
        showAlert('Error', 'Please enter a valid amount');
        return;
      }
      if (!newName.trim()) {
        showAlert('Error', 'Please enter a name');
        return;
      }
      const dueDay = Number(newDueDay);
      if (!dueDay || dueDay < 1 || dueDay > 31) {
        showAlert('Error', 'Please enter a valid due day (1-31)');
        return;
      }
      
      addFixedExpense({
        name: newName,
        amount,
        dueDay,
        category: newCategory,
      });
    }
    
    setShowAddModal(false);
    resetForm();
  };

  const handleDelete = (id: string) => {
    setDeleteTargetId(id);
  };

  const confirmDelete = () => {
    if (deleteTargetId) {
      removeFixedExpense(deleteTargetId);
    }
    setDeleteTargetId(null);
  };

  const cancelDelete = () => {
    setDeleteTargetId(null);
  };

  const resetForm = () => {
    setNewName('');
    setNewAmount('');
    setNewDueDay('');
    setNewCategory('other');
    setEditingId(null);
    setEditName('');
    setEditAmount('');
    setEditDueDay('');
  };

  const handleContinue = async () => {
  setIsLoading(true);
  try {
    await previewPlan(); // calls API, sets assignResult in store
    router.push('/(onboarding)/result');
  } catch (error) {
    // error is already set in store, but show the real message here too
    const message = error instanceof Error ? error.message : 'Please try again.';
    showAlert('Could not generate your plan', message);
  } finally {
    setIsLoading(false);
  }
};

  const getIconComponent = (iconName: string) => {
    const icons: Record<string, React.ComponentType<any>> = {
      Home, Zap, Droplets, Wifi, GraduationCap, Bus, CreditCard,
    };
    return icons[iconName] || CreditCard;
  };

  return (
    <ScreenContainer>
      <SafeScrollView>
        <BrandHeader onBack={() => router.canGoBack() && router.back()} />
        <ProgressIndicator currentStep={3} totalSteps={4} />

        <View style={{ marginTop: spacing.lg, marginBottom: spacing.xl }}>
          <Text style={{ ...typography.eyebrow, color: colors.sage }}>Step 3 of 4 — Fixed costs</Text>
          <Text style={{ ...typography.display, color: colors.ink, marginTop: spacing.sm }}>What repeats every month?</Text>
          <Text style={{ ...typography.body, color: colors.sage, marginTop: spacing.sm, lineHeight: 22 }}>
            These get set aside before anything else. No bank link needed in this build — enter them once, edit anytime.
          </Text>
        </View>

        {fixedExpenses.length > 0 && (
          <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.sm, marginBottom: spacing.lg }}>
            {fixedExpenses.map((expense, index) => {
              const IconComponent = getIconComponent(expense.icon as string || 'CreditCard');
              return (
                <View key={expense.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.lineSoft }}>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1, minHeight: touchTarget.minHeight }}
                    onPress={() => handleEdit(expense)}
                    activeOpacity={0.85}
                    accessibilityLabel={`Edit ${expense.name}, KSh ${expense.amount.toLocaleString()}`}
                    accessibilityRole="button"
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
                    onPress={() => handleDelete(expense.id)}
                    accessibilityLabel={`Delete ${expense.name}`}
                    accessibilityRole="button"
                  >
                    <Trash2 size={16} color={colors.error} strokeWidth={2} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        <SectionTitle>Quick add</SectionTitle>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm }}>
          {SUGGESTIONS.map((suggestion) => (
            <TouchableOpacity
              key={suggestion.name}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface, minHeight: touchTarget.minHeight }}
              onPress={() => handleAddSuggestion(suggestion)}
              accessibilityLabel={`Add ${suggestion.name}`}
              accessibilityRole="button"
            >
              <suggestion.icon size={12} color={colors.ink} strokeWidth={2.2} />
              <Text style={{ ...typography.caption, color: colors.ink }}>{suggestion.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={{ ...typography.caption, fontSize: 11.5, color: colors.sage, lineHeight: 18, marginBottom: spacing.xl }}>
          Tap a suggestion to add it — these are suggestions, not auto-detection (manual entry only in this build).
        </Text>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, marginBottom: spacing.xl, backgroundColor: colors.emeraldTint, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line }}>
          <Text style={{ ...typography.heading, color: colors.ink }}>Total fixed per month</Text>
          <Text style={{ ...typography.title, color: colors.emeraldDeep }}>KSh {totalFixed.toLocaleString()}</Text>
        </View>

        <Button
          fullWidth
          size="lg"
          loading={isLoading}
          onPress={handleContinue}
          rightIcon={<ChevronLeft size={18} color="#fff" style={{ transform: [{ rotate: '180deg' }] }} />}
        >
          Continue
        </Button>

        {/* Add/Edit Modal */}
        <Modal
          visible={showAddModal}
          transparent
          animationType="slide"
          statusBarTranslucent
          onRequestClose={() => { setShowAddModal(false); resetForm(); }}
        >
          <KeyboardAvoidingView
            style={{ flex: 1, justifyContent: 'flex-end' }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <TouchableOpacity style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(22,35,29,0.45)' }} onPress={() => { setShowAddModal(false); resetForm(); }} activeOpacity={1} />
            <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: spacing.lg, paddingTop: spacing.md, maxHeight: '85%', ...shadow.elevated, paddingBottom: insets.bottom + spacing.lg }}>
              <View style={{ width: 36, height: 4, borderRadius: radius.pill, backgroundColor: colors.line, alignSelf: 'center', marginBottom: spacing.lg }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl }}>
                <Text style={{ ...typography.title, color: colors.ink }}>
                  {editingId ? 'Edit fixed expense' : 'Add fixed expense'}
                </Text>
                <TouchableOpacity
                  style={{ width: 32, height: 32, borderRadius: radius.pill, backgroundColor: colors.lineSoft, alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => { setShowAddModal(false); resetForm(); }}
                  accessibilityLabel="Close"
                  accessibilityRole="button"
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <X size={18} color={colors.inkSoft} strokeWidth={2} />
                </TouchableOpacity>
              </View>

              <View style={{ gap: spacing.lg }}>
                <Input
                  label="Name"
                  value={editingId ? editName : newName}
                  onChangeText={editingId ? setEditName : setNewName}
                  placeholder="e.g., Rent"
                  autoFocus
                  accessible={true}
                  accessibilityLabel="Expense name"
                />

                <Input
                  label="Amount (KSh)"
                  value={editingId ? editAmount : newAmount}
                  onChangeText={(t) => {
                    const formatted = formatAmount(t);
                    editingId ? setEditAmount(formatted) : setNewAmount(formatted);
                  }}
                  placeholder="0"
                  keyboardType="numeric"
                  accessible={true}
                  accessibilityLabel="Amount in Kenyan shillings"
                />

                <Input
                  label="Due day"
                  value={editingId ? editDueDay : newDueDay}
                  onChangeText={(t) => {
                    editingId ? setEditDueDay(t) : setNewDueDay(t);
                  }}
                  placeholder="1"
                  keyboardType="numeric"
                  accessible={true}
                  accessibilityLabel="Due day of the month"
                />
              </View>

              <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}>
                <Button variant="secondary" style={{ flex: 1 }} onPress={() => { setShowAddModal(false); resetForm(); }}>
                  Cancel
                </Button>
                <Button style={{ flex: 1 }} onPress={handleSave}>
                  {editingId ? 'Save changes' : 'Add expense'}
                </Button>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Delete confirmation modal */}
        <Modal
          visible={!!deleteTargetId}
          transparent
          animationType="slide"
          statusBarTranslucent
          onRequestClose={cancelDelete}
        >
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <TouchableOpacity style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(22,35,29,0.45)' }} onPress={cancelDelete} activeOpacity={1} />
            <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: spacing.lg, paddingTop: spacing.md, maxHeight: '85%', ...shadow.elevated, paddingBottom: insets.bottom + spacing.lg }}>
              <View style={{ width: 36, height: 4, borderRadius: radius.pill, backgroundColor: colors.line, alignSelf: 'center', marginBottom: spacing.lg }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl }}>
                <Text style={{ ...typography.title, color: colors.ink }}>Delete expense</Text>
                <TouchableOpacity
                  style={{ width: 32, height: 32, borderRadius: radius.pill, backgroundColor: colors.lineSoft, alignItems: 'center', justifyContent: 'center' }}
                  onPress={cancelDelete}
                  accessibilityLabel="Close"
                  accessibilityRole="button"
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <X size={18} color={colors.inkSoft} strokeWidth={2} />
                </TouchableOpacity>
              </View>

              <Text style={{ ...typography.body, color: colors.inkSoft, lineHeight: 21 }}>
                Are you sure you want to remove {deleteTarget ? `"${deleteTarget.name}"` : 'this fixed expense'}? This can&apos;t be undone.
              </Text>

              <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}>
                <Button variant="secondary" style={{ flex: 1 }} onPress={cancelDelete}>
                  Cancel
                </Button>
                <Button
                  style={{ flex: 1, backgroundColor: colors.error, borderColor: colors.error }}
                  onPress={confirmDelete}
                  accessibilityLabel="Confirm delete"
                  accessibilityRole="button"
                >
                  Delete
                </Button>
              </View>
            </View>
          </View>
        </Modal>
      </SafeScrollView>
    </ScreenContainer>
  );
}