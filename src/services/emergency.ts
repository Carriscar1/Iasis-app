// ─────────────────────────────────────────────
//  IASIS — Emergência
//
//  Dois caminhos chegam aqui: o paciente aperta o botão de socorro, ou o
//  acelerômetro detecta uma queda e ninguém cancela a contagem regressiva.
//  Nos dois casos, todos os cuidadores da equipe são avisados — com a
//  localização e a precisão dela.
// ─────────────────────────────────────────────
import { supabase } from './supabase';
import { mapsLink, type Fix } from './location';
import { openWhatsApp } from './chat';

export type EmergencyKind = 'emergency' | 'fall';

export type EmergencyResult = {
  /** Quantos cuidadores receberam o aviso. */
  notified: number;
  error: string | null;
};

/**
 * Grava o alerta para toda a equipe de cuidado.
 *
 * A localização é opcional de propósito: se o GPS falhar, o pedido de
 * socorro tem que sair mesmo assim. Um aviso sem coordenada é
 * incomparavelmente melhor que nenhum aviso.
 */
export async function raiseEmergency(
  fix: Fix | null,
  kind: EmergencyKind = 'emergency',
): Promise<EmergencyResult> {
  const { data, error } = await supabase.rpc('raise_emergency', {
    p_lat: fix?.latitude ?? null,
    p_lon: fix?.longitude ?? null,
    p_accuracy: fix?.accuracyMeters ?? null,
    p_kind: kind,
  });

  if (error) {
    return { notified: 0, error: 'Não consegui avisar seus cuidadores agora.' };
  }

  return { notified: Number(data ?? 0), error: null };
}

/** Texto do WhatsApp, com o link do mapa quando há posição. */
export function emergencyMessage(
  name: string,
  fix: Fix | null,
  kind: EmergencyKind = 'emergency',
): string {
  const head =
    kind === 'fall'
      ? `${name} pode ter sofrido uma queda agora e não respondeu ao aviso do IASIS.`
      : `${name} acionou a emergência pelo IASIS.`;

  if (!fix) {
    return `${head} A localização não estava disponível — tente ligar.`;
  }

  const precision =
    fix.accuracyMeters != null
      ? ` (precisão de ${Math.round(fix.accuracyMeters)} m)`
      : '';

  return `${head}\n\nLocalização${precision}:\n${mapsLink(fix)}`;
}

/** Abre o WhatsApp de um cuidador já com o texto da emergência pronto. */
export async function alertByWhatsApp(
  phone: string,
  name: string,
  fix: Fix | null,
  kind: EmergencyKind = 'emergency',
): Promise<{ ok: boolean; error?: string }> {
  return openWhatsApp(phone, emergencyMessage(name, fix, kind));
}
