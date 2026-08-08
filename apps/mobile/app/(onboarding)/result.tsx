import React, { useState, useRef } from 'react';
import { View, Text, ScrollView, Dimensions, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, shadow, touchTarget } from '@/theme';
import { useOnboardingStore } from '@/services/onboarding-store';
import { useAuthStore } from '@/services/auth';
import { showAlert } from '@/utils/alert';
import { Button, ScreenContainer, SafeScrollView, ProgressIndicator, SectionTitle } from '@/components/ui';
import { ChevronLeft, Check, Shield, TrendingUp, Home, DollarSign, Lock, ChevronRight } from 'lucide-react-native';
import { authStore } from '@/services/auth';

export default function ResultScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { assignResult, commitPlan, reset } = useOnboardingStore();

  const [isCommitting, setIsCommitting] = React.useState(false);
  const [activeSlide, setActiveSlide] = React.useState(0);
  const scrollViewRef = React.useRef<ScrollView>(null);
  const { width } = Dimensions.get('window');

  if (!assignResult) {
    // Redirect back if no result
    React.useEffect(() => {
      router.replace('/(onboarding)/income');
    }, []);
    return null;
  }

  const { plan, planType, incomePattern, reasons, remainingAfterFixed, savingsTarget, spendableAmount } = assignResult;
  const incomeAmount = remainingAfterFixed + savingsTarget + spendableAmount;

  const handleSlideChange = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const pageIndex = Math.round(offsetX / width);
    setActiveSlide(pageIndex);
  };

  const goToSlide = (index: number) => {
    setActiveSlide(index);
    scrollViewRef.current?.scrollTo({ x: index * width, animated: true });
  };

  const handleEnterPlan = async () => {
    setIsCommitting(true);
    try {
      await commitPlan();
      // Commit succeeded - pockets are now created in database
      // Re-check plan status to ensure routing works correctly
      await useAuthStore.getState().checkHasPlan();
      // Small delay to ensure state updates propagate
      await new Promise(resolve => setTimeout(resolve, 200));
      router.replace('/');
      // Clear onboarding state after navigation to prevent re-entry
      setTimeout(() => reset(), 0);
    } catch (error) {
      showAlert('Error', 'Failed to create your plan. Please try again.');
    } finally {
      setIsCommitting(false);
    }
  };

  const handleAdjust = () => {
    // Navigate back to fixed screen, user can continue back from there
    router.replace('/(onboarding)/fixed');
  };

  const getPlanTag = () => {
    const patternLabel = incomePattern === 'salaried' ? 'Salaried income' : 'Freelancer income';
    const styleLabel = planType === 'structured' ? 'Planner behaviour' : 'Daily budget style';
    return `${patternLabel} · ${styleLabel}`;
  };

  const getPocketColor = (kind: string, category?: string) => {
    if (kind === 'fixed') return colors.gold;
    if (kind === 'savings') return colors.emeraldDeep;
    if (kind === 'spendable') {
      switch (category) {
        case 'food': return colors.emerald;
        case 'transport': return colors.plum;
        case 'leisure': return colors.clay;
        default: return colors.emerald;
      }
    }
    return colors.emerald;
  };

  const getPocketName = (kind: string) => {
    if (kind === 'fixed') return 'Fixed costs';
    if (kind === 'savings') return 'Savings';
    if (kind === 'spendable') return 'Safe to spend';
    return 'Pocket';
  };

  const savingsPercentage = (savingsTarget / incomeAmount * 100);
  const spendablePercentage = (spendableAmount / incomeAmount * 100);
  const fixedAmount = incomeAmount - spendableAmount - savingsTarget;

  return (
    <ScreenContainer>
      <View style={{ flex: 1 }}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleSlideChange}
          scrollEventThrottle={16}
          style={{ flex: 1 }}
        >
          {/* Slide 1: Plan Overview */}
          <View style={{ width, paddingHorizontal: spacing.xl, flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
              <View style={{ width: 56, height: 56, borderRadius: radius.pill, backgroundColor: colors.emeraldDeep, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }}>
                <Check size={26} color="#fff" strokeWidth={1.7} />
              </View>
              <Text style={{ ...typography.eyebrow, color: colors.sage }}>Your money plan is ready</Text>
              <Text style={{ ...typography.display, color: colors.ink, marginTop: spacing.sm, textAlign: 'center' }}>{plan}</Text>
              <Text style={{ ...typography.body, color: colors.sage, marginTop: spacing.xs, textAlign: 'center' }}>{getPlanTag()}</Text>
            </View>

            <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.xl, ...shadow.default, width: '100%' }}>
              <Text style={{ ...typography.heading, fontSize: 13, color: colors.ink, marginBottom: spacing.sm }}>Why this plan</Text>
              {reasons.map((reason, index) => (
                <View key={index} style={{ flexDirection: 'row', gap: spacing.md, marginBottom: index === reasons.length - 1 ? 0 : spacing.md }}>
                  <View style={{ width: 28, height: 28, borderRadius: radius.md, backgroundColor: colors.emeraldTint, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {index === 0 && <Home size={15} color={colors.ink} strokeWidth={2} />}
                    {index === 1 && <TrendingUp size={15} color={colors.ink} strokeWidth={2} />}
                    {index === 2 && <Check size={15} color={colors.ink} strokeWidth={2} />}
                  </View>
                  <Text style={{ ...typography.body, color: colors.ink, flex: 1, lineHeight: 21 }}>{reason.reason}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Slide 2: Pocket Details */}
          <View style={{ width, paddingHorizontal: spacing.lg, flex: 1, alignItems: 'center' }}>
            <View style={{ marginTop: spacing.xl, marginBottom: spacing.xl, width: '100%' }}>
              <Text style={{ ...typography.heading, fontSize: 16, color: colors.ink, textAlign: 'center', marginBottom: spacing.xl }}>Your monthly split</Text>

              {/* Income strip */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg, width: '100%' }}>
                <View>
                  <Text style={{ ...typography.caption, color: colors.sage }}>Monthly income</Text>
                  <Text style={{ ...typography.title, color: colors.emeraldDeep, marginTop: 2 }}>KSh {incomeAmount.toLocaleString()}</Text>
                </View>
                <TrendingUp size={22} color={colors.emeraldDeep} strokeWidth={2} />
              </View>

              {/* Fixed costs pocket card - exact home page structure */}
              <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, ...shadow.default }}>
                <View style={{ borderTopWidth: 1.5, borderTopColor: getPocketColor('fixed'), borderStyle: 'dashed', marginTop: -spacing.xs, paddingTop: spacing.md }} />
                <View style={{ position: 'absolute', top: -4, left: 16, width: 34, height: 8, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: getPocketColor('fixed') }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Home color={getPocketColor('fixed')} size={14} />
                    <Text style={{ ...typography.heading, color: colors.ink }}>{getPocketName('fixed')}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ ...typography.body, color: colors.ink, fontVariant: ['tabular-nums'] }}>KSh {fixedAmount.toLocaleString()}</Text>
                  </View>
                </View>
                <View style={{ height: 6, backgroundColor: colors.lineSoft, borderRadius: radius.pill, marginTop: spacing.md, overflow: 'hidden' }}>
                  <View style={{ height: '100%', borderRadius: radius.pill, backgroundColor: getPocketColor('fixed'), width: '100%' }} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
                  <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage }}>Set aside before anything else</Text>
                  <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage }}>Available</Text>
                </View>
              </View>

              {/* Savings pocket card - exact home page structure */}
              <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, ...shadow.default }}>
                <View style={{ borderTopWidth: 1.5, borderTopColor: getPocketColor('savings'), borderStyle: 'dashed', marginTop: -spacing.xs, paddingTop: spacing.md }} />
                <View style={{ position: 'absolute', top: -4, left: 16, width: 34, height: 8, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: getPocketColor('savings') }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Shield color={getPocketColor('savings')} size={14} />
                    <Text style={{ ...typography.heading, color: colors.ink }}>{getPocketName('savings')}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Lock size={13} color={colors.sage} />
                    <Text style={{ ...typography.body, color: colors.ink, fontVariant: ['tabular-nums'] }}>KSh {savingsTarget.toLocaleString()}</Text>
                  </View>
                </View>
                <View style={{ height: 6, backgroundColor: colors.lineSoft, borderRadius: radius.pill, marginTop: spacing.md, overflow: 'hidden' }}>
                  <View style={{ height: '100%', borderRadius: radius.pill, backgroundColor: getPocketColor('savings'), width: `${savingsPercentage}%` }} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
                  <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage }}>Minimum 10% — enforced</Text>
                  <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage }}>Locked</Text>
                </View>
              </View>

              {/* Safe to spend pocket card - exact home page structure with highlight */}
              <View style={{ backgroundColor: colors.ink, borderWidth: 0, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, ...shadow.default }}>
                <View style={{ borderTopWidth: 1.5, borderTopColor: colors.emeraldDeep, borderStyle: 'dashed', marginTop: -spacing.xs, paddingTop: spacing.md }} />
                <View style={{ position: 'absolute', top: -4, left: 16, width: 34, height: 8, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: colors.emeraldDeep }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <DollarSign color={colors.emeraldDeep} size={14} />
                    <Text style={{ ...typography.heading, color: '#fff' }}>Safe to spend</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ ...typography.body, color: '#fff', fontVariant: ['tabular-nums'] }}>KSh {spendableAmount.toLocaleString()}</Text>
                  </View>
                </View>
                <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.pill, marginTop: spacing.md, overflow: 'hidden' }}>
                  <View style={{ height: '100%', borderRadius: radius.pill, backgroundColor: colors.emeraldDeep, width: `${spendablePercentage}%` }} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
                  <Text style={{ ...typography.caption, fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Daily budget</Text>
                  <Text style={{ ...typography.caption, fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Available</Text>
                </View>
              </View>

              <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage, textAlign: 'center', marginTop: spacing.md, marginBottom: spacing.xl }}>Portions shown to scale · savings minimum is enforced at allocation, not just displayed</Text>

              <View style={{ gap: spacing.md, width: '100%' }}>
                <Button
                  fullWidth
                  size="lg"
                  loading={isCommitting}
                  onPress={handleEnterPlan}
                  rightIcon={<ChevronLeft size={18} color="#fff" style={{ transform: [{ rotate: '180deg' }] }} />}
                  accessibilityLabel="Enter my plan and create pockets"
                  accessibilityRole="button"
                >
                  Enter my plan
                </Button>
                <View style={{ alignItems: 'center' }}>
                  <Button variant="ghost" onPress={handleAdjust} accessibilityLabel="Go back and adjust onboarding answers" accessibilityRole="button">
                    Adjust before I start
                  </Button>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Navigation and Pagination */}
        <View style={{ 
          paddingBottom: spacing.xl,
          paddingHorizontal: spacing.xl,
          flexDirection: 'row', 
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          {/* Previous Button */}
          <View style={{ width: 36 }} />

          {/* Pagination Dots */}
          <View style={{ 
            flexDirection: 'row', 
            justifyContent: 'center', 
            gap: spacing.sm,
          }}>
            {[0, 1].map((index) => (
              <View
                key={index}
                style={{ 
                  width: index === activeSlide ? 24 : 8, 
                  height: 8, 
                  borderRadius: radius.pill, 
                  backgroundColor: index === activeSlide ? colors.emeraldDeep : colors.lineSoft,
                }}
              />
            ))}
          </View>

          {/* Next Button */}
          <Pressable
            onPress={() => goToSlide(1)}
            disabled={activeSlide === 1}
            style={{ 
              padding: spacing.md,
              opacity: activeSlide === 1 ? 0.3 : 1,
            }}
          >
            <ChevronRight size={28} color={colors.emeraldDeep} />
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  );
}