// ─────────────────────────────────────────────
//  IASIS — Loja · geração de códigos de ativação
//  Formato: IASIS-XXXX-XXXX (sem caracteres ambíguos).
// ─────────────────────────────────────────────
import { randomInt } from 'crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem I, O, 0, 1

function block(len: number): string {
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

export function generateActivationCode(): string {
  return `IASIS-${block(4)}-${block(4)}`;
}
