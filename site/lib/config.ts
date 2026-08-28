// ─────────────────────────────────────────────
//  IASIS — Loja · configuração central
// ─────────────────────────────────────────────

export const PRODUCT = {
  id: 'iasis-dispenser-01',
  name: 'Dispenser Inteligente IASIS',
  shortName: 'Dispenser IASIS',
  description:
    'Dispensador de medicamentos com validação por RFID, pulseira vibratória e app incluso.',
  price: Number(process.env.PRODUCT_PRICE ?? 499),
  currency: 'BRL',
} as const;

export const SITE = {
  name: 'IASIS',
  tagline: 'Sua saúde em dia',
  year: 2026,
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
} as const;

// true quando o Mercado Pago real está configurado. Sem token válido, a loja
// entra em MODO DEMONSTRAÇÃO: o pagamento é simulado (sem cobrança) e o código
// de ativação é emitido na hora — igual ao simulador do ESP32 no app.
export function isMpConfigured(): boolean {
  const t = process.env.MP_ACCESS_TOKEN ?? '';
  return t.startsWith('APP_USR-') || t.startsWith('TEST-');
}

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
