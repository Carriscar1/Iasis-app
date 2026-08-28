// ─────────────────────────────────────────────
//  IASIS — Serviço unificado do dispositivo
//
//  Uma única interface para falar com o dispenser, com dois "canais":
//    · 'mqtt' — o ESP32 real, via broker MQTT (quando configurado)
//    · 'demo' — o simulador fiel do ESP32 (DispenserSimulator)
//
//  O canal é escolhido pelas credenciais salvas no aparelho (tela
//  "Configurar dispenser") ou, na falta delas, pelo que estiver em
//  src/config/app.ts. Sem credenciais válidas → modo demonstração.
//  As telas não precisam saber qual canal está ativo: a interface é a mesma.
// ─────────────────────────────────────────────
import { mqttService } from './mqtt';
import { dispenserSim, DEMO_WRISTBAND_TAG } from './dispenserSim';
import { loadMqttSettings, isValidSettings, type MqttSettings } from './deviceConfig';
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
  private settings: MqttSettings | null = null;
  private ready = false;

  // Carrega as credenciais salvas. Chamado antes de conectar.
  async init(): Promise<DeviceMode> {
    this.settings = await loadMqttSettings();
    this.ready = true;
    return this.mode;
  }

  get mode(): DeviceMode {
    return isValidSettings(this.settings) ? 'mqtt' : 'demo';
  }

  get isReady() {
    return this.ready;
  }

  // Identificador usado nos tópicos (iasis/dispenser/<id>/...)
  get dispenserId(): string {
    return this.settings?.dispenserId ?? '01';
  }

  private get channel() {
    return this.mode === 'mqtt' ? mqttService : dispenserSim;
  }

  connect(userId: string, callbacks: DeviceCallbacks = {}) {
    if (this.mode === 'mqtt' && this.settings) {
      mqttService.connect(this.settings.dispenserId, userId, callbacks, this.settings);
    } else {
      dispenserSim.connect(this.dispenserId, userId, callbacks);
    }
  }

  disconnect() {
    // Encerra os dois canais: ao trocar de modo, o anterior precisa parar.
    try { mqttService.disconnect(); } catch { /* ignora */ }
    try { dispenserSim.disconnect(); } catch { /* ignora */ }
  }

  isConnected() {
    return this.channel.isConnected();
  }

  // Aplica novas credenciais em memória (a gravação fica com deviceConfig).
  // Quem chama deve reconectar — o hook useDevice faz isso ao mudar a versão
  // da configuração no store.
  applySettings(settings: MqttSettings | null) {
    this.disconnect();
    this.settings = settings;
    this.ready = true;
  }

  getSettings(): MqttSettings | null {
    return this.settings;
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
