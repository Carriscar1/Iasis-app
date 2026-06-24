import React, { useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, FlatList, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useStore, selectMqttLog } from '../store';
import { useMqtt } from '../hooks/useMqtt';
import { Colors, Fonts, Spacing, Radius, Shadows } from '../theme';
import { Card, Pill, SectionHeader, Button, Divider } from '../components/ui';

export default function DeviceScreen() {
  const { dispenser, mqttConnected, mqttLog } = useStore();
  const { dispense, setVibrate, requestStatus, restart } = useMqtt();
  const logRef = useRef<FlatList>(null);

  const handleDispenseTest = () => {
    Alert.alert(
      'Dispensar teste',
      'Isso vai acionar o motor NEMA 17 no slot 1. Confirma?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Dispensar',
          onPress: () => dispense(1, `test_${Date.now()}`),
        },
      ]
    );
  };

  const handleRestart = () => {
    Alert.alert(
      'Reiniciar ESP32',
      'O dispenser vai reiniciar e reconectar em ~10s.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Reiniciar', style: 'destructive', onPress: restart },
      ]
    );
  };

  const sensorColor = (humidity: number) =>
    humidity <= 60 ? Colors.greenText : humidity <= 70 ? Colors.amberText : Colors.redText;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Dispenser IoT</Text>
        <Text style={styles.subtitle}>{dispenser?.name ?? 'IASIS-01'} · ESP32</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Status card */}
        <SectionHeader title="Status da conexão" />
        <Card>
          <View style={styles.statusRow}>
            <View style={[styles.statusIcon, { backgroundColor: mqttConnected ? Colors.greenLight : Colors.redLight }]}>
              <Ionicons
                name="hardware-chip"
                size={22}
                color={mqttConnected ? Colors.greenText : Colors.redText}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.deviceName}>{dispenser?.name ?? 'IASIS-01'}</Text>
              <Text style={styles.deviceMeta}>
                Firmware {dispenser?.firmware ?? '—'} · MQTT
              </Text>
            </View>
            <Pill
              label={mqttConnected ? 'Online' : 'Offline'}
              variant={mqttConnected ? 'success' : 'error'}
              dot
            />
          </View>

          <Divider style={{ marginVertical: Spacing.sm }} />

          <View style={styles.metaGrid}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Protocolo</Text>
              <Text style={styles.metaValue}>MQTT / WS</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Última sync</Text>
              <Text style={styles.metaValue}>
                {dispenser?.lastSeen
                  ? new Date(dispenser.lastSeen).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                  : '—'}
              </Text>
            </View>
          </View>
        </Card>

        {/* Sensores DHT22 */}
        <SectionHeader title="Sensores DHT22" />
        <View style={styles.sensorRow}>
          <Card style={[styles.sensorCard, { marginRight: 0 }]}>
            <Ionicons name="water" size={20} color="#185FA5" />
            <Text style={styles.sensorLabel}>Umidade</Text>
            <Text style={[styles.sensorValue, { color: sensorColor(dispenser?.sensors.humidity ?? 0) }]}>
              {dispenser?.sensors.humidity ?? '--'}%
            </Text>
            <Text style={styles.sensorStatus}>
              {dispenser?.sensors.humidity
                ? dispenser.sensors.humidity <= 60 ? '✓ Ideal' : '⚠ Alta'
                : 'Aguardando'}
            </Text>
          </Card>
          <Card style={[styles.sensorCard, { marginLeft: 6 }]}>
            <Ionicons name="thermometer" size={20} color={Colors.amberText} />
            <Text style={styles.sensorLabel}>Temperatura</Text>
            <Text style={styles.sensorValue}>
              {dispenser?.sensors.temperature ?? '--'}°C
            </Text>
            <Text style={styles.sensorStatus}>
              {dispenser?.sensors.temperature
                ? dispenser.sensors.temperature <= 30 ? '✓ Normal' : '⚠ Quente'
                : 'Aguardando'}
            </Text>
          </Card>
        </View>

        {/* Pulseira RFID */}
        <SectionHeader title="Pulseira RFID" />
        <Card>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>ID da Tag</Text>
            <Text style={[styles.infoValue, { fontFamily: 'Courier New' }]}>
              {dispenser?.rfid.lastRead ?? 'Nenhuma leitura'}
            </Text>
          </View>
          <Divider style={{ marginVertical: Spacing.xs }} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Última leitura</Text>
            <Text style={styles.infoValue}>
              {dispenser?.rfid.lastReadAt
                ? new Date(dispenser.rfid.lastReadAt).toLocaleTimeString('pt-BR')
                : '—'}
            </Text>
          </View>
          <Divider style={{ marginVertical: Spacing.xs }} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Vibração manual</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                label="Ligar"
                variant="secondary"
                onPress={() => setVibrate(true, 'gentle')}
                style={{ paddingVertical: 8, paddingHorizontal: 14 }}
                textStyle={{ fontSize: Fonts.sizes.sm }}
              />
              <Button
                label="Desligar"
                variant="ghost"
                onPress={() => setVibrate(false)}
                style={{ paddingVertical: 8, paddingHorizontal: 14 }}
                textStyle={{ fontSize: Fonts.sizes.sm }}
              />
            </View>
          </View>
        </Card>

        {/* Controles */}
        <SectionHeader title="Controles remotos" />
        <Card>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Motor NEMA 17</Text>
            <Button
              label="Dispensar teste"
              variant="secondary"
              onPress={handleDispenseTest}
              disabled={!mqttConnected}
              style={{ paddingVertical: 8, paddingHorizontal: 14 }}
              textStyle={{ fontSize: Fonts.sizes.sm }}
            />
          </View>
          <Divider style={{ marginVertical: Spacing.xs }} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status sensores</Text>
            <Button
              label="Atualizar"
              variant="ghost"
              onPress={requestStatus}
              disabled={!mqttConnected}
              style={{ paddingVertical: 8, paddingHorizontal: 14 }}
              textStyle={{ fontSize: Fonts.sizes.sm }}
            />
          </View>
          <Divider style={{ marginVertical: Spacing.xs }} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>ESP32</Text>
            <Button
              label="Reiniciar"
              variant="danger"
              onPress={handleRestart}
              disabled={!mqttConnected}
              style={{ paddingVertical: 8, paddingHorizontal: 14 }}
              textStyle={{ fontSize: Fonts.sizes.sm }}
            />
          </View>
        </Card>

        {/* Log MQTT */}
        <SectionHeader title="Log MQTT" action="Limpar" onAction={() => {}} />
        <View style={styles.logContainer}>
          {mqttLog.length === 0 ? (
            <Text style={styles.logEmpty}>Aguardando mensagens...</Text>
          ) : (
            mqttLog.slice(0, 30).map(entry => (
              <Text key={entry.id} style={[
                styles.logLine,
                { color: entry.direction === 'out' ? '#FAC775' : '#5DCAA5' }
              ]}>
                {entry.direction === 'out' ? '→' : '←'} [{entry.ts}] {entry.payload}
              </Text>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.bg },
  header:  { backgroundColor: Colors.navy, paddingHorizontal: Spacing.md, paddingBottom: Spacing.lg, paddingTop: Spacing.md },
  title:   { fontSize: Fonts.sizes.xl, fontWeight: '700', color: Colors.white },
  subtitle: { fontSize: Fonts.sizes.sm, color: 'rgba(255,255,255,.6)', marginTop: 4 },

  statusRow:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  statusIcon:  { width: 46, height: 46, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  deviceName:  { fontSize: Fonts.sizes.base, fontWeight: '600', color: Colors.textPrimary },
  deviceMeta:  { fontSize: Fonts.sizes.xs, color: Colors.textSecondary, marginTop: 2 },

  metaGrid:  { flexDirection: 'row', gap: Spacing.md },
  metaItem:  { flex: 1 },
  metaLabel: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary },
  metaValue: { fontSize: Fonts.sizes.sm, fontWeight: '500', color: Colors.textPrimary, marginTop: 2 },

  sensorRow:  { flexDirection: 'row', paddingHorizontal: Spacing.md, gap: 0, marginBottom: Spacing.xs },
  sensorCard: { flex: 1, marginHorizontal: 0, gap: 4 },
  sensorLabel:  { fontSize: Fonts.sizes.xs, color: Colors.textSecondary, marginTop: 4 },
  sensorValue:  { fontSize: Fonts.sizes.xl, fontWeight: '700', color: Colors.textPrimary },
  sensorStatus: { fontSize: Fonts.sizes.xs, color: Colors.textMuted },

  infoRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 36 },
  infoLabel: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary },
  infoValue: { fontSize: Fonts.sizes.sm, fontWeight: '500', color: Colors.textPrimary },

  logContainer: {
    marginHorizontal: Spacing.md,
    backgroundColor:  Colors.navy,
    borderRadius:     Radius.md,
    padding:          Spacing.sm,
    marginBottom:     Spacing.sm,
    minHeight:        160,
  },
  logLine:  { fontSize: 11, fontFamily: 'Courier New', lineHeight: 20 },
  logEmpty: { fontSize: Fonts.sizes.xs, color: 'rgba(255,255,255,.4)', fontFamily: 'Courier New' },
});
