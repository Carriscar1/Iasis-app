import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Spacing, Radius, Shadows } from '../theme';

const W = Dimensions.get('window').width - 64;

// Dados de exemplo para o TCC (substituir por Supabase depois)
const mockWeek = [
  { day: 'Seg', pct: 100 },
  { day: 'Ter', pct: 75  },
  { day: 'Qua', pct: 100 },
  { day: 'Qui', pct: 100 },
  { day: 'Sex', pct: 50  },
  { day: 'Sáb', pct: 100 },
  { day: 'Dom', pct: 0   },
];

const mockHistory = [
  { id: '1', med: 'Losartana 50mg',    time: 'Hoje 14:00',     status: 'taken',  delay: 0  },
  { id: '2', med: 'Metformina 500mg',  time: 'Hoje 12:00',     status: 'taken',  delay: 0  },
  { id: '3', med: 'Omeprazol 20mg',    time: 'Hoje 08:00',     status: 'taken',  delay: 0  },
  { id: '4', med: 'Atorvastatina 40mg',time: 'Ontem 22:18',    status: 'late',   delay: 18 },
  { id: '5', med: 'Losartana 50mg',    time: 'Ontem 14:00',    status: 'taken',  delay: 0  },
  { id: '6', med: 'Metformina 500mg',  time: 'Ontem 12:00',    status: 'missed', delay: 0  },
];

type Period = '7d' | '30d' | '3m';

