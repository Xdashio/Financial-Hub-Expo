import React from 'react';
import { View, Text, ScrollView, SafeAreaView, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { radius, spacing, typography, shadow } from '../../src/theme';
import { useTheme } from '@/theme/ThemeContext';
import {
  ArrowLeft,
  AlertTriangle,
  X,
  RefreshCw,
  LucideIcon,
} from 'lucide-react-native';

export default function BlockedSpendScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { pocketId, blockedCategory, amount, merchant, reviewAvailable } = useLocalSearchParams<{
    pocketId: string;
    blockedCategory: string;
    amount: string;
    merchant: string;
    reviewAvailable?: string;
  }>();
  // Absent for links generated before this param existed — default to
  // showing the option rather than hiding it on a false negative.
  const canReview = reviewAvailable !== 'false';

  const formatCurrency = (amount: string) => {
    return `KES ${parseFloat(amount).toLocaleString()}`;
  };

  const getCategoryDisplayName = (category: string) => {
    const displayNames: Record<string, string> = {
      gambling_betting: 'Betting & gambling',
      entertainment: 'Entertainment',
      other: 'Other',
    };
    return displayNames[category] || category;
  };

  const handleReview = () => {
    // Navigate to merchant classification screen
    router.push({
      pathname: '/(classification)/classify',
      params: {
        recipientKey: merchant,
        amount,
        transactionId: '',
      },
    });
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg }}>
          <Pressable onPress={handleBack} style={{ padding: spacing.sm }}>
            <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
          </Pressable>
          <Text style={{ ...typography.title, color: colors.ink, marginLeft: spacing.md }}>
            Payment Blocked
          </Text>
        </View>

        {/* Block Information Card */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
          <View style={{ 
            padding: spacing.xl, 
            borderRadius: radius.md, 
            backgroundColor: colors.clayTint, 
            borderWidth: 1, 
            borderColor: colors.clay 
          }}>
            <View style={{ 
              width: 64, 
              height: 64, 
              borderRadius: radius.md, 
              backgroundColor: colors.clay, 
              alignItems: 'center', 
              justifyContent: 'center',
              marginBottom: spacing.md 
            }}>
              <AlertTriangle size={32} color={colors.surface} strokeWidth={2} />
            </View>
            
            <Text style={{ ...typography.title, color: colors.ink, fontSize: 20, marginBottom: spacing.sm }}>
              This payment was blocked
            </Text>
            
            <Text style={{ ...typography.body, color: colors.sage, marginBottom: spacing.lg }}>
              {getCategoryDisplayName(blockedCategory)} payments can't be made from this pocket to help you stay on track with your spending goals.
            </Text>

            <View style={{ 
              padding: spacing.md, 
              borderRadius: radius.xs, 
              backgroundColor: colors.surface, 
              marginBottom: spacing.sm 
            }}>
              <Text style={{ ...typography.caption, color: colors.sage }}>
                Payment amount
              </Text>
              <Text style={{ ...typography.title, color: colors.ink, fontSize: 24 }}>
                {formatCurrency(amount)}
              </Text>
            </View>

            <View style={{ 
              padding: spacing.md, 
              borderRadius: radius.xs, 
              backgroundColor: colors.surface 
            }}>
              <Text style={{ ...typography.caption, color: colors.sage }}>
                Merchant
              </Text>
              <Text style={{ ...typography.heading, color: colors.ink }}>
                {merchant}
              </Text>
            </View>
          </View>
        </View>

        {/* Options */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <Text style={{ ...typography.eyebrow, color: colors.ink, marginBottom: spacing.md }}>
            What would you like to do?
          </Text>

          <Pressable
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: spacing.lg,
              borderRadius: radius.md,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.line,
              marginBottom: spacing.md,
              display: canReview ? 'flex' : 'none',
            }}
            onPress={handleReview}
          >
            <View style={{ 
              width: 40, 
              height: 40, 
              borderRadius: radius.xs, 
              backgroundColor: colors.emeraldTint, 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <RefreshCw size={20} color={colors.emeraldDeep} strokeWidth={2} />
            </View>
            <View style={{ marginLeft: spacing.md, flex: 1 }}>
              <Text style={{ ...typography.heading, color: colors.ink }}>
                Review and classify
              </Text>
              <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>
                Sort this payment into the right pocket
              </Text>
            </View>
          </Pressable>

          <Pressable
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: spacing.lg,
              borderRadius: radius.md,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.line,
            }}
            onPress={handleBack}
          >
            <View style={{ 
              width: 40, 
              height: 40, 
              borderRadius: radius.xs, 
              backgroundColor: colors.sage + '20', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <X size={20} color={colors.sage} strokeWidth={2} />
            </View>
            <View style={{ marginLeft: spacing.md, flex: 1 }}>
              <Text style={{ ...typography.heading, color: colors.ink }}>
                Cancel payment
              </Text>
              <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>
                Go back and try a different pocket
              </Text>
            </View>
          </Pressable>
        </View>

        {/* Help Text */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <View style={{ 
            padding: spacing.md, 
            borderRadius: radius.xs, 
            backgroundColor: colors.emeraldTint 
          }}>
            <Text style={{ ...typography.caption, color: colors.emeraldDeep }}>
              💡 These block rules help you protect your essential spending and stay on track with your financial goals. You can adjust them in your pocket settings.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}