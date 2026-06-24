import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart } from 'react-native-chart-kit';

import { useStore } from '../store';
import { getDosesRange, computeAdherence } from '../services/firebase';
import { Colors, Fonts, Spacing, Radius, Shadows } from '../theme';
import { Card, SectionHeader, Pill, MetricCard } from '../components/ui';
import { Dose, DoseStatus } from '../types';

const W = Dimensions.get('window').width - Spacing.md * 2 - 32;

type Period = '7d' | '30d' | '3m';

const periodLabel: Record<Period, string> = {
  '7d':  '7 dias',
  '30d': '30 dias',
  '3m':  '3 meses',
};

export default function HistoryScreen() {
  const { user } = useStore();
  const [period,   setPeriod]   = useState<Period>('7d');
  const [doses,    setDoses]    = useState<Dose[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (!user) return;
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const from = subDays(new Date(), days);
    setLoading(true);
    getDosesRange(user.uid, from, new Date()).then(d => {
      setDoses(d);
      setLoading(false);
    });
  }, [period, user?.uid]);

  const total    = doses.length;
  const taken    = doses.filter(d => d.status === 'taken').length;
  const late     = doses.filter(d => d.status === 'late').length;
  const missed   = doses.filter(d => d.status === 'missed').length;
  const pct      = computeAdherence(doses);

  // Dados do gráfico (últimos 7 dias simplificado)
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const day = subDays(new Date(), 6 - i);
    const dayStr = format(day, 'yyyy-MM-dd');
    const dayDoses = doses.filter(d => d.scheduledAt.startsWith(dayStr));
    const takenDay = dayDoses.filter(d => d.status === 'taken' || d.status === 'late').length;
    return {
      label: format(day, 'EEE', { locale: ptBR }).slice(0, 3),
      value: dayDoses.length > 0 ? Math.round((takenDay / dayDoses.length) * 100) : 0,
    };
  });

  const recent = doses.slice(0, 20);

  const statusLabel: Partial<Record<DoseStatus, string>> = {
    taken:   'Tomada no horário',
    late:    'Tomada com atraso',
    missed:  'Não tomada',
    pending: 'Pendente',
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Histórico</Text>
        <Text style={styles.subtitle}>Adesão ao tratamento</Text>
      </View>

      {/* Period selector */}
      <View style={styles.periodRow}>
        {(['7d', '30d', '3m'] as Period[]).map(p => (
          <TouchableOpacity
            key={p}
            style={[styles.periodBtn, period === p && styles.periodBtnActive]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[styles.periodLabel, period === p && styles.periodLabelActive]}>
              {periodLabel[p]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Score principal */}
        <Card style={[styles.scoreCard, { backgroundColor: Colors.navy }]}>
          <Text style={styles.scoreLabel}>Adesão geral</Text>
          <Text style={[styles.scoreValue, { color: pct >= 80 ? '#5DCAA5' : '#FAC775' }]}>
            {pct}%
          </Text>
          <Text style={styles.scoreSub}>{taken + late} de {total} doses tomadas</Text>
        </Card>

        {/* Métricas */}
        <View style={styles.metricsRow}>
          <MetricCard label="No horário" value={taken}  color={Colors.greenText}  style={styles.metricItem} />
          <MetricCard label="Atrasadas"  value={late}   color={Colors.amberText}  style={styles.metricItem} />
          <MetricCard label="Perdidas"   value={missed} color={Colors.redText}    style={styles.metricItem} />
        </View>

        {/* Gráfico */}
        <SectionHeader title="Adesão por dia (últimos 7)" />
        <Card style={{ paddingHorizontal: 0, overflow: 'hidden' }}>
          <BarChart
            data={{
              labels: last7.map(d => d.label),
              datasets: [{ data: last7.map(d => d.value) }],
            }}
            width={W}
            height={160}
            yAxisSuffix="%"
            yAxisLabel=""
            chartConfig={{
              backgroundColor:       Colors.surface,
              backgroundGradientFrom: Colors.surface,
              backgroundGradientTo:   Colors.surface,
              decimalPlaces:          0,
              color:      (opacity = 1) => `rgba(28, 43, 75, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
              style:     { borderRadius: Radius.md },
              propsForBars: { rx: '4', ry: '4' },
            }}
            style={{ borderRadius: Radius.md }}
            showValuesOnTopOfBars
            fromZero
          />
        </Card>

        {/* Linha do tempo */}
        <SectionHeader title="Linha do tempo" />
        {recent.length === 0 ? (
          <Card>
            <Text style={{ color: Colors.textSecondary, fontSize: Fonts.sizes.sm, textAlign: 'center' }}>
              Nenhuma dose encontrada neste período.
            </Text>
          </Card>
        ) : (
          <Card style={{ gap: 0, paddingHorizontal: 0 }}>
            {recent.map((dose, idx) => (
              <View key={dose.id}>
                <View style={styles.timelineItem}>
                  <View style={[styles.timelineDot, {
                    backgroundColor:
                      dose.status === 'taken'  ? Colors.greenText :
                      dose.status === 'late'   ? Colors.amberText :
                      dose.status === 'missed' ? Colors.redText   : Colors.textMuted,
                  }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.timelineName}>
                      {dose.medication?.name ?? 'Medicamento'}
                    </Text>
                    <Text style={styles.timelineMeta}>
                      {format(new Date(dose.scheduledAt), "d/MM 'às' HH:mm")}
                      {dose.validatedBy === 'rfid' ? ' · Pulseira RFID' : ''}
                    </Text>
                  </View>
                  <Pill
                    label={
                      dose.status === 'taken'  ? 'No horário' :
                      dose.status === 'late'   ? `+${dose.delayMinutes ?? '?'} min` :
                      dose.status === 'missed' ? 'Perdida' : dose.status
                    }
                    variant={
                      dose.status === 'taken'  ? 'success' :
                      dose.status === 'late'   ? 'warning' :
                      dose.status === 'missed' ? 'error'   : 'neutral'
                    }
                  />
                </View>
                {idx < recent.length - 1 && <View style={styles.timelineLine} />}
              </View>
            ))}
          </Card>
        )}

        {/* Exportar */}
        <SectionHeader title="Relatório" />
        <Card>
          <Text style={{ fontSize: Fonts.sizes.sm, color: Colors.textSecondary, marginBottom: Spacing.sm }}>
            Exporte o histórico para compartilhar com seu médico ou cuidador.
          </Text>
          <TouchableOpacity style={styles.exportBtn}>
            <Ionicons name="download-outline" size={18} color={Colors.white} />
            <Text style={styles.exportText}>Exportar PDF</Text>
          </TouchableOpacity>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.bg },
  header:  { backgroundColor: Colors.navy, paddingHorizontal: Spacing.md, paddingBottom: Spacing.lg, paddingTop: Spacing.md },
  title:   { fontSize: Fonts.sizes.xl, fontWeight: '700', color: Colors.white },
  subtitle:{ fontSize: Fonts.sizes.sm, color: 'rgba(255,255,255,.6)', marginTop: 4 },

  periodRow: {
    flexDirection:    'row',
    marginHorizontal: Spacing.md,
    marginTop:        Spacing.md,
    marginBottom:     Spacing.xs,
    backgroundColor:  Colors.surface,
    borderRadius:     Radius.sm,
    padding:          3,
    borderWidth:      0.5,
    borderColor:      Colors.border,
  },
  periodBtn:       { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  periodBtnActive: { backgroundColor: Colors.navy },
  periodLabel:      { fontSize: Fonts.sizes.xs, fontWeight: '500', color: Colors.textSecondary },
  periodLabelActive:{ color: Colors.white },

  scoreCard:   { alignItems: 'center', padding: Spacing.xl },
  scoreLabel:  { fontSize: Fonts.sizes.sm, color: 'rgba(255,255,255,.6)', fontWeight: '500' },
  scoreValue:  { fontSize: 64, fontWeight: '800', marginVertical: Spacing.xs },
  scoreSub:    { fontSize: Fonts.sizes.sm, color: 'rgba(255,255,255,.5)' },

  metricsRow:  { flexDirection: 'row', gap: Spacing.xs, paddingHorizontal: Spacing.md, marginBottom: Spacing.xs },
  metricItem:  { flex: 1 },

  timelineItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  timelineDot:  { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  timelineLine: { height: 0.5, backgroundColor: Colors.border, marginLeft: Spacing.md + 10 + Spacing.sm },
  timelineName: { fontSize: Fonts.sizes.sm, fontWeight: '500', color: Colors.textPrimary },
  timelineMeta: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary, marginTop: 2 },

  exportBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.navy, borderRadius: Radius.sm, paddingVertical: Spacing.sm },
  exportText: { color: Colors.white, fontWeight: '600', fontSize: Fonts.sizes.sm },
});
