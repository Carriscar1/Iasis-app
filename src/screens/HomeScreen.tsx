import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useStore } from '../store';
import { Colors, Radius, Shadows } from '../theme';

const SHORTCUTS = [
  { icon: 'calendar',      label: 'Agenda',    sub: 'Doses de hoje',         route: '/(tabs)/schedule', bg: '#E6F1FB',           ic: '#185FA5'            },
  { icon: 'hardware-chip', label: 'Dispenser', sub: 'Controlar dispositivo', route: '/(tabs)/device',   bg: '#E1F5EE',           ic: '#0F6E56'            },
  { icon: 'bar-chart',     label: 'Histórico', sub: 'Adesão ao tratamento',  route: '/(tabs)/history',  bg: '#FAEEDA',           ic: '#854F0B'            },
  { icon: 'person',        label: 'Perfil',    sub: 'Minha conta',           route: '/(tabs)/profile',  bg: '#F1F5F9',           ic: '#64748B'            },
];

const INFO = [
  { icon: 'shield-checkmark', color: '#0F6E56', text: 'Dados guardados com segurança no Supabase'  },
  { icon: 'wifi',             color: '#185FA5', text: 'ESP32 conectado via MQTT em tempo real'     },
  { icon: 'watch',            color: '#854F0B', text: 'Pulseira RFID libera doses automaticamente' },
  { icon: 'notifications',    color: '#1C2B4B', text: 'Notificações push no horário de cada dose'  },
];

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const { user, mqttConnected, humidity, temperature } = useStore();
  const [refreshing, setRefreshing] = useState(false);

  const isTablet  = width >= 768;
  const isDesktop = width >= 1024;
  const fs        = isDesktop ? 15 : isTablet ? 14 : 13;
  const maxW      = isDesktop ? 960 : isTablet ? 720 : undefined;

  // Grid: 4 colunas em desktop, 2 em tablet/mobile
  const cols     = isDesktop ? 4 : isTablet ? 4 : 2;
  const gap      = 12;
  const padding  = 16;
  const cardW    = (Math.min(width, maxW ?? width) - padding * 2 - gap * (cols - 1)) / cols;

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      {/* Header */}
      <LinearGradient colors={['#1C2B4B', '#2E4A7A']} style={styles.header}>
        <View style={[styles.headerInner, maxW ? { maxWidth: maxW, alignSelf: 'center', width: '100%' } : {}]}>
          <View>
            <Text style={[styles.greeting, { fontSize: fs - 1 }]}>{greeting()},</Text>
            <Text style={[styles.userName, { fontSize: isDesktop ? 26 : isTablet ? 24 : 22 }]}>
              {user?.name?.split(' ')[0] ?? 'Usuário'} 👋
            </Text>
          </View>
          <TouchableOpacity style={[styles.avatar, { width: isTablet ? 46 : 40, height: isTablet ? 46 : 40, borderRadius: isTablet ? 23 : 20 }]}
            onPress={() => router.push('/(tabs)/profile')}>
            <Text style={{ fontSize: isTablet ? 18 : 16, fontWeight: '700', color: '#fff' }}>
              {user?.name?.charAt(0).toUpperCase() ?? 'U'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.statusRow, maxW ? { maxWidth: maxW, alignSelf: 'center', width: '100%' } : {}]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={[styles.dot, { backgroundColor: mqttConnected ? '#5DCAA5' : '#F59E0B' }]} />
            <Text style={[styles.statusText, { fontSize: fs - 2 }]}>
              {mqttConnected ? 'Dispenser online' : 'Dispenser offline'}
            </Text>
          </View>
          {humidity > 0 && (
            <Text style={[styles.statusText, { fontSize: fs - 2 }]}>{humidity}% · {temperature}°C</Text>
          )}
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32, alignItems: maxW ? 'center' : undefined }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.navy} />}
      >
        <View style={{ width: '100%', maxWidth: maxW, paddingHorizontal: padding }}>

          {/* Grid de atalhos */}
          <Text style={[styles.sectionTitle, { fontSize: fs - 2, marginTop: 20 }]}>Acesso rápido</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
            {SHORTCUTS.map(item => (
              <TouchableOpacity
                key={item.label}
                style={[styles.gridCard, { width: cardW }]}
                onPress={() => router.push(item.route as any)}
                activeOpacity={0.8}
              >
                <View style={[styles.gridIcon, { backgroundColor: item.bg, width: isTablet ? 52 : 44, height: isTablet ? 52 : 44, borderRadius: isTablet ? 16 : 13 }]}>
                  <Ionicons name={item.icon as any} size={isTablet ? 26 : 22} color={item.ic} />
                </View>
                <Text style={[styles.gridLabel, { fontSize: fs }]}>{item.label}</Text>
                <Text style={[styles.gridSub, { fontSize: fs - 3 }]}>{item.sub}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Info do sistema */}
          <Text style={[styles.sectionTitle, { fontSize: fs - 2, marginTop: 24 }]}>Sistema IASIS</Text>
          <View style={styles.infoCard}>
            {INFO.map((item, idx) => (
              <View key={item.text}>
                <View style={styles.infoRow}>
                  <Ionicons name={item.icon as any} size={isTablet ? 20 : 17} color={item.color} />
                  <Text style={[styles.infoText, { fontSize: fs - 1 }]}>{item.text}</Text>
                </View>
                {idx < INFO.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </View>

          <Text style={[styles.version, { fontSize: fs - 3 }]}>IASIS v1.0.0 · TCC 2025</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header:      { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 8 },
  headerInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  greeting:    { color: 'rgba(255,255,255,.65)', fontWeight: '500' },
  userName:    { fontWeight: '700', color: '#fff', marginTop: 2 },
  avatar:      { backgroundColor: 'rgba(255,255,255,.2)', alignItems: 'center', justifyContent: 'center' },
  statusRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dot:         { width: 8, height: 8, borderRadius: 4 },
  statusText:  { color: 'rgba(255,255,255,.7)' },
  sectionTitle:{ fontWeight: '700', color: Colors.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  gridCard:    { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 14, borderWidth: 0.5, borderColor: Colors.border, ...Shadows.sm },
  gridIcon:    { alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  gridLabel:   { fontWeight: '700', color: Colors.textPrimary },
  gridSub:     { color: Colors.textSecondary, marginTop: 3 },
  infoCard:    { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, ...Shadows.sm, marginBottom: 20 },
  infoRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  infoText:    { color: Colors.textSecondary, flex: 1 },
  divider:     { height: 0.5, backgroundColor: Colors.border, marginLeft: 14 },
  version:     { textAlign: 'center', color: Colors.textMuted },
});
