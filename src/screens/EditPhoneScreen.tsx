import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView, useWindowDimensions, Alert as RNAlert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows } from '../theme';
import { useStore } from '../store';
import { updateProfile } from '../services/auth';
import { formatPhoneInput, normalizePhone } from '../services/chat';

export default function EditPhoneScreen() {
  const { width } = useWindowDimensions();
  const maxW = width >= 1024 ? 560 : width >= 768 ? 520 : undefined;

  const user    = useStore((s) => s.user);
  const setUser = useStore((s) => s.setUser);

  const [phone, setPhone]   = useState(formatPhoneInput(user?.phone ?? ''));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    const trimmed = phone.trim();

    // Permite apagar o telefone (campo vazio) ou exige um número válido.
    if (trimmed && !normalizePhone(trimmed)) {
      RNAlert.alert('Telefone inválido', 'Informe o número com DDD. Ex: (11) 99999-8888');
      return;
    }

    setSaving(true);
    const { error } = await updateProfile(user.id, { phone: trimmed || undefined });
    setSaving(false);

    if (error) { RNAlert.alert('Erro ao salvar', error); return; }

    setUser({ ...user, phone: trimmed || undefined });
    RNAlert.alert('Pronto!', 'Telefone atualizado com sucesso.');
    router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Meu telefone</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, maxW ? { maxWidth: maxW, alignSelf: 'center', width: '100%' } : null]}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="logo-whatsapp" size={28} color="#25D366" />
          </View>

          <Text style={styles.cardTitle}>Número para contato</Text>
          <Text style={styles.cardText}>
            Com o telefone cadastrado, {user?.role === 'caregiver' ? 'seus pacientes' : 'seu cuidador'} podem
            falar com você direto pelo WhatsApp, além do chat do app.
          </Text>

          <Text style={styles.label}>Telefone com DDD</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="call-outline" size={18} color={Colors.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={(t) => setPhone(formatPhoneInput(t))}
              placeholder="(11) 99999-8888"
              placeholderTextColor={Colors.textMuted}
              keyboardType="phone-pad"
              maxLength={16}
            />
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveText}>Salvar telefone</Text>}
          </TouchableOpacity>

          <Text style={styles.hint}>
            Deixe em branco e salve para remover o número.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.navy, paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  title:  { color: '#fff', fontWeight: '800', fontSize: 20 },
  scroll: { padding: 16 },

  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 22, ...Shadows.sm },
  iconCircle: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.greenLight,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 14,
  },
  cardTitle: { fontSize: 19, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  cardText:  { fontSize: 14.5, color: Colors.textSecondary, textAlign: 'center', lineHeight: 21, marginTop: 8, marginBottom: 22 },

  label: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 7 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12,
    backgroundColor: Colors.bg, paddingHorizontal: 14,
  },
  input: { flex: 1, color: Colors.textPrimary, fontSize: 16, paddingVertical: 14 },

  saveBtn: {
    backgroundColor: Colors.navy, borderRadius: Radius.md,
    paddingVertical: 15, alignItems: 'center', marginTop: 22,
  },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  hint: { fontSize: 12.5, color: Colors.textMuted, textAlign: 'center', marginTop: 12 },
});
