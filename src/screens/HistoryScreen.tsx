import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  useWindowDimensions, ActivityIndicator, RefreshControl, Alert as RNAlert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows } from '../theme';
import { useStore } from '../store';
import { getAdherence, listRecentDoses, type AdherenceSummary } from '../services/data';
import type { Dose } from '../types';

type Period = '7d' | '30d' | '3m';
const DAYS: Record<Period, number> = { '7d': 7, '30d': 30, '3m': 90 };
const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const sc = (s: string) => (s === 'taken' ? '#0F6E56' : s === 'late' ? '#854F0B' : '#A32D2D');
const sb = (s: string) => (s === 'taken' ? '#E1F5EE' : s === 'late' ? '#FAEEDA' : '#FCEBEB');

const fmtWhen = (iso: string) => {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yest = new Date(today); yest.setDate(today.getDate() - 1);
  const dd = new Date(d); dd.setHours(0, 0, 0, 0);
  const t = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (dd.getTime() === today.getTime()) return `Hoje ${t}`;
  if (dd.getTime() === yest.getTime()) return `Ontem ${t}`;
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${t}`;
};

export default function HistoryScreen() {
  const { width } = useWindowDimensions();
  const isTablet  = width >= 768;
  const isDesktop = width >= 1024;
  const maxW = isDesktop ? 900 : isTablet ? 680 : undefined;
  const fs   = isDesktop ? 15 : isTablet ? 14 : 13;

  const user = useStore((s) => s.user);
  const [period, setPeriod] = useState<Period>('7d');
  const [adh, setAdh] = useState<AdherenceSummary | null>(null);
  const [recent, setRecent] = useState<Dose[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const [a, r] = await Promise.all([
      getAdherence(user.id, DAYS[period]),
      listRecentDoses(user.id, 30),
    ]);
    if (a.error) RNAlert.alert('Erro', a.error);
    setAdh(a.data);
    setRecent(r.data.filter((d) => d.takenAt || d.status === 'missed'));
    setLoading(false);
    setRefreshing(false);
  }, [user, period]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));
  const onRefresh = () => { setRefreshing(true); load(); };

  const pct    = adh?.percentage ?? 0;
  const taken  = (adh?.taken ?? 0) - (adh?.late ?? 0);
  const late   = adh?.late ?? 0;
  const missed = adh?.missed ?? 0;
  const total  = adh?.total ?? 0;
  const week   = (adh?.byDay ?? []).slice(-7);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { fontSize: isDesktop ? 26 : isTablet ? 24 : 22 }]}>Histórico</Text>
        <Text style={[styles.subtitle, { fontSize: fs - 1 }]}>Adesão ao tratamento</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32, alignItems: maxW ? 'center' : undefined }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={{ width: '100%', maxWidth: maxW, paddingHorizontal: 16 }}>

          <View style={styles.periodRow}>
            {(['7d', '30d', '3m'] as Period[]).map((p) => (
              <TouchableOpacity key={p} style={[styles.periodBtn, period === p && styles.periodActive]} onPress={() => setPeriod(p)}>
                <Text style={[styles.periodLabel, { fontSize: fs - 2 }, period === p && styles.periodLabelActive]}>
                  {p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : '3 meses'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {loading ? (
            <View style={{ paddingVertical: 60 }}><ActivityIndicator size="large" color={Colors.navy} /></View>
          ) : total === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="bar-chart-outline" size={40} color={Colors.textMuted} />
              <Text style={[styles.emptyTitle, { fontSize: fs }]}>Sem dados ainda</Text>
              <Text style={[styles.emptySub, { fontSize: fs - 2 }]}>Registre doses na Agenda para ver sua adesão aqui.</Text>
            </View>
          ) : (
            <>
              <View style={styles.scoreCard}>
                <Text style={[styles.scoreLabel, { fontSize: fs - 1 }]}>Adesão geral</Text>
                <Text style={[styles.scoreValue, { fontSize: isDesktop ? 72 : isTablet ? 64 : 56, color: pct >= 80 ? '#5DCAA5' : '#FAC775' }]}>{pct}%</Text>
                <Text style={[styles.scoreSub, { fontSize: fs - 1 }]}>{taken + late} de {total} doses tomadas</Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                {[
                  { label: 'No horário', val: taken,  color: '#0F6E56' },
                  { label: 'Atrasadas',  val: late,   color: '#854F0B' },
                  { label: 'Perdidas',   val: missed, color: '#A32D2D' },
                ].map((m) => (
                  <View key={m.label} style={[styles.metricBox, { flex: 1 }]}>
                    <Text style={[styles.metricVal, { fontSize: isTablet ? 28 : 22, color: m.color }]}>{m.val}</Text>
                    <Text style={[styles.metricLabel, { fontSize: fs - 3 }]}>{m.label}</Text>
                  </View>
                ))}
              </View>

              <Text style={[styles.sectionTitle, { fontSize: fs - 2 }]}>Últimos 7 dias</Text>
              <View style={styles.barCard}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: isTablet ? 140 : 110, gap: 6 }}>
                  {week.map((d) => {
                    const dp = d.total ? Math.round((d.taken / d.total) * 100) : 0;
                    const label = WD[new Date(d.date + 'T00:00:00').getDay()];
                    return (
                      <View key={d.date} style={{ flex: 1, alignItems: 'center', height: '100%' }}>
                        <Text style={{ fontSize: 9, color: Colors.textMuted, marginBottom: 3 }}>{d.total > 0 ? `${dp}%` : ''}</Text>
                        <View style={{ flex: 1, width: '100%', justifyContent: 'flex-end', backgroundColor: Colors.borderSoft, borderRadius: 6 }}>
                          <View style={{ width: '100%', height: `${dp}%`, borderRadius: 6, minHeight: d.total > 0 ? 4 : 0,
                            backgroundColor: dp === 100 ? '#0F6E56' : dp >= 50 ? '#1C2B4B' : '#FCEBEB' }} />
                        </View>
                        <Text style={{ fontSize: 10, color: Colors.textSecondary, marginTop: 5 }}>{label}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              <Text style={[styles.sectionTitle, { fontSize: fs - 2 }]}>Linha do tempo</Text>
              <View style={styles.timelineCard}>
                {recent.length === 0 ? (
                  <Text style={{ padding: 16, color: Colors.textSecondary, fontSize: fs - 1 }}>Nenhuma dose registrada ainda.</Text>
                ) : recent.map((d, idx) => {
                  const valid = d.validatedBy === 'rfid' ? 'Pulseira RFID' : d.validatedBy === 'caregiver' ? 'Cuidador' : d.takenAt ? 'Manual' : '—';
                  const lbl = d.status === 'late' ? `+${d.delayMinutes ?? 0} min` : d.status === 'missed' ? 'Perdida' : 'No horário';
                  return (
                    <View key={d.id}>
                      <View style={styles.tlRow}>
                        <View style={[styles.tlDot, { backgroundColor: sc(d.status), width: isTablet ? 12 : 10, height: isTablet ? 12 : 10, borderRadius: isTablet ? 6 : 5 }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.tlMed, { fontSize: fs }]}>{d.medication ? `${d.medication.name} ${d.medication.dosage}` : 'Medicamento'}</Text>
                          <Text style={[styles.tlTime, { fontSize: fs - 2 }]}>{fmtWhen(d.takenAt ?? d.scheduledAt)} · {valid}</Text>
                        </View>
                        <View style={[styles.tlBadge, { backgroundColor: sb(d.status) }]}>
                          <Text style={[styles.tlBadgeText, { color: sc(d.status), fontSize: fs - 3 }]}>{lbl}</Text>
                        </View>
                      </View>
                      {idx < recent.length - 1 && <View style={styles.tlLine} />}
                    </View>
                  );
                })}
              </View>

              <TouchableOpacity style={styles.exportBtn}>
                <Ionicons name="download-outline" size={isTablet ? 20 : 17} color="#fff" />
                <Text style={[styles.exportText, { fontSize: fs }]}>Exportar relatório PDF</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header:   { backgroundColor: '#1C2B4B', paddingHorizontal: 16, paddingBottom: 16, paddingTop: 10 },
  title:    { fontWeight: '700', color: '#fff' },
  subtitle: { color: 'rgba(255,255,255,.6)', marginTop: 4 },
  periodRow:      { flexDirection: 'row', marginTop: 16, marginBottom: 12, backgroundColor: Colors.surface, borderRadius: 10, padding: 3, borderWidth: 0.5, borderColor: Colors.border },
  periodBtn:      { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  periodActive:   { backgroundColor: '#1C2B4B' },
  periodLabel:    { fontWeight: '500', color: Colors.textSecondary },
  periodLabelActive: { color: '#fff' },
  emptyCard:  { alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 32, gap: 8, ...Shadows.sm },
  emptyTitle: { fontWeight: '700', color: Colors.textPrimary, marginTop: 4 },
  emptySub:   { color: Colors.textSecondary, textAlign: 'center' },
  scoreCard:  { backgroundColor: '#1C2B4B', borderRadius: Radius.md, alignItems: 'center', paddingVertical: 28, marginBottom: 12, ...Shadows.md },
  scoreLabel: { color: 'rgba(255,255,255,.6)' },
  scoreValue: { fontWeight: '800', marginVertical: 4 },
  scoreSub:   { color: 'rgba(255,255,255,.5)' },
  metricBox:  { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 14, alignItems: 'center', borderWidth: 0.5, borderColor: Colors.border },
  metricVal:  { fontWeight: '700' },
  metricLabel:{ color: Colors.textSecondary, marginTop: 3, textAlign: 'center' },
  sectionTitle: { fontWeight: '700', color: Colors.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  barCard:    { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 14, marginBottom: 20, borderWidth: 0.5, borderColor: Colors.border, ...Shadows.sm },
  timelineCard:{ backgroundColor: Colors.surface, borderRadius: Radius.md, marginBottom: 16, borderWidth: 0.5, borderColor: Colors.border, ...Shadows.sm },
  tlRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  tlDot:      { flexShrink: 0 },
  tlMed:      { fontWeight: '600', color: Colors.textPrimary },
  tlTime:     { color: Colors.textSecondary, marginTop: 2 },
  tlLine:     { height: 0.5, backgroundColor: Colors.border, marginLeft: 36 },
  tlBadge:    { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  tlBadgeText:{ fontWeight: '600' },
  exportBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1C2B4B', borderRadius: 12, paddingVertical: 14 },
  exportText: { color: '#fff', fontWeight: '600' },
});
