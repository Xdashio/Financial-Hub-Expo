import { Tabs } from 'expo-router';
import { Home, LineChart, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/ThemeContext';
import { typography, spacing } from '../../src/theme';

export default function TabsLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // Explicit height/inset tuning tied to the same `spacing` primitive used
  // everywhere else, instead of leaving the bar to React Navigation's
  // per-platform defaults — those don't line up with our own touch-target
  // and spacing scale, especially on devices with a large bottom inset.
  const tabBarHeight = spacing.xxxl + spacing.lg + insets.bottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.emerald,
        tabBarInactiveTintColor: colors.sage,
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
          // Prevent label clipping on narrow screens — without an explicit
          // lineHeight the OS default can be taller than the allocated
          // label slot on some Android densities, clipping the descenders.
          lineHeight: typography.caption.lineHeight,
        },
        // Ensure label always sits below icon and has room to render fully
        tabBarItemStyle: {
          paddingVertical: spacing.xs,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarIcon: ({ color, size }) => <LineChart color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}