// ─────────────────────────────────────────────
//  IASIS — Preferências de acessibilidade
//
//  Guardadas no aparelho (AsyncStorage). O "modo fácil" aumenta fontes e
//  alvos de toque — é o mesmo tratamento que o app já dá ao perfil paciente,
//  agora disponível para qualquer pessoa que precise.
// ─────────────────────────────────────────────
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const KEY = '@iasis:prefs';

export interface Preferences {
  largeText:     boolean;   // modo fácil: tudo maior
  fallDetection: boolean;   // acelerômetro vigiando queda
  theme:         ThemeMode; // aparência do app
}

export type ThemeMode = 'system' | 'light' | 'dark';

export const defaultPreferences = (): Preferences => ({
  largeText:     false,
  fallDetection: true,      // ligado por padrão: é rede de proteção
  theme:         'system',
});

const storage = {
  async get(): Promise<string | null> {
    if (Platform.OS === 'web') {
      try { return window.localStorage.getItem(KEY); } catch { return null; }
    }
    return AsyncStorage.getItem(KEY);
  },
  async set(v: string): Promise<void> {
    if (Platform.OS === 'web') {
      try { window.localStorage.setItem(KEY, v); } catch { /* ignora */ }
      return;
    }
    await AsyncStorage.setItem(KEY, v);
  },
};

export const loadPreferences = async (): Promise<Preferences> => {
  try {
    const raw = await storage.get();
    if (raw) return { ...defaultPreferences(), ...JSON.parse(raw) };
  } catch {
    // valor corrompido — volta ao padrão
  }
  return defaultPreferences();
};

/**
 * Grava as preferências. Aceita mudança parcial: quem altera só o tema não
 * precisa carregar e reenviar o resto (e não corre o risco de zerar um
 * campo que outra tela acabou de mudar).
 */
export const savePreferences = async (
  patch: Partial<Preferences>,
): Promise<Preferences> => {
  const next = { ...(await loadPreferences()), ...patch };
  try { await storage.set(JSON.stringify(next)); } catch { /* ignora */ }
  return next;
};
