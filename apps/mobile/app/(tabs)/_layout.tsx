import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography, shadow } from '../../src/theme';

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
    backgroundColor: colors.paper,
    height: 70,
  },
  tabItem: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    flex: 1,
  },
  tabLabel: {
    ...typography.caption,
    fontWeight: '500',
  },
  tabActive: {
    color: colors.emeraldDeep,
  },
  tabInactive: {
    color: colors.sage,
  },
  iconContainer: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const tabs = [
  { name: 'index', label: 'Home', icon: 'home' },
  { name: 'insights', label: 'Insights', icon: 'trending-up' },
  { name: 'profile', label: 'Profile', icon: 'user' },
];

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const color = focused ? colors.emeraldDeep : colors.sage;
  return (
    <View style={[styles.iconContainer, { width: 28, height: 28 }]}>
      <Text style={{ fontSize: 22, color }}>●</Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.emeraldDeep,
        tabBarInactiveTintColor: colors.sage,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.label,
            tabBarIcon: ({ focused }) => <TabIcon name={tab.icon} focused={focused} />,
            tabBarLabel: tab.label,
          }}
        />
      ))}
    </Tabs>
  );
}