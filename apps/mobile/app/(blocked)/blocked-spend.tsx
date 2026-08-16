import React, { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/ui';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { radius, spacing, typography, shadow } from '../../src/theme';
import { useTheme } from '@/theme/ThemeContext';
import { useAlertModal } from '@/hooks/useAlertModal';
import { spendApi } from '@/services/api';
import {
  ArrowLeft,
  AlertTriangle,
  X,
  RefreshCw,
  LucideIcon,
  Info,
  Shield,
  Lock,
} from 'lucide-react-native';
import { getMerchantCategoryLabel } from '@financial-hub/shared';
import { safeGoBack } from '@/utils/navigation';
import { formatMoney } from '@/utils/money';

export default function BlockedSpendScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { alert, modal } = useAlertModal();
  const { pocketId, blockedCategory, amount, merchant, reviewAvailable } = useLocalSearchParams<{
    pocketId: string;
    blockedCategory: string;
    amount: string;
    merchant: string;
    reviewAvailable?: string;
  }>();
  
  const [blockedReasons, setBlockedReasons] = useState<any>(null);
  const [isLoadingReasons, setIsLoadingReasons] = useState(false);
  const [showDetailedInfo, setShowDetailedInfo] = useState(false);
  
  // Absent for links generated before this param existed — default to
  // showing the option rather than hiding it on a false negative.
  const canReview = reviewAvailable !== 'false';

  useEffect(() => {
    if (pocketId) {
      loadBlockedReasons();
    }
  }, [pocketId]);

  const loadBlockedReasons = async () => {
    try {
      setIsLoadingReasons(true);
      const reasons = await spendApi.getBlockedReasons(pocketId);
      setBlockedReasons(reasons);
    } catch (error) {
      console.error('Error loading blocked reasons:', error);
      // Don't show error - this is supplementary info
    } finally {
      setIsLoadingReasons(false);
    }
  };

  const formatCurrency = (amount: string) => {
    return formatMoney(parseFloat(amount));
  };

  const handleReview = () => {
    // Navigate to merchant classification screen
    router.push({
      pathname: '/(classification)/classify',
      params: {
        recipientKey: merchant,
        amount,
        preferredPocketId: pocketId,
      },
    });
  };

  const handleBack = () => {
    safeGoBack(router, '/(tabs)');
  };

  return (
    <ScreenContainer>
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
              {getMerchantCategoryLabel(blockedCategory)} payments can't be made from this pocket to help you stay on track with your spending goals.
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

        {/* Detailed Blocked Reasons */}
        {blockedReasons && (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
            <Pressable
              onPress={() => setShowDetailedInfo(!showDetailedInfo)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: spacing.md,
                borderRadius: radius.md,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.line,
              }}
            >
              <Info size={20} color={colors.sage} strokeWidth={2} />
              <Text style={{ ...typography.heading, color: colors.ink, marginLeft: spacing.md, flex: 1 }}>
                Why is this blocked?
              </Text>
              <Text style={{ ...typography.caption, color: colors.sage }}>
                {showDetailedInfo ? 'Hide' : 'Show details'}
              </Text>
            </Pressable>

            {showDetailedInfo && (
              <View style={{ marginTop: spacing.md }}>
                {/* Pocket Info */}
                <View style={{ 
                  padding: spacing.md, 
                  borderRadius: radius.md, 
                  backgroundColor: colors.surface, 
                  borderWidth: 1, 
                  borderColor: colors.line,
                  marginBottom: spacing.md 
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
                    <Shield size={16} color={colors.emeraldDeep} strokeWidth={2} />
                    <Text style={{ ...typography.caption, color: colors.sage, marginLeft: spacing.sm }}>
                      Pocket: {blockedReasons.pocket_name}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Lock size={16} color={colors.gold} strokeWidth={2} />
                    <Text style={{ ...typography.caption, color: colors.sage, marginLeft: spacing.sm }}>
                      Type: {blockedReasons.pocket_kind}
                    </Text>
                  </View>
                </View>

                {/* Blocked Categories */}
                <View style={{ 
                  padding: spacing.md, 
                  borderRadius: radius.md, 
                  backgroundColor: colors.errorTint, 
                  borderWidth: 1, 
                  borderColor: colors.error,
                  marginBottom: spacing.md 
                }}>
                  <Text style={{ ...typography.caption, color: colors.clay, marginBottom: spacing.sm }}>
                    Blocked Categories ({blockedReasons.blocked_categories.length}):
                  </Text>
                  {blockedReasons.blocked_categories.map((blocked: any) => (
                    <View 
                      key={blocked.category} 
                      style={{ 
                        padding: spacing.sm, 
                        borderRadius: radius.xs, 
                        backgroundColor: colors.surface, 
                        marginBottom: spacing.xs 
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
                        <Lock size={14} color={blocked.can_override ? colors.gold : colors.clay} strokeWidth={2} />
                        <Text style={{ ...typography.body, color: colors.ink, marginLeft: spacing.xs }}>
                          {getMerchantCategoryLabel(blocked.category)}
                        </Text>
                      </View>
                      <Text style={{ ...typography.caption, color: colors.sage, marginLeft: spacing.md }}>
                        {blocked.reason}
                        {blocked.can_override && (
                          <Text style={{ ...typography.caption, color: colors.emeraldDeep }}>
                            {' • Can be overridden'}
                          </Text>
                        )}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Allowed Categories */}
                <View style={{ 
                  padding: spacing.md, 
                  borderRadius: radius.md, 
                  backgroundColor: colors.emeraldTint, 
                  borderWidth: 1, 
                  borderColor: colors.emeraldDeep 
                }}>
                  <Text style={{ ...typography.caption, color: colors.emeraldDeep, marginBottom: spacing.sm }}>
                    Allowed Categories ({blockedReasons.allowed_categories.length}):
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                    {blockedReasons.allowed_categories.slice(0, 10).map((category: string) => (
                      <View
                        key={category}
                        style={{
                          padding: spacing.xs,
                          borderRadius: radius.xs,
                          backgroundColor: colors.surface,
                          borderWidth: 1,
                          borderColor: colors.emeraldDeep,
                        }}
                      >
                        <Text style={{ ...typography.caption, color: colors.ink }}>
                          {getMerchantCategoryLabel(category)}
                        </Text>
                      </View>
                    ))}
                    {blockedReasons.allowed_categories.length > 10 && (
                      <Text style={{ ...typography.caption, color: colors.sage }}>
                        +{blockedReasons.allowed_categories.length - 10} more
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

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
              💡 These block rules help you protect your essential spending and stay on track with your financial goals. You can see exactly what each pocket allows and blocks from its pocket detail screen.
            </Text>
          </View>
        </View>
      </ScrollView>
      {modal}
    </ScreenContainer>
  );
}