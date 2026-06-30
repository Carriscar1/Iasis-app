import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../../src/store';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface TabItem {
  name:       string;
  title:      string;
  icon:       IconName;
  iconActive: IconName;
}

const TABS: TabItem[] = [
  { name: 'home',     title: 'Início',    icon: 'home-outline',          iconActive: 'home'          },
  { name: 'schedule', title: 'Agenda',    icon: 'calendar-outline',      iconActive: 'calendar'      },
  { name: 'device',   title: 'Dispenser', icon: 'hardware-chip-outline', iconActive: 'hardware-chip' },
  { name: 'history',  title: 'Histórico', icon: 'bar-chart-outline',     iconActive: 'bar-chart'     },
  { name: 'profile',  title: 'Perfil',    icon: 'person-outline',        iconActive: 'person'        },
];

function TabBar({ state, descriptors, navigation }: any) {
  const { width } = useWindowDimensions();
  const isTablet  = width >= 768;
  const role      = useStore((s) => s.user?.role);

  // Paciente (idoso) não controla o dispenser — escondemos essa aba para ele.
  const hidden = role === 'patient' ? ['device'] : [];

  return (
    <View style={[styles.wrapper, isTablet && styles.wrapperTablet]}>
      <View style={styles.container}>
        {state.routes.map((route: any, index: number) => {
          if (hidden.includes(route.name)) return null;
          const tab       = TABS.find(t => t.name === route.name)!;
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <View key={route.key} style={styles.tabItem}>
              <View
                style={[styles.tabBtn, isFocused && styles.tabBtnActive]}
              >
                <Text
                  onPress={onPress}
                  style={styles.tabBtnInner}
                >
                  <Ionicons
                    name={isFocused ? tab.iconActive : tab.icon}
                    size={isTablet ? 24 : 22}
                    color={isFocused ? '#fff' : 'rgba(255,255,255,0.5)'}
                  />
                </Text>
              </View>
              <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
                {tab.title}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      {TABS.map(tab => (
        <Tabs.Screen key={tab.name} name={tab.name} />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position:        'absolute',
    bottom:          0,
    left:            0,
    right:           0,
    paddingBottom:   Platform.OS === 'ios' ? 24 : 12,
    paddingTop:      12,
    paddingHorizontal: 16,
    backgroundColor: '#1C2B4B',
    borderTopWidth:  0,
  },
  wrapperTablet: {
    paddingHorizontal: 40,
    paddingBottom: 20,
  },
  container: {
    flexDirection:  'row',
    justifyContent: 'space-around',
    alignItems:     'center',
  },
  tabItem: {
    flex:       1,
    alignItems: 'center',
    gap:        4,
  },
  tabBtn: {
    width:          46,
    height:         32,
    borderRadius:   16,
    alignItems:     'center',
    justifyContent: 'center',
  },
  tabBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    width:           56,
  },
  tabBtnInner: {
    lineHeight: 32,
  },
  tabLabel: {
    fontSize:   10,
    fontWeight: '500',
    color:      'rgba(255,255,255,0.45)',
  },
  tabLabelActive: {
    color:      '#fff',
    fontWeight: '700',
  },
});
