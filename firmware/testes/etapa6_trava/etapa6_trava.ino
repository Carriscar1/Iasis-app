/*
 * IASIS — Teste 6 com trava: app pede o remédio → vibra até a pulseira → app libera
 *         → o disco gira → a trava (paleta do servo) abre → a dose cai na calha
 *
 * Fluxo (o ESP32 nunca libera dose sozinho, quem decide é o app):
 *   1. App manda em iasis/dispenser/01/cmd {"type":"CMD","command":"VIBRATE_ON"}
 *      → módulo vibra em pulsos e o LCD avisa "Hora do remedio!"
 *   2. Pulseira lida → ESP32 publica em .../rfid e para de vibrar se for a certa
 *      (pulseira errada continua vibrando)
 *   3. App manda {"type":"CMD","command":"DISPENSE","slot":N,"doseId":"..."}
 *      → com a trava FECHADA o disco gira 1 compartimento: a dose cai no furo
 *        da saída e fica parada em cima da paleta
 *      → a trava ABRE, a dose cai na calha, a trava FECHA
 *      (MODO_DEMO 1: abre a trava e dá uma volta inteira parando em cada
 *       compartimento; nunca gira com a trava fechada e dose em cima dela)
 *      → responde em iasis/dispenser/01/dispense:
 *        {"type":"DISPENSE_ACK","slot":N,"doseId":"...","success":true}
 *      (slot e doseId voltam iguais aos do comando: é assim que o app sabe
 *       que foi a dose dele; se der errado, success=false e errorCode)
 *   4. App manda {"command":"VIBRATE_OFF"} → para de vibrar
 *   5. Sem resposta em 5 min → para sozinho e avisa a nuvem (ALERT_TIMEOUT)
 *
 * Ligações:
 *   RC522 e LCD iguais ao teste 4
 *   Módulo de vibração: VCC → 5 V   GND → GND   IN/SIG → GPIO 4
 *   A4988: STEP 26, DIR 27, EN 21 (igual ao teste 5), VMOT 12 V, VDD 5 V
 *          MS1, MS2, MS3 soltos (passo inteiro: 200 passos = 1 volta)
 *   Servo SG90 da trava: laranja (sinal) → GPIO 17
 *                        vermelho → 5 V do regulador (NÃO no 3V3 do ESP32)
 *                        marrom → GND (o mesmo GND do ESP32)
 *
 * Ajuste da trava pelo Monitor Serial (115200, "Nova linha"):
 *   a = abrir   f = fechar   + / - = mexe 5° no ângulo fechado (para acertar)
 *
 * ⚠️ Repositório PÚBLICO: não faça commit com as senhas preenchidas.
 * Bibliotecas: MFRC522, LiquidCrystal, PubSubClient (Nick O'Leary),
 *              ArduinoJson 7.x (Benoit Blanchon), ESP32Servo (Kevin Harrington)
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <MFRC522.h>
#include <LiquidCrystal.h>
#include <ESP32Servo.h>

#define WIFI_SSID      "SUA_REDE_WIFI"        // rede 2,4 GHz (o ESP32 nao enxerga 5 GHz)
#define WIFI_PASSWORD  "SUA_SENHA_WIFI"
#define MQTT_HOST      "xxxxxxxx.s1.eu.hivemq.cloud"
#define MQTT_PORT      8883
#define MQTT_USER      "SEU_USUARIO_MQTT"
#define MQTT_PASS      "SUA_SENHA_MQTT"

#define DISPENSER_ID   "01"
#define TAG_AUTORIZADA "UID_DA_SUA_PULSEIRA"   // o UID que aparece no Serial do teste 1
#define TLS_INSEGURO   0

#define PIN_RFID_SS   5
#define PIN_RFID_RST  22
#define PIN_LCD_RS 13
#define PIN_LCD_E  15
#define PIN_LCD_D4 14
#define PIN_LCD_D5 25
#define PIN_LCD_D6 33
#define PIN_LCD_D7 32

#define PIN_VIBRA     4
#define VIBRA_LIGADO  HIGH        // se ficar invertido, troque para LOW
#define ALERTA_MAX_MS 300000UL    // 5 min vibrando sem pulseira → desiste

#define PIN_STEP 26
#define PIN_DIR  27
#define PIN_EN   21
#define COMPARTIMENTOS   8
#define PASSOS_POR_VOLTA 200      // passo inteiro (MS1-3 soltos); com micropasso 1/4 seria 800
#define MODO_DEMO        1        // 1 = volta inteira por dose (demonstração); 0 = só um compartimento
#if MODO_DEMO
#define PASSOS_POR_DOSE  PASSOS_POR_VOLTA                       // 200 = 360°, o disco dá a volta completa
#else
#define PASSOS_POR_DOSE  (PASSOS_POR_VOLTA / COMPARTIMENTOS)   // 25 = 45°, um compartimento
#endif
#define MEIO_PERIODO_US 8000      // o valor que funcionou no teste 5
#define SENTIDO_HORARIO true
#define PAUSA_COMPARTIMENTO_MS 600   // na volta inteira: para em cada compartimento e a dose cai parada

// Trava (paleta embaixo da saída). Monte o braço do servo com ele em SERVO_FECHADO
// e a paleta tampando a saída. Abrir = girar 80° no sentido HORÁRIO visto de cima.
// Se ao abrir a paleta for para o lado errado (para a esquerda/frente), troque
// SENTIDO_TRAVA para -1.
#define PIN_SERVO        17
#define SERVO_FECHADO    90
#define GIRO_TRAVA       80
#define SENTIDO_TRAVA    1
#define TRAVA_ABERTA_MS  1500        // tempo aberta para a dose cair
#define DOSE_ASSENTAR_MS 400         // depois do disco parar, antes de abrir

// Cole aqui o MESMO bloco ROOT_CA do teste 4, sem mudar nada:
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

MFRC522          rfid(PIN_RFID_SS, PIN_RFID_RST);
LiquidCrystal    lcd(PIN_LCD_RS, PIN_LCD_E, PIN_LCD_D4, PIN_LCD_D5, PIN_LCD_D6, PIN_LCD_D7);
WiFiClientSecure rede;
PubSubClient     mqtt(rede);
Servo            trava;
int              anguloFechado = SERVO_FECHADO;
int              anguloAtual   = SERVO_FECHADO;

String TOPICO_STATUS, TOPICO_RFID, TOPICO_CMD, TOPICO_VIBRATE, TOPICO_DISPENSE;

enum Estado { ESPERA, ALERTA };
Estado estado = ESPERA;

unsigned long alertaDesde = 0, voltarTelaEm = 0, ultimaTentativa = 0, ultimoStatus = 0;
unsigned long doses = 0;

// ─── Tela ────────────────────────────────────
void tela(const String& l1, const String& l2 = "") {
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print(l1.substring(0, 16));
  lcd.setCursor(0, 1); lcd.print(l2.substring(0, 16));
}

void telaEspera() {
  if (estado == ALERTA) { tela("Hora do remedio!", "Use a pulseira"); return; }
  tela("IASIS pronto", WiFi.status() != WL_CONNECTED ? "Sem WiFi"
                     : mqtt.connected()              ? "Nuvem OK"
                     :                                 "Sem nuvem");
}

// ─── Atuadores ───────────────────────────────
void vibra(bool ligado) {
  digitalWrite(PIN_VIBRA, ligado ? VIBRA_LIGADO : !VIBRA_LIGADO);
}

void girar(int passos) {
  digitalWrite(PIN_DIR, SENTIDO_HORARIO ? HIGH : LOW);
  digitalWrite(PIN_EN, LOW);          // liga o driver
  delay(5);
  for (int i = 0; i < passos; i++) {
    digitalWrite(PIN_STEP, HIGH); delayMicroseconds(MEIO_PERIODO_US);
    digitalWrite(PIN_STEP, LOW);  delayMicroseconds(MEIO_PERIODO_US);
  }
  delay(50);
  digitalWrite(PIN_EN, HIGH);         // desliga: não esquenta parado
}

// Move o servo devagar (2° a cada 8 ms): a dose não é arremessada e o servo não dá tranco
void moverTrava(int alvo) {
  alvo = constrain(alvo, 0, 180);
  while (anguloAtual != alvo) {
    anguloAtual += (alvo > anguloAtual) ? min(2, alvo - anguloAtual) : -min(2, anguloAtual - alvo);
    trava.write(anguloAtual);
    delay(8);
  }
}

void fecharTrava() { moverTrava(anguloFechado); }
void abrirTrava()  { moverTrava(anguloFechado + SENTIDO_TRAVA * GIRO_TRAVA); }

// ─── Nuvem ───────────────────────────────────
void publicar(const String& topico, JsonDocument& doc, bool reter = false) {
  if (!mqtt.connected()) return;
  char buf[256];
  serializeJson(doc, buf);
  mqtt.publish(topico.c_str(), buf, reter);
}

void publicarStatus() {
  JsonDocument doc;
  doc["type"]     = "STATUS";
  doc["online"]   = true;
  doc["firmware"] = "teste-6-trava";
  doc["state"]    = estado == ALERTA ? "ALERTING" : "IDLE";
  doc["doses"]    = doses;
  doc["uptime"]   = millis() / 1000;
  publicar(TOPICO_STATUS, doc, true);
}

void publicarEvento(const char* evento) {
  JsonDocument doc;
  doc["type"]  = "EVENT";
  doc["event"] = evento;
  publicar(TOPICO_STATUS, doc);
  Serial.printf("[Evento] %s\n", evento);
}

// Resposta que o app espera em .../dispense depois de cada DISPENSE
void responderDispense(int slot, const String& doseId, bool ok, const char* erro = nullptr) {
  JsonDocument doc;
  doc["type"]    = "DISPENSE_ACK";
  doc["slot"]    = slot;
  doc["doseId"]  = doseId;
  doc["success"] = ok;
  if (erro) doc["errorCode"] = erro;
  publicar(TOPICO_DISPENSE, doc);
  Serial.printf("[MQTT] DISPENSE_ACK slot %d dose %s: %s\n", slot, doseId.c_str(), ok ? "OK" : erro);
}

// ─── Fluxo ───────────────────────────────────
void iniciarAlerta() {
  if (estado == ALERTA) return;       // o app às vezes repete o comando
  estado = ALERTA;
  alertaDesde = millis();
  voltarTelaEm = 0;
  tela("Hora do remedio!", "Use a pulseira");
  publicarEvento("ALERT_STARTED");
  publicarStatus();
}

void encerrarAlerta(const char* motivo) {
  vibra(false);
  estado = ESPERA;
  publicarEvento(motivo);
  publicarStatus();
}

// Só acontece quando o APP manda DISPENSE
void liberarDose(int slot, const String& doseId) {
  if (slot < 1 || slot > COMPARTIMENTOS) {
    responderDispense(slot, doseId, false, "INVALID_SLOT");
    return;
  }
  vibra(false);
  estado = ESPERA;
  tela("Liberando dose", "");
#if MODO_DEMO
  // Volta inteira: trava aberta o tempo todo, para em cada compartimento e a dose cai parada
  Serial.println("[Motor] Volta inteira com a trava aberta");
  abrirTrava();
  for (int i = 0; i < COMPARTIMENTOS; i++) {
    girar(PASSOS_POR_VOLTA / COMPARTIMENTOS);
    delay(PAUSA_COMPARTIMENTO_MS);
  }
  fecharTrava();
#else
  // Uma dose: gira com a trava fechada (a dose cai em cima da paleta), depois abre e fecha
  Serial.printf("[Motor] Girando 1 compartimento (app pediu o %d)\n", slot);
  fecharTrava();
  girar(PASSOS_POR_DOSE);
  delay(DOSE_ASSENTAR_MS);
  tela("Liberando dose", "Trava aberta");
  abrirTrava();
  delay(TRAVA_ABERTA_MS);
  fecharTrava();
#endif
  doses++;
  responderDispense(slot, doseId, true);
  publicarEvento("DOSE_RELEASED");
  publicarStatus();
  tela("Dose liberada!", "Bom tratamento");
  voltarTelaEm = millis() + 4000;
}

void aoReceber(char* topico, byte* payload, unsigned int tamanho) {
  String t(topico);
  JsonDocument doc;
  bool json = !deserializeJson(doc, payload, tamanho);
  String comando = json ? String(doc["command"] | "") : "";

  // Tópico .../vibrate: qualquer mensagem liga; {"on":false} ou STOP desliga
  if (t == TOPICO_VIBRATE) {
    bool desligar = json && (doc["on"] == false || comando == "STOP");
    if (desligar) { if (estado == ALERTA) { encerrarAlerta("ALERT_CANCELLED"); telaEspera(); } }
    else iniciarAlerta();
    return;
  }

  Serial.printf("[MQTT] %s: %s\n", topico, comando.c_str());
  if (comando == "VIBRATE_ON" || comando == "VIBRATE") {
    iniciarAlerta();
  } else if (comando == "VIBRATE_OFF" || comando == "STOP") {
    if (estado == ALERTA) { encerrarAlerta("ALERT_CANCELLED"); telaEspera(); }
  } else if (comando == "DISPENSE") {
    // sem slot (teste manual pelo painel do HiveMQ) vale o compartimento 1
    liberarDose(doc["slot"] | 1, String(doc["doseId"] | ""));
  } else if (comando == "STATUS_REQ") {
    publicarStatus();
  }
}

// Uma tentativa por vez: o leitor continua funcionando mesmo sem internet
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
    mqtt.subscribe(TOPICO_VIBRATE.c_str(), 1);
    publicarStatus();
  } else {
    // rc=-2: não chegou no servidor (endereço, porta ou certificado)
    // rc=4 ou 5: usuário/senha errados
    Serial.printf("[MQTT] Falhou, rc=%d\n", mqtt.state());
  }
  if (!voltarTelaEm) telaEspera();
}

// ─── RFID ────────────────────────────────────
String lerUid() {
  String uid;
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  return uid;
}

// ─── Setup / Loop ────────────────────────────
void setup() {
  // Motor travado e vibração desligada antes de qualquer coisa
  pinMode(PIN_EN, OUTPUT);    digitalWrite(PIN_EN, HIGH);
  pinMode(PIN_STEP, OUTPUT);  digitalWrite(PIN_STEP, LOW);
  pinMode(PIN_DIR, OUTPUT);
  pinMode(PIN_VIBRA, OUTPUT); vibra(false);

  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== IASIS | Teste 6 com trava: vibracao + pulseira + disco + servo ===");

  // Trava fechada logo no começo: nada cai antes da hora
  trava.setPeriodHertz(50);
  trava.attach(PIN_SERVO, 500, 2400);
  trava.write(anguloFechado);

  lcd.begin(16, 2);
  tela("IASIS - Teste 6", "Iniciando...");

  SPI.begin();
  rfid.PCD_Init();
  delay(50);
  Serial.printf("[RC522] Versao do chip: 0x%02X\n", rfid.PCD_ReadRegister(MFRC522::VersionReg));

  String base     = String("iasis/dispenser/") + DISPENSER_ID;
  TOPICO_STATUS   = base + "/status";
  TOPICO_RFID     = base + "/rfid";
  TOPICO_CMD      = base + "/cmd";
  TOPICO_VIBRATE  = base + "/vibrate";
  TOPICO_DISPENSE = base + "/dispense";

#if TLS_INSEGURO
  rede.setInsecure();
  Serial.println("[TLS] ATENCAO: certificado NAO verificado (so diagnostico)");
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
  Serial.printf("[WiFi] %s\n", WiFi.status() == WL_CONNECTED
                ? ("Conectado, IP " + WiFi.localIP().toString()).c_str()
                : "Nao conectou (o leitor segue funcionando)");

  tela("Conectando", "nuvem...");
  ultimaTentativa = millis() - 15000;
  manterConexao();
  telaEspera();
}

// Ajuste da trava pelo Monitor Serial: a = abrir, f = fechar, + / - = corrige o ângulo fechado
void ajusteSerial() {
  if (!Serial.available()) return;
  char c = Serial.read();
  if (c == 'a') { abrirTrava();  Serial.printf("[Trava] aberta (%d graus)\n", anguloAtual); }
  if (c == 'f') { fecharTrava(); Serial.printf("[Trava] fechada (%d graus)\n", anguloAtual); }
  if (c == '+' || c == '-') {
    anguloFechado = constrain(anguloFechado + (c == '+' ? 5 : -5), 0, 180);
    fecharTrava();
    Serial.printf("[Trava] fechado agora em %d graus (anote e troque SERVO_FECHADO)\n", anguloFechado);
  }
}

void loop() {
  manterConexao();
  ajusteSerial();

  // Vibração em pulsos (0,6 s ligado / 0,4 s desligado) enquanto espera a pulseira
  if (estado == ALERTA) {
    vibra((millis() - alertaDesde) % 1000 < 600);
    if (millis() - alertaDesde > ALERTA_MAX_MS) {
      encerrarAlerta("ALERT_TIMEOUT");     // o app fica sabendo que a dose não foi tomada
      tela("Dose nao tomada", "Avisando app...");
      voltarTelaEm = millis() + 4000;
    }
  }

  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    String uid  = lerUid();
    bool valida = (uid == TAG_AUTORIZADA);

    JsonDocument doc;
    doc["type"]  = "RFID_READ";
    doc["tag"]   = uid;
    doc["valid"] = valida;
    publicar(TOPICO_RFID, doc);
    Serial.printf("UID: %s -> %s\n", uid.c_str(), valida ? "AUTORIZADA" : "NEGADA");

    if (estado == ALERTA && valida) {
      // Para de vibrar e espera o app mandar DISPENSE (quem libera é o app)
      vibra(false);
      estado = ESPERA;
      tela("Pulseira OK!", "Aguardando app");
      voltarTelaEm = millis() + 5000;
    } else if (estado == ALERTA) {
      tela("Pulseira errada", "Tente de novo");
      voltarTelaEm = millis() + 2000;
    } else {
      tela(valida ? "Pulseira OK" : "Pulseira errada", "Sem dose agora");
      voltarTelaEm = millis() + 2500;
    }

    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
  }

  if (voltarTelaEm && millis() > voltarTelaEm) { voltarTelaEm = 0; telaEspera(); }

  if (mqtt.connected() && millis() - ultimoStatus > 30000) {
    ultimoStatus = millis();
    publicarStatus();
  }

  delay(10);
}
