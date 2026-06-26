import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows } from '../theme';

const DOSES = [
  { id:'1', time:'08:00', name:'Omeprazol 20mg',     instruction:'Antes do café',   status:'taken'   },
  { id:'2', time:'12:00', name:'Metformina 500mg',   instruction:'Com o almoço',    status:'taken'   },
  { id:'3', time:'14:00', name:'Losartana 50mg',     instruction:'Pressão arterial',status:'upcoming'},
  { id:'4', time:'22:00', name:'Atorvastatina 40mg', instruction:'Colesterol',      status:'pending' },
];

const CFG: Record<string,{label:string;bg:string;tc:string;icon:string}> = {
  taken:    { label:'Tomada',  bg:'#E1F5EE', tc:'#0F6E56', icon:'checkmark-circle' },
  late:     { label:'Atraso',  bg:'#FAEEDA', tc:'#854F0B', icon:'time'             },
  missed:   { label:'Perdida', bg:'#FCEBEB', tc:'#A32D2D', icon:'close-circle'     },
  upcoming: { label:'Em breve',bg:'#E6F1FB', tc:'#185FA5', icon:'alarm'            },
  pending:  { label:'Aguarda', bg:'#F1F5F9', tc:'#64748B', icon:'ellipse-outline'  },
};

export default function ScheduleScreen() {
  const { width } = useWindowDimensions();
  const isTablet  = width >= 768;
  const isDesktop = width >= 1024;
  const maxW      = isDesktop ? 900 : isTablet ? 680 : undefined;
  const fs        = isDesktop ? 15 : isTablet ? 14 : 13;
  const [sel, setSel] = useState<typeof DOSES[0]|null>(null);

  const taken   = DOSES.filter(d => d.status === 'taken').length;
  const pending = DOSES.filter(d => ['pending','upcoming'].includes(d.status)).length;
  const missed  = DOSES.filter(d => d.status === 'missed').length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { fontSize: isDesktop ? 26 : isTablet ? 24 : 22 }]}>Agenda de Doses</Text>
        <Text style={[styles.subtitle, { fontSize: fs - 1 }]}>
          {new Date().toLocaleDateString('pt-BR',{ weekday:'long', day:'numeric', month:'long' })}
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32, alignItems: maxW ? 'center' : undefined }}
      >
        <View style={{ width: '100%', maxWidth: maxW, paddingHorizontal: 16 }}>

          {/* Resumo */}
          <View style={styles.summaryCard}>
            {[
              { val: taken,   label: 'Tomadas',   color: '#0F6E56' },
              { val: pending, label: 'Pendentes',  color: '#185FA5' },
              { val: missed,  label: 'Perdidas',   color: '#A32D2D' },
            ].map((s, i) => (
              <React.Fragment key={s.label}>
                {i > 0 && <View style={styles.summaryDivider} />}
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryNum, { color: s.color, fontSize: isTablet ? 28 : 24 }]}>{s.val}</Text>
                  <Text style={[styles.summaryLabel, { fontSize: fs - 2 }]}>{s.label}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { fontSize: fs - 2, marginTop: 20 }]}>Doses de hoje</Text>

          {DOSES.map(dose => {
            const cfg = CFG[dose.status];
            return (
              <TouchableOpacity
                key={dose.id}
                style={[styles.doseCard, dose.status === 'upcoming' && { borderColor: '#93B4DA', backgroundColor: '#F0F6FF' }]}
                onPress={() => setSel(dose)}
                activeOpacity={0.8}
              >
                <View style={[styles.doseIcon, { backgroundColor: cfg.bg, width: isTablet ? 50 : 44, height: isTablet ? 50 : 44, borderRadius: isTablet ? 15 : 12 }]}>
                  <Ionicons name={cfg.icon as any} size={isTablet ? 24 : 20} color={cfg.tc} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.doseTime, { fontSize: fs - 2 }]}>{dose.time}</Text>
                  <Text style={[styles.doseName, { fontSize: fs + 1 }]}>{dose.name}</Text>
                  <Text style={[styles.doseInstr, { fontSize: fs - 2 }]}>{dose.instruction}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
                  <Text style={[styles.badgeText, { color: cfg.tc, fontSize: fs - 3 }]}>{cfg.label}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <Modal visible={!!sel} transparent animationType="slide" onRequestClose={() => setSel(null)}>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { padding: isTablet ? 32 : 24, maxWidth: maxW ?? '100%', width: '100%', alignSelf: 'center' }]}>
            <View style={styles.handle} />
            {sel && (
              <>
                <Text style={[styles.sheetTitle, { fontSize: isTablet ? 22 : 19 }]}>{sel.name}</Text>
                <Text style={[styles.sheetSub, { fontSize: fs }]}>{sel.time} · {sel.instruction}</Text>
                {[
                  { label: 'Status',    val: CFG[sel.status].label },
                  { label: 'Validação', val: 'Pulseira RFID' },
                ].map(r => (
                  <View key={r.label} style={styles.sheetRow}>
                    <Text style={[styles.sheetLabel, { fontSize: fs }]}>{r.label}</Text>
                    <Text style={[styles.sheetValue, { fontSize: fs }]}>{r.val}</Text>
                  </View>
                ))}
                <TouchableOpacity style={[styles.closeBtn, { paddingVertical: isTablet ? 16 : 13 }]} onPress={() => setSel(null)}>
                  <Text style={[styles.closeBtnText, { fontSize: fs }]}>Fechar</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header:   { backgroundColor: '#1C2B4B', paddingHorizontal: 16, paddingBottom: 16, paddingTop: 10 },
  title:    { fontWeight: '700', color: '#fff' },
  subtitle: { color: 'rgba(255,255,255,.6)', marginTop: 4 },
  summaryCard:    { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 16, marginTop: 16, ...Shadows.md },
  summaryItem:    { flex: 1, alignItems: 'center' },
  summaryNum:     { fontWeight: '700' },
  summaryLabel:   { color: Colors.textSecondary, marginTop: 3 },
  summaryDivider: { width: 0.5, backgroundColor: Colors.border },
  sectionTitle:   { fontWeight: '700', color: Colors.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  doseCard:  { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface, borderRadius: Radius.md, marginBottom: 10, padding: 14, borderWidth: 0.5, borderColor: Colors.border, ...Shadows.sm },
  doseIcon:  { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  doseTime:  { color: Colors.textSecondary },
  doseName:  { fontWeight: '600', color: Colors.textPrimary, marginTop: 1 },
  doseInstr: { color: Colors.textSecondary, marginTop: 2 },
  badge:     { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontWeight: '600' },
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,.5)', justifyContent: 'flex-end' },
  sheet:     { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, alignSelf: 'center' },
  handle:    { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 20 },
  sheetTitle:{ fontWeight: '700', color: Colors.textPrimary },
  sheetSub:  { color: Colors.textSecondary, marginTop: 4, marginBottom: 16 },
  sheetRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  sheetLabel:{ color: Colors.textSecondary },
  sheetValue:{ fontWeight: '500', color: Colors.textPrimary },
  closeBtn:  { marginTop: 20, backgroundColor: Colors.borderSoft ?? '#F1F5F9', borderRadius: 12, alignItems: 'center' },
  closeBtnText: { fontWeight: '600', color: Colors.textPrimary },
});
