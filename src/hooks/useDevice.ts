// ─────────────────────────────────────────────
//  IASIS — Hook global do dispositivo
//
//  Conecta ao dispenser (ESP32 real via MQTT ou simulador em modo demo)
//  enquanto o usuário está logado, e implementa o FLUXO DE SEGURANÇA
//  FECHADO do lado do app:
//
//    1. horário chega   → alerta é disparado (pulseira vibra)
//    2. pulseira vibra  → paciente vai até o dispenser
//    3. RFID válido     → dose é validada (validated_by = 'rfid')
//    4. motor dispensa  → vibração cessa → app confirma
//
//  Montado uma única vez no layout das abas.
// ─────────────────────────────────────────────
import { useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useStore } from '../store';
import { deviceService, DEMO_WRISTBAND_TAG } from '../services/device';
import { findDoseAwaitingValidation, markDoseTaken } from '../services/data';
import { cancelDoseReminder, sendLocalNotification } from '../services/notifications';
import type { Dose } from '../types';

const haptic = (type: Haptics.NotificationFeedbackType) => {
  if (Platform.OS !== 'web') {
    Haptics.notificationAsync(type).catch(() => {});
  }
};

export const useDevice = () => {
  const userId = useStore((s) => s.user?.id);
  // Muda quando as credenciais MQTT são salvas/apagadas → reconecta.
  const configVersion = useStore((s) => s.deviceConfigVersion);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const {
      setMqttConnected, setDeviceMode, setSensors, setFirmware,
      setWristbandVibrating, setLastRfid, setDoseFlow, addMqttLog,
    } = useStore.getState();

    const start = async () => {
      // Carrega as credenciais salvas no aparelho antes de escolher o canal.
      await deviceService.init();
      if (cancelled) return;

      setDeviceMode(deviceService.mode);

      deviceService.connect(userId, {
      onConnect: () => {
        setMqttConnected(true);
        addMqttLog({
          direction: 'in',
          payload: deviceService.mode === 'demo'
            ? 'Dispenser conectado (modo demonstração)'
            : 'Conectado ao broker MQTT',
        });
      },

      onDisconnect: () => {
        setMqttConnected(false);
        addMqttLog({ direction: 'in', payload: 'Conexão perdida — reconectando...' });
      },

      onStatus: (p) => {
        setSensors(p.humidity, p.temperature);
        setFirmware(p.firmware);
        addMqttLog({ direction: 'in', payload: `STATUS umidade:${p.humidity}% temp:${p.temperature}°C uptime:${p.uptime}s` });
      },

      onVibrate: (p) => {
        setWristbandVibrating(p.active);
        addMqttLog({ direction: 'in', payload: `VIBRATE ${p.active ? 'ON' : 'OFF'}${p.pattern ? ` (${p.pattern})` : ''}` });
      },

      // ── Coração do fluxo fechado: leitura RFID ──
      onRfid: async (p) => {
        setLastRfid({ tag: p.tag, valid: p.valid, at: new Date().toISOString() });
        addMqttLog({ direction: 'in', payload: `RFID_READ tag:${p.tag} ${p.valid ? 'AUTORIZADA ✓' : 'NEGADA ✗'}` });

        if (!p.valid) {
          haptic(Haptics.NotificationFeedbackType.Error);
          return;
        }

        const user = useStore.getState().user;
        if (!user) return;

        haptic(Haptics.NotificationFeedbackType.Success);
        useStore.getState().setDoseFlow({ step: 'validating' });

        // Busca a dose "da vez" (janela -60min a +15min do horário agendado)
        const { data: dose } = await findDoseAwaitingValidation(user.id);
        if (!dose) {
          addMqttLog({ direction: 'in', payload: 'RFID válido, mas nenhuma dose aguardando neste horário' });
          useStore.getState().setDoseFlow({ step: 'idle' });
          deviceService.setVibrate(false); // garante pulseira em silêncio
          return;
        }

        await validateAndDispense(dose);
      },

      onDispense: (p) => {
        addMqttLog({ direction: 'in', payload: `DISPENSE_ACK slot:${p.slot} ${p.success ? 'OK' : `ERRO ${p.errorCode ?? ''}`}` });
        if (!p.success) return;
        haptic(Haptics.NotificationFeedbackType.Success);

        const flow = useStore.getState().doseFlow;
        if (flow.step === 'dispensing' && flow.doseId === p.doseId) {
          useStore.getState().setDoseFlow({ ...flow, step: 'done' });
          sendLocalNotification(
            '✅ Dose liberada',
            `${flow.medName ?? 'Medicamento'} dispensado no compartimento ${p.slot}. Vibração encerrada.`
          );
        }
      },

      onError: (e) => {
        addMqttLog({ direction: 'in', payload: `ERRO: ${e.message}` });
      },
      });
    };

    start();

    return () => {
      cancelled = true;
      deviceService.disconnect();
      setMqttConnected(false);
      setWristbandVibrating(false);
      setDoseFlow({ step: 'idle' });
    };
  }, [userId, configVersion]);
};

