import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useStore } from '../store';
import { Colors, Radius, Shadows } from '../theme';
import { APP_META, FOOTER_LABEL } from '../config/app';

export default function AboutScreen() {
  const { width } = useWindowDimensions();
  const isTablet  = width >= 768;
  const isDesktop = width >= 1024;
  const role      = useStore((s) => s.user?.role);
  const isElderly = role === 'patient';
  const maxW = isDesktop ? 720 : isTablet ? 600 : undefined;
  const fs   = (isDesktop ? 15 : 14) + (isElderly ? 3 : 0);

  // Conteúdo adaptado ao perfil: o paciente (idoso) recebe passos simples
  // e concretos; demais perfis recebem a explicação técnica do sistema.
  const steps = isElderly
    ? [
        { icon: 'time',          title: 'Veja seu próximo remédio', desc: 'Na tela inicial aparece, em letras grandes, qual remédio tomar e a que horas.' },
        { icon: 'watch',         title: 'A pulseira avisa',         desc: 'No horário, sua pulseira vibra para lembrar você de tomar o remédio.' },
        { icon: 'checkmark-done', title: 'Confirme que tomou',      desc: 'Toque em "Marcar como tomada" na agenda. Pronto, seu cuidador é avisado.' },
        { icon: 'people',        title: 'Seu cuidador acompanha',   desc: 'Quem cuida de você vê se os remédios estão sendo tomados certinho.' },
      ]
    : [
        { icon: 'calendar',  title: 'Agenda de doses',     desc: 'Cadastre seus medicamentos, horários e o dia de início do tratamento.' },
        { icon: 'cube',      title: 'Aparelho organizador', desc: 'Guarda os remédios e libera a dose certa na hora marcada.' },
        { icon: 'watch',     title: 'Pulseira de lembrete', desc: 'Vibra no horário e confirma que o remédio foi pego.' },
        { icon: 'bar-chart', title: 'Acompanhamento',       desc: 'Veja seu histórico e quanto você vem seguindo o tratamento.' },
      ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={[styles.title, { fontSize: isDesktop ? 26 : isTablet ? 24 : 22 }]}>Sobre o IASIS</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60, alignItems: maxW ? 'center' : undefined }}>
        <View style={{ width: '100%', maxWidth: maxW, paddingHorizontal: 16, paddingTop: 20 }}>

          {/* Marca */}
          <View style={styles.brandCard}>
            <Text style={styles.brandLogo}>💙</Text>
            <Text style={[styles.brandName, { fontSize: isElderly ? 38 : 34 }]}>iasis</Text>
            <Text style={[styles.brandTag, { fontSize: fs - 1 }]}>{APP_META.tagline}</Text>
            <View style={styles.versionPill}>
              <Text style={[styles.versionText, { fontSize: fs - 3 }]}>versão {APP_META.version}</Text>
            </View>
          </View>

          <Text style={[styles.lead, { fontSize: fs }]}>
            {isElderly
              ? 'O IASIS ajuda você a tomar seus remédios na hora certa, com a ajuda da sua pulseira e do seu cuidador.'
              : 'O IASIS ajuda você a tomar os remédios no horário certo, unindo o aplicativo, um aparelho organizador de doses e uma pulseira que avisa a hora.'}
          </Text>

          <Text style={[styles.section, { fontSize: fs - 2 }]}>Como funciona</Text>
          <View style={styles.card}>
            {steps.map((s, i) => (
              <View key={s.title}>
                <View style={styles.stepRow}>
                  <View style={styles.stepIcon}>
                    <Ionicons name={s.icon as any} size={isElderly ? 24 : 20} color={Colors.navy} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.stepTitle, { fontSize: fs }]}>{s.title}</Text>
                    <Text style={[styles.stepDesc, { fontSize: fs - 2 }]}>{s.desc}</Text>
                  </View>
                </View>
                {i < steps.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </View>

          <Text style={[styles.section, { fontSize: fs - 2 }]}>Projeto</Text>
          <View style={styles.card}>
            <Info label="Trabalho" value={`TCC ${APP_META.year}`} fs={fs} />
            <View style={styles.divider} />
            <Info label="Instituição" value="ETEC Bento Quirino" fs={fs} />
            <View style={styles.divider} />
            <Info label="Versão" value={APP_META.version} fs={fs} />
          </View>

          <Text style={[styles.disclaimer, { fontSize: fs - 3 }]}>
            ⚠️ O catálogo de remédios é educacional e não substitui a orientação de um médico ou farmacêutico.
          </Text>

          <Text style={[styles.footer, { fontSize: fs - 3 }]}>{FOOTER_LABEL}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Info({ label, value, fs }: { label: string; value: string; fs: number }) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { fontSize: fs - 1 }]}>{label}</Text>
      <Text style={[styles.infoValue, { fontSize: fs - 1 }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header:    { backgroundColor: Colors.navy, paddingHorizontal: 16, paddingBottom: 16, paddingTop: 10 },
  backBtn:   { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,.14)', alignItems: 'center', justifyContent: 'center' },
  title:     { fontWeight: '700', color: '#fff' },
  brandCard: { alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.lg, paddingVertical: 28, ...Shadows.sm, marginBottom: 18 },
  brandLogo: { fontSize: 44 },
  brandName: { fontWeight: '800', color: Colors.navy, letterSpacing: -1, marginTop: 8 },
  brandTag:  { color: Colors.textSecondary, marginTop: 2 },
  versionPill:{ marginTop: 12, backgroundColor: Colors.borderSoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 5 },
  versionText:{ color: Colors.textSecondary, fontWeight: '600' },
  lead:      { color: Colors.textSecondary, lineHeight: 24, marginBottom: 8 },
  section:   { fontWeight: '700', color: Colors.textSecondary, marginTop: 20, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  card:      { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, ...Shadows.sm },
  stepRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  stepIcon:  { width: 42, height: 42, borderRadius: 12, backgroundColor: Colors.borderSoft, alignItems: 'center', justifyContent: 'center' },
  stepTitle: { fontWeight: '700', color: Colors.textPrimary },
  stepDesc:  { color: Colors.textSecondary, marginTop: 3, lineHeight: 19 },
  divider:   { height: 0.5, backgroundColor: Colors.border, marginLeft: 14 },
  infoRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  infoLabel: { color: Colors.textSecondary },
  infoValue: { fontWeight: '600', color: Colors.textPrimary },
  disclaimer:{ color: Colors.textMuted, lineHeight: 18, marginTop: 18, textAlign: 'center' },
  footer:    { textAlign: 'center', color: Colors.textMuted, marginTop: 18 },
});
