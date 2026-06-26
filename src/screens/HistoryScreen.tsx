import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows } from '../theme';

const WEEK = [
  { day:'Seg', pct:100 },{ day:'Ter', pct:75 },{ day:'Qua', pct:100 },
  { day:'Qui', pct:100 },{ day:'Sex', pct:50  },{ day:'Sáb', pct:100 },{ day:'Dom', pct:0   },
];

const HISTORY = [
  { id:'1', med:'Losartana 50mg',     time:'Hoje 14:00',    status:'taken',  delay:0  },
  { id:'2', med:'Metformina 500mg',   time:'Hoje 12:00',    status:'taken',  delay:0  },
  { id:'3', med:'Omeprazol 20mg',     time:'Hoje 08:00',    status:'taken',  delay:0  },
  { id:'4', med:'Atorvastatina 40mg', time:'Ontem 22:18',   status:'late',   delay:18 },
  { id:'5', med:'Losartana 50mg',     time:'Ontem 14:00',   status:'taken',  delay:0  },
  { id:'6', med:'Metformina 500mg',   time:'Ontem 12:00',   status:'missed', delay:0  },
];

type Period = '7d' | '30d' | '3m';

const sc = (s: string) =>
  s === 'taken' ? '#0F6E56' : s === 'late' ? '#854F0B' : '#A32D2D';
const sl = (d: typeof HISTORY[0]) =>
  d.status === 'taken' ? 'No horário' : d.status === 'late' ? `+${d.delay} min` : 'Perdida';
const sb = (s: string) =>
  s === 'taken' ? '#E1F5EE' : s === 'late' ? '#FAEEDA' : '#FCEBEB';

export default function HistoryScreen() {
  const { width } = useWindowDimensions();
  const isTablet  = width >= 768;
  const isDesktop = width >= 1024;
  const maxW = isDesktop ? 900 : isTablet ? 680 : undefined;
  const fs   = isDesktop ? 15 : isTablet ? 14 : 13;
  const [period, setPeriod] = useState<Period>('7d');

  const taken  = HISTORY.filter(d => d.status === 'taken').length;
  const late   = HISTORY.filter(d => d.status === 'late').length;
  const missed = HISTORY.filter(d => d.status === 'missed').length;
  const pct    = Math.round(((taken + late) / HISTORY.length) * 100);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { fontSize: isDesktop ? 26 : isTablet ? 24 : 22 }]}>Histórico</Text>
        <Text style={[styles.subtitle, { fontSize: fs - 1 }]}>Adesão ao tratamento</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32, alignItems: maxW ? 'center' : undefined }}>
        <View style={{ width: '100%', maxWidth: maxW, paddingHorizontal: 16 }}>

          {/* Seletor período */}
          <View style={styles.periodRow}>
            {(['7d','30d','3m'] as Period[]).map(p => (
              <TouchableOpacity key={p} style={[styles.periodBtn, period === p && styles.periodActive]} onPress={() => setPeriod(p)}>
                <Text style={[styles.periodLabel, { fontSize: fs - 2 }, period === p && styles.periodLabelActive]}>
                  {p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : '3 meses'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Score */}
          <View style={styles.scoreCard}>
            <Text style={[styles.scoreLabel, { fontSize: fs - 1 }]}>Adesão geral</Text>
            <Text style={[styles.scoreValue, { fontSize: isDesktop ? 72 : isTablet ? 64 : 56, color: pct >= 80 ? '#5DCAA5' : '#FAC775' }]}>{pct}%</Text>
            <Text style={[styles.scoreSub, { fontSize: fs - 1 }]}>{taken + late} de {HISTORY.length} doses tomadas</Text>
          </View>

          {/* Métricas */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
            {[
              { label:'No horário', val: taken,  color:'#0F6E56' },
              { label:'Atrasadas',  val: late,   color:'#854F0B' },
              { label:'Perdidas',   val: missed, color:'#A32D2D' },
            ].map(m => (
              <View key={m.label} style={[styles.metricBox, { flex: 1 }]}>
                <Text style={[styles.metricVal, { fontSize: isTablet ? 28 : 22, color: m.color }]}>{m.val}</Text>
                <Text style={[styles.metricLabel, { fontSize: fs - 3 }]}>{m.label}</Text>
              </View>
            ))}
          </View>

          {/* Gráfico de barras */}
          <Text style={[styles.sectionTitle, { fontSize: fs - 2 }]}>Semana atual</Text>
          <View style={styles.barCard}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: isTablet ? 140 : 110, gap: 6 }}>
              {WEEK.map(d => (
                <View key={d.day} style={{ flex: 1, alignItems: 'center', height: '100%' }}>
                  <Text style={{ fontSize: 9, color: Colors.textMuted, marginBottom: 3 }}>{d.pct > 0 ? `${d.pct}%` : ''}</Text>
                  <View style={{ flex: 1, width: '100%', justifyContent: 'flex-end', backgroundColor: Colors.borderSoft, borderRadius: 6 }}>
                    <View style={{ width: '100%', height: `${d.pct}%`, borderRadius: 6, minHeight: d.pct > 0 ? 4 : 0,
                      backgroundColor: d.pct === 100 ? '#0F6E56' : d.pct >= 50 ? '#1C2B4B' : '#FCEBEB' }} />
                  </View>
                  <Text style={{ fontSize: 10, color: Colors.textSecondary, marginTop: 5 }}>{d.day}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Linha do tempo */}
          <Text style={[styles.sectionTitle, { fontSize: fs - 2 }]}>Linha do tempo</Text>
          <View style={styles.timelineCard}>
            {HISTORY.map((d, idx) => (
              <View key={d.id}>
                <View style={styles.tlRow}>
                  <View style={[styles.tlDot, { backgroundColor: sc(d.status), width: isTablet ? 12 : 10, height: isTablet ? 12 : 10, borderRadius: isTablet ? 6 : 5 }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.tlMed, { fontSize: fs }]}>{d.med}</Text>
                    <Text style={[styles.tlTime, { fontSize: fs - 2 }]}>{d.time} · Pulseira RFID</Text>
                  </View>
                  <View style={[styles.tlBadge, { backgroundColor: sb(d.status) }]}>
                    <Text style={[styles.tlBadgeText, { color: sc(d.status), fontSize: fs - 3 }]}>{sl(d)}</Text>
                  </View>
                </View>
                {idx < HISTORY.length - 1 && <View style={styles.tlLine} />}
              </View>
            ))}
          </View>

          {/* Exportar */}
          <TouchableOpacity style={styles.exportBtn}>
            <Ionicons name="download-outline" size={isTablet ? 20 : 17} color="#fff" />
            <Text style={[styles.exportText, { fontSize: fs }]}>Exportar relatório PDF</Text>
          </TouchableOpacity>
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
