import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, Keyboard } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import React from 'react';
import { colors, radius, spacing, typography, shadow, touchTarget } from '@/theme';
import { useOnboardingStore } from '@/services/onboarding-store';
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
  const [newDueDay, setNewDueDay] = React.useState(1);
  const [newCategory, setNewCategory] = React.useState('other');
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState('');
  const [editAmount, setEditAmount] = React.useState('');
  const [editDueDay, setEditDueDay] = React.useState(1);
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
    addFixedExpense({
      name: suggestion.name,
      amount: 0,
      dueDay: 1,
      category: suggestion.category,
    });
    setShowAddModal(true);
    setNewName(suggestion.name);
    setNewCategory(suggestion.category);
    setEditingId(null);
  };

  const handleAddCustom = () => {
    setShowAddModal(true);
    setNewName('');
    setNewAmount('');
    setNewDueDay(1);
    setNewCategory('other');
    setEditingId(null);
  };

  const handleEdit = (expense: typeof fixedExpenses[0]) => {
    setEditingId(expense.id);
    setEditName(expense.name);
    setEditAmount(expense.amount.toLocaleString());
    setEditDueDay(expense.dueDay);
    setShowAddModal(true);
  };

  const handleSave = () => {
    Keyboard.dismiss();
    
    if (editingId) {
      // Update existing
      const amount = Number(editAmount.replace(/,/g, ''));
      if (!amount || amount <= 0) {
        Alert.alert('Error', 'Please enter a valid amount');
        return;
      }
      if (!editName.trim()) {
        Alert.alert('Error', 'Please enter a name');
        return;
      }
      
      // Update in store
      const updated = fixedExpenses.map((e: FixedExpenseItem) => 
        e.id === editingId ? { ...e, name: editName, amount, dueDay: editDueDay } : e
      );
      setFixedExpenses(updated);
    } else {
      // Add new
      const amount = Number(newAmount.replace(/,/g, ''));
      if (!amount || amount <= 0) {
        Alert.alert('Error', 'Please enter a valid amount');
        return;
      }
      if (!newName.trim()) {
        Alert.alert('Error', 'Please enter a name');
        return;
      }
      
      addFixedExpense({
        name: newName,
        amount,
        dueDay: newDueDay,
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
    setNewDueDay(1);
    setNewCategory('other');
    setEditingId(null);
    setEditName('');
    setEditAmount('');
    setEditDueDay(1);
  };

  const handleContinue = async () => {
    setIsLoading(true);
    try {
      await previewPlan(); // calls API, sets assignResult in store
      router.push('/(onboarding)/result');
    } catch (error) {
      // error is already set in store, show it
      Alert.alert('Error', 'Could not generate your plan. Please try again.');
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

        <View style={styles.header}>
          <Text style={styles.eyebrow}>Step 3 of 4 — Fixed costs</Text>
          <Text style={styles.title}>What repeats every month?</Text>
          <Text style={styles.subtext}>
            These get set aside before anything else. No bank link needed in this build — enter them once, edit anytime.
          </Text>
        </View>

        {fixedExpenses.length > 0 && (
          <View style={styles.fixedList}>
            {fixedExpenses.map((expense, index) => {
              const IconComponent = getIconComponent(expense.icon as string || 'CreditCard');
              return (
                <View key={expense.id} style={styles.fixedItem}>
                  <TouchableOpacity
                    style={styles.fixedItemContent}
                    onPress={() => handleEdit(expense)}
                    activeOpacity={0.85}
                    accessibilityLabel={`Edit ${expense.name}, KSh ${expense.amount.toLocaleString()}`}
                    accessibilityRole="button"
                  >
                    <View style={styles.fixedIcon}>
                      <IconComponent size={16} color={colors.ink} strokeWidth={2} />
                    </View>
                    <View style={styles.fixedInfo}>
                      <Text style={styles.fixedName}>{expense.name}</Text>
                      <Text style={styles.fixedSub}>Paid by the {expense.dueDay}{expense.dueDay === 1 ? 'st' : expense.dueDay === 2 ? 'nd' : expense.dueDay === 3 ? 'rd' : 'th'}</Text>
                    </View>
                    <Text style={styles.fixedAmount}>KSh {expense.amount.toLocaleString()}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteBtn}
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
        <View style={styles.suggestRow}>
          {SUGGESTIONS.map((suggestion) => (
            <TouchableOpacity
              key={suggestion.name}
              style={styles.suggestChip}
              onPress={() => handleAddSuggestion(suggestion)}
              accessibilityLabel={`Add ${suggestion.name}`}
              accessibilityRole="button"
            >
              <suggestion.icon size={12} color={colors.ink} strokeWidth={2.2} />
              <Text style={styles.suggestChipText}>{suggestion.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.suggestNote}>
          Tap a suggestion to add it — these are suggestions, not auto-detection (manual entry only in this build).
        </Text>

        <View style={styles.fixedSummary}>
          <Text style={styles.summaryLabel}>Total fixed per month</Text>
          <Text style={styles.summaryValue}>KSh {totalFixed.toLocaleString()}</Text>
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
        {showAddModal && (
          <TouchableOpacity style={styles.modalOverlay} onPress={() => { setShowAddModal(false); resetForm(); }} activeOpacity={1}>
            <TouchableOpacity style={styles.modalContent} onPress={() => {}} activeOpacity={1}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingId ? 'Edit fixed expense' : 'Add fixed expense'}
                </Text>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => { setShowAddModal(false); resetForm(); }}
                  accessibilityLabel="Close"
                  accessibilityRole="button"
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <X size={18} color={colors.inkSoft} strokeWidth={2} />
                </TouchableOpacity>
              </View>

              <View style={styles.modalFields}>
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
                  value={editingId ? String(editDueDay) : String(newDueDay)}
                  onChangeText={(t) => {
                    const day = Math.min(Math.max(Number(t) || 1, 1), 31);
                    editingId ? setEditDueDay(day) : setNewDueDay(day);
                  }}
                  placeholder="1"
                  keyboardType="numeric"
                  accessible={true}
                  accessibilityLabel="Due day of the month"
                />
              </View>

              <View style={styles.modalActions}>
                <Button variant="secondary" style={styles.modalActionBtn} onPress={() => { setShowAddModal(false); resetForm(); }}>
                  Cancel
                </Button>
                <Button style={styles.modalActionBtn} onPress={handleSave}>
                  {editingId ? 'Save changes' : 'Add expense'}
                </Button>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        )}

        {/* Delete confirmation modal */}
        {deleteTargetId && (
          <TouchableOpacity style={styles.modalOverlay} onPress={cancelDelete} activeOpacity={1}>
            <TouchableOpacity style={styles.modalContent} onPress={() => {}} activeOpacity={1}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Delete expense</Text>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={cancelDelete}
                  accessibilityLabel="Close"
                  accessibilityRole="button"
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <X size={18} color={colors.inkSoft} strokeWidth={2} />
                </TouchableOpacity>
              </View>

              <Text style={styles.deleteConfirmText}>
                Are you sure you want to remove {deleteTarget ? `"${deleteTarget.name}"` : 'this fixed expense'}? This can&apos;t be undone.
              </Text>

              <View style={styles.modalActions}>
                <Button variant="secondary" style={styles.modalActionBtn} onPress={cancelDelete}>
                  Cancel
                </Button>
                <Button
                  style={styles.modalDeleteBtnAction}
                  onPress={confirmDelete}
                  accessibilityLabel="Confirm delete"
                  accessibilityRole="button"
                >
                  Delete
                </Button>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      </SafeScrollView>
    </ScreenContainer>
  );
}
 
const styles = StyleSheet.create({
  header: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.sage,
  },
  title: {
    ...typography.display,
    color: colors.ink,
    marginTop: spacing.sm,
  },
  subtext: {
    ...typography.body,
    color: colors.sage,
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  fixedList: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: spacing.sm,
    marginBottom: spacing.lg,
  },
  fixedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  fixedItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
    minHeight: touchTarget.minHeight,
  },
  fixedIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.emeraldTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fixedInfo: {
    flex: 1,
  },
  fixedName: {
    ...typography.body,
    color: colors.ink,
  },
  fixedSub: {
    ...typography.caption,
    fontSize: 12,
    color: colors.sage,
  },
  fixedAmount: {
    ...typography.body,
    color: colors.ink,
  },
  deleteBtn: {
    padding: spacing.sm,
    minWidth: touchTarget.minWidth,
    minHeight: touchTarget.minHeight,
  },
  suggestRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  suggestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    minHeight: touchTarget.minHeight,
  },
  suggestChipText: {
    ...typography.caption,
    color: colors.ink,
  },
  suggestNote: {
    ...typography.caption,
    fontSize: 11.5,
    color: colors.sage,
    lineHeight: 18,
    marginBottom: spacing.xl,
  },
  fixedSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    marginBottom: spacing.xl,
    backgroundColor: colors.emeraldTint,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  summaryLabel: {
    ...typography.heading,
    color: colors.ink,
  },
  summaryValue: {
    ...typography.title,
    color: colors.emeraldDeep,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(22,35,29,0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    maxHeight: '85%',
    ...shadow.elevated,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.line,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  modalTitle: {
    ...typography.title,
    color: colors.ink,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.lineSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalFields: {
    gap: spacing.lg,
  },
  deleteConfirmText: {
    ...typography.body,
    color: colors.inkSoft,
    lineHeight: 21,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  modalActionBtn: {
    flex: 1,
  },
  modalDeleteBtn: {
    backgroundColor: colors.error,
    borderColor: colors.error,
  },
  modalDeleteBtnAction: {
    flex: 1,
    backgroundColor: colors.error,
    borderColor: colors.error,
  },
});
