import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../store';
import { signOut } from '../services/auth';
import { Colors, Radius, Shadows } from '../theme';

export default function ProfileScreen() {
  const { width } = useWindowDimensions();
  const { user, mqttConnected } = useStore();
  const isTablet  = width >= 768;
  const isDesktop = width >= 1024;
  const maxW = isDesktop ? 720 : isTablet ? 560 : undefined;
  const fs   = isDesktop ? 15 : isTablet ? 14 : 13;
  const avatarSize = isDesktop ? 90 : isTablet ? 80 : 70;

  const handleLogout = () => {
    Alert.alert('Sair da conta', 'Tem certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: signOut },
    ]);
  };

  const items = [
    { icon: 'person-outline',           label: 'Nome',          value: user?.name  ?? '—' },
    { icon: 'mail-outline',             label: 'E-mail',        value: user?.email ?? '—' },
    { icon: 'shield-checkmark-outline', label: 'Tipo de conta', value: user?.role === 'caregiver' ? 'Cuidador' : 'Paciente' },
    { icon: 'watch-outline',            label: 'Pulseira RFID', value: user?.rfid_tag ?? 'Não cadastrada' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { fontSize: isDesktop ? 26 : isTablet ? 24 : 22 }]}>Perfil</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40, alignItems: maxW ? 'center' : undefined }}>
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
              <Text style={[styles.roleBadgeText, { fontSize: fs - 2 }]}>
                {user?.role === 'caregiver' ? '👨‍⚕️ Cuidador' : '🧑 Paciente'}
              </Text>
            </View>
          </View>

          {/* Status MQTT */}
          <View style={styles.mqttRow}>
            <View style={[styles.mqttDot, { backgroundColor: mqttConnected ? '#0F6E56' : '#EF4444' }]} />
            <Text style={[styles.mqttText, { fontSize: fs - 1 }]}>
              {mqttConnected ? 'Dispenser conectado via MQTT' : 'Dispenser offline'}
            </Text>
          </View>

          {/* Dados */}
          <Text style={[styles.sectionTitle, { fontSize: fs - 2 }]}>Dados da conta</Text>
          <View style={styles.infoCard}>
            {items.map((item, idx) => (
              <View key={item.label}>
                <View style={styles.infoRow}>
                  <View style={[styles.infoIcon, { width: isTablet ? 40 : 34, height: isTablet ? 40 : 34, borderRadius: isTablet ? 12 : 10 }]}>
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

          {/* Logout */}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={isTablet ? 22 : 19} color='#A32D2D' />
            <Text style={[styles.logoutText, { fontSize: fs }]}>Sair da conta</Text>
          </TouchableOpacity>

          <Text style={[styles.version, { fontSize: fs - 3 }]}>IASIS v1.0.0 · TCC 2025</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header:   { backgroundColor: '#1C2B4B', paddingHorizontal: 16, paddingBottom: 16, paddingTop: 10 },
  title:    { fontWeight: '700', color: '#fff' },
  avatarSection: { alignItems: 'center', paddingVertical: 28 },
  avatar:   { backgroundColor: '#1C2B4B', alignItems: 'center', justifyContent: 'center', marginBottom: 12, ...Shadows.md },
  userName: { fontWeight: '700', color: Colors.textPrimary },
  roleBadge:     { marginTop: 6, backgroundColor: Colors.borderSoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 5 },
  roleBadgeText: { color: Colors.textSecondary, fontWeight: '500' },
  mqttRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surface, borderRadius: Radius.sm, padding: 12, marginBottom: 20, borderWidth: 0.5, borderColor: Colors.border },
  mqttDot:  { width: 8, height: 8, borderRadius: 4 },
  mqttText: { color: Colors.textSecondary },
  sectionTitle: { fontWeight: '700', color: Colors.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoCard: { backgroundColor: Colors.surface, borderRadius: Radius.md, marginBottom: 16, borderWidth: 0.5, borderColor: Colors.border, ...Shadows.sm },
  infoRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  infoIcon: { backgroundColor: Colors.borderSoft, alignItems: 'center', justifyContent: 'center' },
  infoLabel:{ color: Colors.textMuted },
  infoValue:{ fontWeight: '500', color: Colors.textPrimary, marginTop: 2 },
  divider:  { height: 0.5, backgroundColor: Colors.border, marginLeft: 14 },
  logoutBtn:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#F09595', backgroundColor: '#FCEBEB', marginBottom: 16 },
  logoutText:{ fontWeight: '600', color: '#A32D2D' },
  version:  { textAlign: 'center', color: Colors.textMuted },
});
