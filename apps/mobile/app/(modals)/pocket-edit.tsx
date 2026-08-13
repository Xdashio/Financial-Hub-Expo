import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { radius, spacing, typography } from '../../src/theme';
import { useTheme } from '@/theme/ThemeContext';
import { pocketsApi } from '@/services/api';
import { useDataSync } from '@/services/data-sync';
import { useHomeStore } from '@/services/home-store';
import { ScreenContainer } from '@/components/ui';
import { ArrowLeft } from 'lucide-react-native';

export default function PocketEditModal() {
  const router = useRouter();
  const { colors } = useTheme();
  const dataSync = useDataSync();
  const { id } = useLocalSearchParams();
  const [pocket, setPocket] = useState<any>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [dailyCap, setDailyCap] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPocket();
  }, [id]);

  const loadPocket = async () => {
    try {
      const data = await pocketsApi.getById(id as string);
      setPocket(data);
      setName(data.name);
      setCategory(data.category || '');
      setDailyCap(data.daily_cap?.toString() || '');
    } catch (error) {
      console.error('Failed to load pocket:', error);
      Alert.alert('Error', 'Could not load pocket');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      return;
    }

    setSaving(true);
    try {
      await pocketsApi.update(id as string, {
        name: name.trim(),
        category: category.trim() || undefined,
        dailyCap: pocket?.kind === 'spendable' && dailyCap ? parseFloat(dailyCap) : undefined,
      });
      const localPatch: { name: string; category?: string; dailyCap?: number } = { name: name.trim() };
      if (category.trim()) localPatch.category = category.trim();
      if (pocket?.kind === 'spendable' && dailyCap) localPatch.dailyCap = parseFloat(dailyCap);
      useHomeStore.getState().updatePocketLocal(id as string, localPatch);
      dataSync.bump();
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not update pocket');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ ...typography.body, color: colors.sage }}>Loading...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md }}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
          </Pressable>
          <Text style={{ ...typography.heading, color: colors.ink }}>Edit Pocket</Text>
          <Pressable onPress={handleSave} disabled={!name.trim() || saving} hitSlop={8}>
            <Text style={{ ...typography.body, color: name.trim() && !saving ? colors.emeraldDeep : colors.lineSoft }}>
              {saving ? 'Saving...' : 'Save'}
            </Text>
          </Pressable>
        </View>

        <ScrollView style={{ flex: 1, paddingHorizontal: spacing.lg }}>
          <View style={{ marginTop: spacing.lg }}>
            <Text style={{ ...typography.caption, color: colors.sage, marginBottom: spacing.xs }}>Pocket name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
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
            />
          </View>

          <View style={{ marginTop: spacing.lg }}>
            <Text style={{ ...typography.caption, color: colors.sage, marginBottom: spacing.xs }}>Category</Text>
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

          {pocket?.kind === 'spendable' && (
            <View style={{ marginTop: spacing.lg }}>
              <Text style={{ ...typography.caption, color: colors.sage, marginBottom: spacing.xs }}>Daily cap (KES)</Text>
              <TextInput
                value={dailyCap}
                onChangeText={setDailyCap}
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
              />
            </View>
          )}

          <View style={{ marginTop: spacing.xl, padding: spacing.md, backgroundColor: colors.goldTint, borderRadius: radius.sm }}>
            <Text style={{ ...typography.caption, color: colors.gold, marginBottom: spacing.xs }}>Pocket type</Text>
            <Text style={{ ...typography.body, color: colors.ink }}>{pocket?.kind}</Text>
          </View>
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}
