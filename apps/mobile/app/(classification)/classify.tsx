import React, { useState } from 'react';
import { View, Text, ScrollView, SafeAreaView, Pressable, TextInput, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { radius, spacing, typography, shadow } from '../../src/theme';
import { useTheme } from '@/theme/ThemeContext';
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

  const pockets = [
    { id: '1', name: 'Groceries & food', kind: 'spendable' },
    { id: '2', name: 'Transport', kind: 'spendable' },
    { id: '3', name: 'Personal & leisure', kind: 'spendable' },
    { id: '4', name: 'Savings', kind: 'savings' },
  ];

  const handleSubmit = async () => {
    if (!selectedCategory || !selectedPocket) {
      Alert.alert('Missing Information', 'Please select both a category and a pocket.');
      return;
    }

    try {
      setIsLoading(true);
      // TODO: Replace with actual API call
      // await merchantApi.classify({
      //   recipient_key: recipientKey,
      //   category: selectedCategory,
      //   pocket_id: selectedPocket,
      //   remember,
      //   transaction_id: transactionId,
      //   amount: amount ? parseFloat(amount) : undefined,
      // });

      Alert.alert('Success', 'Classification saved successfully!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to save classification. Please try again.');
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
          <Text style={{ ...typography.eyebrow, marginBottom: spacing.md }}>
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
                onPress={() => setSelectedCategory(category.id)}
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
          <Text style={{ ...typography.eyebrow, marginBottom: spacing.md }}>
            Which pocket?
          </Text>
          {pockets.map((pocket) => (
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
    </SafeAreaView>
  );
}