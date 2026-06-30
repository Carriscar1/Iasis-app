// ─────────────────────────────────────────────
//  IASIS — Metadados do aplicativo
//  Centraliza versão / ano para o rodapé não ficar desatualizado
//  espalhado pelas telas. Mude aqui e reflete em todo lugar.
// ─────────────────────────────────────────────

export const APP_META = {
  name:    'IASIS',
  version: '1.0.0',
  // Ano do TCC — atualize ao virar o ano letivo.
  year:    2026,
  tagline: 'Sua saúde em dia',
} as const;

// Texto pronto do rodapé: "IASIS v1.0.0 · TCC 2026"
export const FOOTER_LABEL = `${APP_META.name} v${APP_META.version} · TCC ${APP_META.year}`;
