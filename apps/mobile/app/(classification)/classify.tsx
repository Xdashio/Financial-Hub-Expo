import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { radius, spacing, typography, shadow } from '../../src/theme';
import { useTheme } from '@/theme/ThemeContext';
import { useAlertModal } from '@/hooks/useAlertModal';
import { merchantApi, pocketsApi } from '@/services/api';
import {
  ArrowLeft,
  Tag,
  AlertTriangle,
  Check,
  LucideIcon,
} from 'lucide-react-native';

export default function ClassificationScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { recipientKey, amount, transactionId } = useLocalSearchParams<{
    recipientKey: string;
    amount: string;
    transactionId: string;
  }>();
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedPocket, setSelectedPocket] = useState<string | null>(null);
  const [remember, setRemember] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [pockets, setPockets] = useState<Array<{ id: string; name: string; kind: string }>>([]);
  const [isLoadingPockets, setIsLoadingPockets] = useState(true);
  const { alert, modal } = useAlertModal();

  // Mirrors SpendService.getBlockedCategoriesForPocket on the API: fixed
  // (essential) pockets block gambling + entertainment, every other pocket
  // kind still blocks gambling. Keeps the picker from ever offering a
  // pocket the backend would reject the classification for.
  const getBlockedCategoriesForPocket = (kind: string): string[] => {
    if (kind === 'fixed') {
      return ['gambling_betting', 'entertainment'];
    }
    return ['gambling_betting'];
  };

  const selectablePockets = selectedCategory
    ? pockets.filter((p) => !getBlockedCategoriesForPocket(p.kind).includes(selectedCategory))
    : pockets;

  const categories = [
    { id: 'grocery', name: 'Groceries', icon: '🛒' },
    { id: 'landlord_rent', name: 'Rent', icon: '🏠' },
    { id: 'utility', name: 'Utilities', icon: '💡' },
    { id: 'transport', name: 'Transport', icon: '🚗' },
    { id: 'healthcare', name: 'Healthcare', icon: '💊' },
    { id: 'education', name: 'Education', icon: '📚' },
    { id: 'entertainment', name: 'Entertainment', icon: '🎬' },
    { id: 'personal_care', name: 'Personal Care', icon: '💇' },
    { id: 'other', name: 'Other', icon: '📦' },
  ];

  useEffect(() => {
    loadPockets();
  }, []);

  const loadPockets = async () => {
    try {
      setIsLoadingPockets(true);
      const data = await pocketsApi.getAll();
      setPockets(data.map((p: any) => ({ id: p.id, name: p.name, kind: p.kind })));
    } catch (error) {
      console.error('Error loading pockets:', error);
    } finally {
      setIsLoadingPockets(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedCategory || !selectedPocket) {
      alert('Missing Information', 'Please select both a category and a pocket.');
      return;
    }

    try {
      setIsLoading(true);
      await merchantApi.classify({
        recipient_key: recipientKey,
        category: selectedCategory,
        pocket_id: selectedPocket,
        remember,
        transaction_id: transactionId || undefined,
        amount: amount ? parseFloat(amount) : undefined,
      });

      await alert('Success', 'Classification saved successfully!');
      router.back();
    } catch (error) {
      alert('Error', 'Failed to save classification. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReport = () => {
    router.push({
      pathname: '/(merchant)/report',
      params: { recipientKey, transactionId },
    });
  };

  const formatCurrency = (amount: string) => {
    return `KES ${parseFloat(amount).toLocaleString()}`;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg }}>
          <Pressable onPress={() => router.back()} style={{ padding: spacing.sm }}>
            <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
          </Pressable>
          <Text style={{ ...typography.title, color: colors.ink, marginLeft: spacing.md }}>
            Sort Payment
          </Text>
        </View>

        {/* Context Card */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
          <View style={{ 
            padding: spacing.lg, 
            borderRadius: radius.md, 
            backgroundColor: colors.surface, 
            borderWidth: 1, 
            borderColor: colors.line 
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
              <View style={{ 
                width: 40, 
                height: 40, 
                borderRadius: radius.md, 
                backgroundColor: colors.goldTint, 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <Tag size={20} color={colors.gold} strokeWidth={2} />
              </View>
              <View style={{ marginLeft: spacing.md, flex: 1 }}>
                <Text style={{ ...typography.heading, color: colors.ink }}>
                  {recipientKey}
                </Text>
                {amount && (
                  <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>
                    {formatCurrency(amount)}
                  </Text>
                )}
              </View>
            </View>
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              padding: spacing.md, 
              borderRadius: radius.xs, 
              backgroundColor: colors.emeraldTint 
            }}>
              <AlertTriangle size={16} color={colors.emeraldDeep} strokeWidth={2} />
              <Text style={{ ...typography.caption, color: colors.emeraldDeep, marginLeft: spacing.sm }}>
                Sort, don't block — just tell us where this payment belongs
              </Text>
            </View>
          </View>
        </View>

        {/* Category Selection */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <Text style={{ ...typography.eyebrow, color: colors.ink, marginBottom: spacing.md }}>
            What is this for?
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {categories.map((category) => (
              <Pressable
                key={category.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: spacing.md,
                  borderRadius: radius.md,
                  backgroundColor: selectedCategory === category.id ? colors.emeraldDeep : colors.background,
                  borderWidth: 1,
                  borderColor: selectedCategory === category.id ? colors.emeraldDeep : colors.line,
                  minWidth: 120,
                }}
                onPress={() => {
                  setSelectedCategory(category.id);
                  // Deselect the pocket if it's no longer eligible for the
                  // newly picked category (e.g. switching to Entertainment
                  // after picking an essential/fixed pocket).
                  if (
                    selectedPocket &&
                    getBlockedCategoriesForPocket(
                      pockets.find((p) => p.id === selectedPocket)?.kind || ''
                    ).includes(category.id)
                  ) {
                    setSelectedPocket(null);
                  }
                }}
              >
                <Text style={{ fontSize: 20, marginRight: spacing.sm }}>
                  {category.icon}
                </Text>
                <Text style={{ 
                  ...typography.caption, 
                  color: selectedCategory === category.id ? colors.surface : colors.ink,
                  marginLeft: spacing.sm 
                }}>
                  {category.name}
                </Text>
                {selectedCategory === category.id && (
                  <Check size={16} color={colors.surface} strokeWidth={2} style={{ marginLeft: spacing.sm }} />
                )}
              </Pressable>
            ))}
          </View>
        </View>

        {/* Pocket Selection */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <Text style={{ ...typography.eyebrow, color: colors.ink, marginBottom: spacing.md }}>
            Which pocket?
          </Text>
          {isLoadingPockets && (
            <Text style={{ ...typography.caption, color: colors.sage, marginBottom: spacing.sm }}>
              Loading pockets…
            </Text>
          )}
          {!isLoadingPockets && selectedCategory && selectablePockets.length < pockets.length && (
            <Text style={{ ...typography.caption, color: colors.sage, marginBottom: spacing.sm }}>
              Some pockets are hidden because they block this category.
            </Text>
          )}
          {selectablePockets.map((pocket) => (
            <Pressable
              key={pocket.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: spacing.md,
                borderRadius: radius.md,
                backgroundColor: selectedPocket === pocket.id ? colors.emeraldDeep : colors.background,
                borderWidth: 1,
                borderColor: selectedPocket === pocket.id ? colors.emeraldDeep : colors.line,
                marginBottom: spacing.sm,
              }}
              onPress={() => setSelectedPocket(pocket.id)}
            >
              <View style={{ 
                width: 32, 
                height: 32, 
                borderRadius: radius.xs, 
                backgroundColor: selectedPocket === pocket.id ? colors.emeraldDeep + '20' : colors.lineSoft, 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <Tag size={16} color={selectedPocket === pocket.id ? colors.emeraldDeep : colors.sage} strokeWidth={2} />
              </View>
              <View style={{ marginLeft: spacing.md, flex: 1 }}>
                <Text style={{ 
                  ...typography.heading, 
                  color: selectedPocket === pocket.id ? colors.surface : colors.ink 
                }}>
                  {pocket.name}
                </Text>
                <Text style={{ 
                  ...typography.caption, 
                  color: selectedPocket === pocket.id ? colors.emeraldDeep + '80' : colors.sage,
                  marginTop: 2 
                }}>
                  {pocket.kind}
                </Text>
              </View>
              {selectedPocket === pocket.id && (
                <Check size={20} color={colors.surface} strokeWidth={2} />
              )}
            </Pressable>
          ))}
        </View>

        {/* Remember Toggle */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <Pressable
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: spacing.md,
              borderRadius: radius.md,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.line,
            }}
            onPress={() => setRemember(!remember)}
          >
            <View style={{
              width: 20,
              height: 20,
              borderRadius: radius.xs,
              backgroundColor: remember ? colors.emeraldDeep : colors.lineSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {remember && <Check size={14} color={colors.surface} strokeWidth={2} />}
            </View>
            <View style={{ marginLeft: spacing.md, flex: 1 }}>
              <Text style={{ ...typography.heading, color: colors.ink }}>
                Remember this classification
              </Text>
              <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>
                Auto-sort future payments from {recipientKey}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* Action Buttons */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <Pressable
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              padding: spacing.md,
              borderRadius: radius.md,
              backgroundColor: colors.emeraldDeep,
              marginBottom: spacing.md,
            }}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <Text style={{ ...typography.heading, color: colors.surface }}>
                Saving...
              </Text>
            ) : (
              <>
                <Check size={20} color={colors.surface} strokeWidth={2} />
                <Text style={{ ...typography.heading, color: colors.surface, marginLeft: spacing.sm }}>
                  Save Classification
                </Text>
              </>
            )}
          </Pressable>
          
          <Pressable
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              padding: spacing.md,
              borderRadius: radius.md,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.line,
            }}
            onPress={handleReport}
          >
            <AlertTriangle size={20} color={colors.sage} strokeWidth={2} />
            <Text style={{ ...typography.heading, color: colors.sage, marginLeft: spacing.sm }}>
              Report Wrong Classification
            </Text>
          </Pressable>
        </View>
      </ScrollView>
      {modal}
    </SafeAreaView>
  );
}