import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../store';
import { signOut } from '../services/firebase';
import { Colors, Fonts, Spacing, Radius, Shadows } from '../theme';
import { Card, Divider, Button } from '../components/ui';

export default function ProfileScreen() {
  const { user, dispenser, mqttConnected } = useStore();

  const handleLogout = () => {
    Alert.alert('Sair', 'Deseja sair da conta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: signOut },
    ]);
  };

  const menuItems = [
    { icon: 'person-outline',        label: 'Minha conta',          sub: user?.email },
    { icon: 'hardware-chip-outline', label: 'Dispenser vinculado',  sub: dispenser?.name ?? 'Nenhum' },
    { icon: 'watch-outline',         label: 'Pulseira RFID',        sub: user?.rfidTag ?? 'Não cadastrada' },
    { icon: 'notifications-outline', label: 'Notificações',         sub: 'Doses e alertas ativos' },
    { icon: 'shield-checkmark-outline', label: 'Privacidade',       sub: 'Seus dados são criptografados' },
    { icon: 'help-circle-outline',   label: 'Suporte',              sub: 'Ajuda e documentação' },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Perfil</Text>
      </View>

      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.charAt(0).toUpperCase() ?? 'U'}</Text>
        </View>
        <Text style={styles.name}>{user?.name ?? 'Usuário'}</Text>
        <Text style={styles.role}>{user?.role === 'caregiver' ? 'Cuidador' : 'Paciente'}</Text>
      </View>

      {/* Status MQTT */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: mqttConnected ? Colors.greenText : Colors.redText }} />
          <Text style={{ fontSize: Fonts.sizes.sm, color: Colors.textSecondary }}>
            {mqttConnected ? 'Dispenser conectado via MQTT' : 'Dispenser offline'}
          </Text>
        </View>
      </Card>

      <Card style={{ paddingHorizontal: 0, paddingVertical: 0, gap: 0 }}>
        {menuItems.map((item, idx) => (
          <View key={item.label}>
            <TouchableOpacity style={styles.menuItem}>
              <View style={styles.menuIcon}>
                <Ionicons name={item.icon as any} size={20} color={Colors.navy} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuLabel}>{item.label}</Text>
                {item.sub && <Text style={styles.menuSub}>{item.sub}</Text>}
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
            {idx < menuItems.length - 1 && (
              <Divider style={{ marginLeft: 56 }} />
            )}
          </View>
        ))}
      </Card>

      <Button
        label="Sair da conta"
        onPress={handleLogout}
        variant="ghost"
        style={{ marginHorizontal: Spacing.md, borderColor: Colors.redText }}
        textStyle={{ color: Colors.redText }}
      />

      <Text style={styles.version}>IASIS v1.0.0 · TCC 2025</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: Colors.navy, paddingHorizontal: Spacing.md, paddingBottom: Spacing.lg, paddingTop: Spacing.md },
  title:  { fontSize: Fonts.sizes.xl, fontWeight: '700', color: Colors.white },

  avatarSection: { alignItems: 'center', paddingVertical: Spacing.xl },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.navy,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.sm,
    ...Shadows.md,
  },
  avatarText: { fontSize: Fonts.sizes.xxl, fontWeight: '700', color: Colors.white },
  name:  { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.textPrimary },
  role:  { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, marginTop: 4 },

  menuItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minHeight: 52 },
  menuIcon: { width: 36, height: 36, borderRadius: Radius.xs, backgroundColor: Colors.borderSoft, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { fontSize: Fonts.sizes.sm, fontWeight: '500', color: Colors.textPrimary },
  menuSub:   { fontSize: Fonts.sizes.xs, color: Colors.textSecondary, marginTop: 2 },

  version: { textAlign: 'center', fontSize: Fonts.sizes.xs, color: Colors.textMuted, marginTop: Spacing.lg },
});
