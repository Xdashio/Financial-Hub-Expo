import { Tabs } from 'expo-router';
import { Home, LineChart, User, Zap } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/ThemeContext';
import { typography, spacing } from '../../src/theme';
import { useIsFreelancerDaily } from '../../src/hooks/useFreelancer';

export default function TabsLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // Check if user has a freelancer daily plan. NOTE: this must come from
  // GET /profile/plan (via useIsFreelancerDaily/usePlan) — the /pockets
  // list has no `plan` field on each pocket, so reading `pockets?.[0]?.plan`
  // here previously always evaluated to `undefined`, silently defeating
  // this check.
  const isFreelancerDaily = useIsFreelancerDaily();

  // Explicit height/inset tuning tied to the same `spacing` primitive used
  // everywhere else, instead of leaving the bar to React Navigation's
  // per-platform defaults — those don't line up with our own touch-target
  // and spacing scale, especially on devices with a large bottom inset.
  const tabBarHeight = spacing.xxxl + spacing.lg + insets.bottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
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
          lineHeight: typography.caption.lineHeight,
          color: colors.sage,
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
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      {/*
        `freelancer-dashboard.tsx` is a file in this route group, so
        expo-router always registers it as a tab whether or not it's
        declared here — conditionally omitting the <Tabs.Screen> (as this
        used to do) doesn't remove the tab, it just strips its options,
        which is what produced the unstyled/broken tab in the bar. To
        actually hide it, keep the screen declared and set `href: null`.
      */}
      <Tabs.Screen
        name="freelancer-dashboard"
        options={{
          title: 'Runway',
          tabBarLabel: 'Runway',
          tabBarIcon: ({ color, size }) => <Zap color={color} size={size} />,
          href: isFreelancerDaily ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarLabel: 'Insights',
          tabBarIcon: ({ color, size }) => <LineChart color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}