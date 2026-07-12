import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Switch,
  useWindowDimensions, Animated, ActivityIndicator, Easing, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../store';
import { Colors, Radius, Shadows } from '../theme';
import ConfirmAction from '../components/ConfirmAction';
import { deviceActions } from '../hooks/useDevice';
import { DEMO_WRISTBAND_TAG } from '../services/device';
import { MQTT_CONFIG } from '../config/app';
import {
  findDoseAwaitingValidation, listMedications, createMedication, createDose,
} from '../services/data';
import type { Dose } from '../types';

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export default function DeviceScreen() {
  const { width } = useWindowDimensions();
  const user = useStore((s) => s.user);
  const mqttConnected      = useStore((s) => s.mqttConnected);
  const deviceMode         = useStore((s) => s.deviceMode);
  const humidity           = useStore((s) => s.humidity);
  const temperature        = useStore((s) => s.temperature);
  const firmware           = useStore((s) => s.firmware);
  const wristbandVibrating = useStore((s) => s.wristbandVibrating);
  const lastRfid           = useStore((s) => s.lastRfid);
  const doseFlow           = useStore((s) => s.doseFlow);
  const mqttLog            = useStore((s) => s.mqttLog);

  const [nextDose, setNextDose]   = useState<Dose | null>(null);
  const [creatingDemo, setCreatingDemo] = useState(false);

  const isTablet  = width >= 768;
  const isDesktop = width >= 1024;
  const maxW = isDesktop ? 900 : isTablet ? 680 : undefined;
  const fs   = isDesktop ? 15 : isTablet ? 14 : 13;

  const isDemo = deviceMode === 'demo';

  // Dose aguardando validação (a que o fluxo fechado vai liberar)
  const loadNextDose = useCallback(async () => {
    if (!user) return;
    const { data } = await findDoseAwaitingValidation(user.id);
    setNextDose(data);
  }, [user]);

  useFocusEffect(useCallback(() => { loadNextDose(); }, [loadNextDose]));

  // Recarrega quando o ciclo termina (a dose validada sai da fila)
  useEffect(() => {
    if (doseFlow.step === 'done') loadNextDose();
  }, [doseFlow.step, loadNextDose]);

  // ── Animação de pulso da pulseira vibrando ──
  const useNative = Platform.OS !== 'web';
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (wristbandVibrating) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.25, duration: 380, easing: Easing.inOut(Easing.ease), useNativeDriver: useNative }),
          Animated.timing(pulse, { toValue: 1.0,  duration: 380, easing: Easing.inOut(Easing.ease), useNativeDriver: useNative }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
    pulse.setValue(1);
  }, [wristbandVibrating, pulse]);

  // Cria uma dose "para agora" — atalho para demonstrar o fluxo na feira
  // sem precisar montar a agenda antes.
  const handleCreateDemoDose = async () => {
    if (!user || creatingDemo) return;
    setCreatingDemo(true);
    let medId: string | null = null;
    let slot = 1;
    const meds = await listMedications(user.id);
    if (meds.data.length > 0) {
      medId = meds.data[0].id;
      slot  = meds.data[0].compartment;
    } else {
      const med = await createMedication(user.id, {
        name: 'Dipirona', dosage: '500mg', compartment: 1, instructions: 'Dose de demonstração',
      });
      medId = med.data?.id ?? null;
    }
    if (medId) {
      await createDose(user.id, { medicationId: medId, scheduledAt: new Date().toISOString() });
      await loadNextDose();
    }
    setCreatingDemo(false);
  };

  // Estado visual de cada etapa do fluxo (1-4)
  const stepState = (n: 1 | 2 | 3 | 4): 'done' | 'active' | 'pending' => {
    const s = doseFlow.step;
    if (s === 'idle')       return 'pending';
    if (s === 'alerting')   return n === 1 ? 'done' : n === 2 ? 'active' : 'pending';
    if (s === 'validating') return n <= 2 ? 'done' : n === 3 ? 'active' : 'pending';
    if (s === 'dispensing') return n <= 3 ? 'done' : 'active';
    return 'done'; // 'done'
  };

  const STEPS = [
    { n: 1 as const, icon: 'notifications',   label: 'Horário chega — alerta disparado' },
    { n: 2 as const, icon: 'watch',           label: 'Pulseira vibra continuamente' },
    { n: 3 as const, icon: 'radio',           label: 'Validação RFID no dispenser' },
    { n: 4 as const, icon: 'checkmark-done',  label: 'Motor libera a dose · vibração cessa' },
  ];

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { fontSize: fs }]}>{label}</Text>
      {children}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={[styles.title, { fontSize: isDesktop ? 26 : isTablet ? 24 : 22 }]}>Dispenser IoT</Text>
            <Text style={[styles.subtitle, { fontSize: fs - 1 }]}>IASIS-{MQTT_CONFIG.dispenserId} · ESP32</Text>
          </View>
          <View style={[styles.modeBadge, { backgroundColor: isDemo ? 'rgba(250,199,117,.2)' : 'rgba(93,202,165,.2)' }]}>
            <Ionicons name={isDemo ? 'flask' : 'wifi'} size={13} color={isDemo ? '#FAC775' : '#5DCAA5'} />
            <Text style={{ color: isDemo ? '#FAC775' : '#5DCAA5', fontWeight: '700', fontSize: fs - 3 }}>
              {isDemo ? 'Demonstração' : 'MQTT real'}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32, alignItems: maxW ? 'center' : undefined }}>
        <View style={{ width: '100%', maxWidth: maxW, paddingHorizontal: 16 }}>

          {/* ── Fluxo de segurança fechado ── */}
          <Text style={[styles.section, { fontSize: fs - 2 }]}>Fluxo de segurança fechado</Text>
          <View style={styles.flowCard}>
            {/* Dose da vez */}
            {doseFlow.step === 'done' ? (
              <View style={styles.flowDone}>
                <Ionicons name="checkmark-circle" size={30} color={Colors.greenText} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.flowDoneTitle, { fontSize: fs + 1 }]}>Dose liberada com sucesso!</Text>
                  <Text style={[styles.flowDoneSub, { fontSize: fs - 2 }]}>
                    {doseFlow.medName ?? 'Medicamento'} validado pela pulseira RFID. Ciclo encerrado.
                  </Text>
                </View>
              </View>
            ) : nextDose ? (
              <View style={styles.flowDose}>
                <View style={styles.flowDoseIcon}>
                  <Ionicons name="medkit" size={20} color={Colors.amberText} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.flowDoseName, { fontSize: fs + 1 }]}>
                    {nextDose.medication ? `${nextDose.medication.name} ${nextDose.medication.dosage}` : 'Medicamento'}
                  </Text>
                  <Text style={[styles.flowDoseMeta, { fontSize: fs - 2 }]}>
                    {fmtTime(nextDose.scheduledAt)} · compartimento {nextDose.medication?.compartment ?? 1} · aguardando validação
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.flowDose}>
                <View style={[styles.flowDoseIcon, { backgroundColor: Colors.borderSoft }]}>
                  <Ionicons name="time-outline" size={20} color={Colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.flowDoseName, { fontSize: fs }]}>Nenhuma dose no horário agora</Text>
                  <Text style={[styles.flowDoseMeta, { fontSize: fs - 2 }]}>
                    O fluxo é executado quando uma dose está aguardando validação.
                  </Text>
                </View>
              </View>
            )}

            {/* Etapas */}
            <View style={{ marginTop: 14, gap: 2 }}>
              {STEPS.map((s, i) => {
                const st = stepState(s.n);
                return (
                  <View key={s.n}>
                    <View style={styles.stepRow}>
                      <View style={[
                        styles.stepDot,
                        st === 'done'   && { backgroundColor: Colors.greenLight },
                        st === 'active' && { backgroundColor: Colors.amberLight },
                      ]}>
                        {st === 'done'
                          ? <Ionicons name="checkmark" size={14} color={Colors.greenText} />
                          : st === 'active'
                            ? <ActivityIndicator size={12} color={Colors.amberText} />
                            : <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.textMuted }}>{s.n}</Text>}
                      </View>
                      <Ionicons name={s.icon as any} size={15}
                        color={st === 'pending' ? Colors.textMuted : st === 'active' ? Colors.amberText : Colors.greenText} />
                      <Text style={[
                        styles.stepLabel, { fontSize: fs - 1 },
                        st === 'done'   && { color: Colors.greenText },
                        st === 'active' && { color: Colors.amberText, fontWeight: '700' },
                      ]}>
                        {s.label}
                      </Text>
                    </View>
                    {i < STEPS.length - 1 && <View style={styles.stepLine} />}
                  </View>
                );
              })}
            </View>

            {/* Ações do fluxo */}
            <View style={{ marginTop: 16, gap: 8 }}>
              {doseFlow.step === 'idle' && (
                nextDose ? (
                  <TouchableOpacity
                    style={[styles.flowBtn, !mqttConnected && { opacity: 0.5 }]}
                    onPress={() => deviceActions.startAlert(nextDose)}
                    disabled={!mqttConnected}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="play" size={18} color="#fff" />
                    <Text style={[styles.flowBtnText, { fontSize: fs }]}>Iniciar alerta da dose</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.flowBtnOutline, (!mqttConnected || creatingDemo) && { opacity: 0.5 }]}
                    onPress={handleCreateDemoDose}
                    disabled={!mqttConnected || creatingDemo}
                    activeOpacity={0.85}
                  >
                    {creatingDemo
                      ? <ActivityIndicator size="small" color={Colors.navy} />
                      : <Ionicons name="add-circle-outline" size={18} color={Colors.navy} />}
                    <Text style={[styles.flowBtnOutlineText, { fontSize: fs }]}>Criar dose de teste para agora</Text>
                  </TouchableOpacity>
                )
              )}

              {doseFlow.step === 'alerting' && (
                <>
                  {isDemo ? (
                    <TouchableOpacity
                      style={[styles.flowBtn, { backgroundColor: Colors.navy }]}
                      onPress={() => deviceActions.approachWristband(user?.rfid_tag ?? DEMO_WRISTBAND_TAG)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="radio" size={18} color="#fff" />
                      <Text style={[styles.flowBtnText, { fontSize: fs }]}>Aproximar pulseira do leitor</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.flowHint}>
                      <Ionicons name="radio" size={16} color="#185FA5" />
                      <Text style={[styles.flowHintText, { fontSize: fs - 1 }]}>
                        Aproxime a pulseira física do leitor RFID no dispenser…
                      </Text>
                    </View>
                  )}
                  <TouchableOpacity style={styles.flowCancel} onPress={() => deviceActions.stopAlert()} activeOpacity={0.8}>
                    <Text style={[styles.flowCancelText, { fontSize: fs - 1 }]}>Cancelar alerta</Text>
                  </TouchableOpacity>
                </>
              )}

              {(doseFlow.step === 'validating' || doseFlow.step === 'dispensing') && (
                <View style={styles.flowHint}>
                  <ActivityIndicator size="small" color={Colors.amberText} />
                  <Text style={[styles.flowHintText, { fontSize: fs - 1, color: Colors.amberText }]}>
                    {doseFlow.step === 'validating' ? 'Validando identidade…' : 'Motor NEMA 17 liberando a dose…'}
                  </Text>
                </View>
              )}

              {doseFlow.step === 'done' && (
                <TouchableOpacity style={styles.flowBtnOutline} onPress={() => deviceActions.resetFlow()} activeOpacity={0.85}>
                  <Ionicons name="refresh" size={17} color={Colors.navy} />
                  <Text style={[styles.flowBtnOutlineText, { fontSize: fs }]}>Concluir demonstração</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* ── Pulseira RFID ── */}
          <Text style={[styles.section, { fontSize: fs - 2 }]}>Pulseira RFID</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Animated.View style={[
                styles.wristIcon,
                { transform: [{ scale: pulse }] },
                wristbandVibrating && { backgroundColor: Colors.amberLight },
              ]}>
                <Ionicons name="watch" size={22} color={wristbandVibrating ? Colors.amberText : Colors.navy} />
              </Animated.View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { fontSize: fs + 1 }]}>
                  {wristbandVibrating ? 'Vibrando — aguardando validação' : 'Em silêncio'}
                </Text>
                <Text style={[styles.cardSub, { fontSize: fs - 2, fontFamily: 'monospace' }]}>
                  tag {user?.rfid_tag ?? DEMO_WRISTBAND_TAG}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: wristbandVibrating ? '#FAEEDA' : '#E1F5EE' }]}>
                <View style={[styles.dot, { backgroundColor: wristbandVibrating ? '#854F0B' : '#0F6E56' }]} />
                <Text style={[styles.badgeText, { color: wristbandVibrating ? '#854F0B' : '#0F6E56', fontSize: fs - 2 }]}>
                  {wristbandVibrating ? 'Alerta' : 'OK'}
                </Text>
              </View>
            </View>
            <View style={styles.divider} />
            <Row label="Vibração manual">
              <Switch
                value={wristbandVibrating}
                onValueChange={(v) => deviceActions.setVibrate(v)}
                disabled={!mqttConnected}
                trackColor={{ false: Colors.border, true: '#854F0B' }} thumbColor="#fff"
              />
            </Row>
            {lastRfid && (
              <>
                <View style={styles.divider} />
                <Row label="Última leitura">
                  <Text style={[styles.rowValue, { fontSize: fs - 2, color: lastRfid.valid ? Colors.greenText : Colors.redText }]}>
                    {lastRfid.tag} · {lastRfid.valid ? 'autorizada' : 'negada'} · {fmtTime(lastRfid.at)}
                  </Text>
                </Row>
              </>
            )}
          </View>

          {/* ── Conexão ── */}
          <Text style={[styles.section, { fontSize: fs - 2 }]}>
            {isDemo ? 'Conexão (simulador ESP32)' : 'Conexão MQTT'}
          </Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={[styles.iconBox, { backgroundColor: mqttConnected ? '#E1F5EE' : '#FCEBEB', width: isTablet ? 50 : 44, height: isTablet ? 50 : 44 }]}>
                <Ionicons name="hardware-chip" size={isTablet ? 24 : 20} color={mqttConnected ? '#0F6E56' : '#A32D2D'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { fontSize: fs + 1 }]}>IASIS-{MQTT_CONFIG.dispenserId}</Text>
                <Text style={[styles.cardSub, { fontSize: fs - 2 }]}>Firmware {firmware}</Text>
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
              <Text style={[styles.rowValue, { fontSize: fs - 2, fontFamily: 'monospace' }]}>
                iasis/dispenser/{MQTT_CONFIG.dispenserId}
              </Text>
            </Row>
            {isDemo && (
              <>
                <View style={styles.divider} />
                <View style={[styles.row, { alignItems: 'flex-start' }]}>
                  <Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} style={{ marginTop: 1 }} />
                  <Text style={{ flex: 1, fontSize: fs - 2, color: Colors.textSecondary, lineHeight: 18 }}>
                    Modo demonstração ativo: um simulador fiel do ESP32 responde aos comandos.
                    Configure o broker em src/config/app.ts para usar o hardware real.
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* ── Sensores ── */}
          <Text style={[styles.section, { fontSize: fs - 2 }]}>Sensores DHT22</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {[
              { icon: 'water',        label: 'Umidade',      val: humidity > 0 ? `${humidity}%` : '--',    color: '#185FA5', status: humidity > 0 ? humidity <= 60 ? '✓ Ideal para armazenamento' : '⚠ Alta' : 'Aguardando' },
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

          {/* ── Controles remotos ── */}
          <Text style={[styles.section, { fontSize: fs - 2 }]}>Controles remotos</Text>
          <View style={styles.card}>
            <Row label="Motor NEMA 17">
              <ConfirmAction
                label="Dispensar teste" confirmLabel="Dispensar"
                onConfirm={() => deviceActions.dispenseTest(1)}
                bg="#E1F5EE" txtColor="#0F6E56" disabled={!mqttConnected} fs={fs - 2}
              />
            </Row>
            <View style={styles.divider} />
            <Row label="Sensores">
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#F1F5F9' }, !mqttConnected && { opacity: 0.5 }]}
                onPress={() => deviceActions.requestStatus()}
                disabled={!mqttConnected}
              >
                <Text style={[styles.actionBtnText, { color: '#64748B', fontSize: fs - 2 }]}>Atualizar</Text>
              </TouchableOpacity>
            </Row>
            <View style={styles.divider} />
            <Row label="ESP32">
              <ConfirmAction
                label="Reiniciar" confirmLabel="Reiniciar"
                onConfirm={() => deviceActions.restart()}
                bg="#FCEBEB" txtColor="#A32D2D" disabled={!mqttConnected} fs={fs - 2}
              />
            </Row>
          </View>

          {/* ── Log ── */}
          <Text style={[styles.section, { fontSize: fs - 2 }]}>
            {isDemo ? 'Log do simulador' : 'Log MQTT em tempo real'}
          </Text>
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
  modeBadge:{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  section:  { fontWeight: '700', color: Colors.textSecondary, marginTop: 20, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  card:     { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, ...Shadows.sm },
  row:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 14 },
  rowLabel: { color: Colors.textSecondary },
  rowValue: { fontWeight: '500', color: Colors.textPrimary },
  iconBox:  { borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitle:{ fontWeight: '600', color: Colors.textPrimary },
  cardSub:  { color: Colors.textSecondary, marginTop: 2 },
  badge:    { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  dot:      { width: 7, height: 7, borderRadius: 4 },
  badgeText:{ fontWeight: '600' },
  divider:  { height: 0.5, backgroundColor: Colors.border, marginHorizontal: 14 },
  wristIcon:{ width: 46, height: 46, borderRadius: 14, backgroundColor: Colors.borderSoft, alignItems: 'center', justifyContent: 'center' },
  sensorCard: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 14, borderWidth: 0.5, borderColor: Colors.border, gap: 4, ...Shadows.sm },
  sensorLabel: { color: Colors.textSecondary, marginTop: 6 },
  sensorValue: { fontWeight: '700', color: Colors.textPrimary },
  sensorStatus:{ color: Colors.textMuted },
  actionBtn:     { borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  actionBtnText: { fontWeight: '600' },
  logBox:   { backgroundColor: '#1C2B4B', borderRadius: Radius.md, padding: 12, minHeight: 140 },
  logLine:  { fontFamily: 'monospace', lineHeight: 20 },
  logEmpty: { color: 'rgba(255,255,255,.35)', fontFamily: 'monospace' },

  // Fluxo de segurança fechado
  flowCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 16, borderWidth: 1, borderColor: '#D9E4F2', ...Shadows.md },
  flowDose: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FDF8EE', borderRadius: 12, padding: 12 },
  flowDoseIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: Colors.amberLight, alignItems: 'center', justifyContent: 'center' },
  flowDoseName: { fontWeight: '700', color: Colors.textPrimary },
  flowDoseMeta: { color: Colors.textSecondary, marginTop: 2 },
  flowDone:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.greenLight, borderRadius: 12, padding: 12 },
  flowDoneTitle:{ fontWeight: '800', color: Colors.greenText },
  flowDoneSub:  { color: Colors.greenText, marginTop: 2, opacity: 0.9 },
  stepRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  stepDot:  { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.borderSoft, alignItems: 'center', justifyContent: 'center' },
  stepLabel:{ flex: 1, color: Colors.textSecondary, fontWeight: '500' },
  stepLine: { width: 2, height: 10, backgroundColor: Colors.borderSoft, marginLeft: 12 },
  flowBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.green, borderRadius: 12, paddingVertical: 14 },
  flowBtnText: { color: '#fff', fontWeight: '700' },
  flowBtnOutline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: Colors.navy, borderRadius: 12, paddingVertical: 13 },
  flowBtnOutlineText: { color: Colors.navy, fontWeight: '700' },
  flowHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#F0F6FF', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14 },
  flowHintText: { color: '#185FA5', fontWeight: '600' },
  flowCancel: { alignItems: 'center', paddingVertical: 10 },
  flowCancelText: { color: Colors.textSecondary, fontWeight: '600' },
});
