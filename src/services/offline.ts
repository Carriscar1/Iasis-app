// ─────────────────────────────────────────────
//  IASIS — Histórico disponível sem internet
//
//  Um app de saúde que só mostra dados com rede é um app que falha na
//  consulta médica — justo onde o histórico de adesão mais importa, e onde
//  o sinal costuma ser ruim.
//
//  A estratégia é "última versão boa": toda leitura bem-sucedida grava uma
//  cópia no aparelho; quando a rede falha, a tela mostra essa cópia com a
//  data de quando ela foi tirada, em vez de uma tela vazia ou um erro.
// ─────────────────────────────────────────────
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const PREFIX = '@iasis:cache:';

/** O que guardamos, por usuário. */
export type CacheKey = 'doses' | 'adherence' | 'medications' | 'alerts';

type Envelope<T> = {
  savedAt: string;
  data: T;
};

const storage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try { return window.localStorage.getItem(key); } catch { return null; }
    }
    try { return await AsyncStorage.getItem(key); } catch { return null; }
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      try { window.localStorage.setItem(key, value); } catch { /* cota cheia */ }
      return;
    }
    try { await AsyncStorage.setItem(key, value); } catch { /* ignora */ }
  },
  async remove(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      try { window.localStorage.removeItem(key); } catch { /* ignora */ }
      return;
    }
    try { await AsyncStorage.removeItem(key); } catch { /* ignora */ }
  },
};

// A chave inclui o usuário: em aparelho compartilhado (caso comum entre
// paciente e cuidador da mesma casa) um não pode ver o histórico do outro.
const keyFor = (key: CacheKey, userId: string) => `${PREFIX}${userId}:${key}`;

export async function writeCache<T>(
  key: CacheKey,
  userId: string,
  data: T,
): Promise<void> {
  const envelope: Envelope<T> = { savedAt: new Date().toISOString(), data };
  await storage.set(keyFor(key, userId), JSON.stringify(envelope));
}

export async function readCache<T>(
  key: CacheKey,
  userId: string,
): Promise<{ data: T; savedAt: string } | null> {
  const raw = await storage.get(keyFor(key, userId));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Envelope<T>;
    if (!parsed || typeof parsed.savedAt !== 'string') return null;
    return { data: parsed.data, savedAt: parsed.savedAt };
  } catch {
    // Cópia corrompida não pode derrubar a tela: descarta e segue online.
    await storage.remove(keyFor(key, userId));
    return null;
  }
}

/** Apaga tudo do usuário — chamado no logout. */
export async function clearCache(userId: string): Promise<void> {
  const keys: CacheKey[] = ['doses', 'adherence', 'medications', 'alerts'];
  await Promise.all(keys.map((k) => storage.remove(keyFor(k, userId))));
}

export type Cached<T> = {
  data: T;
  /** true quando veio do aparelho porque a rede falhou. */
  fromCache: boolean;
  /** Quando a cópia local foi tirada (só quando fromCache). */
  savedAt?: string;
  error: string | null;
};

/**
 * Busca online e, se falhar, cai na cópia local.
 *
 * O critério de "falhou" é o próprio resultado da consulta: se veio erro,
 * tentamos a cópia. Não usamos um detector de conectividade separado porque
 * ele mente nos dois sentidos — Wi-Fi conectado sem saída para a internet
 * aparece como online, e a consulta é a única prova que interessa.
 */
export async function withCache<T>(
  key: CacheKey,
  userId: string,
  fetcher: () => Promise<{ data: T; error: string | null }>,
): Promise<Cached<T>> {
  let result: { data: T; error: string | null };

  try {
    result = await fetcher();
  } catch {
    result = { data: undefined as unknown as T, error: 'network' };
  }

  if (!result.error) {
    await writeCache(key, userId, result.data);
    return { data: result.data, fromCache: false, error: null };
  }

  const cached = await readCache<T>(key, userId);
  if (cached) {
    return {
      data: cached.data,
      fromCache: true,
      savedAt: cached.savedAt,
      error: null,
    };
  }

  // Sem rede e sem cópia: aí não há o que mostrar mesmo.
  return { data: result.data, fromCache: false, error: result.error };
}

/** "há 3 minutos", "ontem às 14:20" — para o aviso de dados offline. */
export function describeAge(savedAt: string): string {
  const then = new Date(savedAt);
  const mins = Math.floor((Date.now() - then.getTime()) / 60000);

  if (mins < 1)  return 'agora há pouco';
  if (mins < 60) return `há ${mins} min`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours} h`;

  const days = Math.floor(hours / 24);
  if (days === 1) {
    return `ontem às ${then.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return `em ${then.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
}
