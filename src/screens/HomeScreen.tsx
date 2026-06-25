import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useStore } from '../store';
import { Colors, Fonts, Spacing, Radius, Shadows } from '../theme';

export default function HomeScreen() {
  const { user, mqttConnected, humidity, temperature } = useStore();
  const [refreshing, setRefreshing] = useState(false);

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

  const firstName = user?.name?.split(' ')[0] ?? 'Usuário';

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <LinearGradient colors={[Colors.navy, Colors.navyLight]} style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>{greeting()},</Text>
            <Text style={styles.userName}>{firstName} 👋</Text>
          </View>
          <TouchableOpacity
            style={styles.avatar}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0).toUpperCase() ?? 'U'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Status dispenser */}
        <View style={styles.statusRow}>
          <View style={styles.statusLeft}>
            <View style={[
              styles.statusDot,
              { backgroundColor: mqttConnected ? '#5DCAA5' : Colors.amber }
            ]} />
            <Text style={styles.statusText}>
              {mqttConnected ? 'Dispenser online' : 'Dispenser offline'}
            </Text>
          </View>
          {humidity > 0 && (
            <Text style={styles.sensorText}>
              {humidity}% · {temperature}°C
            </Text>
          )}
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.navy} />
        }
      >
        {/* Cards de atalho */}
        <Text style={styles.sectionTitle}>Acesso rápido</Text>

        <View style={styles.grid}>
          {[
            { icon: 'calendar',       label: 'Agenda',    sub: 'Ver doses de hoje',      route: '/(tabs)/schedule', color: '#E6F1FB', iconColor: '#185FA5' },
            { icon: 'hardware-chip',  label: 'Dispenser', sub: 'Controlar dispositivo',  route: '/(tabs)/device',   color: Colors.greenLight, iconColor: Colors.greenText },
            { icon: 'bar-chart',      label: 'Histórico', sub: 'Adesão ao tratamento',   route: '/(tabs)/history',  color: Colors.amberLight, iconColor: Colors.amberText },
            { icon: 'person',         label: 'Perfil',    sub: 'Minha conta',            route: '/(tabs)/profile',  color: Colors.borderSoft, iconColor: Colors.textSecondary },
          ].map((item) => (
            <TouchableOpacity
              key={item.label}
              style={styles.gridItem}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.8}
            >
              <View style={[styles.gridIcon, { backgroundColor: item.color }]}>
                <Ionicons name={item.icon as any} size={26} color={item.iconColor} />
              </View>
              <Text style={styles.gridLabel}>{item.label}</Text>
              <Text style={styles.gridSub}>{item.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Info do sistema */}
        <Text style={styles.sectionTitle}>Sistema IASIS</Text>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="shield-checkmark" size={18} color={Colors.greenText} />
            <Text style={styles.infoText}>Dados guardados com segurança no Supabase</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Ionicons name="wifi" size={18} color="#185FA5" />
            <Text style={styles.infoText}>ESP32 conectado via MQTT em tempo real</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Ionicons name="watch" size={18} color={Colors.amberText} />
            <Text style={styles.infoText}>Pulseira RFID libera doses automaticamente</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Ionicons name="notifications" size={18} color={Colors.navy} />
            <Text style={styles.infoText}>Notificações push no horário de cada dose</Text>
          </View>
        </View>

        {/* Versão */}
        <Text style={styles.version}>IASIS v1.0.0 · TCC 2025</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.bg },
  header:  { paddingHorizontal: Spacing.md, paddingBottom: Spacing.lg, paddingTop: Spacing.xs },
  headerTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: Spacing.sm,
  },
  greeting: { fontSize: Fonts.sizes.sm, color: 'rgba(255,255,255,.65)', fontWeight: '500' },
  userName: { fontSize: Fonts.sizes.xl, fontWeight: '700', color: '#fff', marginTop: 2 },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: Fonts.sizes.md, fontWeight: '700', color: '#fff' },

  statusRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot:  { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: Fonts.sizes.xs, color: 'rgba(255,255,255,.75)' },
  sensorText: { fontSize: Fonts.sizes.xs, color: 'rgba(255,255,255,.55)' },

  content: { padding: Spacing.md, paddingBottom: 32 },

  sectionTitle: {
    fontSize: Fonts.sizes.sm, fontWeight: '700',
    color: Colors.textSecondary, marginBottom: Spacing.sm,
    marginTop: Spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  gridItem: {
    width: '47.5%', backgroundColor: Colors.surface,
    borderRadius: Radius.md, padding: Spacing.md,
    borderWidth: 0.5, borderColor: Colors.border, ...Shadows.sm,
  },
  gridIcon:  { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  gridLabel: { fontSize: Fonts.sizes.base, fontWeight: '700', color: Colors.textPrimary },
  gridSub:   { fontSize: Fonts.sizes.xs, color: Colors.textSecondary, marginTop: 2 },

  infoCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 0.5, borderColor: Colors.border, ...Shadows.sm,
    marginBottom: Spacing.lg,
  },
  infoRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, padding: Spacing.md },
  infoText: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, flex: 1 },
  divider:  { height: 0.5, backgroundColor: Colors.border, marginLeft: Spacing.md },

  version: { textAlign: 'center', fontSize: Fonts.sizes.xs, color: Colors.textMuted },
});
