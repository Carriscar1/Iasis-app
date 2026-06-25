import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '../../src/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor:   Colors.navy,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopWidth:  0.5,
          borderTopColor:  Colors.border,
          paddingBottom:   6,
          height:          62,
        },
        tabBarLabelStyle: {
          fontSize:   Fonts.sizes.xs,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen name="home"     options={{ title: 'Início',    tabBarIcon: ({ color, size }) => <Ionicons name="home"          size={size} color={color} /> }} />
      <Tabs.Screen name="schedule" options={{ title: 'Agenda',    tabBarIcon: ({ color, size }) => <Ionicons name="calendar"      size={size} color={color} /> }} />
      <Tabs.Screen name="device"   options={{ title: 'Dispenser', tabBarIcon: ({ color, size }) => <Ionicons name="hardware-chip" size={size} color={color} /> }} />
      <Tabs.Screen name="history"  options={{ title: 'Histórico', tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart"     size={size} color={color} /> }} />
      <Tabs.Screen name="profile"  options={{ title: 'Perfil',    tabBarIcon: ({ color, size }) => <Ionicons name="person"        size={size} color={color} /> }} />
    </Tabs>
  );
}
