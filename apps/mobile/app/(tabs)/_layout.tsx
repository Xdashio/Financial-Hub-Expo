import { Tabs } from 'expo-router';
import { Home, LineChart, User, Zap } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/ThemeContext';
import { typography, spacing } from '../../src/theme';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/services/api';

export default function TabsLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // Check if user has freelancer daily plan
  const { data: pockets, isLoading: pocketsLoading } = useQuery({
    queryKey: ['pockets'],
    queryFn: () => api.get<any[]>('/pockets'),
  });

  const isFreelancerDaily = pockets?.[0]?.plan?.income_pattern === 'freelancer' && pockets?.[0]?.plan?.type === 'daily';

  // Explicit height/inset tuning tied to the same `spacing` primitive used
  // everywhere else, instead of leaving the bar to React Navigation's
  // per-platform defaults — those don't line up with our own touch-target
  // and spacing scale, especially on devices with a large bottom inset.
  const tabBarHeight = spacing.xxxl + spacing.lg + insets.bottom;

  const screens = [
    <Tabs.Screen
      key="index"
      name="index"
      options={{
        title: 'Home',
        tabBarLabel: 'Home',
        tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
      }}
    />,
  ];
  if (isFreelancerDaily) {
    screens.push(
      <Tabs.Screen
        key="freelancer-dashboard"
        name="freelancer-dashboard"
        options={{
          title: 'Runway',
          tabBarLabel: 'Runway',
          tabBarIcon: ({ color, size }) => <Zap color={color} size={size} />,
        }}
      />
    );
  }
  screens.push(
    <Tabs.Screen
      key="insights"
      name="insights"
      options={{
        title: 'Insights',
        tabBarLabel: 'Insights',
        tabBarIcon: ({ color, size }) => <LineChart color={color} size={size} />,
      }}
    />,
    <Tabs.Screen
      key="profile"
      name="profile"
      options={{
        title: 'Profile',
        tabBarLabel: 'Profile',
        tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
      }}
    />
  );

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
      {screens}
    </Tabs>
  );
}