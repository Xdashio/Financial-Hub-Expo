import React, { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/ui';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { radius, spacing, typography } from '@/theme';
import { useTheme } from '@/theme/ThemeContext';
import { useAlertModal } from '@/hooks/useAlertModal';
import { merchantApi, pocketsApi } from '@/services/api';
import { useDataSync } from '@/services/data-sync';
import { MERCHANT_CATEGORIES } from '@financial-hub/shared';
import {
  ArrowLeft,
  Tag,
  AlertTriangle,
  Check,
  History,
} from 'lucide-react-native';
import { safeGoBack } from '@/utils/navigation';
import { formatMoney } from '@/utils/money';
import { CategoryIcon } from '@/components/icons';

type PocketOption = { id: string; name: string; kind: string; category: string | null };

/**
 * Mirrors apps/api/src/common/pocket-rules.ts getAllowedCategoriesForPocket
 * for UI filtering. Keep in sync — gambling_betting must never appear in
 * any branch here (it's filtered out on the backend by
 * isAlwaysBlockedCategory regardless of what a branch returns, but the
 * mobile mirror has no such guard, so it has to be correct by construction).
 * Updated 2026-08-12: Savings now gets the essential-only list, not the
 * broad discretionary one — it should never be spendable on leisure
 * categories, gambling or otherwise.
 */
function getAllowedCategoriesForPocket(pocket: PocketOption): string[] {
  if (pocket.kind === 'fixed') {
    switch (pocket.category) {
      case 'housing':
        return ['landlord_rent'];
      case 'utilities':
        return ['utility'];
      case 'education':
        return ['education'];
      case 'transport':
        return ['transport'];
      case 'healthcare':
        return ['healthcare'];
      case 'food':
        return ['grocery'];
      case 'family':
        return ['education', 'healthcare', 'other'];
      case 'leisure':
        return ['entertainment', 'personal_care', 'other'];
      case 'personal':
        return ['personal_care', 'other'];
      default:
        return ['grocery', 'landlord_rent', 'utility', 'transport', 'healthcare', 'education'];
    }
  }
  if (pocket.category === 'food') return ['grocery'];
  if (pocket.category === 'transport') return ['transport'];
  if (pocket.category === 'family') return ['education', 'healthcare', 'grocery', 'other'];
  if (pocket.category === 'housing') return ['landlord_rent', 'utility'];
  if (pocket.kind === 'savings') {
    return ['grocery', 'landlord_rent', 'utility', 'transport', 'healthcare', 'education'];
  }
  return [
    'grocery',
    'landlord_rent',
    'utility',
    'transport',
    'healthcare',
    'education',
    'entertainment',
    'personal_care',
    'other',
  ];
}

export default function ClassificationScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { recipientKey, amount, transactionId, preferredPocketId } = useLocalSearchParams<{
    recipientKey: string;
    amount: string;
    transactionId: string;
    preferredPocketId: string;
  }>();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedPocket, setSelectedPocket] = useState<string | null>(preferredPocketId || null);
  const [remember, setRemember] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [pockets, setPockets] = useState<PocketOption[]>([]);
  const [isLoadingPockets, setIsLoadingPockets] = useState(true);
  const { alert, modal } = useAlertModal();

  const selectablePockets = selectedCategory
    ? pockets.filter((p) => getAllowedCategoriesForPocket(p).includes(selectedCategory))
    : pockets;

  // Was a hardcoded 9-item list that silently omitted gambling_betting —
  // meaning a user had no way to self-classify a betting/gambling payment
  // at all, the one category this screen most needs to catch. Now sourced
  // from the shared category list so it can't drift from the backend's
  // enum again.
  const categories = MERCHANT_CATEGORIES;

  useEffect(() => {
    loadPockets();
  }, []);

  const loadPockets = async () => {
    try {
      setIsLoadingPockets(true);
      const data = await pocketsApi.getAll();
      setPockets(
        data.map((p: any) => ({
          id: p.id,
          name: p.name,
          kind: p.kind,
          category: p.category ?? null,
        })),
      );
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

      useDataSync.getState().bump();
      await alert(
        'Success',
        transactionId
          ? 'Classification saved and the spend was moved to the pocket you picked.'
          : 'Classification saved successfully!',
      );
      safeGoBack(router, '/(tabs)');
    } catch (error: any) {
      alert('Error', error?.message || 'Failed to save classification. Please try again.');
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

  const handleViewHistory = () => {
    router.push('/(classification)/history');
  };

  const formatCurrency = (value: string) => {
    return formatMoney(parseFloat(value));
  };

  return (
    <ScreenContainer>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg }}>
          <Pressable onPress={() => safeGoBack(router, '/(tabs)')} style={{ padding: spacing.sm }}>
            <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
          </Pressable>
          <Text style={{ ...typography.title, color: colors.ink, marginLeft: spacing.md }}>
            Sort Payment
          </Text>
        </View>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
          <View
            style={{
              padding: spacing.lg,
              borderRadius: radius.md,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.line,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.md,
                  backgroundColor: colors.goldTint,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Tag size={20} color={colors.gold} strokeWidth={2} />
              </View>
              <View style={{ marginLeft: spacing.md, flex: 1 }}>
                <Text style={{ ...typography.heading, color: colors.ink }}>{recipientKey}</Text>
                {amount && (
                  <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>
                    {formatCurrency(amount)}
                  </Text>
                )}
              </View>
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: spacing.md,
                borderRadius: radius.xs,
                backgroundColor: colors.emeraldTint,
              }}
            >
              <AlertTriangle size={16} color={colors.emeraldDeep} strokeWidth={2} />
              <Text
                style={{ ...typography.caption, color: colors.emeraldDeep, marginLeft: spacing.sm }}
              >
                Sort, don't block — just tell us where this payment belongs
              </Text>
            </View>
          </View>
        </View>

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
                  backgroundColor:
                    selectedCategory === category.id ? colors.emeraldDeep : colors.surface,
                  borderWidth: 1,
                  borderColor: selectedCategory === category.id ? colors.emeraldDeep : colors.line,
                  minWidth: 120,
                }}
                onPress={() => {
                  setSelectedCategory(category.id);
                  if (
                    selectedPocket &&
                    !getAllowedCategoriesForPocket(
                      pockets.find((p) => p.id === selectedPocket) || {
                        id: '',
                        name: '',
                        kind: '',
                        category: null,
                      },
                    ).includes(category.id)
                  ) {
                    setSelectedPocket(null);
                  }
                }}
              >
                <CategoryIcon 
                  category={category.icon} 
                  size={20}
                  color={selectedCategory === category.id ? colors.surface : undefined}
                />
                <Text
                  style={{
                    ...typography.caption,
                    color: selectedCategory === category.id ? colors.surface : colors.ink,
                    marginLeft: spacing.sm,
                  }}
                >
                  {category.label}
                </Text>
                {selectedCategory === category.id && (
                  <Check
                    size={16}
                    color={colors.surface}
                    strokeWidth={2}
                    style={{ marginLeft: spacing.sm }}
                  />
                )}
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <Text style={{ ...typography.eyebrow, color: colors.ink, marginBottom: spacing.md }}>
            Which pocket?
          </Text>
          {isLoadingPockets && (
            <Text style={{ ...typography.caption, color: colors.sage, marginBottom: spacing.sm }}>
              Loading pockets...
            </Text>
          )}
          {!isLoadingPockets && selectedCategory && selectablePockets.length === 0 && (
            <Text style={{ ...typography.caption, color: colors.emeraldDeep, marginBottom: spacing.sm }}>
              {MERCHANT_CATEGORIES.find((c) => c.id === selectedCategory)?.alwaysBlocked
                ? "No pocket can take a betting/gambling payment — that's blocked everywhere, on purpose. Report it instead if this looks miscategorized."
                : "No pocket currently accepts this category. Try a different category, or report it if this looks miscategorized."}
            </Text>
          )}
          {!isLoadingPockets &&
            selectedCategory &&
            selectablePockets.length > 0 &&
            selectablePockets.length < pockets.length && (
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
                backgroundColor: selectedPocket === pocket.id ? colors.emeraldDeep : colors.surface,
                borderWidth: 1,
                borderColor: selectedPocket === pocket.id ? colors.emeraldDeep : colors.line,
                marginBottom: spacing.sm,
              }}
              onPress={() => setSelectedPocket(pocket.id)}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: radius.xs,
                  backgroundColor:
                    selectedPocket === pocket.id ? colors.emeraldDeep + '20' : colors.lineSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Tag
                  size={16}
                  color={selectedPocket === pocket.id ? colors.emeraldDeep : colors.sage}
                  strokeWidth={2}
                />
              </View>
              <View style={{ marginLeft: spacing.md, flex: 1 }}>
                <Text
                  style={{
                    ...typography.heading,
                    color: selectedPocket === pocket.id ? colors.surface : colors.ink,
                  }}
                >
                  {pocket.name}
                </Text>
                <Text
                  style={{
                    ...typography.caption,
                    color: selectedPocket === pocket.id ? colors.emeraldDeep + '80' : colors.sage,
                    marginTop: 2,
                  }}
                >
                  {pocket.kind}
                </Text>
              </View>
              {selectedPocket === pocket.id && (
                <Check size={20} color={colors.surface} strokeWidth={2} />
              )}
            </Pressable>
          ))}
        </View>

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
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: radius.xs,
                backgroundColor: remember ? colors.emeraldDeep : colors.lineSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
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
              <Text style={{ ...typography.heading, color: colors.surface }}>Saving...</Text>
            ) : (
              <>
                <Check size={20} color={colors.surface} strokeWidth={2} />
                <Text
                  style={{ ...typography.heading, color: colors.surface, marginLeft: spacing.sm }}
                >
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
              marginBottom: spacing.md,
            }}
            onPress={handleReport}
          >
            <AlertTriangle size={20} color={colors.sage} strokeWidth={2} />
            <Text style={{ ...typography.heading, color: colors.sage, marginLeft: spacing.sm }}>
              Report Wrong Classification
            </Text>
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
            onPress={handleViewHistory}
          >
            <History size={20} color={colors.sage} strokeWidth={2} />
            <Text style={{ ...typography.heading, color: colors.sage, marginLeft: spacing.sm }}>
              View Classification History
            </Text>
          </Pressable>
        </View>
      </ScrollView>
      {modal}
    </ScreenContainer>
  );
}