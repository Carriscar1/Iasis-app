/*
 * ═══════════════════════════════════════════════════════════════
 *  IASIS — Firmware ESP32  v2.2.0
 *  Dispenser inteligente de medicamentos
 *
 *  Hardware necessário:
 *    - ESP32 DevKit (qualquer variante com Wi-Fi)
 *    - Sensor DHT22 (DATA → GPIO 4, pull-up 10k para 3V3)
 *    - Leitor RFID RC522 — 3V3, NUNCA 5V
 *      (SPI: MOSI→23, MISO→19, SCK→18, SS→5, RST→22)
 *    - Driver A4988 + motor de passo NEMA 17 (12 V)
 *      (STEP → GPIO 14, DIR → GPIO 27, EN → GPIO 26 com pull-up 10k)
 *    - Motor vibratório da pulseira (transistor NPN + diodo → GPIO 32)
 *    - LED de status (GPIO 2 — onboard)
 *
 *  Opcionais (ative em SENSORES OPCIONAIS):
 *    - Sensor hall A3144 / fim de curso = posição zero do disco (GPIO 33)
 *    - Sensor IR de queda (TCRT5000/FC-51) = confirma a dose (GPIO 35)
 *
 *  Dependências (Arduino Library Manager):
 *    - PubSubClient   (Nick O'Leary)
 *    - DHT sensor library + Adafruit Unified Sensor (Adafruit)
 *    - MFRC522        (GithubCommunity)
 *    - ArduinoJson 7.x (Benoit Blanchon)
 *
 *  ⚠️  Copie secrets.example.h → secrets.h e preencha antes de gravar
 * ═══════════════════════════════════════════════════════════════
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <Preferences.h>
#include <DHT.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ArduinoJson.h>

#if __has_include("secrets.h")
  #include "secrets.h"
#else
  #error "Crie o arquivo secrets.h a partir do secrets.example.h (mesma pasta do .ino)"
#endif

#define FIRMWARE_VERSION "2.2.0"

// ─────────────────────────────────────────────
//  SENSORES OPCIONAIS — 1 quando estiverem montados
// ─────────────────────────────────────────────
#define USE_HOME_SENSOR  0   // sensor de posição zero do disco
#define USE_DROP_SENSOR  0   // sensor IR que vê o comprimido cair

// ─────────────────────────────────────────────
//  MECÂNICA DO DISCO
// ─────────────────────────────────────────────
// Disco com 8 setores: o setor 0 é a posição de repouso (fechada) e os
// setores 1–7 são os compartimentos. Ajuste se o modelo 3D mudar.
#define DISC_SECTORS     8
#define MICROSTEPS       1     // MS1/MS2/MS3 do A4988 soltos = passo inteiro
#define STEPS_PER_REV    (200 * MICROSTEPS)
#define STEPS_PER_SECTOR (STEPS_PER_REV / DISC_SECTORS)

#define STEP_DELAY_START_US 2500   // começa devagar (mais torque)...
#define STEP_DELAY_CRUISE_US 1200  // ...e acelera até aqui
#define RAMP_STEPS          40

#define DROP_TIMEOUT_MS  3000  // quanto tempo espera o comprimido cair

// ─────────────────────────────────────────────
//  PINOS
// ─────────────────────────────────────────────
#define PIN_DHT       4
#define PIN_DHT_TYPE  DHT22

#define PIN_RFID_SS   5
#define PIN_RFID_RST  22

#define PIN_STEP      14
#define PIN_DIR       27
#define PIN_EN        26

#define PIN_VIBRATE   32
#define PIN_LED       2

#define PIN_HOME      33   // LOW = disco na posição zero
#define PIN_DROP      35   // input-only; LOW = algo passou pelo feixe

// ─────────────────────────────────────────────
//  CERTIFICADO — raiz do HiveMQ Cloud (Let's Encrypt ISRG Root X1,
//  válido até 2035). Sem ele a conexão TLS na porta 8883 não fecha.
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
//  TÓPICOS MQTT
// ─────────────────────────────────────────────
String TOPIC_STATUS;
String TOPIC_RFID;
String TOPIC_DISPENSE;
String TOPIC_VIBRATE;
String TOPIC_CMD;
String TOPIC_ONLINE;   // "online"/"offline" — o broker publica "offline" se a placa cair

// ─────────────────────────────────────────────
//  OBJETOS
// ─────────────────────────────────────────────
DHT      dht(PIN_DHT, PIN_DHT_TYPE);
MFRC522  rfid(PIN_RFID_SS, PIN_RFID_RST);
Preferences prefs;
#if MQTT_USE_TLS
WiFiClientSecure netClient;
#else
WiFiClient       netClient;
#endif
PubSubClient mqtt(netClient);

// ─────────────────────────────────────────────
//  ESTADO
// ─────────────────────────────────────────────
String authorizedTag;
unsigned long lastStatus      = 0;
unsigned long lastMqttAttempt = 0;
unsigned long startTime       = 0;

float lastHumidity    = NAN;
float lastTemperature = NAN;

String        lastTagRead = "";
unsigned long lastTagAt   = 0;

volatile uint16_t dropCount = 0;

// ─────────────────────────────────────────────
//  VIBRAÇÃO — padrões sem delay()
//  Cada padrão alterna LIGA/DESLIGA (ms), começando ligado, e repete.
//  Não usar delay() aqui é o que deixa o RFID ser lido enquanto vibra.
// ─────────────────────────────────────────────
const uint16_t PATTERN_GENTLE[] = { 400, 1600 };
const uint16_t PATTERN_URGENT[] = { 300, 200, 300, 1200 };
const uint16_t PATTERN_SOS[]    = { 200, 200, 200, 200, 200, 400,
                                    600, 200, 600, 200, 600, 400,
                                    200, 200, 200, 200, 200, 1500 };

const uint16_t* vibPattern    = PATTERN_GENTLE;
uint8_t         vibLen        = 2;
uint8_t         vibIndex      = 0;
unsigned long   vibStepAt     = 0;
bool            vibrateActive = false;
String          vibPatternName = "gentle";

void publishVibrate(bool active, const char* pattern);

void setVibrate(bool on, const String& pattern = "gentle") {
  if (pattern == "urgent")   { vibPattern = PATTERN_URGENT; vibLen = 4;  }
  else if (pattern == "sos") { vibPattern = PATTERN_SOS;    vibLen = 18; }
  else                       { vibPattern = PATTERN_GENTLE; vibLen = 2;  }

  vibPatternName = pattern;
  vibrateActive  = on;
  vibIndex       = 0;
  vibStepAt      = millis();
  digitalWrite(PIN_VIBRATE, on ? HIGH : LOW);
  // Confirma o estado para o app: é assim que a tela mostra a pulseira
  // vibrando de verdade (e não só o comando que foi enviado).
  publishVibrate(on, vibPatternName.c_str());
}

void updateVibration() {
  if (!vibrateActive) return;
  if (millis() - vibStepAt < vibPattern[vibIndex]) return;

  vibIndex  = (vibIndex + 1) % vibLen;
  vibStepAt = millis();
  // Índice par = liga, ímpar = desliga
  digitalWrite(PIN_VIBRATE, vibIndex % 2 == 0 ? HIGH : LOW);
}

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────
void blinkLed(int n, int ms = 100) {
  for (int i = 0; i < n; i++) {
    digitalWrite(PIN_LED, HIGH); delay(ms);
    digitalWrite(PIN_LED, LOW);  delay(ms);
  }
}

void IRAM_ATTR onDrop() {
  static unsigned long lastDropUs = 0;
  unsigned long now = micros();
  if (now - lastDropUs > 50000) dropCount++;   // ignora repique < 50 ms
  lastDropUs = now;
}

// ─────────────────────────────────────────────
//  MOTOR
// ─────────────────────────────────────────────
// Gira N passos com rampa de aceleração. Para cedo (e devolve true) se
// stopAtHome for verdadeiro e o sensor de posição zero disparar.
bool stepMotor(int steps, bool clockwise, bool stopAtHome = false) {
  digitalWrite(PIN_EN, LOW);                      // habilita driver
  digitalWrite(PIN_DIR, clockwise ? HIGH : LOW);  // define direção
  delay(5);

  bool homed = false;
  for (int i = 0; i < steps; i++) {
    if (stopAtHome && digitalRead(PIN_HOME) == LOW) { homed = true; break; }

    int fromEdge = min(i, steps - 1 - i);
    int stepDelay = fromEdge >= RAMP_STEPS
      ? STEP_DELAY_CRUISE_US
      : map(fromEdge, 0, RAMP_STEPS, STEP_DELAY_START_US, STEP_DELAY_CRUISE_US);

    digitalWrite(PIN_STEP, HIGH); delayMicroseconds(stepDelay / 2);
    digitalWrite(PIN_STEP, LOW);  delayMicroseconds(stepDelay / 2);
  }

  digitalWrite(PIN_EN, HIGH);  // desabilita driver (economia de energia e menos calor)
  return homed;
}

// Volta o disco para a posição zero. Sem o sensor, confia na contagem de passos.
bool homeDisc() {
#if USE_HOME_SENSOR
  if (digitalRead(PIN_HOME) == LOW) return true;
  // Procura o ímã por no máximo 1 volta e pouco; se não achar, algo travou
  bool ok = stepMotor(STEPS_PER_REV + STEPS_PER_SECTOR, false, true);
  Serial.printf("[Motor] Homing %s\n", ok ? "OK" : "FALHOU");
  return ok;
#else
  return true;
#endif
}

// ─────────────────────────────────────────────
//  MQTT PUBLISH
// ─────────────────────────────────────────────
void publishStatus() {
  if (!mqtt.connected()) return;

  float humidity    = dht.readHumidity();
  float temperature = dht.readTemperature();
  bool  sensorOk    = !isnan(humidity) && !isnan(temperature);

  if (sensorOk) {
    lastHumidity    = humidity;
    lastTemperature = temperature;
  } else {
    Serial.println("[DHT22] Leitura falhou — mantendo a última válida");
  }

  // O status sai mesmo com o DHT falhando: ele também é o "estou vivo"
  // do dispenser para o app.
  JsonDocument doc;
  doc["type"]     = "STATUS";
  doc["online"]   = true;
  if (!isnan(lastHumidity)) {
    doc["humidity"]    = round(lastHumidity * 10.0) / 10.0;
    doc["temperature"] = round(lastTemperature * 10.0) / 10.0;
  }
  doc["sensorOk"] = sensorOk;
  doc["firmware"] = FIRMWARE_VERSION;
  doc["uptime"]   = (millis() - startTime) / 1000;
  doc["rssi"]     = WiFi.RSSI();

  char buf[256];
  serializeJson(doc, buf);
  mqtt.publish(TOPIC_STATUS.c_str(), buf, true);  // retained

  Serial.printf("[MQTT] Status → umidade: %.1f%%, temp: %.1f°C\n", lastHumidity, lastTemperature);
}

// Estado da pulseira → app (tópico .../vibrate)
void publishVibrate(bool active, const char* pattern) {
  if (!mqtt.connected()) return;

  JsonDocument doc;
  doc["type"]    = "VIBRATE";
  doc["active"]  = active;
  doc["pattern"] = pattern;

  char buf[128];
  serializeJson(doc, buf);
  mqtt.publish(TOPIC_VIBRATE.c_str(), buf, true);  // retained

  Serial.printf("[MQTT] Vibrate → %s (%s)\n", active ? "ON" : "OFF", pattern);
}

void publishRfid(const String& tag, bool valid) {
  JsonDocument doc;
  doc["type"]  = "RFID_READ";
  doc["tag"]   = tag;
  doc["valid"] = valid;

  char buf[200];
  serializeJson(doc, buf);
  mqtt.publish(TOPIC_RFID.c_str(), buf);

  Serial.printf("[MQTT] RFID → tag: %s | válida: %s\n", tag.c_str(), valid ? "SIM" : "NÃO");
}

void publishDispenseAck(int slot, const String& doseId, bool success,
                        const String& errorCode = "", int pills = -1) {
  JsonDocument doc;
  doc["type"]    = "DISPENSE_ACK";
  doc["slot"]    = slot;
  doc["doseId"]  = doseId;
  doc["success"] = success;
  if (!success && errorCode.length() > 0) doc["errorCode"] = errorCode;
  if (pills >= 0) doc["pills"] = pills;   // usado no teste dos 100 ciclos

  char buf[200];
  serializeJson(doc, buf);
  mqtt.publish(TOPIC_DISPENSE.c_str(), buf);

  Serial.printf("[MQTT] Dispense ACK → slot: %d | sucesso: %s %s\n",
                slot, success ? "SIM" : "NÃO", errorCode.c_str());
}

// ─────────────────────────────────────────────
//  DISPENSAR
// ─────────────────────────────────────────────
// Leva o compartimento até a saída, espera a dose cair e volta ao zero.
void dispenseSlot(int slot, const String& doseId) {
  if (slot < 1 || slot >= DISC_SECTORS) {
    publishDispenseAck(slot, doseId, false, "BAD_SLOT");
    return;
  }

  Serial.printf("[Motor] Dispensando slot %d\n", slot);

  if (!homeDisc()) {
    publishDispenseAck(slot, doseId, false, "HOME_FAIL");
    return;
  }

  dropCount = 0;
  stepMotor(STEPS_PER_SECTOR * slot, true);

#if USE_DROP_SENSOR
  unsigned long waitStart = millis();
  while (dropCount == 0 && millis() - waitStart < DROP_TIMEOUT_MS) {
    mqtt.loop();
    delay(10);
  }
  delay(300);  // dá tempo de um segundo comprimido cair, se cair
#else
  delay(500);
#endif

  // Volta pelo mesmo caminho e corrige a posição no sensor de zero
  stepMotor(STEPS_PER_SECTOR * slot, false);
  bool homed = homeDisc();

#if USE_DROP_SENSOR
  int pills = dropCount;
  if (pills == 0) {
    publishDispenseAck(slot, doseId, false, "NO_PILL", pills);
  } else {
    publishDispenseAck(slot, doseId, true, "", pills);
  }
#else
  publishDispenseAck(slot, doseId, true);
#endif

  if (!homed) Serial.println("[Motor] ⚠️ Disco não voltou ao zero — verifique travamento");
  blinkLed(3);
}

// ─────────────────────────────────────────────
//  MQTT RECEIVE (callback)
// ─────────────────────────────────────────────
void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, payload, length);
  if (err) { Serial.println("[JSON] Erro ao parsear"); return; }

  String type    = doc["type"]    | "";
  String command = doc["command"] | "";
  Serial.printf("[MQTT] Recebido em %s: %s %s\n", topic, type.c_str(), command.c_str());

  if (type == "CMD") {
    // ── Dispensar ───────────────────────────
    // O app só manda DISPENSE depois de receber o RFID_READ válido e
    // confirmar a dose no banco — é ele quem fecha o fluxo.
    if (command == "DISPENSE") {
      int    slot   = doc["slot"]   | 1;
      String doseId = doc["doseId"] | "";
      dispenseSlot(slot, doseId);
    }

    // ── Vibração ────────────────────────────
    else if (command == "VIBRATE_ON") {
      // O app manda o padrão junto (gentle / urgent / sos).
      setVibrate(true, doc["pattern"] | "gentle");
    }
    else if (command == "VIBRATE_OFF") {
      setVibrate(false, vibPatternName);
    }

    // ── Status imediato ─────────────────────
    else if (command == "STATUS_REQ") {
      publishStatus();
    }

    // ── Reiniciar ESP32 ─────────────────────
    else if (command == "RESTART") {
      Serial.println("[CMD] Reiniciando ESP32...");
      delay(500);
      ESP.restart();
    }
  }

  // Tag autorizada pode ser atualizada remotamente e fica salva na flash
  else if (type == "SET_TAG") {
    String tag = doc["tag"] | "";
    tag.toUpperCase();
    if (tag.length() == 0) return;
    authorizedTag = tag;
    prefs.putString("tag", authorizedTag);
    Serial.printf("[RFID] Tag autorizada atualizada: %s\n", authorizedTag.c_str());
  }
}

// ─────────────────────────────────────────────
//  WIFI
// ─────────────────────────────────────────────
void connectWifi() {
  Serial.printf("[WiFi] Conectando a %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);   // se o roteador cair, volta sozinho
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 30) {
    delay(500); Serial.print(".");
    tries++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WiFi] Conectado! IP: %s\n", WiFi.localIP().toString().c_str());
    blinkLed(2, 200);
  } else {
    Serial.println("\n[WiFi] Falha — reiniciando...");
    ESP.restart();
  }
}

// ─────────────────────────────────────────────
//  MQTT CONNECT — uma tentativa por vez, sem travar o loop
// ─────────────────────────────────────────────
bool connectMqtt() {
  String clientId = "iasis_esp32_" + String(DISPENSER_ID) + "_" + String((uint32_t)ESP.getEfuseMac(), HEX);

  Serial.printf("[MQTT] Conectando ao broker %s:%d...\n", MQTT_BROKER, MQTT_PORT);
  // Last Will: se a placa sumir (queda de energia), o broker avisa sozinho
  bool ok = mqtt.connect(clientId.c_str(), MQTT_USER, MQTT_PASS,
                         TOPIC_ONLINE.c_str(), 1, true, "offline");
  if (!ok) {
    Serial.printf("[MQTT] Falha (rc=%d), tentando em 5s...\n", mqtt.state());
    return false;
  }

  Serial.println("[MQTT] Conectado!");
  mqtt.publish(TOPIC_ONLINE.c_str(), "online", true);
  mqtt.subscribe(TOPIC_CMD.c_str());
  Serial.printf("[MQTT] Subscrito em %s\n", TOPIC_CMD.c_str());

  publishStatus();
  // Reenvia o estado da pulseira: se a conexão caiu no meio de um alerta,
  // o app volta a enxergar a vibração ativa.
  publishVibrate(vibrateActive, vibPatternName.c_str());
  blinkLed(3, 150);
  return true;
}

// ─────────────────────────────────────────────
//  RFID — leitura e validação
// ─────────────────────────────────────────────
void checkRfid() {
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return;

  // Converte UID para string hex
  String tag = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) tag += "0";
    tag += String(rfid.uid.uidByte[i], HEX);
  }
  tag.toUpperCase();

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();

  // Pulseira parada em cima do leitor gera leituras repetidas: ignora 2s
  if (tag == lastTagRead && millis() - lastTagAt < 2000) return;
  lastTagRead = tag;
  lastTagAt   = millis();

  bool valid = (tag == authorizedTag);
  Serial.printf("[RFID] Tag lida: %s | Autorizada: %s\n", tag.c_str(), authorizedTag.c_str());

  if (valid) {
    blinkLed(2, 80);
    // Para vibração — dose foi validada fisicamente
    setVibrate(false, vibPatternName);
  } else {
    // Tag desconhecida — 3 blinks rápidos
    blinkLed(3, 60);
  }

  publishRfid(tag, valid);
}

// ─────────────────────────────────────────────
//  SETUP
// ─────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  Serial.println("\n═══ IASIS Dispenser v" FIRMWARE_VERSION " ═══");

  startTime = millis();

  // Pinos
  pinMode(PIN_LED,     OUTPUT);
  pinMode(PIN_VIBRATE, OUTPUT);
  pinMode(PIN_STEP,    OUTPUT);
  pinMode(PIN_DIR,     OUTPUT);
  pinMode(PIN_EN,      OUTPUT);
  digitalWrite(PIN_EN, HIGH);   // motor desabilitado por padrão
  digitalWrite(PIN_VIBRATE, LOW);

#if USE_HOME_SENSOR
  pinMode(PIN_HOME, INPUT_PULLUP);
#endif
#if USE_DROP_SENSOR
  pinMode(PIN_DROP, INPUT);     // GPIO 35 não tem pull-up interno: o módulo já tem
  attachInterrupt(digitalPinToInterrupt(PIN_DROP), onDrop, FALLING);
#endif

  // Tag da pulseira salva na flash (ou a padrão do secrets.h)
  prefs.begin("iasis", false);
  authorizedTag = prefs.getString("tag", DEFAULT_TAG);
  Serial.printf("[RFID] Tag autorizada: %s\n", authorizedTag.c_str());

  // Tópicos MQTT com ID do dispenser
  String base    = "iasis/dispenser/" + String(DISPENSER_ID);
  TOPIC_STATUS   = base + "/status";
  TOPIC_RFID     = base + "/rfid";
  TOPIC_DISPENSE = base + "/dispense";
  TOPIC_VIBRATE  = base + "/vibrate";
  TOPIC_CMD      = base + "/cmd";
  TOPIC_ONLINE   = base + "/online";

  // Sensores
  dht.begin();
  SPI.begin();
  rfid.PCD_Init();
  Serial.println("[RFID] Leitor RC522 iniciado");

  // Disco começa sempre na posição zero
  homeDisc();

  // Rede
#if MQTT_USE_TLS
  netClient.setCACert(ROOT_CA);
#endif
  mqtt.setServer(MQTT_BROKER, MQTT_PORT);
  mqtt.setCallback(onMqttMessage);
  mqtt.setKeepAlive(60);
  mqtt.setBufferSize(512);

  connectWifi();
  connectMqtt();
  lastMqttAttempt = millis();

  Serial.println("[IASIS] Sistema pronto ✓");
}

// ─────────────────────────────────────────────
//  LOOP — nada aqui pode travar: RFID e vibração rodam o tempo todo,
//  mesmo sem internet.
// ─────────────────────────────────────────────
void loop() {
  if (!mqtt.connected()) {
    if (WiFi.status() == WL_CONNECTED && millis() - lastMqttAttempt > 5000) {
      lastMqttAttempt = millis();
      connectMqtt();
    }
  } else {
    mqtt.loop();
  }

  checkRfid();
  updateVibration();

  // Publica status a cada 30 segundos
  if (millis() - lastStatus > 30000) {
    publishStatus();
    lastStatus = millis();
  }

  delay(5);
}
