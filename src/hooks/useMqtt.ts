import { useEffect, useCallback } from 'react';
import { useStore } from '../store';
import { mqttService } from '../services/mqtt';
import * as Haptics from 'expo-haptics';

export const useMqtt = () => {
  const { user, setMqttConnected, setSensors, addMqttLog } = useStore();

  const connect = useCallback(() => {
    if (!user) return;

    mqttService.connect('01', user.id, {
      onConnect: () => {
        setMqttConnected(true);
        addMqttLog({ direction:'in', payload:'Conectado ao broker MQTT' });
      },
      onDisconnect: () => {
        setMqttConnected(false);
        addMqttLog({ direction:'in', payload:'Conexão perdida — reconectando...' });
      },
      onStatus: (p) => {
        setSensors(p.humidity, p.temperature);
        addMqttLog({ direction:'in', payload:`STATUS umidade:${p.humidity}% temp:${p.temperature}°C` });
      },
      onRfid: (p) => {
        addMqttLog({ direction:'in', payload:`RFID tag:${p.tag} válida:${p.valid}` });
        if (p.valid) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
      onDispense: (p) => {
        addMqttLog({ direction:'in', payload:`DISPENSE slot:${p.slot} ok:${p.success}` });
        if (p.success) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
      onError: (e) => {
        addMqttLog({ direction:'in', payload:`ERRO: ${e.message}` });
      },
    });
  }, [user?.id]);

  useEffect(() => {
    connect();
    return () => { mqttService.disconnect(); setMqttConnected(false); };
  }, [connect]);

  return {
    dispense:      (slot: number, doseId: string) => {
      addMqttLog({ direction:'out', payload:`CMD DISPENSE slot:${slot}` });
      mqttService.dispense(slot, doseId);
    },
    setVibrate:    (on: boolean) => {
      addMqttLog({ direction:'out', payload:`CMD VIBRATE_${on?'ON':'OFF'}` });
      mqttService.setVibrate(on);
    },
    requestStatus: () => mqttService.requestStatus(),
    restart:       () => mqttService.restart(),
  };
};
