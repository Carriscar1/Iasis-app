import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Switch, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows } from '../theme';
import { useStore } from '../store';
import { useElderlyMode } from '../hooks/useElderly';
import { savePreferences } from '../services/preferences';

export default function AccessibilityScreen() {
  const { width } = useWindowDimensions();
  const maxW = width >= 1024 ? 620 : width >= 768 ? 560 : undefined;

  const role         = useStore((s) => s.user?.role);
  const largeText    = useStore((s) => s.largeText);
  const setLargeText = useStore((s) => s.setLargeText);
  const isElderly    = useElderlyMode();

  const [saving, setSaving] = useState(false);

  const toggle = async (value: boolean) => {
    setSaving(true);
    setLargeText(value);                 // aplica na hora
    await savePreferences({ largeText: value });
    setSaving(false);
  };

  // Perfil paciente já usa o modo fácil por padrão — não dá para desligar.
  const lockedOn = role === 'patient';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Acessibilidade</Text>
          <Text style={styles.subtitle}>Deixe o app mais fácil de usar</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, maxW ? { maxWidth: maxW, alignSelf: 'center', width: '100%' } : null]}>
        {/* Modo fácil */}
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.iconBox}>
              <Ionicons name="text" size={22} color={Colors.navy} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Modo fácil</Text>
              <Text style={styles.rowDesc}>
                Letras maiores e botões mais largos em todo o aplicativo.
              </Text>
            </View>
            <Switch
              value={isElderly}
              onValueChange={toggle}
              disabled={lockedOn || saving}
              trackColor={{ false: Colors.border, true: Colors.blueLight }}
              thumbColor={isElderly ? Colors.navy : '#f4f3f4'}
            />
          </View>

          {lockedOn && (
            <View style={styles.note}>
              <Ionicons name="information-circle" size={16} color={Colors.textSecondary} />
              <Text style={styles.noteText}>
                Contas de paciente já usam o modo fácil sempre ligado.
              </Text>
            </View>
          )}
        </View>

        {/* Prévia ao vivo */}
        <View style={styles.card}>
          <Text style={styles.previewLabel}>Como fica</Text>
          <View style={styles.previewBox}>
            <Text style={[styles.previewTitle, { fontSize: isElderly ? 24 : 18 }]}>
              Losartana 50mg
            </Text>
            <Text style={[styles.previewSub, { fontSize: isElderly ? 17 : 14 }]}>
              Hoje às 08:00
            </Text>
            <TouchableOpacity
              style={[styles.previewBtn, { paddingVertical: isElderly ? 18 : 13 }]}
              activeOpacity={0.85}
            >
              <Text style={[styles.previewBtnText, { fontSize: isElderly ? 19 : 15 }]}>
                {isElderly ? '✅ Já tomei' : 'Marcar como tomada'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.hint}>
          A preferência fica guardada neste aparelho.
        </Text>
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
  title:    { color: '#fff', fontWeight: '800', fontSize: 20 },
  subtitle: { color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 2 },
  scroll:   { padding: 16, gap: 14 },

  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 18, ...Shadows.sm },
  row:  { flexDirection: 'row', alignItems: 'center', gap: 13 },
  iconBox: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.borderSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  rowTitle: { fontSize: 16.5, fontWeight: '700', color: Colors.textPrimary },
  rowDesc:  { fontSize: 13.5, color: Colors.textSecondary, marginTop: 3, lineHeight: 19 },

  note: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 14, backgroundColor: Colors.bg, borderRadius: 10, padding: 11 },
  noteText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },

  previewLabel: { fontSize: 12.5, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  previewBox: { backgroundColor: Colors.bg, borderRadius: Radius.md, padding: 18, borderWidth: 1, borderColor: Colors.border },
  previewTitle: { fontWeight: '800', color: Colors.textPrimary },
  previewSub:   { color: Colors.textSecondary, marginTop: 4 },
  previewBtn:   { backgroundColor: Colors.navy, borderRadius: 14, alignItems: 'center', marginTop: 16 },
  previewBtnText: { color: '#fff', fontWeight: '700' },

  hint: { fontSize: 12.5, color: Colors.textMuted, textAlign: 'center', marginTop: 4 },
});
