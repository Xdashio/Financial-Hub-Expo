import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { radius, spacing, typography } from '../../src/theme';
import { useTheme } from '@/theme/ThemeContext';
import { pocketsApi } from '@/services/api';
import { useDataSync } from '@/services/data-sync';
import { ScreenContainer, Button } from '@/components/ui';
import { safeGoBack } from '@/utils/navigation';
import { ArrowLeft, Check } from 'lucide-react-native';

export default function PocketCreateModal() {
  const router = useRouter();
  const { colors } = useTheme();
  const dataSync = useDataSync();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'spendable' | 'fixed' | 'savings'>('spendable');
  const [category, setCategory] = useState('');
  const [monthlyAllocation, setMonthlyAllocation] = useState('');
  const [dailyCap, setDailyCap] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      return;
    }

    setLoading(true);
    try {
      await pocketsApi.create({
        name: name.trim(),
        kind,
        category: category.trim() || undefined,
        monthlyAllocation: monthlyAllocation ? parseFloat(monthlyAllocation) : 0,
        dailyCap: kind === 'spendable' && dailyCap ? parseFloat(dailyCap) : undefined,
      });
      dataSync.bump();
      safeGoBack(router, '/(modals)/pockets-manage');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not create pocket');
    } finally {
      setLoading(false);
    }
  };

  const kindOptions = [
    { value: 'spendable', label: 'Spendable', description: 'For daily spending' },
    { value: 'fixed', label: 'Fixed', description: 'For recurring bills' },
    { value: 'savings', label: 'Savings', description: 'For saving goals' },
  ] as const;

  return (
    <ScreenContainer>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md }}>
          <Pressable onPress={() => safeGoBack(router, '/(modals)/pockets-manage')} hitSlop={8} accessibilityLabel="Go back" accessibilityRole="button">
            <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
          </Pressable>
          <Text style={{ ...typography.heading, color: colors.ink }}>Add Pocket</Text>
          <Pressable onPress={handleCreate} disabled={!name.trim() || loading} hitSlop={8}>
            <Text style={{ ...typography.body, color: name.trim() && !loading ? colors.emeraldDeep : colors.lineSoft }}>
              {loading ? 'Creating...' : 'Create'}
            </Text>
          </Pressable>
        </View>

        <ScrollView style={{ flex: 1, paddingHorizontal: spacing.lg }}>
          <View style={{ marginTop: spacing.lg }}>
            <Text style={{ ...typography.caption, color: colors.sage, marginBottom: spacing.xs }}>Pocket name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g., Entertainment, Emergency Fund"
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.line,
                borderRadius: radius.sm,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.md,
                ...typography.body,
                color: colors.ink,
              }}
              placeholderTextColor={colors.sage}
            />
          </View>

          <View style={{ marginTop: spacing.lg }}>
            <Text style={{ ...typography.caption, color: colors.sage, marginBottom: spacing.xs }}>Pocket type</Text>
            {kindOptions.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => setKind(option.value)}
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: kind === option.value ? colors.emeraldDeep : colors.line,
                  borderRadius: radius.sm,
                  padding: spacing.md,
                  marginBottom: spacing.sm,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View>
                  <Text style={{ ...typography.body, color: colors.ink }}>{option.label}</Text>
                  <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>{option.description}</Text>
                </View>
                {kind === option.value && (
                  <View style={{ width: 20, height: 20, borderRadius: radius.pill, backgroundColor: colors.emeraldDeep, alignItems: 'center', justifyContent: 'center' }}>
                    <Check size={12} color={colors.surface} strokeWidth={2.5} />
                  </View>
                )}
              </Pressable>
            ))}
          </View>

          <View style={{ marginTop: spacing.lg }}>
            <Text style={{ ...typography.caption, color: colors.sage, marginBottom: spacing.xs }}>Category (optional)</Text>
            <TextInput
              value={category}
              onChangeText={setCategory}
              placeholder="e.g., food, transport, leisure"
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.line,
                borderRadius: radius.sm,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.md,
                ...typography.body,
                color: colors.ink,
              }}
              placeholderTextColor={colors.sage}
            />
          </View>

          <View style={{ marginTop: spacing.lg }}>
            <Text style={{ ...typography.caption, color: colors.sage, marginBottom: spacing.xs }}>Monthly allocation (KSh)</Text>
            <TextInput
              value={monthlyAllocation}
              onChangeText={setMonthlyAllocation}
              placeholder="0"
              keyboardType="numeric"
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.line,
                borderRadius: radius.sm,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.md,
                ...typography.body,
                color: colors.ink,
              }}
              placeholderTextColor={colors.sage}
            />
          </View>

          {kind === 'spendable' && (
            <View style={{ marginTop: spacing.lg }}>
              <Text style={{ ...typography.caption, color: colors.sage, marginBottom: spacing.xs }}>Daily cap (KSh, optional)</Text>
              <TextInput
                value={dailyCap}
                onChangeText={setDailyCap}
                placeholder="0"
                keyboardType="numeric"
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.line,
                  borderRadius: radius.sm,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.md,
                  ...typography.body,
                  color: colors.ink,
                }}
                placeholderTextColor={colors.sage}
              />
            </View>
          )}
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}