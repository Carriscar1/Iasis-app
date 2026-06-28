import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, useWindowDimensions, Alert as RNAlert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows } from '../theme';
import { useStore } from '../store';
import { getPatientsOverview, type PatientOverview } from '../services/data';
import type { DoseStatus } from '../types';

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const STATUS_DOT: Record<DoseStatus, string> = {
  taken: '#0F6E56', late: '#854F0B', missed: '#A32D2D',
  due: '#854F0B', upcoming: '#185FA5', pending: '#94A3B8',
};

const adherenceColor = (pct: number) =>
  pct >= 80 ? '#0F6E56' : pct >= 50 ? '#854F0B' : '#A32D2D';

export default function CaregiverScreen() {
  const { width } = useWindowDimensions();
  const isTablet  = width >= 768;
  const isDesktop = width >= 1024;
  const maxW      = isDesktop ? 860 : isTablet ? 680 : undefined;
  const fs        = isDesktop ? 15 : isTablet ? 14 : 13;

  const user = useStore((s) => s.user);

  const [items, setItems]     = useState<PatientOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const { data, error } = await getPatientsOverview(user.id);
    if (error) RNAlert.alert('Erro', error);
    setItems(data);
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { fontSize: isDesktop ? 26 : isTablet ? 24 : 22 }]}>Meus pacientes</Text>
            <Text style={[styles.subtitle, { fontSize: fs - 1 }]}>
              {items.length} {items.length === 1 ? 'paciente vinculado' : 'pacientes vinculados'}
            </Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.navy} /></View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40, alignItems: maxW ? 'center' : undefined }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={{ width: '100%', maxWidth: maxW, paddingHorizontal: 16, paddingTop: 16 }}>

            {items.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="people-outline" size={42} color={Colors.textMuted} />
                <Text style={[styles.emptyTitle, { fontSize: fs }]}>Nenhum paciente vinculado</Text>
                <Text style={[styles.emptySub, { fontSize: fs - 2 }]}>
                  Um paciente aparece aqui quando se cadastra informando o seu e-mail de cuidador.
                </Text>
              </View>
            ) : (
              items.map(({ patient, today, adherence }) => {
                const taken   = today.filter((d) => d.status === 'taken' || d.status === 'late').length;
                const pending = today.filter((d) => ['pending', 'upcoming', 'due'].includes(d.status)).length;
                const missed  = today.filter((d) => d.status === 'missed').length;
                const isOpen  = expanded === patient.id;
                const pct     = adherence.percentage;

                return (
                  <View key={patient.id} style={styles.card}>
                    <TouchableOpacity
                      style={styles.cardHead}
                      onPress={() => setExpanded(isOpen ? null : patient.id)}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.avatar, { width: isTablet ? 50 : 44, height: isTablet ? 50 : 44, borderRadius: isTablet ? 25 : 22 }]}>
                        <Text style={{ color: '#fff', fontWeight: '800', fontSize: isTablet ? 20 : 17 }}>
                          {patient.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.patientName, { fontSize: fs + 1 }]}>{patient.name}</Text>
                        <Text style={[styles.patientEmail, { fontSize: fs - 2 }]}>{patient.email}</Text>
                      </View>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={[styles.adhPct, { color: adherenceColor(pct), fontSize: isTablet ? 22 : 19 }]}>{pct}%</Text>
                        <Text style={[styles.adhLabel, { fontSize: fs - 4 }]}>adesão 7d</Text>
                      </View>
                      <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textMuted} />
                    </TouchableOpacity>

                    {/* Resumo de hoje */}
                    <View style={styles.statsRow}>
                      {[
                        { val: taken,   label: 'Tomadas',   color: '#0F6E56' },
                        { val: pending, label: 'Pendentes', color: '#185FA5' },
                        { val: missed,  label: 'Perdidas',  color: '#A32D2D' },
                      ].map((s, i) => (
                        <React.Fragment key={s.label}>
                          {i > 0 && <View style={styles.statDivider} />}
                          <View style={styles.statItem}>
                            <Text style={[styles.statNum, { color: s.color, fontSize: isTablet ? 20 : 18 }]}>{s.val}</Text>
                            <Text style={[styles.statLabel, { fontSize: fs - 3 }]}>{s.label}</Text>
                          </View>
                        </React.Fragment>
                      ))}
                    </View>

                    {/* Doses de hoje (expandido) */}
                    {isOpen && (
                      <View style={styles.dosesBox}>
                        <Text style={[styles.dosesTitle, { fontSize: fs - 2 }]}>Doses de hoje</Text>
                        {today.length === 0 ? (
                          <Text style={[styles.noDoses, { fontSize: fs - 1 }]}>Sem doses agendadas para hoje.</Text>
                        ) : (
                          today.map((d) => (
                            <View key={d.id} style={styles.doseRow}>
                              <View style={[styles.doseDot, { backgroundColor: STATUS_DOT[d.status] }]} />
                              <Text style={[styles.doseTime, { fontSize: fs - 1 }]}>{fmtTime(d.scheduledAt)}</Text>
                              <Text style={[styles.doseName, { fontSize: fs - 1 }]} numberOfLines={1}>
                                {d.medication ? `${d.medication.name} ${d.medication.dosage}` : 'Medicamento'}
                              </Text>
                            </View>
                          ))
                        )}
                      </View>
                    )}
                  </View>
                );
              })
            )}

            <Text style={[styles.hint, { fontSize: fs - 3 }]}>
              Visualização somente leitura. Puxe para baixo para atualizar.
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header:    { backgroundColor: '#1C2B4B', paddingHorizontal: 16, paddingBottom: 16, paddingTop: 10 },
  backBtn:   { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,.14)', alignItems: 'center', justifyContent: 'center' },
  title:     { fontWeight: '700', color: '#fff' },
  subtitle:  { color: 'rgba(255,255,255,.6)', marginTop: 3 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyCard: { alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 32, gap: 8, ...Shadows.sm },
  emptyTitle:{ fontWeight: '700', color: Colors.textPrimary, marginTop: 4 },
  emptySub:  { color: Colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  card:      { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, marginBottom: 12, ...Shadows.sm, overflow: 'hidden' },
  cardHead:  { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  avatar:    { backgroundColor: '#2E4A7A', alignItems: 'center', justifyContent: 'center' },
  patientName:  { fontWeight: '700', color: Colors.textPrimary },
  patientEmail: { color: Colors.textSecondary, marginTop: 2 },
  adhPct:    { fontWeight: '800' },
  adhLabel:  { color: Colors.textMuted, marginTop: 1 },
  statsRow:  { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: Colors.border, paddingVertical: 12, backgroundColor: '#FAFBFD' },
  statItem:  { flex: 1, alignItems: 'center' },
  statNum:   { fontWeight: '700' },
  statLabel: { color: Colors.textSecondary, marginTop: 2 },
  statDivider:{ width: 0.5, backgroundColor: Colors.border },
  dosesBox:  { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 14, borderTopWidth: 0.5, borderTopColor: Colors.border },
  dosesTitle:{ fontWeight: '700', color: Colors.textSecondary, marginVertical: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  noDoses:   { color: Colors.textMuted, paddingVertical: 6 },
  doseRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  doseDot:   { width: 9, height: 9, borderRadius: 5 },
  doseTime:  { fontWeight: '700', color: Colors.textPrimary, width: 46 },
  doseName:  { color: Colors.textSecondary, flex: 1 },
  hint:      { textAlign: 'center', color: Colors.textMuted, marginTop: 8 },
});
