import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { radius, spacing, typography } from '@/theme';
import { useTheme } from '@/theme/ThemeContext';
import { BottomSheetModal } from './BottomSheetModal';
import { ArrowLeftRight, Plus, Wallet, TrendingUp, ShoppingCart } from 'lucide-react-native';

interface ActionsSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function ActionsSheet({ visible, onClose }: ActionsSheetProps) {
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

  const handleActionPress = (route: string) => {
    onClose();
    setTimeout(() => {
      router.push(route as any);
    }, 200);
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Manage your money"
    >
      <View style={{ gap: spacing.sm }}>
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
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
              }}
              onPress={() => handleActionPress(action.route)}
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
      </View>
    </BottomSheetModal>
  );
}
