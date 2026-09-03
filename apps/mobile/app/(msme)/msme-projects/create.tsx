import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { radius, spacing, typography } from '@/theme';
import { useTheme } from '@/theme/ThemeContext';
import { msmeProjectsApi } from '@/services/api';
import { ScreenContainer, Button, Input } from '@/components/ui';
import { useAlertModal } from '@/hooks/useAlertModal';
import { ArrowLeft, Calculator, AlertTriangle, Check, Utensils, Heart, Plane, Bus, FileText, HardHat, Sprout, Package } from 'lucide-react-native';
import { safeGoBack } from '@/utils/navigation';
import { formatMoney } from '@/utils/money';
import { ProjectKind } from '@financial-hub/shared';

const PROJECT_KINDS: { value: ProjectKind; label: string; Icon: React.ComponentType<any> }[] = [
  { value: 'catering', label: 'Catering', Icon: Utensils },
  { value: 'wedding', label: 'Wedding', Icon: Heart },
  { value: 'trip', label: 'Trip / Travel', Icon: Plane },
  { value: 'tour', label: 'Tour', Icon: Bus },
  { value: 'contract', label: 'Contract', Icon: FileText },
  { value: 'construction', label: 'Construction', Icon: HardHat },
  { value: 'agri', label: 'Agriculture', Icon: Sprout },
  { value: 'other', label: 'Other', Icon: Package },
];

const TIER_LABELS = {
  priorities: { label: 'Priorities', desc: 'Non-negotiable costs (materials, deposits)', color: 'emeraldDeep' },
  needs: { label: 'Needs', desc: 'Important but flexible (staff, transport)', color: 'gold' },
  wants: { label: 'Wants', desc: 'Nice-to-have upgrades (decor, extras)', color: 'plum' },
} as const;