// Valida a dose no banco e comanda o motor. Compartilhado entre a leitura
// RFID (fluxo fechado) e ações da tela do dispenser.
const validateAndDispense = async (dose: Dose) => {
  const { setDoseFlow, addMqttLog } = useStore.getState();
  const medName = dose.medication ? `${dose.medication.name} ${dose.medication.dosage}` : 'Medicamento';
  const slot = dose.medication?.compartment ?? 1;

  setDoseFlow({ step: 'dispensing', doseId: dose.id, medName });

  const { error } = await markDoseTaken(dose.id, 'rfid', dose.scheduledAt);
  if (error) {
    addMqttLog({ direction: 'in', payload: `ERRO ao validar dose: ${error}` });
    setDoseFlow({ step: 'idle' });
    return;
  }

  await cancelDoseReminder(dose.id);

  // Fecha o ciclo: motor libera a dose e a vibração cessa
  addMqttLog({ direction: 'out', payload: `CMD DISPENSE slot:${slot}` });
  deviceService.dispense(slot, dose.id);
  addMqttLog({ direction: 'out', payload: 'CMD VIBRATE_OFF' });
  deviceService.setVibrate(false);
};

// ─── Ações para as telas ───────────────────────
export const deviceActions = {
  // Passo 1 do fluxo: dispara o alerta na pulseira para uma dose.
  startAlert(dose?: Dose) {
    const { addMqttLog, setDoseFlow } = useStore.getState();
    addMqttLog({ direction: 'out', payload: 'CMD VIBRATE_ON (urgent)' });
    deviceService.setVibrate(true, 'urgent');
    setDoseFlow({
      step:    'alerting',
      doseId:  dose?.id,
      medName: dose?.medication ? `${dose.medication.name} ${dose.medication.dosage}` : undefined,
    });
  },

  stopAlert() {
    const { addMqttLog, setDoseFlow } = useStore.getState();
    addMqttLog({ direction: 'out', payload: 'CMD VIBRATE_OFF' });
    deviceService.setVibrate(false);
    setDoseFlow({ step: 'idle' });
  },

  // Passo 3 (modo demo): simula a aproximação da pulseira no leitor.
  approachWristband(tag?: string) {
    const { addMqttLog } = useStore.getState();
    addMqttLog({ direction: 'out', payload: `[demo] pulseira aproximada do leitor (tag ${tag ?? DEMO_WRISTBAND_TAG})` });
    deviceService.simulateRfidScan(tag);
  },

  dispenseTest(slot = 1) {
    const { addMqttLog } = useStore.getState();
    addMqttLog({ direction: 'out', payload: `CMD DISPENSE slot:${slot} (teste)` });
    deviceService.dispense(slot, 'test');
  },

  requestStatus() {
    const { addMqttLog } = useStore.getState();
    addMqttLog({ direction: 'out', payload: 'CMD STATUS_REQ' });
    deviceService.requestStatus();
  },

  restart() {
    const { addMqttLog } = useStore.getState();
    addMqttLog({ direction: 'out', payload: 'CMD RESTART' });
    deviceService.restart();
  },

  setVibrate(on: boolean) {
    const { addMqttLog } = useStore.getState();
    addMqttLog({ direction: 'out', payload: `CMD VIBRATE_${on ? 'ON' : 'OFF'}` });
    deviceService.setVibrate(on);
  },

  resetFlow() {
    useStore.getState().setDoseFlow({ step: 'idle' });
  },
};
