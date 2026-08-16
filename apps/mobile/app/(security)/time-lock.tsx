import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { radius, spacing, typography, shadow } from '../../src/theme';
import { useTheme } from '@/theme/ThemeContext';
import { ScreenContainer, Card, LoadingState, ErrorState } from '@/components/ui';
import { useAlertModal } from '@/hooks/useAlertModal';
import { pocketsApi } from '@/services/api';
import { useDataSync } from '@/services/data-sync';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  ArrowLeft,
  Lock,
  Unlock,
  TrendingUp,
  Clock,
  AlertTriangle,
  Check,
  LucideIcon,
} from 'lucide-react-native';
import { safeGoBack } from '@/utils/navigation';
import { formatMoney } from '@/utils/money';

export default function TimeLockScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { pocketId: pocketIdParam } = useLocalSearchParams<{ pocketId: string }>();

  const [resolvedPocketId, setResolvedPocketId] = useState<string | null>(pocketIdParam ?? null);
  const [lockStatus, setLockStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isExtending, setIsExtending] = useState(false);
  const [reason, setReason] = useState('');
  const { alert, confirm, modal } = useAlertModal();

  useEffect(() => {
    // This screen can be opened two ways: from a specific pocket's "Manage
    // time-lock" button (pocketId is passed as a param), or from Profile's
    // "Savings time-lock" row, which links here with no pocketId at all.
    // The latter used to leave loadLockStatus() never called — isLoading
    // stayed true forever and the screen just spun. Now, with no pocketId,
    // we look up the user's pockets ourselves and find the locked one.
    if (pocketIdParam) {
      setResolvedPocketId(pocketIdParam);
      loadLockStatus(pocketIdParam);
    } else {
      resolveAndLoad();
    }
  }, [pocketIdParam]);

  const resolveAndLoad = async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const pockets = await pocketsApi.getAll();
      const locked = pockets.find((p: any) => p.kind === 'savings' && p.is_time_locked);
      if (!locked) {
        // No time-locked savings pocket exists — this is a legitimate
        // state, not an error, so show it rather than a spinner or a
        // generic failure message.
        setResolvedPocketId(null);
        setLockStatus(null);
        setIsLoading(false);
        return;
      }
      setResolvedPocketId(locked.id);
      await loadLockStatus(locked.id);
    } catch (error) {
      console.error('Error resolving locked pocket:', error);
      setLoadError('Failed to load your time-locked savings. Please try again.');
      setIsLoading(false);
    }
  };

  const loadLockStatus = async (pocketId: string) => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const status = await pocketsApi.getLockStatus(pocketId);
      setLockStatus(status);
    } catch (error) {
      console.error('Error loading lock status:', error);
      setLoadError('Failed to load lock status. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const retry = () => {
    if (pocketIdParam) {
      loadLockStatus(pocketIdParam);
    } else {
      resolveAndLoad();
    }
  };

  const handleUnlock = async () => {
    if (!resolvedPocketId) return;
    if (!lockStatus?.can_unlock) {
      alert('Cannot Unlock', 'This pocket is not currently locked.');
      return;
    }

    const confirmed = await confirm(
      'Early Unlock Required',
      `Unlocking will cost approximately ${lockStatus.early_unlock_cost} discipline points.`,
      { confirmLabel: 'Unlock with Biometric', destructive: true }
    );
    if (!confirmed) return;

    try {
      setIsUnlocking(true);

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      let biometricConfirmed = false;
      if (hasHardware && isEnrolled) {
        const bioResult = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Confirm early unlock',
        });
        if (!bioResult.success) {
          alert('Unlock Cancelled', 'Biometric confirmation was not completed.');
          return;
        }
        biometricConfirmed = true;
      } else {
        // No biometric hardware/enrollment on this device — the backend
        // requires biometric_confirmed to unlock, so without real hardware
        // confirmation we can't honestly claim it happened.
        alert(
          'Biometric Unavailable',
          'Early unlock requires biometric confirmation, and this device has no biometrics set up.'
        );
        return;
      }

      const result = await pocketsApi.unlock(resolvedPocketId, {
        reason,
        biometric_confirmed: biometricConfirmed,
      });
      useDataSync.getState().bump();

      await alert(
        'Unlocked Successfully',
        `Your pocket has been unlocked early. Discipline score: ${result.discipline_cost.previous_score} → ${result.discipline_cost.new_score}.`
      );
      safeGoBack(router, '/(tabs)/profile');
    } catch (error) {
      alert('Error', 'Failed to unlock pocket. Please try again.');
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleExtendLock = async () => {
    if (!resolvedPocketId || isExtending) return;
    const confirmed = await confirm(
      'Extend Lock Period',
      'Extending your lock will earn you discipline bonus points for better security.',
      { confirmLabel: 'Extend 30 Days' }
    );
    if (!confirmed) return;

    try {
      setIsExtending(true);
      const result = await pocketsApi.extendLock(resolvedPocketId, {
        additional_days: 30,
        reason: 'Building emergency fund',
      });
      useDataSync.getState().bump();

      alert(
        'Lock Extended',
        `Your lock has been extended by 30 days. Discipline score: ${result.discipline_bonus.previous_score} → ${result.discipline_bonus.new_score}.`
      );
      loadLockStatus(resolvedPocketId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to extend lock. Please try again.';
      alert('Error', message);
    } finally {
      setIsExtending(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return formatMoney(amount);
  };

  if (isLoading) {
    return (
      <ScreenContainer>
        <LoadingState label="Loading lock status…" />
      </ScreenContainer>
    );
  }

  if (loadError) {
    return (
      <ScreenContainer>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg }}>
          <Pressable onPress={() => safeGoBack(router, '/(tabs)/profile')} style={{ padding: spacing.sm }} hitSlop={8} accessibilityLabel="Go back" accessibilityRole="button">
            <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
          </Pressable>
          <Text style={{ ...typography.title, color: colors.ink, marginLeft: spacing.md }}>Time-Lock Savings</Text>
        </View>
        <ErrorState message={loadError} onRetry={retry} />
      </ScreenContainer>
    );
  }

  if (!resolvedPocketId || !lockStatus) {
    return (
      <ScreenContainer style={{ backgroundColor: colors.surface }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg }}>
          <Pressable onPress={() => safeGoBack(router, '/(tabs)/profile')} style={{ padding: spacing.sm }} hitSlop={8} accessibilityLabel="Go back" accessibilityRole="button">
            <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
          </Pressable>
          <Text style={{ ...typography.title, color: colors.ink, marginLeft: spacing.md }}>Time-Lock Savings</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md }}>
          <View style={{ width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.goldTint, alignItems: 'center', justifyContent: 'center' }}>
            <Lock size={22} color={colors.gold} strokeWidth={2} />
          </View>
          <Text style={{ ...typography.body, color: colors.sage, textAlign: 'center' }}>
            You don't have a time-locked savings pocket yet.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer style={{ backgroundColor: colors.surface }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg }}>
          <Pressable onPress={() => safeGoBack(router, '/(tabs)/profile')} style={{ padding: spacing.sm }} hitSlop={8} accessibilityLabel="Go back" accessibilityRole="button">
            <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
          </Pressable>
          <Text style={{ ...typography.title, color: colors.ink, marginLeft: spacing.md }}>
            Time-Lock Savings
          </Text>
        </View>

        {lockStatus && (
          <>
            {/* Lock Status Card */}
            <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
              <View style={{ 
                padding: spacing.xl, 
                borderRadius: radius.md, 
                backgroundColor: colors.surface, 
                borderWidth: 1, 
                borderColor: colors.line 
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg }}>
                  <View style={{ 
                    width: 48, 
                    height: 48, 
                    borderRadius: radius.md, 
                    backgroundColor: colors.goldTint, 
                    alignItems: 'center', 
                    justifyContent: 'center' 
                  }}>
                    <Lock size={24} color={colors.gold} strokeWidth={2} />
                  </View>
                  <View style={{ marginLeft: spacing.md, flex: 1 }}>
                    <Text style={{ ...typography.title, color: colors.ink, fontSize: 18 }}>
                      {lockStatus.pocket_name}
                    </Text>
                    <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>
                      Protected savings
                    </Text>
                  </View>
                  <View style={{ 
                    paddingHorizontal: spacing.md, 
                    paddingVertical: spacing.xs, 
                    borderRadius: radius.pill, 
                    backgroundColor: colors.emeraldTint 
                  }}>
                    <Text style={{ ...typography.caption, fontSize: 10, color: colors.emeraldDeep }}>
                      {lockStatus.is_locked ? 'Locked' : 'Unlocked'}
                    </Text>
                  </View>
                </View>

                {lockStatus.is_locked && lockStatus.lock_status && (
                  <>
                    {/* Progress Circle */}
                    <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
                      <View style={{ 
                        width: 160, 
                        height: 160, 
                        borderRadius: 80, 
                        backgroundColor: colors.lineSoft, 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        position: 'relative' 
                      }}>
                        <View style={{ 
                          position: 'absolute',
                          width: 160,
                          height: 160,
                          borderRadius: 80,
                          backgroundColor: 'transparent',
                          borderStyle: 'solid',
                          borderWidth: 8,
                          borderColor: colors.emeraldDeep,
                          transform: [{ rotate: `${lockStatus.lock_status.percentage_complete * 3.6}deg` }],
                          borderTopColor: colors.lineSoft,
                        }} />
                        <View style={{ alignItems: 'center' }}>
                          <Clock size={32} color={colors.ink} strokeWidth={2} />
                          <Text style={{ ...typography.title, color: colors.ink, fontSize: 32, marginTop: spacing.sm }}>
                            {lockStatus.lock_status.days_remaining}
                          </Text>
                          <Text style={{ ...typography.caption, color: colors.sage }}>
                            days remaining
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Lock Details */}
                    <View style={{ 
                      flexDirection: 'row', 
                      gap: spacing.md, 
                      marginBottom: spacing.lg 
                    }}>
                      <View style={{ flex: 1, padding: spacing.md, borderRadius: radius.xs, backgroundColor: colors.background }}>
                        <Text style={{ ...typography.caption, color: colors.sage }}>
                          Total lock period
                        </Text>
                        <Text style={{ ...typography.title, color: colors.ink, fontSize: 18 }}>
                          {lockStatus.lock_status.total_lock_days} days
                        </Text>
                      </View>
                      <View style={{ flex: 1, padding: spacing.md, borderRadius: radius.xs, backgroundColor: colors.background }}>
                        <Text style={{ ...typography.caption, color: colors.sage }}>
                          Days elapsed
                        </Text>
                        <Text style={{ ...typography.title, color: colors.ink, fontSize: 18 }}>
                          {lockStatus.lock_status.days_elapsed} days
                        </Text>
                      </View>
                    </View>

                    {/* Protected Amount */}
                    <View style={{ 
                      padding: spacing.md, 
                      borderRadius: radius.xs, 
                      backgroundColor: colors.emeraldTint, 
                      marginBottom: spacing.lg 
                    }}>
                      <Text style={{ ...typography.caption, color: colors.emeraldDeep }}>
                        Protected amount
                      </Text>
                      <Text style={{ ...typography.title, color: colors.emeraldDeep, fontSize: 24 }}>
                        {formatCurrency(lockStatus.protected_amount)}
                      </Text>
                    </View>

                    {/* Unlock Cost */}
                    <View style={{ 
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      padding: spacing.md, 
                      borderRadius: radius.xs, 
                      backgroundColor: colors.clayTint 
                    }}>
                      <AlertTriangle size={20} color={colors.clay} strokeWidth={2} />
                      <View style={{ marginLeft: spacing.md, flex: 1 }}>
                        <Text style={{ ...typography.caption, color: colors.clay }}>
                          Early unlock cost
                        </Text>
                        <Text style={{ ...typography.heading, color: colors.clay }}>
                          {lockStatus.early_unlock_cost} discipline points
                        </Text>
                      </View>
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* Actions */}
            <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
              {lockStatus.is_locked && (
                <>
                  <Pressable
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: spacing.md,
                      borderRadius: radius.md,
                      backgroundColor: colors.clay,
                      marginBottom: spacing.md,
                    }}
                    onPress={handleUnlock}
                    disabled={isUnlocking}
                  >
                    {isUnlocking ? (
                      <Text style={{ ...typography.heading, color: colors.surface }}>
                        Unlocking...
                      </Text>
                    ) : (
                      <>
                        <Unlock size={20} color={colors.surface} strokeWidth={2} />
                        <Text style={{ ...typography.heading, color: colors.surface, marginLeft: spacing.sm }}>
                          Unlock Early
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
                    onPress={handleExtendLock}
                    disabled={isExtending}
                  >
                    {isExtending ? (
                      <Text style={{ ...typography.heading, color: colors.ink }}>
                        Extending...
                      </Text>
                    ) : (
                      <>
                        <TrendingUp size={20} color={colors.emeraldDeep} strokeWidth={2} />
                        <Text style={{ ...typography.heading, color: colors.ink, marginLeft: spacing.sm }}>
                          Extend Lock Period
                        </Text>
                      </>
                    )}
                  </Pressable>
                </>
              )}

              {!lockStatus.is_locked && (
                <View style={{ 
                  padding: spacing.xl, 
                  borderRadius: radius.md, 
                  backgroundColor: colors.emeraldTint, 
                  alignItems: 'center' 
                }}>
                  <Check size={32} color={colors.emeraldDeep} strokeWidth={2} />
                  <Text style={{ ...typography.title, color: colors.emeraldDeep, marginTop: spacing.md }}>
                    Pocket is Unlocked
                  </Text>
                  <Text style={{ ...typography.body, color: colors.emeraldDeep, marginTop: spacing.sm }}>
                    Your savings are currently accessible
                  </Text>
                </View>
              )}
            </View>

            {/* Information */}
            <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
              <Card style={{ backgroundColor: colors.goldTint, borderColor: colors.gold }}>
                <Text style={{ ...typography.caption, color: colors.gold }}>
                  Time-locks help you build the habit of not touching your savings. Early unlocks are possible but cost discipline points to encourage sticking to your goals.
                </Text>
              </Card>
            </View>
          </>
        )}
      </ScrollView>
      {modal}
    </ScreenContainer>
  );
}