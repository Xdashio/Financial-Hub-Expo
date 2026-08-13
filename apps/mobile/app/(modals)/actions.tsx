import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { radius, spacing, typography } from '../../src/theme';
import { useTheme } from '@/theme/ThemeContext';
import { ScreenContainer } from '@/components/ui';
import { safeGoBack } from '@/utils/navigation';
import { ArrowLeft, ArrowLeftRight, Plus, Wallet, TrendingUp, ShoppingCart } from 'lucide-react-native';

export default function ActionsModal() {
  const router = useRouter();
  const { colors } = useTheme();

  const actions = [
    {
      id: 'spend',
      icon: ShoppingCart,
      label: 'Log spend',
      description: 'Record a payment from a pocket',
      color: colors.emeraldTint,
      iconColor: colors.emeraldDeep,
      route: '/(pockets)/log-spend',
    },
    {
      id: 'income',
      icon: Plus,
      label: 'Add income',
      description: 'Record salary, freelance payments, or other income',
      color: colors.emeraldTint,
      iconColor: colors.emeraldDeep,
      route: '/(income)/entry',
    },
    {
      id: 'reallocate',
      icon: ArrowLeftRight,
      label: 'Reallocate money',
      description: 'Move money between pockets',
      color: colors.plumTint,
      iconColor: colors.plum,
      route: '/(modals)/realloc-pick',
    },
    {
      id: 'pockets',
      icon: Wallet,
      label: 'Manage pockets',
      description: 'Add, edit, or delete pockets',
      color: colors.goldTint,
      iconColor: colors.gold,
      route: '/(modals)/pockets-manage',
    },
    {
      id: 'loans',
      icon: TrendingUp,
      label: 'Manage loans',
      description: 'Track loan repayments and balances',
      color: colors.plumTint,
      iconColor: colors.plum,
      route: '/(loans)',
    },
  ];

  return (
    <ScreenContainer>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md }}>
          <TouchableOpacity onPress={() => safeGoBack(router, '/(tabs)')} hitSlop={8}>
            <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={{ ...typography.heading, color: colors.ink }}>Manage your money</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={{ flex: 1, paddingHorizontal: spacing.lg }}>
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <TouchableOpacity
                key={action.id}
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.line,
                  borderRadius: radius.sm,
                  padding: spacing.lg,
                  marginBottom: spacing.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                }}
                onPress={() => router.push(action.route as any)}
                activeOpacity={0.8}
                accessibilityLabel={action.label}
                accessibilityRole="button"
              >
                <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: action.color, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={22} color={action.iconColor} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...typography.body, color: colors.ink }}>{action.label}</Text>
                  <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>{action.description}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}
