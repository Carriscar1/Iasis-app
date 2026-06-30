import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Switch, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../store';
import { Colors, Radius, Shadows } from '../theme';
import ConfirmAction from '../components/ConfirmAction';

export default function DeviceScreen() {
  const { width } = useWindowDimensions();
  const { mqttConnected, humidity, temperature, mqttLog, addMqttLog } = useStore();
  const [vibrateOn, setVibrateOn] = useState(false);
  const isTablet  = width >= 768;
  const isDesktop = width >= 1024;
  const maxW = isDesktop ? 900 : isTablet ? 680 : undefined;
  const fs   = isDesktop ? 15 : isTablet ? 14 : 13;

  const sendCmd = (cmd: string) => {
    addMqttLog({ direction: 'out', payload: `CMD: ${cmd}` });
    setTimeout(() => addMqttLog({ direction: 'in', payload: `ACK: ${cmd}_OK` }), 600);
  };

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { fontSize: fs }]}>{label}</Text>
      {children}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { fontSize: isDesktop ? 26 : isTablet ? 24 : 22 }]}>Dispenser IoT</Text>
        <Text style={[styles.subtitle, { fontSize: fs - 1 }]}>IASIS-01 · ESP32</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32, alignItems: maxW ? 'center' : undefined }}>
        <View style={{ width: '100%', maxWidth: maxW, paddingHorizontal: 16 }}>

          {/* Status */}
          <Text style={[styles.section, { fontSize: fs - 2 }]}>Conexão MQTT</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={[styles.iconBox, { backgroundColor: mqttConnected ? '#E1F5EE' : '#FCEBEB', width: isTablet ? 50 : 44, height: isTablet ? 50 : 44 }]}>
                <Ionicons name="hardware-chip" size={isTablet ? 24 : 20} color={mqttConnected ? '#0F6E56' : '#A32D2D'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { fontSize: fs + 1 }]}>IASIS-01</Text>
                <Text style={[styles.cardSub, { fontSize: fs - 2 }]}>Firmware v2.1.0</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: mqttConnected ? '#E1F5EE' : '#FCEBEB' }]}>
                <View style={[styles.dot, { backgroundColor: mqttConnected ? '#0F6E56' : '#A32D2D' }]} />
                <Text style={[styles.badgeText, { color: mqttConnected ? '#0F6E56' : '#A32D2D', fontSize: fs - 2 }]}>
                  {mqttConnected ? 'Online' : 'Offline'}
                </Text>
              </View>
            </View>
            <View style={styles.divider} />
            <Row label="Tópico MQTT">
              <Text style={[styles.rowValue, { fontSize: fs - 2, fontFamily: 'monospace' }]}>iasis/dispenser/01</Text>
            </Row>
          </View>

          {/* Sensores — lado a lado em tablet/desktop */}
          <Text style={[styles.section, { fontSize: fs - 2 }]}>Sensores DHT22</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {[
              { icon: 'water',        label: 'Umidade',      val: humidity > 0 ? `${humidity}%` : '--',    color: '#185FA5', status: humidity > 0 ? humidity <= 60 ? '✓ Ideal' : '⚠ Alta' : 'Aguardando' },
              { icon: 'thermometer',  label: 'Temperatura',  val: temperature > 0 ? `${temperature}°C` : '--', color: '#854F0B', status: temperature > 0 ? temperature <= 30 ? '✓ Normal' : '⚠ Quente' : 'Aguardando' },
            ].map(s => (
              <View key={s.label} style={[styles.sensorCard, { flex: 1 }]}>
                <Ionicons name={s.icon as any} size={isTablet ? 22 : 18} color={s.color} />
                <Text style={[styles.sensorLabel, { fontSize: fs - 2 }]}>{s.label}</Text>
                <Text style={[styles.sensorValue, { fontSize: isTablet ? 28 : 24 }]}>{s.val}</Text>
                <Text style={[styles.sensorStatus, { fontSize: fs - 3 }]}>{s.status}</Text>
              </View>
            ))}
          </View>

          {/* Pulseira */}
          <Text style={[styles.section, { fontSize: fs - 2 }]}>Pulseira RFID</Text>
          <View style={styles.card}>
            <Row label="Status">
              <View style={[styles.badge, { backgroundColor: '#E1F5EE' }]}>
                <Text style={[styles.badgeText, { color: '#0F6E56', fontSize: fs - 2 }]}>Registrada</Text>
              </View>
            </Row>
            <View style={styles.divider} />
            <Row label="Vibração manual">
              <Switch value={vibrateOn} onValueChange={v => { setVibrateOn(v); sendCmd(v ? 'VIBRATE_ON' : 'VIBRATE_OFF'); }}
                trackColor={{ false: Colors.border, true: '#0F6E56' }} thumbColor="#fff" />
            </Row>
          </View>

          {/* Controles — confirmação inline (sem pop-up de janela) */}
          <Text style={[styles.section, { fontSize: fs - 2 }]}>Controles remotos</Text>
          <View style={styles.card}>
            <Row label="Motor NEMA 17">
              <ConfirmAction
                label="Dispensar teste" confirmLabel="Dispensar"
                onConfirm={() => sendCmd('DISPENSE slot:1')}
                bg="#E1F5EE" txtColor="#0F6E56" disabled={!mqttConnected} fs={fs - 2}
              />
            </Row>
            <View style={styles.divider} />
            <Row label="Sensores">
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#F1F5F9' }]}
                onPress={() => sendCmd('STATUS_REQ')}
                disabled={!mqttConnected}
              >
                <Text style={[styles.actionBtnText, { color: '#64748B', fontSize: fs - 2 }]}>Atualizar</Text>
              </TouchableOpacity>
            </Row>
            <View style={styles.divider} />
            <Row label="ESP32">
              <ConfirmAction
                label="Reiniciar" confirmLabel="Reiniciar"
                onConfirm={() => sendCmd('RESTART')}
                bg="#FCEBEB" txtColor="#A32D2D" disabled={!mqttConnected} fs={fs - 2}
              />
            </Row>
          </View>

          {/* Log MQTT */}
          <Text style={[styles.section, { fontSize: fs - 2 }]}>Log MQTT em tempo real</Text>
          <View style={styles.logBox}>
            {mqttLog.length === 0
              ? <Text style={[styles.logEmpty, { fontSize: fs - 3 }]}>Aguardando mensagens do ESP32...</Text>
              : mqttLog.slice(0, 30).map(e => (
                <Text key={e.id} style={[styles.logLine, { color: e.direction === 'out' ? '#FAC775' : '#5DCAA5', fontSize: fs - 3 }]}>
                  {e.direction === 'out' ? '→' : '←'} [{e.ts}] {e.payload}
                </Text>
              ))
            }
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header:   { backgroundColor: '#1C2B4B', paddingHorizontal: 16, paddingBottom: 16, paddingTop: 10 },
  title:    { fontWeight: '700', color: '#fff' },
  subtitle: { color: 'rgba(255,255,255,.6)', marginTop: 4 },
  section:  { fontWeight: '700', color: Colors.textSecondary, marginTop: 20, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  card:     { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, ...Shadows.sm },
  row:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  rowLabel: { color: Colors.textSecondary },
  rowValue: { fontWeight: '500', color: Colors.textPrimary },
  iconBox:  { borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitle:{ fontWeight: '600', color: Colors.textPrimary },
  cardSub:  { color: Colors.textSecondary, marginTop: 2 },
  badge:    { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  dot:      { width: 7, height: 7, borderRadius: 4 },
  badgeText:{ fontWeight: '600' },
  divider:  { height: 0.5, backgroundColor: Colors.border, marginHorizontal: 14 },
  sensorCard: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 14, borderWidth: 0.5, borderColor: Colors.border, gap: 4, ...Shadows.sm },
  sensorLabel: { color: Colors.textSecondary, marginTop: 6 },
  sensorValue: { fontWeight: '700', color: Colors.textPrimary },
  sensorStatus:{ color: Colors.textMuted },
  actionBtn:     { borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  actionBtnText: { fontWeight: '600' },
  logBox:   { backgroundColor: '#1C2B4B', borderRadius: Radius.md, padding: 12, minHeight: 140 },
  logLine:  { fontFamily: 'monospace', lineHeight: 20 },
  logEmpty: { color: 'rgba(255,255,255,.35)', fontFamily: 'monospace' },
});
