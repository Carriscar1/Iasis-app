// ─────────────────────────────────────────────
//  IASIS — Metadados do aplicativo
//  Centraliza versão / ano para o rodapé não ficar desatualizado
//  espalhado pelas telas. Mude aqui e reflete em todo lugar.
// ─────────────────────────────────────────────

export const APP_META = {
  name:    'IASIS',
  version: '1.0.5',
  // Ano do TCC — atualize ao virar o ano letivo.
  year:    2026,
  tagline: 'Sua saúde em dia',
} as const;

// Texto pronto do rodapé: "IASIS v1.0.0 · TCC 2026"
export const FOOTER_LABEL = `${APP_META.name} v${APP_META.version} · TCC ${APP_META.year}`;

// ─────────────────────────────────────────────
//  Conexão com o dispenser físico (ESP32 via MQTT)
//  Preencha com os dados do seu broker (HiveMQ Cloud / Mosquitto).
//  Enquanto o broker não estiver configurado, o app entra automaticamente
//  em MODO DEMONSTRAÇÃO: um simulador fiel do ESP32 responde aos comandos
//  (sensores, RFID, dispensa) — perfeito para apresentar na feira sem
//  depender do hardware montado.
// ─────────────────────────────────────────────
export const MQTT_CONFIG = {
  brokerUrl: 'wss://SEU_BROKER.hivemq.cloud:8884/mqtt', // ⚠️ substitua
  username:  'iasis_app',
  password:  'SUA_SENHA_MQTT',
  dispenserId: '01',
} as const;

// Código de ativação da compra no cadastro. Desligado enquanto as contas são
// criadas na hora (feira e apresentações); volte para true quando as vendas
// começarem — o resto do fluxo (validar e queimar o código) continua pronto.
export const REQUIRE_ACTIVATION_CODE = false;

// true quando o broker real foi configurado (deixa de usar o simulador).
export const isMqttConfigured = () =>
  !MQTT_CONFIG.brokerUrl.includes('SEU_BROKER') &&
  MQTT_CONFIG.password !== 'SUA_SENHA_MQTT';