export default function HistoryScreen() {
  const [period, setPeriod] = useState<Period>('7d');

  const taken  = mockHistory.filter(d => d.status === 'taken').length;
  const late   = mockHistory.filter(d => d.status === 'late').length;
  const missed = mockHistory.filter(d => d.status === 'missed').length;
  const total  = mockHistory.length;
  const pct    = Math.round(((taken + late) / total) * 100);

  const statusColor = (s: string) =>
    s === 'taken' ? Colors.greenText : s === 'late' ? Colors.amberText : Colors.redText;
  const statusLabel = (d: typeof mockHistory[0]) =>
    d.status === 'taken' ? 'No horário' : d.status === 'late' ? `+${d.delay} min` : 'Perdida';

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Histórico</Text>
        <Text style={styles.subtitle}>Adesão ao tratamento</Text>
      </View>

      {/* Seletor de período */}
      <View style={styles.periodRow}>
        {(['7d', '30d', '3m'] as Period[]).map(p => (
          <TouchableOpacity
            key={p}
            style={[styles.periodBtn, period === p && styles.periodActive]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[styles.periodLabel, period === p && styles.periodLabelActive]}>
              {p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : '3 meses'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* Score */}
        <View style={styles.scoreCard}>
          <Text style={styles.scoreLabel}>Adesão geral</Text>
          <Text style={[styles.scoreValue, { color: pct >= 80 ? '#5DCAA5' : '#FAC775' }]}>
            {pct}%
          </Text>
          <Text style={styles.scoreSub}>{taken + late} de {total} doses tomadas</Text>
        </View>

        {/* Resumo */}
        <View style={styles.metricsRow}>
          {[
            { label: 'No horário', value: taken,  color: Colors.greenText  },
            { label: 'Atrasadas',  value: late,   color: Colors.amberText  },
            { label: 'Perdidas',   value: missed,  color: Colors.redText    },
          ].map(m => (
            <View key={m.label} style={styles.metricBox}>
              <Text style={[styles.metricVal, { color: m.color }]}>{m.value}</Text>
              <Text style={styles.metricLabel}>{m.label}</Text>
            </View>
          ))}
        </View>

        {/* Gráfico de barras manual */}
        <Text style={styles.sectionTitle}>Semana atual</Text>
        <View style={styles.barCard}>
          <View style={styles.barChart}>
            {mockWeek.map(d => (
              <View key={d.day} style={styles.barCol}>
                <Text style={styles.barPct}>{d.pct > 0 ? `${d.pct}%` : ''}</Text>
                <View style={styles.barTrack}>
                  <View style={[
                    styles.barFill,
                    {
                      height: `${d.pct}%`,
                      backgroundColor: d.pct === 100 ? Colors.greenText : d.pct >= 50 ? Colors.navy : Colors.redLight,
                    },
                  ]} />
                </View>
                <Text style={styles.barDay}>{d.day}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Linha do tempo */}
        <Text style={styles.sectionTitle}>Linha do tempo</Text>
        <View style={styles.timelineCard}>
          {mockHistory.map((d, idx) => (
            <View key={d.id}>
              <View style={styles.timelineRow}>
                <View style={[styles.dot, { backgroundColor: statusColor(d.status) }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.tlMed}>{d.med}</Text>
                  <Text style={styles.tlTime}>{d.time} · Pulseira RFID</Text>
                </View>
                <View style={[styles.tlBadge, { backgroundColor:
                  d.status === 'taken' ? Colors.greenLight :
                  d.status === 'late'  ? Colors.amberLight : Colors.redLight
                }]}>
                  <Text style={[styles.tlBadgeText, { color: statusColor(d.status) }]}>
                    {statusLabel(d)}
                  </Text>
                </View>
              </View>
              {idx < mockHistory.length - 1 && <View style={styles.tlLine} />}
            </View>
          ))}
        </View>

        {/* Exportar */}
        <TouchableOpacity style={styles.exportBtn}>
          <Ionicons name="download-outline" size={18} color="#fff" />
          <Text style={styles.exportText}>Exportar relatório PDF</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:     { flex: 1, backgroundColor: Colors.bg },
  header:   { backgroundColor: Colors.navy, paddingHorizontal: Spacing.md, paddingBottom: Spacing.lg, paddingTop: Spacing.md },
  title:    { fontSize: Fonts.sizes.xl, fontWeight: '700', color: '#fff' },
  subtitle: { fontSize: Fonts.sizes.sm, color: 'rgba(255,255,255,.6)', marginTop: 4 },

  periodRow: {
    flexDirection: 'row', margin: Spacing.md, marginBottom: Spacing.xs,
    backgroundColor: Colors.surface, borderRadius: Radius.sm, padding: 3,
    borderWidth: 0.5, borderColor: Colors.border,
  },
  periodBtn:        { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  periodActive:     { backgroundColor: Colors.navy },
  periodLabel:      { fontSize: Fonts.sizes.xs, fontWeight: '500', color: Colors.textSecondary },
  periodLabelActive:{ color: '#fff' },

  scoreCard: {
    backgroundColor: Colors.navy, borderRadius: Radius.md,
    marginHorizontal: Spacing.md, marginBottom: Spacing.sm,
    alignItems: 'center', paddingVertical: Spacing.xl, ...Shadows.md,
  },
  scoreLabel: { fontSize: Fonts.sizes.sm, color: 'rgba(255,255,255,.6)' },
  scoreValue: { fontSize: 64, fontWeight: '800', marginVertical: 4 },
  scoreSub:   { fontSize: Fonts.sizes.sm, color: 'rgba(255,255,255,.5)' },

  metricsRow: {
    flexDirection: 'row', gap: Spacing.xs,
    marginHorizontal: Spacing.md, marginBottom: Spacing.md,
  },
  metricBox:   { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', borderWidth: 0.5, borderColor: Colors.border },
  metricVal:   { fontSize: Fonts.sizes.xl, fontWeight: '700' },
  metricLabel: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary, marginTop: 2 },

  sectionTitle: { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.textSecondary, marginHorizontal: Spacing.md, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: Spacing.xs },

  barCard: { backgroundColor: Colors.surface, borderRadius: Radius.md, marginHorizontal: Spacing.md, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 0.5, borderColor: Colors.border, ...Shadows.sm },
  barChart: { flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 6 },
  barCol:   { flex: 1, alignItems: 'center', height: '100%' },
  barPct:   { fontSize: 8, color: Colors.textMuted, marginBottom: 2 },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end', backgroundColor: Colors.borderSoft, borderRadius: 4 },
  barFill:  { width: '100%', borderRadius: 4, minHeight: 4 },
  barDay:   { fontSize: 10, color: Colors.textSecondary, marginTop: 4 },

  timelineCard: { backgroundColor: Colors.surface, borderRadius: Radius.md, marginHorizontal: Spacing.md, marginBottom: Spacing.md, borderWidth: 0.5, borderColor: Colors.border, ...Shadows.sm },
  timelineRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md },
  dot:          { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  tlMed:        { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.textPrimary },
  tlTime:       { fontSize: Fonts.sizes.xs, color: Colors.textSecondary, marginTop: 2 },
  tlLine:       { height: 0.5, backgroundColor: Colors.border, marginLeft: 34 },
  tlBadge:      { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  tlBadgeText:  { fontSize: 11, fontWeight: '600' },

  exportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.navy, borderRadius: Radius.md,
    marginHorizontal: Spacing.md, paddingVertical: Spacing.md,
  },
  exportText: { color: '#fff', fontWeight: '600', fontSize: Fonts.sizes.sm },
});
