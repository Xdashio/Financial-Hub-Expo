import { Tabs } from 'expo-router';
import { Home, LineChart, User, Zap } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';
import { typography, spacing } from '@/theme';
import { useIsFreelancerDaily } from '@/hooks/useFreelancer';

export default function TabsLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // Check if user has a freelancer daily plan. NOTE: this must come from
  // GET /profile/plan (via useIsFreelancerDaily/usePlan) — the /pockets
  // list has no `plan` field on each pocket, so reading `pockets?.[0]?.plan`
  // here previously always evaluated to `undefined`, silently defeating
  // this check.
  const isFreelancerDaily = useIsFreelancerDaily();

  // icon(24) + label(16) + bar paddingTop/paddingBottom(8+8) + item
  // paddingVertical(4+4) leaves exactly 40px for icon+label with zero
  // slack for the ~2-4px marginTop React Navigation's internal label
  // component adds between the icon and the label — so on real devices
  // that margin pushes the label past the available height and it gets
  // clipped out entirely rather than just looking cramped. 76 (up from
  // the previous exact-fit 64) helped but still left labels half-clipped
  // on some devices because PlusJakartaSans's ascenders exceed the 16px
  // lineHeight box + the internal gap. 84 leaves 8px extra headroom above
  // the theoretical minimum (68) so the label's descenders never hit the
  // bottom edge. Add the bottom inset so gesture nav (34) and 3-button
  // nav (0) both get enough room.
  const tabBarHeight = 84 + insets.bottom;

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
          // Keep the token's fontSize but tighten lineHeight to 14 (instead
          // of typography.caption.lineHeight 16). At 16 the glyph box + the
          // 4px marginTop already pushed the label's descenders past the
          // item's bottom padding on devices where the font's ascenders run
          // tall, producing the "halfway truncated" look. 14 still reads
          // identically for a 12px label but guarantees the descenders sit
          // fully inside the 84-height budget.
          lineHeight: 14,
          includeFontPadding: false,
          // Pin this explicitly instead of relying on the library's
          // internal default gap between icon and label — that default is
          // exactly what the old exact-fit height math didn't budget for.
          marginTop: 2,
          // Prevent horizontal ellipsis on longer labels like "Insights"
          // when the item width is tight (90dp on 360dp screens).
          textAlign: 'center',
        },
        tabBarItemStyle: {
          paddingVertical: spacing.xs,
          // Center icon+label inside the extra 8px slack so the label
          // doesn't sit flush against the bottom edge and get visually
          // sliced by the tabBar's overflow.
          justifyContent: 'center',
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