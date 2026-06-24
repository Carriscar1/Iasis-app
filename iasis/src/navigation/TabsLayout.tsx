import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts } from '../theme';
import { useStore } from '../store';

export default function TabsLayout() {
  const unreadCount = useStore(s => s.unreadCount);

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
      <Tabs.Screen name="profile"  options={{
        title: 'Perfil',
        tabBarIcon: ({ color, size }) => (
          <View>
            <Ionicons name="person" size={size} color={color} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </View>
        ),
      }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute', top: -4, right: -6,
    backgroundColor: '#EF4444',
    borderRadius: 8, width: 16, height: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { fontSize: 9, fontWeight: '700', color: '#fff' },
});
