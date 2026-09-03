import { Tabs } from 'expo-router';
import { Store, Receipt, Package, Briefcase } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/ThemeContext';
import { typography, spacing } from '../../src/theme';

// Mirrors (tabs)/_layout.tsx exactly (same height math, colors, and label
// styling) so the business/MSME dashboard has the same persistent bottom
// tab bar as the individual dashboard instead of dropping into a bare,
// bar-less stack. Previously `(msme)` had no _layout.tsx at all, so
// switching to "Business" pushed a single unstyled screen with no way to
// reach Invoices/Stock/Projects except via cards on that one screen, and
// no way back except the Personal/Business pill in the header.
export default function MsmeTabsLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // Same height math as (tabs)/_layout.tsx (see the comment there for why
  // this is 76 rather than an exact-fit 64) — keep both tab bars
  // pixel-identical so switching segments doesn't shift the chrome.
  const tabBarHeight = 76 + insets.bottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: colors.emerald,
        tabBarInactiveTintColor: colors.sage,
        tabBarAllowFontScaling: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          height: tabBarHeight,
          paddingTop: spacing.sm,
          paddingBottom: insets.bottom || spacing.sm,
        },
        tabBarLabelStyle: {
          fontFamily: typography.caption.fontFamily,
          fontSize: typography.caption.fontSize,
          lineHeight: typography.caption.lineHeight,
          includeFontPadding: false,
          marginTop: spacing.xs,
        },
        tabBarItemStyle: {
          paddingVertical: spacing.xs,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => <Store color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="msme-invoices"
        options={{
          title: 'Invoices',
          tabBarLabel: 'Invoices',
          tabBarIcon: ({ color, size }) => <Receipt color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="msme-stock"
        options={{
          title: 'Stock',
          tabBarLabel: 'Stock',
          tabBarIcon: ({ color, size }) => <Package color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="msme-projects"
        options={{
          title: 'Projects',
          tabBarLabel: 'Projects',
          tabBarIcon: ({ color, size }) => <Briefcase color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
