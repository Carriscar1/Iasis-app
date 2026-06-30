import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useStore } from '../store';
import { Colors, Radius, Shadows } from '../theme';
import { FOOTER_LABEL } from '../config/app';

export default function ProfileScreen() {
  const { width } = useWindowDimensions();
  const { user, mqttConnected } = useStore();
  const isTablet  = width >= 768;
  const isDesktop = width >= 1024;
  // Paciente = perfil idoso: fontes e alvos de toque maiores.
  const isElderly = user?.role === 'patient';
  const maxW      = isDesktop ? 720 : isTablet ? 560 : undefined;
  const baseFs    = isDesktop ? 15 : isTablet ? 14 : 13;
  const fs        = isElderly ? baseFs + 3 : baseFs;
  const avatarSize = isDesktop ? 90 : isTablet ? 80 : 70;

  const roleLabel = () => {
    if (user?.role === 'caregiver')   return '👨‍⚕️ Cuidador';
    if (user?.role === 'patient')     return '👴 Paciente';
    return '🧑 Usuário independente';
  };

  const items = [
    { icon: 'person-outline',           label: 'Nome',          value: user?.name  ?? '—'              },
    { icon: 'mail-outline',             label: 'E-mail',        value: user?.email ?? '—'              },
    { icon: 'shield-checkmark-outline', label: 'Tipo de conta', value: roleLabel()                     },
    { icon: 'watch-outline',            label: 'Pulseira RFID', value: user?.rfid_tag ?? 'Não cadastrada' },
  ];

  const menuItems = [
    ...(user?.role === 'caregiver'
      ? [{
          icon:  'people-outline',
          label: 'Meus pacientes',
          desc:  'Acompanhar pacientes vinculados',
          onPress: () => router.push('/patients'),
        }]
      : []),
    {
      icon:  'calendar-outline',
      label: 'Agenda de doses',
      desc:  'Ver e gerenciar doses',
      onPress: () => router.push('/(tabs)/schedule'),
    },
    // Paciente (idoso) não controla o dispenser — quem cuida disso é o cuidador.
    ...(isElderly ? [] : [{
      icon:  'hardware-chip-outline',
      label: 'Dispenser',
      desc:  'Controlar dispositivo IoT',
      onPress: () => router.push('/(tabs)/device'),
    }]),
    {
      icon:  'bar-chart-outline',
      label: 'Histórico',
      desc:  'Relatório de adesão',
      onPress: () => router.push('/(tabs)/history'),
    },
    {
      icon:  'notifications-outline',
      label: 'Notificações',
      desc:  'Lembretes de dose',
      onPress: () => router.push('/notifications'),
    },
    {
      icon:  'information-circle-outline',
      label: 'Sobre',
      desc:  'O que é o IASIS',
      onPress: () => router.push('/about'),
    },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { fontSize: isDesktop ? 26 : isTablet ? 24 : 22 }]}>Perfil</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100, alignItems: maxW ? 'center' : undefined }}
      >
        <View style={{ width: '100%', maxWidth: maxW, paddingHorizontal: 16 }}>

          {/* Avatar */}
          <View style={styles.avatarSection}>
            <View style={[styles.avatar, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}>
              <Text style={{ fontSize: avatarSize * 0.4, fontWeight: '800', color: '#fff' }}>
                {user?.name?.charAt(0).toUpperCase() ?? 'U'}
              </Text>
            </View>
            <Text style={[styles.userName, { fontSize: isTablet ? 22 : 18 }]}>{user?.name ?? 'Usuário'}</Text>
            <View style={styles.roleBadge}>
              <Text style={[styles.roleText, { fontSize: fs - 1 }]}>{roleLabel()}</Text>
            </View>
          </View>

          {/* Status MQTT */}
          <View style={[styles.mqttRow, { marginBottom: 20 }]}>
            <View style={[styles.mqttDot, { backgroundColor: mqttConnected ? '#0F6E56' : '#EF4444' }]} />
            <Text style={[styles.mqttText, { fontSize: fs - 1 }]}>
              {mqttConnected ? 'Dispenser conectado via MQTT' : 'Dispenser offline'}
            </Text>
          </View>

          {/* Dados da conta */}
          <Text style={[styles.section, { fontSize: fs - 2 }]}>Dados da conta</Text>
          <View style={[styles.card, { marginBottom: 20 }]}>
            {items.map((item, idx) => (
              <View key={item.label}>
                <View style={styles.infoRow}>
                  <View style={[styles.infoIcon, { width: isTablet ? 40 : 34, height: isTablet ? 40 : 34 }]}>
                    <Ionicons name={item.icon as any} size={isTablet ? 20 : 17} color={Colors.navy} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.infoLabel, { fontSize: fs - 3 }]}>{item.label}</Text>
                    <Text style={[styles.infoValue, { fontSize: fs }]}>{item.value}</Text>
                  </View>
                </View>
                {idx < items.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </View>

          {/* Menu de ações */}
          <Text style={[styles.section, { fontSize: fs - 2 }]}>Ações rápidas</Text>
          <View style={[styles.card, { marginBottom: 20 }]}>
            {menuItems.map((item, idx) => (
              <View key={item.label}>
                <TouchableOpacity style={styles.menuRow} onPress={item.onPress} activeOpacity={0.7}>
                  <View style={[styles.menuIcon, { width: isTablet ? 40 : 34, height: isTablet ? 40 : 34 }]}>
                    <Ionicons name={item.icon as any} size={isTablet ? 20 : 17} color={Colors.navy} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.menuLabel, { fontSize: fs }]}>{item.label}</Text>
                    <Text style={[styles.menuDesc, { fontSize: fs - 2 }]}>{item.desc}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
                {idx < menuItems.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </View>

          {/* Botão sair → tela de confirmação dedicada (sem pop-up) */}
          <TouchableOpacity style={styles.logoutBtn} onPress={() => router.push('/logout')} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={isTablet ? 22 : 19} color='#A32D2D' />
            <Text style={[styles.logoutText, { fontSize: fs + 1 }]}>Sair da conta</Text>
          </TouchableOpacity>

          <Text style={[styles.version, { fontSize: fs - 3 }]}>{FOOTER_LABEL}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header:       { backgroundColor: '#1C2B4B', paddingHorizontal: 16, paddingBottom: 16, paddingTop: 10 },
  title:        { fontWeight: '700', color: '#fff' },
  avatarSection:{ alignItems: 'center', paddingVertical: 28 },
  avatar:       { backgroundColor: '#1C2B4B', alignItems: 'center', justifyContent: 'center', marginBottom: 12, ...Shadows.md },
  userName:     { fontWeight: '700', color: Colors.textPrimary },
  roleBadge:    { marginTop: 6, backgroundColor: Colors.borderSoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  roleText:     { color: Colors.textSecondary, fontWeight: '500' },
  mqttRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surface, borderRadius: Radius.sm, padding: 12, borderWidth: 0.5, borderColor: Colors.border },
  mqttDot:      { width: 8, height: 8, borderRadius: 4 },
  mqttText:     { color: Colors.textSecondary },
  section:      { fontWeight: '700', color: Colors.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  card:         { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, ...Shadows.sm },
  infoRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  infoIcon:     { backgroundColor: Colors.borderSoft, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  infoLabel:    { color: Colors.textMuted },
  infoValue:    { fontWeight: '500', color: Colors.textPrimary, marginTop: 2 },
  menuRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  menuIcon:     { backgroundColor: Colors.borderSoft, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  menuLabel:    { fontWeight: '600', color: Colors.textPrimary },
  menuDesc:     { color: Colors.textSecondary, marginTop: 2 },
  divider:      { height: 0.5, backgroundColor: Colors.border, marginLeft: 14 },
  logoutBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: '#F09595', backgroundColor: '#FCEBEB', marginBottom: 16 },
  logoutText:   { fontWeight: '700', color: '#A32D2D' },
  version:      { textAlign: 'center', color: Colors.textMuted, marginBottom: 8 },
});
