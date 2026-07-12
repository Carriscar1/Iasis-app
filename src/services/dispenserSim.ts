// ─────────────────────────────────────────────
//  IASIS — Simulador do dispenser ESP32
//
//  Réplica em software do firmware real (firmware/esp32/iasis_dispenser.ino):
//  responde aos mesmos comandos e emite os mesmos eventos que o hardware
//  emitiria via MQTT. Usado automaticamente quando o broker não está
//  configurado — permite demonstrar o ecossistema completo na feira
//  (sensores, pulseira, RFID, motor) sem depender do dispositivo montado.
// ─────────────────────────────────────────────
import type {
  MqttStatusPayload,
  MqttRfidPayload,
  MqttDispensePayload,
  MqttVibratePayload,
} from '../types';

type Callbacks = {
  onStatus?:     (payload: MqttStatusPayload)   => void;
  onRfid?:       (payload: MqttRfidPayload)     => void;
  onDispense?:   (payload: MqttDispensePayload) => void;
  onVibrate?:    (payload: MqttVibratePayload)  => void;
  onConnect?:    () => void;
  onDisconnect?: () => void;
  onError?:      (err: Error) => void;
};

const STATUS_INTERVAL_MS = 8000;   // mesmo ritmo do firmware real
const FIRMWARE_VERSION   = 'v2.1.0-demo';

// Tag "gravada" na pulseira de demonstração (igual ao placeholder do firmware).
export const DEMO_WRISTBAND_TAG = 'A3F2910C';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const drift = (v: number, step: number, min: number, max: number) =>
  clamp(v + (Math.random() - 0.5) * step, min, max);

export class DispenserSimulator {
  private callbacks: Callbacks = {};
  private connected = false;
  private statusTimer: ReturnType<typeof setInterval> | null = null;
  private timeouts: ReturnType<typeof setTimeout>[] = [];

  // Estado interno "físico" do dispenser simulado
  private humidity    = 47.0;   // % — dentro da faixa ideal (< 60%)
  private temperature = 24.5;   // °C
  private startedAt   = Date.now();
  private vibrating   = false;

  connect(_dispenserId: string, _userId: string, callbacks: Callbacks = {}) {
    this.callbacks = callbacks;
    this.startedAt = Date.now();

    // Simula o handshake Wi-Fi + broker do ESP32 (~1s)
    this.later(() => {
      this.connected = true;
      this.callbacks.onConnect?.();
      this.emitStatus();
      this.statusTimer = setInterval(() => this.emitStatus(), STATUS_INTERVAL_MS);
    }, 1000);
  }

  disconnect() {
    this.connected = false;
    if (this.statusTimer) clearInterval(this.statusTimer);
    this.statusTimer = null;
    this.timeouts.forEach(clearTimeout);
    this.timeouts = [];
  }

  isConnected() {
    return this.connected;
  }

  // ── Comandos (mesma interface do MqttService) ──
  dispense(slot: number, doseId: string) {
    if (!this.connected) return;
    // Motor NEMA 17 girando o compartimento (~2s no hardware real)
    this.later(() => {
      this.callbacks.onDispense?.({
        type:    'DISPENSE_ACK',
        slot,
        doseId,
        success: true,
      });
    }, 2000);
  }

  setVibrate(active: boolean, pattern: 'gentle' | 'urgent' | 'sos' = 'gentle') {
    if (!this.connected) return;
    this.vibrating = active;
    this.later(() => {
      this.callbacks.onVibrate?.({ type: 'VIBRATE', active, pattern });
    }, 300);
  }

  requestStatus() {
    if (!this.connected) return;
    this.later(() => this.emitStatus(), 250);
  }

  restart() {
    if (!this.connected) return;
    this.connected = false;
    if (this.statusTimer) clearInterval(this.statusTimer);
    this.callbacks.onDisconnect?.();
    // "Boot" do ESP32 (~2.5s)
    this.later(() => {
      this.connected = true;
      this.startedAt = Date.now();
      this.callbacks.onConnect?.();
      this.emitStatus();
      this.statusTimer = setInterval(() => this.emitStatus(), STATUS_INTERVAL_MS);
    }, 2500);
  }

  // ── Exclusivo do simulador ──────────────────
  // "Aproximar a pulseira do leitor RC522": emite a leitura RFID como o
  // hardware faria. Tags diferentes da autorizada são rejeitadas.
  simulateRfidScan(tag: string = DEMO_WRISTBAND_TAG) {
    if (!this.connected) return;
    const valid = tag === DEMO_WRISTBAND_TAG;
    this.later(() => {
      this.callbacks.onRfid?.({ type: 'RFID_READ', tag, valid });
    }, 600);
  }

  // ── Internos ────────────────────────────────
  private emitStatus() {
    if (!this.connected) return;
    // Sensores DHT22 variando de leve, como no ambiente real
    this.humidity    = drift(this.humidity,    1.6, 40, 58);
    this.temperature = drift(this.temperature, 0.6, 21, 28);
    this.callbacks.onStatus?.({
      type:        'STATUS',
      online:      true,
      humidity:    Math.round(this.humidity * 10) / 10,
      temperature: Math.round(this.temperature * 10) / 10,
      firmware:    FIRMWARE_VERSION,
      uptime:      Math.floor((Date.now() - this.startedAt) / 1000),
    });
  }

  private later(fn: () => void, ms: number) {
    const id = setTimeout(fn, ms);
    this.timeouts.push(id);
  }
}

export const dispenserSim = new DispenserSimulator();
