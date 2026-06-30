import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useStore } from '../store';
import { signOut } from '../services/auth';
import { Colors, Radius, Shadows } from '../theme';

// Tela dedicada de confirmação de saída — sem pop-up de janela.
export default function LogoutScreen() {
  const { width } = useWindowDimensions();
  const isTablet  = width >= 768;
  const isDesktop = width >= 1024;
  const { user, logout } = useStore();
  const isElderly = user?.role === 'patient';
  const fs   = (isDesktop ? 16 : 15) + (isElderly ? 3 : 0);
  const maxW = 460;

  const [loading, setLoading] = useState(false);

  const confirm = async () => {
    setLoading(true);
    await signOut();
    logout();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={[styles.title, { fontSize: isDesktop ? 26 : isTablet ? 24 : 22 }]}>Sair da conta</Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={[styles.card, { maxWidth: maxW }]}>
          <View style={styles.iconCircle}>
            <Ionicons name="log-out-outline" size={40} color={Colors.redText} />
          </View>

          <Text style={[styles.heading, { fontSize: isElderly ? 24 : 20 }]}>
            Deseja realmente sair?
          </Text>
          <Text style={[styles.sub, { fontSize: fs }]}>
            {user?.name ? `Você está conectado como ${user.name}. ` : ''}
            Será preciso entrar de novo com seu e-mail e senha.
          </Text>

          <TouchableOpacity style={styles.dangerBtn} onPress={confirm} disabled={loading} activeOpacity={0.85}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : (
                <>
                  <Ionicons name="log-out-outline" size={20} color="#fff" />
                  <Text style={[styles.dangerText, { fontSize: fs }]}>Sim, sair</Text>
                </>
              )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()} disabled={loading} activeOpacity={0.8}>
            <Text style={[styles.cancelText, { fontSize: fs }]}>Não, continuar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header:     { backgroundColor: Colors.navy, paddingHorizontal: 16, paddingBottom: 16, paddingTop: 10 },
  backBtn:    { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,.14)', alignItems: 'center', justifyContent: 'center' },
  title:      { fontWeight: '700', color: '#fff' },
  body:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card:       { width: '100%', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 28, ...Shadows.md },
  iconCircle: { width: 84, height: 84, borderRadius: 42, backgroundColor: Colors.redLight, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  heading:    { fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  sub:        { color: Colors.textSecondary, textAlign: 'center', lineHeight: 23, marginTop: 10, marginBottom: 24 },
  dangerBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.redText, borderRadius: 14, paddingVertical: 15, width: '100%' },
  dangerText: { color: '#fff', fontWeight: '700' },
  cancelBtn:  { alignItems: 'center', justifyContent: 'center', paddingVertical: 15, marginTop: 10, width: '100%' },
  cancelText: { color: Colors.textSecondary, fontWeight: '700' },
});
