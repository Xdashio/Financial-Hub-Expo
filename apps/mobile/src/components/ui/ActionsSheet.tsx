import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { radius, spacing, typography } from '@/theme';
import { useTheme } from '@/theme/ThemeContext';
import { BottomSheetModal } from './BottomSheetModal';
import { Wallet, TrendingUp } from 'lucide-react-native';

interface ActionsSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function ActionsSheet({ visible, onClose }: ActionsSheetProps) {
  const router = useRouter();
  const { colors } = useTheme();

  const actions = [
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
      title="Manage pockets & loans"
    >
      <View style={{ gap: spacing.sm }}>
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Pressable
              key={action.id}
              style={({ pressed }) => [{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.line,
                borderRadius: radius.sm,
                padding: spacing.lg,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
              }, { opacity: pressed ? 0.8 : 1 }]}
              onPress={() => handleActionPress(action.route)}
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
            </Pressable>
          );
        })}
      </View>
    </BottomSheetModal>
  );
}