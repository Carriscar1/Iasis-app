// ─────────────────────────────────────────────
//  IASIS — Configuração do dispenser (MQTT)
//
//  As credenciais do broker ficam salvas no aparelho (AsyncStorage), então
//  dá para ligar o hardware real SEM editar código: basta preencher a tela
//  "Configurar dispenser". Se nada estiver salvo, o app cai no que estiver
//  em src/config/app.ts — e, se lá também houver placeholders, entra em
//  modo demonstração automaticamente.
// ─────────────────────────────────────────────
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { MQTT_CONFIG } from '../config/app';

const STORAGE_KEY = '@iasis:mqtt_settings';

export interface MqttSettings {
  brokerUrl:   string;   // ex: wss://xxxx.hivemq.cloud:8884/mqtt
  username:    string;
  password:    string;
  dispenserId: string;   // ex: 01  → tópicos iasis/dispenser/01/...
}

// Um ajuste só é válido quando tem broker wss/ws, usuário, senha e id —
// e nenhum deles é o placeholder que vem no código.
export const isValidSettings = (s: Partial<MqttSettings> | null | undefined): s is MqttSettings => {
  if (!s) return false;
  const url = (s.brokerUrl ?? '').trim();
  const ok  = /^wss?:\/\/.+/i.test(url) && !url.includes('SEU_BROKER');
  return (
    ok &&
    !!s.username?.trim() &&
    !!s.password?.trim() &&
    s.password !== 'SUA_SENHA_MQTT' &&
    !!s.dispenserId?.trim()
  );
};

// Ajustes que vêm do código (src/config/app.ts), se já preenchidos.
const fromCode = (): MqttSettings | null => {
  const s: MqttSettings = {
    brokerUrl:   MQTT_CONFIG.brokerUrl,
    username:    MQTT_CONFIG.username,
    password:    MQTT_CONFIG.password,
    dispenserId: MQTT_CONFIG.dispenserId,
  };
  return isValidSettings(s) ? s : null;
};

const storage = {
  async get(): Promise<string | null> {
    if (Platform.OS === 'web') {
      try { return window.localStorage.getItem(STORAGE_KEY); } catch { return null; }
    }
    return AsyncStorage.getItem(STORAGE_KEY);
  },
  async set(v: string): Promise<void> {
    if (Platform.OS === 'web') {
      try { window.localStorage.setItem(STORAGE_KEY, v); } catch { /* ignora */ }
      return;
    }
    await AsyncStorage.setItem(STORAGE_KEY, v);
  },
  async remove(): Promise<void> {
    if (Platform.OS === 'web') {
      try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignora */ }
      return;
    }
    await AsyncStorage.removeItem(STORAGE_KEY);
  },
};

// ── Ler ───────────────────────────────────────
export const loadMqttSettings = async (): Promise<MqttSettings | null> => {
  try {
    const raw = await storage.get();
    if (raw) {
      const parsed = JSON.parse(raw) as MqttSettings;
      if (isValidSettings(parsed)) return parsed;
    }
  } catch {
    // JSON corrompido — ignora e usa o fallback do código.
  }
  return fromCode();
};

// ── Gravar ────────────────────────────────────
export const saveMqttSettings = async (s: MqttSettings): Promise<{ error: string | null }> => {
  if (!isValidSettings(s)) {
    return { error: 'Preencha o endereço do broker (wss://…), usuário, senha e o ID do dispenser.' };
  }
  try {
    await storage.set(JSON.stringify(s));
    return { error: null };
  } catch {
    return { error: 'Não foi possível salvar as configurações neste aparelho.' };
  }
};

// ── Apagar (volta ao modo demonstração) ───────
export const clearMqttSettings = async (): Promise<void> => {
  await storage.remove();
};

export const emptySettings = (): MqttSettings => ({
  brokerUrl:   '',
  username:    '',
  password:    '',
  dispenserId: '01',
});
