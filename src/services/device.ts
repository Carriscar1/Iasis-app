// ─────────────────────────────────────────────
//  IASIS — Serviço unificado do dispositivo
//
//  Uma única interface para falar com o dispenser, com dois "canais":
//    · 'mqtt' — o ESP32 real, via broker MQTT (quando configurado)
//    · 'demo' — o simulador fiel do ESP32 (DispenserSimulator)
//
//  O canal é escolhido automaticamente: se MQTT_CONFIG ainda tem os
//  placeholders, entra em modo demonstração. As telas não precisam saber
//  qual canal está ativo — a interface é idêntica.
// ─────────────────────────────────────────────
import { mqttService } from './mqtt';
import { dispenserSim, DEMO_WRISTBAND_TAG } from './dispenserSim';
import { isMqttConfigured, MQTT_CONFIG } from '../config/app';
import type {
  MqttStatusPayload,
  MqttRfidPayload,
  MqttDispensePayload,
  MqttVibratePayload,
} from '../types';

export type DeviceMode = 'mqtt' | 'demo';

export type DeviceCallbacks = {
  onStatus?:     (payload: MqttStatusPayload)   => void;
  onRfid?:       (payload: MqttRfidPayload)     => void;
  onDispense?:   (payload: MqttDispensePayload) => void;
  onVibrate?:    (payload: MqttVibratePayload)  => void;
  onConnect?:    () => void;
  onDisconnect?: () => void;
  onError?:      (err: Error) => void;
};

class DeviceService {
  readonly mode: DeviceMode = isMqttConfigured() ? 'mqtt' : 'demo';

  private get channel() {
    return this.mode === 'mqtt' ? mqttService : dispenserSim;
  }

  connect(userId: string, callbacks: DeviceCallbacks = {}) {
    this.channel.connect(MQTT_CONFIG.dispenserId, userId, callbacks);
  }

  disconnect() {
    this.channel.disconnect();
  }

  isConnected() {
    return this.channel.isConnected();
  }

  // ── Comandos → dispenser ────────────────────
  dispense(slot: number, doseId: string) {
    this.channel.dispense(slot, doseId);
  }

  setVibrate(active: boolean, pattern: 'gentle' | 'urgent' | 'sos' = 'gentle') {
    this.channel.setVibrate(active, pattern);
  }

  requestStatus() {
    this.channel.requestStatus();
  }

  restart() {
    this.channel.restart();
  }

  // ── Exclusivo do modo demo ──────────────────
  // Simula a aproximação da pulseira no leitor RFID. No modo MQTT real
  // isso não faz nada: a leitura vem do hardware.
  simulateRfidScan(tag: string = DEMO_WRISTBAND_TAG) {
    if (this.mode === 'demo') dispenserSim.simulateRfidScan(tag);
  }
}

export const deviceService = new DeviceService();
export { DEMO_WRISTBAND_TAG };
