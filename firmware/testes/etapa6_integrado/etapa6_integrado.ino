/*
 * IASIS — Teste 6: tudo integrado
 * ESP32 + RC522 + LCD + HiveMQ + servo (trava) + A4988/NEMA 17
 *
 * Segue o formato de mensagens do app (iasis/dispenser/<id>/...).
 * Regra de seguranca: o ESP32 NUNCA libera dose sozinho. Ele le a pulseira,
 * avisa o app (RFID_READ) e so mexe disco e trava quando chega um DISPENSE.
 *
 * Mecanica assumida (ajuste dispensar() se a do 3D for outra):
 *   - o disco tem COMPARTIMENTOS divisoes; ao ligar, o compartimento 1 tem
 *     que estar alinhado com a saida (alinhe a mao com a fonte desligada);
 *   - o disco gira sempre no mesmo sentido ate o compartimento pedido, com a
 *     trava fechada; a trava abre, a dose cai, a trava fecha.
 *
 * Sem o app, da para testar pelo Web Client do HiveMQ publicando em
 * iasis/dispenser/01/cmd:
 *   {"type":"CMD","command":"VIBRATE_ON","pattern":"urgent"}  → alerta no LCD
 *   {"type":"CMD","command":"DISPENSE","slot":2,"doseId":"test"} → libera
 *   {"type":"CMD","command":"STATUS_REQ"}
 *
 * Montagem: teste 4 + teste 5 juntos (pinagem no guia).
 * Antes de gravar: copie secrets.example.h → secrets.h e preencha.
 *
 * Bibliotecas: MFRC522, LiquidCrystal, PubSubClient, ArduinoJson 7.x, ESP32Servo
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <SPI.h>
#include <MFRC522.h>
#include <LiquidCrystal.h>
#include <ESP32Servo.h>

#if __has_include("secrets.h")
  #include "secrets.h"
#else
  #error "Copie secrets.example.h para secrets.h (mesma pasta do .ino) e preencha"
#endif

#define FIRMWARE   "integrado-1"
#define TLS_INSEGURO 0   // 1 so para diagnostico (veja o teste 3)

// ─── Pinos ───────────────────────────────────
#define PIN_RFID_SS   5
#define PIN_RFID_RST  22

#define PIN_LCD_RS  13
#define PIN_LCD_E   17
#define PIN_LCD_D4  14
#define PIN_LCD_D5  25
#define PIN_LCD_D6  33
#define PIN_LCD_D7  32

#define PIN_SERVO   4

#define PIN_STEP    26
#define PIN_DIR     27
#define PIN_EN      21

// ─── Mecanica ────────────────────────────────
#define COMPARTIMENTOS     8      // use 4, 5, 8 ou 10: tem que dividir 200
#define PASSOS_POR_VOLTA   200
#define PASSOS_POR_COMP    (PASSOS_POR_VOLTA / COMPARTIMENTOS)
#define MEIO_PERIODO_US    2000

#define SERVO_FECHADO      0
#define SERVO_ABERTO       90
#define TEMPO_TRAVA_ABERTA 2000   // ms para a dose cair

static_assert(PASSOS_POR_VOLTA % COMPARTIMENTOS == 0,
              "COMPARTIMENTOS precisa dividir 200, senao o disco desalinha a cada volta");

// Raiz do certificado do HiveMQ Cloud (Let's Encrypt ISRG Root X1, valido ate 2035)
static const char ROOT_CA[] PROGMEM = R"PEM(
-----BEGIN CERTIFICATE-----
MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw
TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh
cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4
WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu
ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY
MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJHP0FDfzm54rVygc
h77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj/RQSa78f0uoxmyF+
0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7iS4+3mX6U
A5/TR5d8mUgjU+g4rk8Kb4Mu0UlXjIB0ttov0DiNewNwIRt18jA8+o+u3dpjq+sW
T8KOEUt+zwvo/7V3LvSye0rgTBIlDHCNAymg4VMk7BPZ7hm/ELNKjD+Jo2FR3qyH
B5T0Y3HsLuJvW5iB4YlcNHlsdu87kGJ55tukmi8mxdAQ4Q7e2RCOFvu396j3x+UC
B5iPNgiV5+I3lg02dZ77DnKxHZu8A/lJBdiB3QW0KtZB6awBdpUKD9jf1b0SHzUv
KBds0pjBqAlkd25HN7rOrFleaJ1/ctaJxQZBKT5ZPt0m9STJEadao0xAH0ahmbWn
OlFuhjuefXKnEgV4We0+UXgVCwOPjdAvBbI+e0ocS3MFEvzG6uBQE3xDk3SzynTn
jh8BCNAw1FtxNrQHusEwMFxIt4I7mKZ9YIqioymCzLq9gwQbooMDQaHWBfEbwrbw
qHyGO0aoSCqI3Haadr8faqU9GY/rOPNk3sgrDQoo//fb4hVC1CLQJ13hef4Y53CI
rU7m2Ys6xt0nUW7/vGT1M0NPAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNV
HRMBAf8EBTADAQH/MB0GA1UdDgQWBBR5tFnme7bl5AFzgAiIyBpY9umbbjANBgkq
hkiG9w0BAQsFAAOCAgEAVR9YqbyyqFDQDLHYGmkgJykIrGF1XIpu+ILlaS/V9lZL
ubhzEFnTIZd+50xx+7LSYK05qAvqFyFWhfFQDlnrzuBZ6brJFe+GnY+EgPbk6ZGQ
3BebYhtF8GaV0nxvwuo77x/Py9auJ/GpsMiu/X1+mvoiBOv/2X/qkSsisRcOj/KK
NFtY2PwByVS5uCbMiogziUwthDyC3+6WVwW6LLv3xLfHTjuCvjHIInNzktHCgKQ5
ORAzI4JMPJ+GslWYHb4phowim57iaztXOoJwTdwJx4nLCgdNbOhdjsnvzqvHu7Ur
TkXWStAmzOVyyghqpZXjFaH3pO3JLF+l+/+sKAIuvtd7u+Nxe5AW0wdeRlN8NwdC
jNPElpzVmbUq4JUagEiuTDkHzsxHpFKVK7q4+63SM1N95R1NbdWhscdCb+ZAJzVc
oyi3B43njTOQ5yOf+1CceWxG1bQVs5ZufpsMljq4Ui0/1lvh+wjChP4kqKOJ2qxq
4RgqsahDYVvTH9w7jXbyLeiNdd8XM2w9U/t7y0Ff/9yi0GE44Za4rF2LN9d11TPA
mRGunUHBcnWEvgJBQl9nJEiU0Zsnvgc/ubhPgXRR4Xq37Z0j4r7g1SgEEzwxA57d
emyPxgcYxn/eR44/KJ4EBs+lVDR3veyJm+kXQ99b21/+jh5Xos1AnX5iItreGCc=
-----END CERTIFICATE-----
)PEM";

// ─── Objetos ─────────────────────────────────
MFRC522          rfid(PIN_RFID_SS, PIN_RFID_RST);
LiquidCrystal    lcd(PIN_LCD_RS, PIN_LCD_E, PIN_LCD_D4, PIN_LCD_D5, PIN_LCD_D6, PIN_LCD_D7);
WiFiClientSecure rede;
PubSubClient     mqtt(rede);
Servo            trava;
Preferences      prefs;

String TOPICO_STATUS, TOPICO_RFID, TOPICO_DISPENSE, TOPICO_VIBRATE, TOPICO_CMD;

// ─── Estado ──────────────────────────────────
String tagAutorizada;
int    posicaoDisco = 0;          // 0 = compartimento 1 na saida
bool   alertaAtivo  = false;      // "hora do remedio" pedida pelo app
String padraoAlerta = "gentle";

bool   dispensaPendente = false;
bool   dispensando      = false;
int    slotPendente     = 0;
String dosePendente     = "";
String ultimaDose       = "";     // evita liberar a mesma dose duas vezes

unsigned long voltarTelaEm    = 0;
unsigned long ultimaTentativa = 0;
unsigned long ultimoStatus    = 0;

// ─── Tela ────────────────────────────────────
void tela(const String& linha1, const String& linha2 = "") {
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print(linha1.substring(0, 16));
  lcd.setCursor(0, 1); lcd.print(linha2.substring(0, 16));
}

void telaEspera() {
  if (alertaAtivo) { tela("Hora do remedio!", "Use a pulseira"); return; }
  String rede = WiFi.status() != WL_CONNECTED ? "Sem WiFi"
              : mqtt.connected()              ? "Nuvem OK"
              :                                 "Sem nuvem";
  tela("Use a pulseira", rede);
}

// ─── Publicacoes ─────────────────────────────
void publicar(const String& topico, JsonDocument& doc, bool retida = false) {
  if (!mqtt.connected()) return;
  char buf[256];
  serializeJson(doc, buf);
  mqtt.publish(topico.c_str(), buf, retida);
}

void publicarStatus() {
  JsonDocument doc;
  doc["type"]     = "STATUS";
  doc["online"]   = true;           // sem DHT22: o app mostra "--" em umidade/temperatura
  doc["firmware"] = FIRMWARE;
  doc["uptime"]   = millis() / 1000;
  publicar(TOPICO_STATUS, doc, true);
}

// Hoje nada vibra de verdade: o estado publicado e o do alerta no LCD,
// ate a equipe decidir quem faz a pulseira vibrar.
void publicarAlerta() {
  JsonDocument doc;
  doc["type"]    = "VIBRATE";
  doc["active"]  = alertaAtivo;
  doc["pattern"] = padraoAlerta;
  publicar(TOPICO_VIBRATE, doc, true);
}

void publicarAck(int slot, const String& doseId, bool sucesso, const char* erro = nullptr) {
  JsonDocument doc;
  doc["type"]    = "DISPENSE_ACK";
  doc["slot"]    = slot;
  doc["doseId"]  = doseId;
  doc["success"] = sucesso;
  if (erro) doc["errorCode"] = erro;
  publicar(TOPICO_DISPENSE, doc);
  Serial.printf("[Dispensa] ACK slot %d: %s %s\n", slot, sucesso ? "OK" : "FALHOU", erro ? erro : "");
}

void definirAlerta(bool ativo, const String& padrao) {
  alertaAtivo  = ativo;
  padraoAlerta = padrao;
  publicarAlerta();
  if (!voltarTelaEm) telaEspera();
}

// ─── Mecanica ────────────────────────────────
// Espera atendendo a nuvem. Pode ser usada fora do callback do MQTT.
void esperar(unsigned long ms) {
  unsigned long inicio = millis();
  while (millis() - inicio < ms) {
    if (mqtt.connected()) mqtt.loop();
    delay(10);
  }
}

void girarDisco(int passos) {
  if (passos <= 0) return;
  digitalWrite(PIN_DIR, HIGH);
  digitalWrite(PIN_EN, LOW);
  delay(5);
  for (int i = 0; i < passos; i++) {
    digitalWrite(PIN_STEP, HIGH); delayMicroseconds(MEIO_PERIODO_US);
    digitalWrite(PIN_STEP, LOW);  delayMicroseconds(MEIO_PERIODO_US);
  }
  delay(50);
  digitalWrite(PIN_EN, HIGH);
}

void dispensar(int slot, const String& doseId) {
  dispensando = true;
  int destino  = slot - 1;
  int avancar  = (destino - posicaoDisco + COMPARTIMENTOS) % COMPARTIMENTOS;

  Serial.printf("[Dispensa] Compartimento %d (avancar %d)\n", slot, avancar);
  tela("Liberando dose", "Compartimento " + String(slot));

  trava.write(SERVO_FECHADO);           // garante: nada cai enquanto o disco gira
  esperar(300);
  girarDisco(avancar * PASSOS_POR_COMP);
  posicaoDisco = destino;

  trava.write(SERVO_ABERTO);
  esperar(TEMPO_TRAVA_ABERTA);
  trava.write(SERVO_FECHADO);
  esperar(300);

  ultimaDose = doseId;
  publicarAck(slot, doseId, true);

  if (alertaAtivo) definirAlerta(false, padraoAlerta);
  tela("Dose liberada", "Compartimento " + String(slot));
  voltarTelaEm = millis() + 3000;
  dispensando = false;
}

// ─── Comandos do app ─────────────────────────
// Nada demorado aqui dentro: a dispensa so e agendada e roda no loop().
void aoReceber(char* topico, byte* payload, unsigned int tamanho) {
  JsonDocument doc;
  if (deserializeJson(doc, payload, tamanho)) {
    Serial.println("[MQTT] Mensagem invalida (nao e JSON)");
    return;
  }
  String tipo    = doc["type"]    | "";
  String comando = doc["command"] | "";
  Serial.printf("[MQTT] %s %s\n", tipo.c_str(), comando.c_str());

  if (tipo == "SET_TAG") {
    String tag = doc["tag"] | "";
    tag.toUpperCase();
    if (tag.length() == 0) return;
    tagAutorizada = tag;
    prefs.putString("tag", tag);
    Serial.printf("[RFID] Nova tag autorizada: %s\n", tag.c_str());
    return;
  }
  if (tipo != "CMD") return;

  if (comando == "DISPENSE") {
    int    slot   = doc["slot"]   | 1;
    String doseId = doc["doseId"] | "";

    if (slot < 1 || slot > COMPARTIMENTOS) { publicarAck(slot, doseId, false, "BAD_SLOT"); return; }
    if (dispensando || dispensaPendente)   { publicarAck(slot, doseId, false, "BUSY");     return; }
    // Paciente logado em dois aparelhos = dois DISPENSE iguais. So o primeiro vale.
    if (doseId.length() && doseId != "test" && doseId == ultimaDose) {
      publicarAck(slot, doseId, false, "DUPLICATE");
      return;
    }
    slotPendente     = slot;
    dosePendente     = doseId;
    dispensaPendente = true;
  }
  else if (comando == "VIBRATE_ON")  definirAlerta(true,  doc["pattern"] | "gentle");
  else if (comando == "VIBRATE_OFF") definirAlerta(false, padraoAlerta);
  else if (comando == "STATUS_REQ")  publicarStatus();
  else if (comando == "RESTART")     { delay(300); ESP.restart(); }
}

// ─── Conexao (nunca trava o leitor) ──────────
void manterConexao() {
  if (mqtt.connected()) { mqtt.loop(); return; }

  if (WiFi.status() != WL_CONNECTED) {
    if (millis() - ultimaTentativa < 15000) return;
    ultimaTentativa = millis();
    Serial.println("[WiFi] Sem conexao, tentando de novo...");
    WiFi.disconnect();
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    return;
  }

  if (millis() - ultimaTentativa < 5000) return;
  ultimaTentativa = millis();

  Serial.printf("[MQTT] Conectando a %s:%d...\n", MQTT_HOST, MQTT_PORT);
  String id = String("iasis_esp32_") + DISPENSER_ID;
  if (mqtt.connect(id.c_str(), MQTT_USER, MQTT_PASS)) {
    Serial.println("[MQTT] Conectado!");
    mqtt.subscribe(TOPICO_CMD.c_str(), 1);
    publicarStatus();
    publicarAlerta();
  } else {
    Serial.printf("[MQTT] Falhou, rc=%d\n", mqtt.state());
  }
  if (!voltarTelaEm) telaEspera();
}

// ─── RFID ────────────────────────────────────
String lerUid() {
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  return uid;
}

void verificarPulseira() {
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return;

  String uid    = lerUid();
  bool   valida = (uid == tagAutorizada);
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();

  JsonDocument doc;
  doc["type"]  = "RFID_READ";
  doc["tag"]   = uid;
  doc["valid"] = valida;
  publicar(TOPICO_RFID, doc);

  Serial.printf("[RFID] %s -> %s\n", uid.c_str(), valida ? "AUTORIZADA" : "NEGADA");
  if (!valida)                tela("Tag negada", uid);
  else if (!mqtt.connected()) tela("Pulseira OK", "Sem nuvem");
  else                        tela("Pulseira OK", "Aguardando app");
  voltarTelaEm = millis() + 4000;
}

// ─── Setup / loop ────────────────────────────
void setup() {
  // Motor desligado antes de qualquer outra coisa
  pinMode(PIN_EN, OUTPUT);
  digitalWrite(PIN_EN, HIGH);
  pinMode(PIN_STEP, OUTPUT);
  pinMode(PIN_DIR, OUTPUT);

  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== IASIS | Teste 6: integrado ===");

  lcd.begin(16, 2);
  tela("IASIS", "Iniciando...");

  trava.setPeriodHertz(50);
  trava.attach(PIN_SERVO, 500, 2400);
  trava.write(SERVO_FECHADO);

  prefs.begin("iasis", false);
  tagAutorizada = prefs.getString("tag", TAG_AUTORIZADA);
  Serial.printf("[RFID] Tag autorizada: %s\n", tagAutorizada.c_str());

  SPI.begin();
  rfid.PCD_Init();
  delay(50);
  Serial.printf("[RC522] Versao do chip: 0x%02X\n", rfid.PCD_ReadRegister(MFRC522::VersionReg));

  String base     = String("iasis/dispenser/") + DISPENSER_ID;
  TOPICO_STATUS   = base + "/status";
  TOPICO_RFID     = base + "/rfid";
  TOPICO_DISPENSE = base + "/dispense";
  TOPICO_VIBRATE  = base + "/vibrate";
  TOPICO_CMD      = base + "/cmd";

#if TLS_INSEGURO
  rede.setInsecure();
#else
  rede.setCACert(ROOT_CA);
#endif
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(aoReceber);
  mqtt.setBufferSize(512);

  tela("Conectando WiFi", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  for (int i = 0; i < 30 && WiFi.status() != WL_CONNECTED; i++) delay(500);

  tela("Conectando", "nuvem...");
  ultimaTentativa = millis() - 15000;
  manterConexao();
  telaEspera();
}

void loop() {
  manterConexao();
  verificarPulseira();

  if (dispensaPendente) {
    dispensaPendente = false;
    dispensar(slotPendente, dosePendente);
  }

  if (voltarTelaEm && millis() > voltarTelaEm) {
    voltarTelaEm = 0;
    telaEspera();
  }

  if (mqtt.connected() && millis() - ultimoStatus > 30000) {
    ultimoStatus = millis();
    publicarStatus();
  }

  delay(20);
}
