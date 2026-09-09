// ─────────────────────────────────────────────
//  IASIS — Localização
//
//  Usada quando o paciente aciona a emergência (ou quando uma queda é
//  detectada): os cuidadores recebem onde a pessoa está.
//
//  A precisão do GPS é mostrada na tela porque ela muda o que a informação
//  vale. "Precisão de 8 metros" aponta a casa; "precisão de 200 metros"
//  aponta o quarteirão. Quem vai socorrer precisa saber a diferença antes
//  de sair de carro.
// ─────────────────────────────────────────────
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { ensurePermission, type ExpoPermission } from './permissions';

/** Faixas de qualidade do sinal. */
export type Accuracy = 'high' | 'medium' | 'low' | 'unknown';

export type Fix = {
  latitude: number;
  longitude: number;
  /** Raio de incerteza em metros, como o sistema reporta. */
  accuracyMeters: number | null;
  accuracy: Accuracy;
  at: string;
};

export type FixResult = {
  fix: Fix | null;
  error: string | null;
  /** Distingue "negou a permissão" de "o GPS não respondeu". */
  reason?: 'permission' | 'disabled' | 'timeout' | 'unsupported';
};

/**
 * Classificação do sinal:
 *  · alta   — menos de 10 m: dá para apontar a casa
 *  · média  — 10 a 30 m: dá para apontar a rua
 *  · baixa  — mais de 30 m: só o bairro
 */
export function classifyAccuracy(meters: number | null | undefined): Accuracy {
  if (meters == null || !Number.isFinite(meters)) return 'unknown';
  if (meters < 10) return 'high';
  if (meters <= 30) return 'medium';
  return 'low';
}

/** Cor e rótulo do indicador. */
export function accuracyLabel(a: Accuracy): { label: string; hint: string } {
  switch (a) {
    case 'high':
      return { label: 'Precisão alta', hint: 'Dá para chegar até o endereço' };
    case 'medium':
      return { label: 'Precisão média', hint: 'Aponta a rua, não o número' };
    case 'low':
      return { label: 'Precisão baixa', hint: 'Só a região — tente a céu aberto' };
    default:
      return { label: 'Precisão desconhecida', hint: 'O aparelho não informou' };
  }
}

/** Distância aproximada em metros entre dois pontos (fórmula de Haversine). */
export function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;

  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/**
 * Pega a posição atual.
 *
 * Nada aqui pode derrubar o app: GPS desligado, permissão negada, aparelho
 * sem receptor ou navegador sem suporte são todos tratados como resultado,
 * não como exceção. Numa tela de emergência, travar é o pior desfecho
 * possível.
 */
export async function getCurrentFix(
  current?: ExpoPermission | null,
  timeoutMs = 12_000,
): Promise<FixResult> {
  const ok = await ensurePermission(
    'location',
    () => Location.requestForegroundPermissionsAsync(),
    current,
  );
  if (!ok) {
    return { fix: null, error: 'Sem permissão de localização.', reason: 'permission' };
  }

  // GPS desligado no aparelho: o pedido ficaria pendurado sem isso.
  try {
    const enabled = await Location.hasServicesEnabledAsync();
    if (!enabled) {
      return {
        fix: null,
        error: 'A localização está desligada no aparelho. Ligue o GPS e tente de novo.',
        reason: 'disabled',
      };
    }
  } catch {
    // Alguns navegadores não implementam essa checagem — segue e deixa o
    // pedido de posição decidir.
  }

  try {
    // O expo-location não tem timeout próprio; sem esta corrida a tela de
    // emergência poderia ficar girando para sempre debaixo de uma laje.
    const position = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);

    if (!position) {
      return {
        fix: null,
        error: 'O GPS não respondeu a tempo. Tente perto de uma janela ou a céu aberto.',
        reason: 'timeout',
      };
    }

    const meters = position.coords.accuracy ?? null;

    return {
      fix: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters: meters,
        accuracy: classifyAccuracy(meters),
        at: new Date(position.timestamp).toISOString(),
      },
      error: null,
    };
  } catch {
    return {
      fix: null,
      error: 'Não consegui obter a localização neste aparelho.',
      reason: Platform.OS === 'web' ? 'unsupported' : 'timeout',
    };
  }
}

/** Link do mapa para mandar ao cuidador pelo WhatsApp. */
export function mapsLink(fix: Pick<Fix, 'latitude' | 'longitude'>): string {
  return `https://www.google.com/maps?q=${fix.latitude},${fix.longitude}`;
}

/** Coordenada legível na tela. */
export function prettyCoords(fix: Pick<Fix, 'latitude' | 'longitude'>): string {
  return `${fix.latitude.toFixed(5)}, ${fix.longitude.toFixed(5)}`;
}
