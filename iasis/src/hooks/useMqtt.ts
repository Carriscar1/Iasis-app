// ─────────────────────────────────────────────
//  useMqtt — Hook que conecta MQTT ao store
// ─────────────────────────────────────────────
import { useEffect, useCallback } from 'react';
import { useStore } from '../store';
import { mqttService } from '../services/mqtt';
import { updateDoseStatus, updateDispenserSensors } from '../services/firebase';
import { sendLocalNotification } from '../services/notifications';
import * as Haptics from 'expo-haptics';

export const useMqtt = () => {
  const {
    user,
    dispenser,
    setMqttConnected,
    updateSensors,
    setRfidRead,
    addMqttLog,
    setDispenser,
    todayDoses,
  } = useStore();

  const connect = useCallback(() => {
    if (!user || !dispenser) return;

    mqttService.connect(dispenser.id, user.uid, {
      // ── Dispenser ficou online ────────────────
      onConnect: () => {
        setMqttConnected(true);
        addMqttLog({
          direction: 'in',
          topic:     'broker',
          payload:   'Conectado com sucesso',
        });
      },

      onDisconnect: () => {
        setMqttConnected(false);
        addMqttLog({
          direction: 'in',
          topic:     'broker',
          payload:   'Conexão perdida — reconectando...',
        });
      },

      // ── Atualização de sensores DHT22 ─────────
      onStatus: (payload) => {
        updateSensors(payload);
        updateDispenserSensors(dispenser.id, {
          humidity:    payload.humidity,
          temperature: payload.temperature,
        });
        addMqttLog({
          direction: 'in',
          topic:     `iasis/dispenser/${dispenser.id}/status`,
          payload:   `umidade: ${payload.humidity}%, temp: ${payload.temperature}°C`,
        });

        // Alerta se umidade muito alta (risco para comprimidos)
        if (payload.humidity > 70) {
          sendLocalNotification(
            '⚠️ Umidade alta no dispenser',
            `Umidade em ${payload.humidity}% — pode danificar os medicamentos.`,
            'alerts'
          );
        }
      },

      // ── Leitura RFID da pulseira ───────────────
      onRfid: async (payload) => {
        setRfidRead(payload);
        addMqttLog({
          direction: 'in',
          topic:     `iasis/dispenser/${dispenser.id}/rfid`,
          payload:   `tag: ${payload.tag} — ${payload.valid ? 'VÁLIDA' : 'INVÁLIDA'}`,
        });

        if (!payload.valid) {
          sendLocalNotification(
            '❌ Tag RFID não reconhecida',
            'A pulseira aproximada não está registrada neste dispenser.',
            'alerts'
          );
          return;
        }

        // Verifica qual dose está pendente agora
        const now = new Date();
        const dueDose = todayDoses.find(d => {
          const t = new Date(d.scheduledAt);
          const diff = Math.abs(now.getTime() - t.getTime()) / 60000;
          return (d.status === 'due' || d.status === 'upcoming') && diff <= 30;
        });

        if (dueDose) {
          // Manda comando de dispensar
          const med = dueDose.medication;
          if (med?.compartment) {
            mqttService.dispense(med.compartment, dueDose.id);
            addMqttLog({
              direction: 'out',
              topic:     `iasis/dispenser/${dispenser.id}/cmd`,
              payload:   `DISPENSE slot:${med.compartment} doseId:${dueDose.id}`,
            });
          }
        }
      },

      // ── Motor dispensou ────────────────────────
      onDispense: async (payload) => {
        addMqttLog({
          direction: 'in',
          topic:     `iasis/dispenser/${dispenser.id}/dispense`,
          payload:   `slot:${payload.slot} — ${payload.success ? 'OK' : 'ERRO'}`,
        });

        if (payload.success && payload.doseId) {
          const now = new Date();
          const dose = todayDoses.find(d => d.id === payload.doseId);
          const scheduled = dose ? new Date(dose.scheduledAt) : null;
          const delayMin  = scheduled
            ? Math.round((now.getTime() - scheduled.getTime()) / 60000)
            : 0;

          await updateDoseStatus(payload.doseId, delayMin > 20 ? 'late' : 'taken', {
            takenAt:       now.toISOString(),
            validatedBy:   'rfid',
            dispensedBy:   'motor',
            delayMinutes:  Math.max(0, delayMin),
          });

          // Para vibração da pulseira
          mqttService.setVibrate(false);

          // Haptics no celular
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

          sendLocalNotification(
            '✅ Medicamento dispensado!',
            `Dose ${delayMin > 0 ? `com ${delayMin} min de atraso` : 'no horário'} — continue assim!`,
            'doses'
          );
        } else if (!payload.success) {
          sendLocalNotification(
            '⚠️ Falha ao dispensar',
            `Erro no compartimento ${payload.slot}. Verifique o dispenser.`,
            'alerts'
          );
        }
      },

      onError: (err) => {
        console.error('[useMqtt] Erro MQTT:', err);
        addMqttLog({
          direction: 'in',
          topic:     'broker',
          payload:   `ERRO: ${err.message}`,
        });
      },
    });
  }, [user?.uid, dispenser?.id]);

  useEffect(() => {
    connect();
    return () => {
      mqttService.disconnect();
      setMqttConnected(false);
    };
  }, [connect]);

  return {
    dispense:      mqttService.dispense.bind(mqttService),
    setVibrate:    mqttService.setVibrate.bind(mqttService),
    requestStatus: mqttService.requestStatus.bind(mqttService),
    restart:       mqttService.restart.bind(mqttService),
    isConnected:   mqttService.isConnected.bind(mqttService),
    topics:        mqttService.getTopics(),
  };
};
