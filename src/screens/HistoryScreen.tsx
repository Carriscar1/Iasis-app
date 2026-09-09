import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Platform,
  useWindowDimensions, ActivityIndicator, RefreshControl, Alert as RNAlert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Radius, Shadows, useTheme, type ThemeColors } from '../theme';
import { useStore } from '../store';
import { getAdherence, listRecentDoses, syncOverdueDoses, type AdherenceSummary } from '../services/data';
import { exportAdherenceReport } from '../services/report';
import { exportDosesCsv } from '../services/export';
import { withCache, describeAge } from '../services/offline';
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
  const { C, styles } = useTheme(makeStyles);
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
  const [exporting, setExporting] = useState(false);
  const [csvBusy, setCsvBusy]     = useState(false);
  // RF01: quando a rede falha, a tela mostra a última cópia gravada no
  // aparelho em vez de ficar vazia — com a data de quando ela foi tirada.
  const [offlineAt, setOfflineAt] = useState<string | null>(null);

  const periodLabel =
    period === '7d' ? 'últimos 7 dias' : period === '30d' ? 'últimos 30 dias' : 'últimos 3 meses';

  const handleExport = async () => {
    if (!adh || exporting) return;
    setExporting(true);
    const res = await exportAdherenceReport({
      userName:    user?.name ?? 'Paciente',
      periodLabel,
      adherence:   adh,
      recent,
    });
    setExporting(false);
    if (!res.ok && res.error) RNAlert.alert('Exportar', res.error);
  };

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    // Grava como "missed" as doses vencidas antes de calcular a adesão.
    await syncOverdueDoses(user.id);

    const [a, r] = await Promise.all([
      withCache('adherence', user.id, () => getAdherence(user.id, DAYS[period])),
      withCache('doses',     user.id, () => listRecentDoses(user.id, 30)),
    ]);

    // Só avisa "offline" quando de fato caímos na cópia local. Um erro sem
    // cópia continua sendo erro, e aí a mensagem tem que aparecer.
    const cachedAt = a.fromCache ? a.savedAt : r.fromCache ? r.savedAt : null;
    setOfflineAt(cachedAt ?? null);

    if (a.error && !a.fromCache) RNAlert.alert('Erro', a.error);

    setAdh(a.data ?? null);
    setRecent((r.data ?? []).filter((d) => d.takenAt || d.status === 'missed'));
    setLoading(false);
    setRefreshing(false);
  }, [user, period]);

  const handleCsv = async () => {
    if (csvBusy) return;
    setCsvBusy(true);
    const res = await exportDosesCsv(recent, user?.name ?? 'Paciente');
    setCsvBusy(false);
    if (!res.ok && res.error) RNAlert.alert('Exportar doses', res.error);
  };

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));
  const onRefresh = () => { setRefreshing(true); load(); };

  const pct    = adh?.percentage ?? 0;
  const taken  = (adh?.taken ?? 0) - (adh?.late ?? 0);
  const late   = adh?.late ?? 0;
  const missed = adh?.missed ?? 0;
  const total  = adh?.total ?? 0;
  const week   = (adh?.byDay ?? []).slice(-7);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { fontSize: isDesktop ? 26 : isTablet ? 24 : 22 }]}>Histórico</Text>
            <Text style={[styles.subtitle, { fontSize: fs - 1 }]}>Adesão ao tratamento</Text>
          </View>
          <TouchableOpacity
            style={styles.chartsBtn}
            onPress={() => router.push('/reports')}
            activeOpacity={0.8}
            accessibilityLabel="Ver relatórios com gráficos"
          >
            <Ionicons name="stats-chart" size={16} color="#fff" />
            <Text style={styles.chartsBtnText}>Gráficos</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32, alignItems: maxW ? 'center' : undefined }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={{ width: '100%', maxWidth: maxW, paddingHorizontal: 16 }}>

          {/* RF01: o histórico continua legível sem internet. A faixa diz de
              quando é a cópia, para ninguém tomar decisão com dado velho
              achando que é o de agora. */}
          {offlineAt ? (
            <View style={styles.offlineBar}>
              <Ionicons name="cloud-offline-outline" size={17} color={C.amberText} />
              <Text style={[styles.offlineText, { fontSize: fs - 1 }]}>
                Sem conexão — mostrando o histórico salvo {describeAge(offlineAt)}.
              </Text>
            </View>
          ) : null}


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
            <View style={{ paddingVertical: 60 }}><ActivityIndicator size="large" color={C.navy} /></View>
          ) : total === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="bar-chart-outline" size={40} color={C.textMuted} />
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
                        <Text style={{ fontSize: 9, color: C.textMuted, marginBottom: 3 }}>{d.total > 0 ? `${dp}%` : ''}</Text>
                        <View style={{ flex: 1, width: '100%', justifyContent: 'flex-end', backgroundColor: C.borderSoft, borderRadius: 6 }}>
                          <View style={{ width: '100%', height: `${dp}%`, borderRadius: 6, minHeight: d.total > 0 ? 4 : 0,
                            backgroundColor: dp === 100 ? '#0F6E56' : dp >= 50 ? '#1C2B4B' : '#FCEBEB' }} />
                        </View>
                        <Text style={{ fontSize: 10, color: C.textSecondary, marginTop: 5 }}>{label}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              <Text style={[styles.sectionTitle, { fontSize: fs - 2 }]}>Linha do tempo</Text>
              <View style={styles.timelineCard}>
                {recent.length === 0 ? (
                  <Text style={{ padding: 16, color: C.textSecondary, fontSize: fs - 1 }}>Nenhuma dose registrada ainda.</Text>
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

              <TouchableOpacity style={[styles.exportBtn, exporting && { opacity: 0.7 }]} onPress={handleExport} disabled={exporting} activeOpacity={0.85}>
                {exporting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Ionicons name="download-outline" size={isTablet ? 20 : 17} color="#fff" />}
                <Text style={[styles.exportText, { fontSize: fs }]}>
                  {Platform.OS === 'web' ? 'Exportar relatório PDF' : 'Compartilhar relatório'}
                </Text>
              </TouchableOpacity>

              {/* O PDF é para ler; o CSV é para trabalhar em cima — abre no
                  Excel e deixa o médico filtrar, somar e cruzar dados. */}
              <TouchableOpacity
                style={[styles.csvBtn, csvBusy && { opacity: 0.7 }]}
                onPress={handleCsv}
                disabled={csvBusy || recent.length === 0}
                activeOpacity={0.85}
              >
                {csvBusy
                  ? <ActivityIndicator color={C.navy} size="small" />
                  : <Ionicons name="grid-outline" size={isTablet ? 19 : 16} color={C.navy} />}
                <Text style={[styles.csvText, { fontSize: fs }]}>
                  Exportar doses em planilha (CSV)
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  header:   { backgroundColor: '#1C2B4B', paddingHorizontal: 16, paddingBottom: 16, paddingTop: 10 },
  title:    { fontWeight: '700', color: '#fff' },
  subtitle: { color: 'rgba(255,255,255,.6)', marginTop: 4 },
  chartsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999,
  },
  chartsBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  periodRow:      { flexDirection: 'row', marginTop: 16, marginBottom: 12, backgroundColor: C.surface, borderRadius: 10, padding: 3, borderWidth: 0.5, borderColor: C.border },
  periodBtn:      { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  periodActive:   { backgroundColor: '#1C2B4B' },
  periodLabel:    { fontWeight: '500', color: C.textSecondary },
  periodLabelActive: { color: '#fff' },
  emptyCard:  { alignItems: 'center', backgroundColor: C.surface, borderRadius: Radius.md, padding: 32, gap: 8, ...Shadows.sm },
  emptyTitle: { fontWeight: '700', color: C.textPrimary, marginTop: 4 },
  emptySub:   { color: C.textSecondary, textAlign: 'center' },
  scoreCard:  { backgroundColor: '#1C2B4B', borderRadius: Radius.md, alignItems: 'center', paddingVertical: 28, marginBottom: 12, ...Shadows.md },
  scoreLabel: { color: 'rgba(255,255,255,.6)' },
  scoreValue: { fontWeight: '800', marginVertical: 4 },
  scoreSub:   { color: 'rgba(255,255,255,.5)' },
  metricBox:  { backgroundColor: C.surface, borderRadius: Radius.md, padding: 14, alignItems: 'center', borderWidth: 0.5, borderColor: C.border },
  metricVal:  { fontWeight: '700' },
  metricLabel:{ color: C.textSecondary, marginTop: 3, textAlign: 'center' },
  sectionTitle: { fontWeight: '700', color: C.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  barCard:    { backgroundColor: C.surface, borderRadius: Radius.md, padding: 14, marginBottom: 20, borderWidth: 0.5, borderColor: C.border, ...Shadows.sm },
  timelineCard:{ backgroundColor: C.surface, borderRadius: Radius.md, marginBottom: 16, borderWidth: 0.5, borderColor: C.border, ...Shadows.sm },
  tlRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  tlDot:      { flexShrink: 0 },
  tlMed:      { fontWeight: '600', color: C.textPrimary },
  tlTime:     { color: C.textSecondary, marginTop: 2 },
  tlLine:     { height: 0.5, backgroundColor: C.border, marginLeft: 36 },
  tlBadge:    { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  tlBadgeText:{ fontWeight: '600' },
  offlineBar: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    backgroundColor: C.amberLight, borderRadius: Radius.md,
    paddingHorizontal: 13, paddingVertical: 11, marginTop: 14,
  },
  offlineText: { flex: 1, color: C.amberText, lineHeight: 18 },

  csvBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    backgroundColor: C.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: C.border,
    paddingVertical: 14, marginTop: 10,
  },
  csvText: { color: C.navy, fontWeight: '700' },

  exportBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1C2B4B', borderRadius: 12, paddingVertical: 14 },
  exportText: { color: '#fff', fontWeight: '600' },
});
