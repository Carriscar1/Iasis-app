// ─────────────────────────────────────────────
//  IASIS — Loja · configuração central
// ─────────────────────────────────────────────

export const PRODUCT = {
  id: 'iasis-dispenser-01',
  name: 'Dispenser Inteligente IASIS',
  shortName: 'Dispenser IASIS',
  description:
    'Dispensador de medicamentos com validação por RFID, pulseira vibratória e app incluso.',
  // Preço em reais. Configurável por env (PRODUCT_PRICE); padrão 499.
  price: Number(process.env.PRODUCT_PRICE ?? 499),
  currency: 'BRL',
} as const;

export const SITE = {
  name: 'IASIS',
  tagline: 'Sua saúde em dia',
  year: 2026,
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
} as const;

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}
