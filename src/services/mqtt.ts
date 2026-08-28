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
import { MQTT_CONFIG } from '../config/app';
import type { MqttSettings } from './deviceConfig';

// ─── Configuração ─────────────────────────────
// As credenciais chegam em connect() (vindas da tela "Configurar dispenser",
// salvas no aparelho). Sem elas, cai no que estiver em src/config/app.ts.
const FALLBACK: MqttSettings = {
  brokerUrl:   MQTT_CONFIG.brokerUrl,
  username:    MQTT_CONFIG.username,
  password:    MQTT_CONFIG.password,
  dispenserId: MQTT_CONFIG.dispenserId,
};

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
  connect(
    dispenserId: string,
    userId: string,
    callbacks: Callbacks = {},
    settings?: MqttSettings,
  ) {
    const cfg = settings ?? FALLBACK;
    this.dispenserId = dispenserId || cfg.dispenserId;
    this.userId      = userId;
    this.callbacks   = callbacks;

    const options: IClientOptions = {
      clientId:   `iasis_app_${userId}_${Date.now()}`,
      username:   cfg.username,
      password:   cfg.password,
      clean:      true,
      reconnectPeriod: 5000,
      connectTimeout:  10000,
      keepalive:       60,
      // ws:// (Mosquitto local) e wss:// (HiveMQ Cloud) são ambos aceitos.
      protocol:   cfg.brokerUrl.startsWith('ws://') ? 'ws' : 'wss',
    };

    this.client = mqtt.connect(cfg.brokerUrl, options);

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
      pattern,
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

// ─────────────────────────────────────────────
//  Teste de credenciais (tela "Configurar dispenser")
//  Abre uma conexão separada e efêmera: não interfere na conexão
//  principal do app. Resolve assim que conecta, falha ou estoura o tempo.
// ─────────────────────────────────────────────
export const testMqttConnection = (
  settings: MqttSettings,
  timeoutMs = 12000,
): Promise<{ ok: boolean; error?: string }> =>
  new Promise((resolve) => {
    let client: MqttClient | null = null;
    let done = false;

    const finish = (result: { ok: boolean; error?: string }) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { client?.end(true); } catch { /* ignora */ }
      resolve(result);
    };

    const timer = setTimeout(
      () => finish({
        ok: false,
        error: 'Tempo esgotado. Confira o endereço do broker e se o aparelho está com internet.',
      }),
      timeoutMs,
    );

    try {
      client = mqtt.connect(settings.brokerUrl, {
        clientId:   `iasis_test_${Date.now()}`,
        username:   settings.username,
        password:   settings.password,
        clean:      true,
        reconnectPeriod: 0,          // não reconecta: é só um teste
        connectTimeout:  timeoutMs,
        protocol:   settings.brokerUrl.startsWith('ws://') ? 'ws' : 'wss',
      });

      client.on('connect', () => finish({ ok: true }));
      client.on('error', (err: Error) => {
        const msg = err?.message ?? 'Erro desconhecido';
        const friendly = /not authorized|bad username|unauthorized/i.test(msg)
          ? 'Usuário ou senha incorretos.'
          : /getaddrinfo|ENOTFOUND|failed to connect|ECONNREFUSED/i.test(msg)
            ? 'Broker não encontrado. Confira o endereço.'
            : msg;
        finish({ ok: false, error: friendly });
      });
    } catch (err: any) {
      finish({ ok: false, error: err?.message ?? 'Não foi possível iniciar a conexão.' });
    }
  });