export default function CreateMsmeProjectScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { alert, modal } = useAlertModal();

  const [name, setName] = useState('');
  const [kind, setKind] = useState<ProjectKind>('catering');
  const [contractValue, setContractValue] = useState('');
  const [tiers, setTiers] = useState({
    priorities: '',
    needs: '',
    wants: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;

  const goBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      safeGoBack(router, '/msme-projects');
    }
  };

  const tierSum = 
    (parseFloat(tiers.priorities) || 0) +
    (parseFloat(tiers.needs) || 0) +
    (parseFloat(tiers.wants) || 0);
  const contractVal = parseFloat(contractValue) || 0;
  const isSumValid = Math.abs(tierSum - contractVal) < 0.01;
  const sumColor = isSumValid && tierSum > 0 ? colors.emeraldDeep : tierSum > 0 && contractVal > 0 ? colors.clay : colors.sage;

  const validateStep = async (step: number): Promise<boolean> => {
    switch (step) {
      case 1:
        if (!name.trim()) {
          await alert('Missing Information', 'Please enter a project name');
          return false;
        }
        if (!kind) {
          await alert('Missing Information', 'Please select a project type');
          return false;
        }
        return true;
      case 2:
        if (!contractValue || contractVal <= 0) {
          await alert('Invalid Amount', 'Please enter a valid contract value');
          return false;
        }
        if (!tiers.priorities || parseFloat(tiers.priorities) <= 0) {
          await alert('Invalid Amount', 'Please enter a valid Priorities target');
          return false;
        }
        if (!tiers.needs || parseFloat(tiers.needs) <= 0) {
          await alert('Invalid Amount', 'Please enter a valid Needs target');
          return false;
        }
        // Wants can be 0 for lean projects
        return true;
      case 3:
        if (!isSumValid && tierSum > 0) {
          await alert(
            'Amounts Do Not Match',
            `Tier targets (${formatMoney(tierSum)}) must equal contract value (${formatMoney(contractVal)})`
          );
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNextStep = async () => {
    if (await validateStep(currentStep)) {
      if (currentStep < totalSteps) {
        setCurrentStep(currentStep + 1);
      } else {
        await handleSubmit();
      }
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await msmeProjectsApi.create({
        name: name.trim(),
        kind,
        contractValue: contractVal,
        tiers: {
          priorities: parseFloat(tiers.priorities) || 0,
          needs: parseFloat(tiers.needs) || 0,
          wants: parseFloat(tiers.wants) || 0,
        },
      });

      await alert('Project Created', 'Your project has been created. Activate the cascade when ready to start receiving income.');
      router.replace('/msme-projects');
    } catch (e) {
      console.error('Create project error:', e);
      await alert('Error', e instanceof Error ? e.message : 'Failed to create project');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <>
            <Input
              label="Project Name"
              placeholder="e.g., Amara's Wedding 2025"
              value={name}
              onChangeText={setName}
            />
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={{ ...typography.heading, color: colors.ink, marginBottom: spacing.sm }}>
                Project Type
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {PROJECT_KINDS.map(k => {
                  const selected = kind === k.value;
                  return (
                    <Pressable
                      key={k.value}
                      onPress={() => setKind(k.value)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.xs,
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.sm,
                        borderRadius: radius.pill,
                        backgroundColor: selected ? colors.emeraldDeep : colors.surface,
                        borderWidth: 1,
                        borderColor: selected ? colors.emeraldDeep : colors.line,
                      }}
                    >
                      <k.Icon size={14} color={selected ? colors.surface : colors.ink} strokeWidth={2} />
                      <Text style={{ ...typography.caption, color: selected ? colors.surface : colors.ink }}>{k.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </>
        );
      case 2:
        return (
          <>
            <Input
              label="Contract Value (KES)"
              placeholder="0.00"
              keyboardType="numeric"
              leftElement={<Calculator size={20} color={colors.sage} strokeWidth={2} />}
              value={contractValue}
              onChangeText={setContractValue}
              helperText="Total project contract amount"
            />
            <View style={{ marginTop: spacing.xl }}>
              <Text style={{ ...typography.heading, color: colors.ink, marginBottom: spacing.sm }}>
                Tier Targets
              </Text>
              <Text style={{ ...typography.caption, color: colors.sage, marginBottom: spacing.md, lineHeight: 20 }}>
                Income flows: Priorities → Needs → Wants. Each tier fills completely before the next.
              </Text>
              {Object.keys(tiers).map((tierKey) => {
                const tier = tierKey as 'priorities' | 'needs' | 'wants';
                const config = TIER_LABELS[tier];
                const tierColor = colors[config.color as keyof typeof colors] || colors.ink;
                return (
                  <View key={tier} style={{ marginBottom: spacing.md }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: tierColor }} />
                        <Text style={{ ...typography.caption, color: colors.ink }}>{config.label}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: spacing.md }}>
                        <Text style={{ ...typography.body, color: colors.ink, fontVariant: ['tabular-nums'] }}>
                          KES {tiers[tier] || '0'}
                        </Text>
                      </View>
                    </View>
                    <Input
                      placeholder="0"
                      keyboardType="numeric"
                      value={tiers[tier]}
                      onChangeText={v => setTiers({ ...tiers, [tier]: v })}
                      helperText={config.desc}
                      leftElement={<Calculator size={18} color={tierColor} strokeWidth={2} />}
                    />
                  </View>
                );
              })}
            </View>
          </>
        );
      case 3:
        return (
          <>
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={{ ...typography.heading, color: colors.ink, marginBottom: spacing.sm }}>
                Review & Confirm
              </Text>
            </View>
            <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                <Text style={{ ...typography.caption, color: colors.sage }}>Name</Text>
                <Text style={{ ...typography.body, color: colors.ink }}>{name}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                <Text style={{ ...typography.caption, color: colors.sage }}>Type</Text>
                <Text style={{ ...typography.body, color: colors.ink }}>{kind.charAt(0).toUpperCase() + kind.slice(1)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                <Text style={{ ...typography.caption, color: colors.sage }}>Contract Value</Text>
                <Text style={{ ...typography.body, color: colors.ink, fontVariant: ['tabular-nums'] }}>{formatMoney(contractVal)}</Text>
              </View>
              <View style={{ height: 1, backgroundColor: colors.line, marginVertical: spacing.md }} />
              {Object.keys(tiers).map((tierKey) => {
                const tier = tierKey as 'priorities' | 'needs' | 'wants';
                const config = TIER_LABELS[tier];
                const tierColor = colors[config.color as keyof typeof colors] || colors.ink;
                const val = parseFloat(tiers[tier]) || 0;
                return (
                  <View key={tier} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tierColor }} />
                      <Text style={{ ...typography.caption, color: tierColor }}>{config.label}</Text>
                    </View>
                    <Text style={{ ...typography.body, color: colors.ink, fontVariant: ['tabular-nums'] }}>{formatMoney(val)}</Text>
                  </View>
                );
              })}
              <View style={{ height: 1, backgroundColor: colors.line, marginVertical: spacing.md }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ ...typography.heading, color: sumColor }}>Sum of Tiers</Text>
                <Text style={{ ...typography.heading, color: sumColor, fontVariant: ['tabular-nums'] }}>{formatMoney(tierSum)}</Text>
              </View>
              {!isSumValid && tierSum > 0 && contractVal > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm, backgroundColor: colors.clayTint, padding: spacing.sm, borderRadius: radius.sm }}>
                  <AlertTriangle size={14} color={colors.clay} strokeWidth={2} />
                  <Text style={{ ...typography.caption, color: colors.clay }}>
                    Must match contract value ({formatMoney(contractVal)})
                  </Text>
                </View>
              )}
              {isSumValid && tierSum > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm, backgroundColor: colors.emeraldTint, padding: spacing.sm, borderRadius: radius.sm }}>
                  <Check size={14} color={colors.emeraldDeep} strokeWidth={2} />
                  <Text style={{ ...typography.caption, color: colors.emeraldDeep }}>
                    Targets match contract value
                  </Text>
                </View>
              )}
            </View>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: spacing.xl }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.md,
              paddingBottom: spacing.sm,
            }}
          >
            <Pressable
              onPress={goBack}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ padding: spacing.xs, marginRight: spacing.sm }}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
            </Pressable>
            <Text style={{ ...typography.title, color: colors.ink }}>Create Project</Text>
          </View>

          {/* Progress Steps — connectors are siblings, not children of the circle, so they stretch between steps */}
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {Array.from({ length: totalSteps }).map((_, index) => {
                const stepNumber = index + 1;
                const isCompleted = stepNumber < currentStep;
                const isCurrent = stepNumber === currentStep;
                return (
                  <React.Fragment key={stepNumber}>
                    <View style={{ alignItems: 'center' }}>
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          backgroundColor: isCompleted ? colors.emeraldDeep : isCurrent ? colors.emeraldDeep : colors.lineSoft,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 2,
                          borderColor: isCompleted || isCurrent ? colors.emeraldDeep : colors.lineSoft,
                        }}
                      >
                        {isCompleted ? (
                          <Check size={16} color={colors.surface} strokeWidth={2} />
                        ) : (
                          <Text style={{ ...typography.caption, color: isCurrent ? colors.surface : colors.sage, fontSize: 14 }}>
                            {stepNumber}
                          </Text>
                        )}
                      </View>
                    </View>
                    {stepNumber < totalSteps && (
                      <View
                        style={{
                          flex: 1,
                          height: 2,
                          backgroundColor: isCompleted ? colors.emeraldDeep : colors.lineSoft,
                          marginHorizontal: spacing.xs,
                        }}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
              <Text style={{ ...typography.caption, color: colors.sage }}>
                Step {currentStep} of {totalSteps}
              </Text>
              <Text style={{ ...typography.caption, color: colors.emeraldDeep }}>
                {currentStep === 1 ? 'Details' : currentStep === 2 ? 'Targets' : 'Review'}
              </Text>
            </View>
          </View>

          {/* Form */}
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
            {renderStep()}
          </View>
        </ScrollView>

        {/* Sticky footer — outside ScrollView so it never scrolls away and respects keyboard */}
        <View
          style={{
            flexDirection: 'row',
            gap: spacing.md,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            paddingBottom: spacing.lg,
            borderTopWidth: 1,
            borderTopColor: colors.line,
            backgroundColor: colors.paper,
          }}
        >
          <View style={{ flex: 1 }}>
            <Button variant="outline" onPress={goBack} disabled={isSubmitting}>
              {currentStep === 1 ? 'Cancel' : 'Back'}
            </Button>
          </View>
          <View style={{ flex: 1 }}>
            <Button
              onPress={handleNextStep}
              loading={isSubmitting}
              disabled={isSubmitting || (currentStep === totalSteps && !isSumValid && tierSum > 0)}
            >
              {currentStep === totalSteps ? 'Create Project' : 'Next'}
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>
      {modal}
    </ScreenContainer>
  );
}