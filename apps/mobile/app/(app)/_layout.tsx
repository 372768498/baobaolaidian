import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { COLORS, FONT_SIZES } from '@/lib/constants';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: focused ? 26 : 22, opacity: focused ? 1 : 0.5 }}>
      {emoji}
    </Text>
  );
}

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#F0F0F0',
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textLight,
        tabBarLabelStyle: { fontSize: FONT_SIZES.xs, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: '首页',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🌙" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: '通话',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📞" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '我的',
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
