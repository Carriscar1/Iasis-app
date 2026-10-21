import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  ScrollView, TextInput, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useStore } from '../store';
import { useElderlyMode } from '../hooks/useElderly';
import { deleteAccount } from '../services/auth';
import { clearCache } from '../services/offline';
import { notify } from '../utils/confirm';
import { Radius, Shadows, useTheme, type ThemeColors } from '../theme';

// Excluir a conta não tem volta: a tela explica o que some e pede a palavra
// EXCLUIR digitada, para um toque sem querer não apagar anos de histórico.
const WORD = 'EXCLUIR';

const GONE = [
  'Seus remédios, horários e todo o histórico de doses',
  'Alertas, conversas e a equipe de cuidado',
  'O acesso com este e-mail (dá para criar uma conta nova depois)',
];

export default function DeleteAccountScreen() {
  const { C, styles } = useTheme(makeStyles);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const { user, logout } = useStore();
  const isElderly = useElderlyMode();
  const fs = (isDesktop ? 16 : 15) + (isElderly ? 3 : 0);

  const [typed, setTyped]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const ready = typed.trim().toUpperCase() === WORD;

  const confirm = async () => {
    if (!ready || loading) return;
    setLoading(true);
    setError('');
    const id = user?.id;
    const { error: err } = await deleteAccount();
    if (err) {
      setLoading(false);
      setError(err);
      return;
    }
    if (id) await clearCache(id);
    logout();
    router.replace('/(auth)/login');
    notify('Conta excluída', 'Sua conta e seus dados foram apagados do IASIS.');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={[styles.title, { fontSize: isDesktop ? 26 : 22 }]}>Excluir conta</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="trash-outline" size={38} color={C.redText} />
          </View>

          <Text style={[styles.heading, { fontSize: isElderly ? 24 : 20 }]}>Excluir sua conta?</Text>
          <Text style={[styles.sub, { fontSize: fs }]}>
            {user?.email ? `A conta ${user.email} será apagada. ` : ''}Isso não pode ser desfeito. Some junto:
          </Text>

          <View style={styles.list}>
            {GONE.map((item) => (
              <View key={item} style={styles.item}>
                <Ionicons name="close-circle" size={18} color={C.redText} />
                <Text style={[styles.itemText, { fontSize: fs - 1 }]}>{item}</Text>
              </View>
            ))}
          </View>

          <Text style={[styles.label, { fontSize: fs - 1 }]}>
            Para confirmar, digite <Text style={styles.word}>{WORD}</Text>
          </Text>
          <TextInput
            style={[styles.input, { fontSize: fs + 1 }]}
            value={typed}
            onChangeText={setTyped}
            placeholder={WORD}
            placeholderTextColor={C.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!loading}
          />

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={C.redText} />
              <Text style={[styles.errorText, { fontSize: fs - 2 }]}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.dangerBtn, !ready && { opacity: 0.45 }]}
            onPress={confirm}
            disabled={!ready || loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : (
                <>
                  <Ionicons name="trash-outline" size={20} color="#fff" />
                  <Text style={[styles.dangerText, { fontSize: fs }]}>Excluir minha conta</Text>
                </>
              )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()} disabled={loading} activeOpacity={0.8}>
            <Text style={[styles.cancelText, { fontSize: fs }]}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  header:     { backgroundColor: C.navyBg, paddingHorizontal: 16, paddingBottom: 16, paddingTop: 10 },
  backBtn:    { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,.14)', alignItems: 'center', justifyContent: 'center' },
  title:      { fontWeight: '700', color: '#fff' },
  body:       { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card:       { width: '100%', maxWidth: 460, alignItems: 'center', backgroundColor: C.surface, borderRadius: Radius.lg, padding: 26, ...Shadows.md },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.redLight, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  heading:    { fontWeight: '800', color: C.textPrimary, textAlign: 'center' },
  sub:        { color: C.textSecondary, textAlign: 'center', lineHeight: 22, marginTop: 10, marginBottom: 14 },
  list:       { width: '100%', gap: 8, marginBottom: 20 },
  item:       { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  itemText:   { flex: 1, color: C.textPrimary, lineHeight: 20 },
  label:      { alignSelf: 'flex-start', color: C.textSecondary, marginBottom: 8 },
  word:       { fontWeight: '800', color: C.redText },
  input:      { width: '100%', borderWidth: 1.5, borderColor: C.border, borderRadius: 12, backgroundColor: C.bg, color: C.textPrimary, paddingHorizontal: 14, paddingVertical: 12, letterSpacing: 2, marginBottom: 14 },
  errorBox:   { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.redLight, borderRadius: 10, padding: 10, marginBottom: 12 },
  errorText:  { flex: 1, color: C.redText },
  dangerBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.redText, borderRadius: 14, paddingVertical: 15, width: '100%' },
  dangerText: { color: '#fff', fontWeight: '700' },
  cancelBtn:  { alignItems: 'center', justifyContent: 'center', paddingVertical: 15, marginTop: 6, width: '100%' },
  cancelText: { color: C.textSecondary, fontWeight: '700' },
});
