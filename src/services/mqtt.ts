// ─────────────────────────────────────────────
//  IASIS — MQTT Service
//  Comunicação em tempo real com ESP32
//
//  Broker padrão: HiveMQ Cloud (gratuito até 100 conexões)
//  Alternativa:   Mosquitto local na mesma rede Wi-Fi
// ─────────────────────────────────────────────
import mqtt, { MqttClient, IClientOptions } from 'mqtt';
import {
  MqttPayload,
  MqttCommandPayload,
  MqttStatusPayload,
  MqttRfidPayload,
  MqttDispensePayload,
  MqttVibratePayload,
} from '../types';

// ─── Configuração ─────────────────────────────
// ⚠️ Substitua pelo seu broker (HiveMQ / Mosquitto)
const BROKER_URL    = 'wss://SEU_BROKER.hivemq.cloud:8884/mqtt';
const MQTT_USERNAME = 'iasis_app';
const MQTT_PASSWORD = 'SUA_SENHA_MQTT';

// Tópicos do ecossistema IASIS
const TOPICS = {
  status:   (id: string) => `iasis/dispenser/${id}/status`,
  rfid:     (id: string) => `iasis/dispenser/${id}/rfid`,
  dispense: (id: string) => `iasis/dispenser/${id}/dispense`,
  vibrate:  (id: string) => `iasis/dispenser/${id}/vibrate`,
  command:  (id: string) => `iasis/dispenser/${id}/cmd`,
  alerts:   (uid: string) => `iasis/user/${uid}/alerts`,
} as const;

// ─── Callbacks tipados ────────────────────────
type Callbacks = {
  onStatus?:    (payload: MqttStatusPayload)    => void;
  onRfid?:      (payload: MqttRfidPayload)      => void;
  onDispense?:  (payload: MqttDispensePayload)  => void;
  onVibrate?:   (payload: MqttVibratePayload)   => void;
  onConnect?:   () => void;
  onDisconnect?: () => void;
  onError?:     (err: Error) => void;
};

// ─────────────────────────────────────────────
//  MqttService class
// ─────────────────────────────────────────────
class MqttService {
  private client: MqttClient | null = null;
  private dispenserId: string = '';
  private userId: string      = '';
  private callbacks: Callbacks = {};
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connected: boolean = false;

  // ── Inicializa conexão ──────────────────────
  connect(dispenserId: string, userId: string, callbacks: Callbacks = {}) {
    this.dispenserId = dispenserId;
    this.userId      = userId;
    this.callbacks   = callbacks;

    const options: IClientOptions = {
      clientId:   `iasis_app_${userId}_${Date.now()}`,
      username:   MQTT_USERNAME,
      password:   MQTT_PASSWORD,
      clean:      true,
      reconnectPeriod: 5000,
      connectTimeout:  10000,
      keepalive:       60,
      protocol:   'wss',
    };

    this.client = mqtt.connect(BROKER_URL, options);

    this.client.on('connect', this.handleConnect.bind(this));
    this.client.on('message', this.handleMessage.bind(this));
    this.client.on('error',   this.handleError.bind(this));
    this.client.on('close',   this.handleClose.bind(this));
    this.client.on('offline', () => {
      this.connected = false;
      this.callbacks.onDisconnect?.();
    });
  }

  // ── Event handlers ──────────────────────────
  private handleConnect() {
    this.connected = true;
    console.log('[MQTT] Conectado ao broker');

    // Subscreve todos os tópicos do dispenser
    const id = this.dispenserId;
    const uid = this.userId;
    const topics = [
      TOPICS.status(id),
      TOPICS.rfid(id),
      TOPICS.dispense(id),
      TOPICS.vibrate(id),
      TOPICS.alerts(uid),
    ];

    this.client?.subscribe(topics, { qos: 1 }, (err) => {
      if (err) {
        console.error('[MQTT] Erro ao subscrever:', err);
      } else {
        console.log('[MQTT] Subscrito nos tópicos:', topics);
        // Solicita status imediato
        this.requestStatus();
      }
    });

    this.callbacks.onConnect?.();
  }

  private handleMessage(topic: string, message: Buffer) {
    try {
      const payload: MqttPayload = JSON.parse(message.toString());
      const id = this.dispenserId;

      if (topic === TOPICS.status(id)) {
        this.callbacks.onStatus?.(payload as MqttStatusPayload);
      } else if (topic === TOPICS.rfid(id)) {
        this.callbacks.onRfid?.(payload as MqttRfidPayload);
      } else if (topic === TOPICS.dispense(id)) {
        this.callbacks.onDispense?.(payload as MqttDispensePayload);
      } else if (topic === TOPICS.vibrate(id)) {
        this.callbacks.onVibrate?.(payload as MqttVibratePayload);
      }
    } catch (err) {
      console.error('[MQTT] Erro ao parsear mensagem:', err);
    }
  }

  private handleError(err: Error) {
    console.error('[MQTT] Erro:', err.message);
    this.callbacks.onError?.(err);
  }

  private handleClose() {
    this.connected = false;
    this.callbacks.onDisconnect?.();
    console.log('[MQTT] Conexão encerrada');
  }

  // ── Publicar comandos → ESP32 ───────────────
  private publish(topic: string, payload: object) {
    if (!this.client || !this.connected) {
      console.warn('[MQTT] Não conectado — comando ignorado:', payload);
      return;
    }
    this.client.publish(topic, JSON.stringify(payload), { qos: 1 });
  }

  // ─ Dispensar medicamento (slot do compartimento)
  dispense(slot: number, doseId: string) {
    const cmd: MqttCommandPayload = {
      type:    'CMD',
      command: 'DISPENSE',
      slot,
      doseId,
    };
    this.publish(TOPICS.command(this.dispenserId), cmd);
  }

  // ─ Vibração da pulseira
  setVibrate(active: boolean, pattern: 'gentle' | 'urgent' | 'sos' = 'gentle') {
    const cmd: MqttCommandPayload = {
      type:    'CMD',
      command: active ? 'VIBRATE_ON' : 'VIBRATE_OFF',
    };
    this.publish(TOPICS.command(this.dispenserId), cmd);
  }

  // ─ Solicitar status dos sensores
  requestStatus() {
    const cmd: MqttCommandPayload = { type: 'CMD', command: 'STATUS_REQ' };
    this.publish(TOPICS.command(this.dispenserId), cmd);
  }

  // ─ Reiniciar ESP32 remotamente
  restart() {
    const cmd: MqttCommandPayload = { type: 'CMD', command: 'RESTART' };
    this.publish(TOPICS.command(this.dispenserId), cmd);
  }

  // ── Desconectar ─────────────────────────────
  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.client?.end(true);
    this.client    = null;
    this.connected = false;
  }

  isConnected() {
    return this.connected;
  }

  getTopics() {
    return {
      status:   TOPICS.status(this.dispenserId),
      rfid:     TOPICS.rfid(this.dispenserId),
      dispense: TOPICS.dispense(this.dispenserId),
      command:  TOPICS.command(this.dispenserId),
    };
  }
}

// Singleton exportado
export const mqttService = new MqttService();
export { TOPICS };
