import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows } from '../theme';
import { useStore } from '../store';
import {
  getAdherence, getAdherenceInsights, computeStreak, listRecentDoses,
  type AdherenceSummary, type AdherenceInsights,
} from '../services/data';
import type { Dose } from '../types';
import { exportAdherenceReport } from '../services/report';
import { DonutChart, DayBars, RateBars, Legend } from '../components/Charts';

const PERIODS = [
  { days: 7,  label: '7 dias'  },
  { days: 30, label: '30 dias' },
  { days: 90, label: '3 meses' },
] as const;

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function ReportsScreen() {
  const { width } = useWindowDimensions();
  const isTablet  = width >= 768;
  const isDesktop = width >= 1024;
  const maxW      = isDesktop ? 820 : isTablet ? 680 : undefined;
  const chartW    = Math.min(width, maxW ?? width) - 32 - 36; // padding da tela + do card

  const user = useStore((s) => s.user);

  const [days, setDays]         = useState<number>(7);
  const [summary, setSummary]   = useState<AdherenceSummary | null>(null);
  const [insights, setInsights] = useState<AdherenceInsights | null>(null);
  const [recent, setRecent]     = useState<Dose[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting]   = useState(false);

  const load = useCallback(async (period: number) => {
    if (!user) { setLoading(false); return; }
    const [a, i, r] = await Promise.all([
      getAdherence(user.id, period),
      getAdherenceInsights(user.id, period),
      listRecentDoses(user.id, 40),
    ]);
    setSummary(a.data);
    setInsights(i.data);
    setRecent(r.data ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useFocusEffect(useCallback(() => { setLoading(true); load(days); }, [load, days]));

  const changePeriod = (d: number) => { setDays(d); setLoading(true); load(d); };

  const handleExport = async () => {
    if (!summary || !user) return;
    setExporting(true);
    await exportAdherenceReport({
      userName:    user.name,
      periodLabel: `últimos ${days} dias`,
      adherence:   summary,
      recent,
      insights:    insights ?? undefined,
    });
    setExporting(false);
  };

  const streak    = summary ? computeStreak(summary.byDay) : 0;
  const onTime    = summary ? summary.taken - summary.late : 0;
  const evaluated = summary ? summary.taken + summary.missed : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { fontSize: isTablet ? 24 : 22 }]}>Relatórios</Text>
          <Text style={styles.subtitle}>Como está a sua adesão ao tratamento</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, maxW ? { maxWidth: maxW, alignSelf: 'center', width: '100%' } : null]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(days); }} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Seletor de período */}
        <View style={styles.segment}>
          {PERIODS.map((p) => {
            const active = days === p.days;
            return (
              <TouchableOpacity
                key={p.days}
                style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                onPress={() => changePeriod(p.days)}
                activeOpacity={0.8}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{p.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading ? (
          <View style={{ paddingVertical: 60, alignItems: 'center' }}>
            <ActivityIndicator color={Colors.navy} />
          </View>
        ) : !summary || summary.total === 0 ? (
          <View style={styles.card}>
            <View style={{ alignItems: 'center', paddingVertical: 24, gap: 10 }}>
              <Ionicons name="bar-chart-outline" size={44} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>Ainda sem dados neste período</Text>
              <Text style={styles.emptyText}>
                Cadastre um tratamento na Agenda e os gráficos aparecem aqui conforme as doses
                forem sendo tomadas.
              </Text>
            </View>
          </View>
        ) : (
          <>
            {/* Adesão geral */}
            <View style={[styles.card, { alignItems: 'center' }]}>
              <Text style={styles.cardTitle}>Adesão geral</Text>
              <View style={{ marginVertical: 8 }}>
                <DonutChart percentage={summary.percentage} />
              </View>
              <View style={styles.statRow}>
                <Stat label="No horário" value={onTime}         color={Colors.greenText} />
                <Stat label="Com atraso" value={summary.late}   color={Colors.amberText} />
                <Stat label="Perdidas"   value={summary.missed} color={Colors.redText} />
              </View>
              {streak > 0 && (
                <View style={styles.streakPill}>
                  <Text style={{ fontSize: 15 }}>🔥</Text>
                  <Text style={styles.streakText}>
                    {streak} {streak === 1 ? 'dia seguido' : 'dias seguidos'} sem falhar
                  </Text>
                </View>
              )}
            </View>

            {/* Doses por dia */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Doses por dia</Text>
              <Text style={styles.cardHint}>Altura da barra = doses agendadas no dia</Text>
              <View style={{ marginTop: 14 }}>
                <DayBars data={summary.byDay} width={chartW} />
              </View>
              <Legend
                items={[
                  { color: Colors.green,      label: 'Tomadas' },
                  { color: Colors.red,        label: 'Perdidas' },
                  { color: Colors.borderSoft, label: 'Pendentes' },
                ]}
              />
            </View>

            {/* Por horário */}
            {insights && insights.byHour.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Adesão por horário</Text>
                <Text style={styles.cardHint}>Em quais horas do dia o tratamento é mais seguido</Text>
                <View style={{ marginTop: 16 }}>
                  <RateBars
                    data={insights.byHour.map((h) => ({
                      label: `${String(h.hour).padStart(2, '0')}h`,
                      total: h.total,
                      taken: h.taken,
                    }))}
                  />
                </View>
                {insights.worstHour && insights.bestHour &&
                 insights.worstHour.hour !== insights.bestHour.hour && (
                  <View style={styles.insightBox}>
                    <Ionicons name="bulb-outline" size={18} color={Colors.amberText} />
                    <Text style={styles.insightText}>
                      O horário das{' '}
                      <Text style={{ fontWeight: '700' }}>
                        {String(insights.worstHour.hour).padStart(2, '0')}h
                      </Text>{' '}
                      é o mais esquecido ({insights.worstHour.rate}% de adesão). Vale reforçar o
                      lembrete nesse horário.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Por dia da semana */}
            {insights && insights.byWeekday.some((w) => w.total > 0) && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Adesão por dia da semana</Text>
                <View style={{ marginTop: 16 }}>
                  <RateBars
                    data={insights.byWeekday
                      .filter((w) => w.total > 0)
                      .map((w) => ({
                        label: WEEKDAY_LABELS[w.weekday],
                        total: w.total,
                        taken: w.taken,
                      }))}
                  />
                </View>
              </View>
            )}

            {/* Resumo textual + exportar */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Resumo do período</Text>
              <Text style={styles.summaryText}>
                Foram <Text style={styles.b}>{summary.total}</Text> doses agendadas nos últimos{' '}
                <Text style={styles.b}>{days}</Text> dias.{' '}
                {evaluated > 0 ? (
                  <>
                    Dessas, <Text style={styles.b}>{summary.taken}</Text> foram tomadas
                    {summary.late > 0 ? ` (${summary.late} com atraso)` : ''} e{' '}
                    <Text style={styles.b}>{summary.missed}</Text> foram perdidas.
                  </>
                ) : (
                  'As doses ainda não chegaram no horário.'
                )}
              </Text>

              <TouchableOpacity
                style={[styles.exportBtn, exporting && { opacity: 0.6 }]}
                onPress={handleExport}
                disabled={exporting}
                activeOpacity={0.85}
              >
                {exporting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="share-outline" size={18} color="#fff" />
                    <Text style={styles.exportText}>Exportar relatório</Text>
                  </>
                )}
              </TouchableOpacity>
              <Text style={styles.exportHint}>
                Gera um relatório para levar ao médico ou compartilhar com a família.
              </Text>
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
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
  title:    { color: '#fff', fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 2 },
  scroll:   { padding: 16, gap: 14 },

  segment: {
    flexDirection: 'row', backgroundColor: Colors.borderSoft,
    borderRadius: Radius.md, padding: 4, gap: 4,
  },
  segmentBtn: { flex: 1, paddingVertical: 9, borderRadius: Radius.sm, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: Colors.surface, ...Shadows.sm },
  segmentText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  segmentTextActive: { color: Colors.navy, fontWeight: '700' },

  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: 18, ...Shadows.sm,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  cardHint:  { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },

  statRow:   { flexDirection: 'row', width: '100%', marginTop: 12 },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  streakPill: {
    flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 16,
    backgroundColor: Colors.amberLight, borderRadius: Radius.full,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  streakText: { fontSize: 13, fontWeight: '700', color: Colors.amberText },

  insightBox: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 16,
    backgroundColor: Colors.amberLight, borderRadius: Radius.md, padding: 12,
  },
  insightText: { flex: 1, fontSize: 13.5, color: Colors.amberText, lineHeight: 19 },

  summaryText: { fontSize: 15, color: Colors.textSecondary, lineHeight: 23, marginTop: 10 },
  b: { fontWeight: '800', color: Colors.textPrimary },

  exportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.navy, borderRadius: Radius.md, paddingVertical: 14, marginTop: 18,
  },
  exportText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  exportHint: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginTop: 8 },

  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  emptyText:  { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, paddingHorizontal: 10 },
});
