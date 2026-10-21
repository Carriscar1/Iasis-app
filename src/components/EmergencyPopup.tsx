// ─────────────────────────────────────────────
//  IASIS — Aviso de emergência para o cuidador
//
//  Quando o paciente cai e não responde, ou aperta o socorro, a função
//  raise_emergency grava o alerta e ele chega aqui pelo tempo real. O aviso
//  cobre a tela inteira, vibra, e coloca a ligação a um toque: quem cuida
//  não pode ter que procurar o telefone do paciente numa hora dessas.
// ─────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Vibration, Linking, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { Radius, Shadows, useTheme, type ThemeColors } from '../theme';
import { useStore } from '../store';
import { markAlertRead } from '../services/alerts';
import { listCareTeam, type CareMember } from '../services/careTeam';
import { mapsLink } from '../services/location';
import { callPerson, callEmergencyService, EMERGENCY_NUMBERS } from '../services/call';

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return min < 1 ? `agora · ${hhmm}` : `há ${min} min · ${hhmm}`;
};

export default function EmergencyPopup() {
  const { C, styles } = useTheme(makeStyles);
  const alert = useStore((s) => s.urgentAlert);
  const setUrgentAlert = useStore((s) => s.setUrgentAlert);
  const setUnreadAlerts = useStore((s) => s.setUnreadAlerts);
  const [patient, setPatient] = useState<CareMember | null>(null);

  useEffect(() => {
    if (!alert) return;
    setPatient(null);
    // Toque longo e insistente: o celular pode estar no bolso.
    if (Platform.OS !== 'web') Vibration.vibrate([0, 800, 400, 800, 400, 800]);
    listCareTeam().then(({ data }) => {
      setPatient(data.find((m) => m.personId === alert.patientId) ?? null);
    });
    return () => Vibration.cancel();
  }, [alert?.id]);

  if (!alert) return null;

  const fall = alert.type === 'fall';
  const name = patient?.name ?? 'o paciente';
  const hasPlace = alert.latitude != null && alert.longitude != null;

  const close = async () => {
    Vibration.cancel();
    setUrgentAlert(null);
    if (!alert.read) {
      await markAlertRead(alert.id);
      setUnreadAlerts(Math.max(0, useStore.getState().unreadAlerts - 1));
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <ScrollView style={styles.backdrop} contentContainerStyle={styles.backdropContent}>
        <View style={styles.card}>
          <View style={styles.badge}>
            <Ionicons name={fall ? 'body' : 'warning'} size={44} color="#fff" />
          </View>

          <Text style={styles.kicker}>{fall ? 'POSSÍVEL QUEDA' : 'PEDIDO DE SOCORRO'}</Text>
          <Text style={styles.title}>{alert.title}</Text>
          <Text style={styles.body}>{alert.body}</Text>
          <Text style={styles.when}>{fmtTime(alert.createdAt)}</Text>

          <TouchableOpacity
            style={styles.callBtn}
            onPress={() => callPerson(patient?.name ?? 'O paciente', patient?.phone)}
            activeOpacity={0.85}
            accessibilityLabel={`Ligar para ${name}`}
          >
            <Ionicons name="call" size={22} color="#fff" />
            <Text style={styles.callText}>Ligar para {patient ? patient.name.split(' ')[0] : 'o paciente'}</Text>
          </TouchableOpacity>

          {hasPlace ? (
            <TouchableOpacity
              style={styles.secondary}
              onPress={() => Linking.openURL(mapsLink({ latitude: alert.latitude!, longitude: alert.longitude! }))}
              activeOpacity={0.85}
            >
              <Ionicons name="location" size={19} color={C.navy} />
              <Text style={styles.secondaryText}>Ver onde está no mapa</Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.row}>
            {EMERGENCY_NUMBERS.map((e) => (
              <TouchableOpacity
                key={e.number}
                style={styles.sos}
                onPress={() => callEmergencyService(e.label, e.number)}
                activeOpacity={0.85}
              >
                <Text style={styles.sosNumber}>{e.number}</Text>
                <Text style={styles.sosLabel}>{e.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.okBtn} onPress={close} activeOpacity={0.85}>
            <Text style={styles.okText}>Já estou cuidando</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={async () => { await close(); router.push('/alerts'); }}
            style={{ paddingVertical: 6 }}
          >
            <Text style={styles.link}>Ver todos os avisos</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Modal>
  );
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  backdrop:        { flex: 1, backgroundColor: 'rgba(127,29,29,0.82)' },
  backdropContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 22 },
  card: {
    width: '100%', maxWidth: 400, backgroundColor: C.surface, borderRadius: Radius.xl,
    padding: 24, alignItems: 'center', gap: 10, ...Shadows.lg,
  },
  badge: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: C.red,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  kicker: { fontSize: 12.5, fontWeight: '800', letterSpacing: 1.2, color: C.redText },
  title:  { fontSize: 22, fontWeight: '900', color: C.textPrimary, textAlign: 'center' },
  body:   { fontSize: 15.5, color: C.textSecondary, textAlign: 'center', lineHeight: 22 },
  when:   { fontSize: 13, color: C.textMuted, marginBottom: 6 },

  // Alvo grande: a ligação é a ação principal.
  callBtn: {
    width: '100%', backgroundColor: C.green, borderRadius: Radius.md, paddingVertical: 17,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  callText: { color: '#fff', fontWeight: '800', fontSize: 17 },
  secondary: {
    width: '100%', borderWidth: 1.5, borderColor: C.border, borderRadius: Radius.md, paddingVertical: 13,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  secondaryText: { color: C.navy, fontWeight: '700', fontSize: 15 },
  row: { flexDirection: 'row', gap: 10, width: '100%' },
  sos: {
    flex: 1, backgroundColor: C.redLight, borderRadius: Radius.md, paddingVertical: 11, alignItems: 'center',
  },
  sosNumber: { color: C.redText, fontWeight: '900', fontSize: 20 },
  sosLabel:  { color: C.redText, fontWeight: '700', fontSize: 12.5 },
  okBtn: {
    width: '100%', backgroundColor: C.navyBg, borderRadius: Radius.md, paddingVertical: 15,
    alignItems: 'center', marginTop: 4,
  },
  okText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  link:   { color: C.textSecondary, fontWeight: '600', fontSize: 14 },
});
