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
  largeText: boolean;   // modo fácil: tudo maior
}

export const defaultPreferences = (): Preferences => ({ largeText: false });

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

export const savePreferences = async (p: Preferences): Promise<void> => {
  try { await storage.set(JSON.stringify(p)); } catch { /* ignora */ }
};
