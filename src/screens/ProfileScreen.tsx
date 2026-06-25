import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../store';
import { signOut } from '../services/auth';
import { Colors, Fonts, Spacing, Radius, Shadows } from '../theme';

export default function ProfileScreen() {
  const { user, mqttConnected } = useStore();

  const handleLogout = () => {
    Alert.alert('Sair da conta', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: signOut },
    ]);
  };

  const menuItems = [
    { icon: 'person-outline',           label: 'Nome',             value: user?.name ?? '—' },
    { icon: 'mail-outline',             label: 'E-mail',           value: user?.email ?? '—' },
    { icon: 'shield-checkmark-outline', label: 'Tipo de conta',    value: user?.role === 'caregiver' ? 'Cuidador' : 'Paciente' },
    { icon: 'watch-outline',            label: 'Pulseira RFID',    value: user?.rfid_tag ?? 'Não cadastrada' },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Perfil</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0).toUpperCase() ?? 'U'}
            </Text>
          </View>
          <Text style={styles.userName}>{user?.name ?? 'Usuário'}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>
              {user?.role === 'caregiver' ? '👨‍⚕️ Cuidador' : '🧑 Paciente'}
            </Text>
          </View>
        </View>

        {/* Status MQTT */}
        <View style={styles.mqttRow}>
          <View style={[styles.mqttDot, { backgroundColor: mqttConnected ? Colors.greenText : Colors.red }]} />
          <Text style={styles.mqttText}>
            {mqttConnected ? 'Dispenser conectado via MQTT' : 'Dispenser offline'}
          </Text>
        </View>

        {/* Dados da conta */}
        <Text style={styles.sectionTitle}>Dados da conta</Text>
        <View style={styles.infoCard}>
          {menuItems.map((item, idx) => (
            <View key={item.label}>
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Ionicons name={item.icon as any} size={18} color={Colors.navy} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoLabel}>{item.label}</Text>
                  <Text style={styles.infoValue}>{item.value}</Text>
                </View>
              </View>
              {idx < menuItems.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        {/* Sair */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={Colors.redText} />
          <Text style={styles.logoutText}>Sair da conta</Text>
        </TouchableOpacity>

        <Text style={styles.version}>IASIS v1.0.0 · TCC 2025</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: Colors.navy, paddingHorizontal: Spacing.md, paddingBottom: Spacing.lg, paddingTop: Spacing.md },
  title:  { fontSize: Fonts.sizes.xl, fontWeight: '700', color: '#fff' },

  avatarSection: { alignItems: 'center', paddingVertical: Spacing.xl },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.navy, alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.sm, ...Shadows.md,
  },
  avatarText: { fontSize: 32, fontWeight: '800', color: '#fff' },
  userName:   { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.textPrimary },
  roleBadge:  { marginTop: 6, backgroundColor: Colors.borderSoft, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 4 },
  roleBadgeText: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary, fontWeight: '500' },

  mqttRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.surface, marginHorizontal: Spacing.md,
    borderRadius: Radius.sm, padding: Spacing.sm, marginBottom: Spacing.md,
    borderWidth: 0.5, borderColor: Colors.border,
  },
  mqttDot:  { width: 8, height: 8, borderRadius: 4 },
  mqttText: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary },

  sectionTitle: { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.textSecondary, paddingHorizontal: Spacing.md, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },

  infoCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    marginHorizontal: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 0.5, borderColor: Colors.border, ...Shadows.sm,
  },
  infoRow:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md },
  infoIcon:  { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.borderSoft, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { fontSize: Fonts.sizes.xs, color: Colors.textMuted },
  infoValue: { fontSize: Fonts.sizes.sm, fontWeight: '500', color: Colors.textPrimary, marginTop: 2 },
  divider:   { height: 0.5, backgroundColor: Colors.border, marginLeft: 52 },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: Spacing.md, borderRadius: Radius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: '#F09595',
    backgroundColor: Colors.redLight, marginBottom: Spacing.md,
  },
  logoutText: { fontSize: Fonts.sizes.base, fontWeight: '600', color: Colors.redText },
  version:    { textAlign: 'center', fontSize: Fonts.sizes.xs, color: Colors.textMuted },
});
