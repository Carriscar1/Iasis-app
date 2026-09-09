import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Switch, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Radius, Shadows, useTheme, type ThemeColors } from '../theme';
import { useStore } from '../store';
import { useElderlyMode } from '../hooks/useElderly';
import { savePreferences, type ThemeMode } from '../services/preferences';

export default function AccessibilityScreen() {
  const { C, styles } = useTheme(makeStyles);
  const { width } = useWindowDimensions();
  const maxW = width >= 1024 ? 620 : width >= 768 ? 560 : undefined;

  const themeMode    = useStore((s) => s.themeMode);
  const setThemeMode = useStore((s) => s.setThemeMode);
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

  const pickTheme = async (mode: ThemeMode) => {
    setThemeMode(mode);                  // aplica na hora, sem reiniciar
    await savePreferences({ theme: mode });
  };

  // Perfil paciente já usa o modo fácil por padrão — não dá para desligar.
  const lockedOn = role === 'patient';

  const THEMES: { mode: ThemeMode; icon: any; label: string; desc: string }[] = [
    { mode: 'system', icon: 'phone-portrait-outline', label: 'Seguir o aparelho',
      desc: 'Muda junto com o modo escuro do celular' },
    { mode: 'light',  icon: 'sunny-outline',  label: 'Claro',
      desc: 'Fundo branco o tempo todo' },
    { mode: 'dark',   icon: 'moon-outline',   label: 'Escuro',
      desc: 'Cansa menos a vista à noite' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Aparência</Text>
          <Text style={styles.subtitle}>Deixe o app do seu jeito</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, maxW ? { maxWidth: maxW, alignSelf: 'center', width: '100%' } : null]}>
        {/* Tema */}
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.iconBox}>
              <Ionicons name="contrast" size={22} color={C.navy} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Tema do aplicativo</Text>
              <Text style={styles.rowDesc}>
                A mudança vale na hora, sem precisar reiniciar.
              </Text>
            </View>
          </View>

          <View style={styles.themes}>
            {THEMES.map((t) => {
              const active = themeMode === t.mode;
              return (
                <TouchableOpacity
                  key={t.mode}
                  style={[styles.themeOpt, active && styles.themeOptOn]}
                  onPress={() => pickTheme(t.mode)}
                  activeOpacity={0.8}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                >
                  <Ionicons
                    name={t.icon}
                    size={21}
                    color={active ? C.navy : C.textMuted}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.themeLabel, active && { color: C.navy }]}>
                      {t.label}
                    </Text>
                    <Text style={styles.themeDesc}>{t.desc}</Text>
                  </View>
                  {active ? (
                    <Ionicons name="checkmark-circle" size={21} color={C.navy} />
                  ) : (
                    <View style={styles.radioOff} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Modo fácil */}
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.iconBox}>
              <Ionicons name="text" size={22} color={C.navy} />
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
              trackColor={{ false: C.border, true: C.blueLight }}
              thumbColor={isElderly ? C.navy : '#f4f3f4'}
            />
          </View>

          {lockedOn && (
            <View style={styles.note}>
              <Ionicons name="information-circle" size={16} color={C.textSecondary} />
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

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.navyBg, paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  title:    { color: '#fff', fontWeight: '800', fontSize: 20 },
  subtitle: { color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 2 },
  scroll:   { padding: 16, gap: 14 },

  card: { backgroundColor: C.surface, borderRadius: Radius.lg, padding: 18, ...Shadows.sm },
  row:  { flexDirection: 'row', alignItems: 'center', gap: 13 },
  iconBox: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: C.borderSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  rowTitle: { fontSize: 16.5, fontWeight: '700', color: C.textPrimary },
  rowDesc:  { fontSize: 13.5, color: C.textSecondary, marginTop: 3, lineHeight: 19 },

  note: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 14, backgroundColor: C.bg, borderRadius: 10, padding: 11 },
  noteText: { flex: 1, fontSize: 13, color: C.textSecondary, lineHeight: 18 },

  previewLabel: { fontSize: 12.5, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  previewBox: { backgroundColor: C.bg, borderRadius: Radius.md, padding: 18, borderWidth: 1, borderColor: C.border },
  previewTitle: { fontWeight: '800', color: C.textPrimary },
  previewSub:   { color: C.textSecondary, marginTop: 4 },
  previewBtn:   { backgroundColor: C.navyBg, borderRadius: 14, alignItems: 'center', marginTop: 16 },
  previewBtnText: { color: '#fff', fontWeight: '700' },

  themes: { marginTop: 14, gap: 8 },
  themeOpt: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: Radius.md, borderWidth: 1.5, borderColor: C.border,
    paddingHorizontal: 13, paddingVertical: 12,
  },
  themeOptOn: { borderColor: C.navy, backgroundColor: C.borderSoft },
  themeLabel: { fontSize: 15, fontWeight: '700', color: C.textPrimary },
  themeDesc:  { fontSize: 12.5, color: C.textSecondary, marginTop: 2 },
  radioOff: {
    width: 21, height: 21, borderRadius: 11,
    borderWidth: 1.5, borderColor: C.border,
  },

  hint: { fontSize: 12.5, color: C.textMuted, textAlign: 'center', marginTop: 4 },
});
