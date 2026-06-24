/*
 * ═══════════════════════════════════════════════════════════════
 *  IASIS — Firmware ESP32
 *  Dispenser inteligente de medicamentos
 *
 *  Hardware necessário:
 *    - ESP32 (qualquer variante com Wi-Fi)
 *    - Sensor DHT22 (pino DATA → GPIO 4)
 *    - Leitor RFID RC522 (SPI: MOSI→23, MISO→19, SCK→18, SS→5, RST→22)
 *    - Driver motor A4988 + Motor de passo NEMA 17
 *      (STEP → GPIO 14, DIR → GPIO 27, EN → GPIO 26)
 *    - Motor vibratório (via transistor NPN → GPIO 32)
 *    - LED status (GPIO 2 — onboard)
 *
 *  Dependências (Arduino Library Manager):
 *    - PubSubClient   (Nick O'Leary)
 *    - DHT sensor     (Adafruit)
 *    - MFRC522        (GithubCommunity)
 *    - ArduinoJson    (Benoit Blanchon)
 *
 *  ⚠️  Configure as variáveis da seção CONFIGURAÇÕES abaixo
 * ═══════════════════════════════════════════════════════════════
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ArduinoJson.h>

// ─────────────────────────────────────────────
//  CONFIGURAÇÕES — edite aqui
// ─────────────────────────────────────────────
const char* WIFI_SSID     = "SUA_REDE_WIFI";
const char* WIFI_PASSWORD = "SUA_SENHA_WIFI";

const char* MQTT_BROKER   = "SEU_BROKER.hivemq.cloud";
const int   MQTT_PORT     = 8883;
const char* MQTT_USER     = "iasis_esp32";
const char* MQTT_PASS     = "SUA_SENHA_MQTT";
const char* DISPENSER_ID  = "01";           // ID único do dispenser

// RFID autorizada (tag da pulseira do paciente)
// Após leitura inicial, o app envia via MQTT o tag correto
String AUTHORIZED_TAG     = "A3F2910C";     // placeholder

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

// ─────────────────────────────────────────────
//  TÓPICOS MQTT
// ─────────────────────────────────────────────
String TOPIC_STATUS;
String TOPIC_RFID;
String TOPIC_DISPENSE;
String TOPIC_VIBRATE;
String TOPIC_CMD;

// ─────────────────────────────────────────────
//  OBJETOS
// ─────────────────────────────────────────────
DHT      dht(PIN_DHT, PIN_DHT_TYPE);
MFRC522  rfid(PIN_RFID_SS, PIN_RFID_RST);
WiFiClient   wifiClient;
PubSubClient mqtt(wifiClient);

// ─────────────────────────────────────────────
//  ESTADO
// ─────────────────────────────────────────────
bool   vibrateActive     = false;
bool   dispensing        = false;
String pendingDoseId     = "";
int    pendingSlot       = 0;
unsigned long lastStatus = 0;
unsigned long startTime  = 0;

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────
void blinkLed(int n, int ms = 100) {
  for (int i = 0; i < n; i++) {
    digitalWrite(PIN_LED, HIGH); delay(ms);
    digitalWrite(PIN_LED, LOW);  delay(ms);
  }
}

void setVibrate(bool on) {
  vibrateActive = on;
  digitalWrite(PIN_VIBRATE, on ? HIGH : LOW);
}

// Passo motor: gira N passos na direção
void stepMotor(int steps, bool clockwise = true) {
  digitalWrite(PIN_EN, LOW);                      // habilita driver
  digitalWrite(PIN_DIR, clockwise ? HIGH : LOW);  // define direção
  delay(5);

  for (int i = 0; i < steps; i++) {
    digitalWrite(PIN_STEP, HIGH); delayMicroseconds(1500);
    digitalWrite(PIN_STEP, LOW);  delayMicroseconds(1500);
  }

  digitalWrite(PIN_EN, HIGH);  // desabilita driver (economia energia)
}

// Dispensar 1 dose: gira 1/8 de volta (45°) = 200 * 1/8 = 25 passos
void dispenseSlot(int slot) {
  Serial.printf("[Motor] Dispensando slot %d\n", slot);
  // Gira até o slot correto (simplificado: todos na mesma direção)
  stepMotor(25 * slot, true);
  delay(500);
  // Retorna à posição base
  stepMotor(25 * slot, false);
}

// ─────────────────────────────────────────────
//  MQTT PUBLISH
// ─────────────────────────────────────────────
void publishStatus() {
  float humidity    = dht.readHumidity();
  float temperature = dht.readTemperature();

  if (isnan(humidity) || isnan(temperature)) {
    Serial.println("[DHT22] Leitura falhou");
    return;
  }

  StaticJsonDocument<256> doc;
  doc["type"]        = "STATUS";
  doc["online"]      = true;
  doc["humidity"]    = round(humidity * 10.0) / 10.0;
  doc["temperature"] = round(temperature * 10.0) / 10.0;
  doc["firmware"]    = "2.1.0";
  doc["uptime"]      = (millis() - startTime) / 1000;

  char buf[256];
  serializeJson(doc, buf);
  mqtt.publish(TOPIC_STATUS.c_str(), buf, true);  // retained

  Serial.printf("[MQTT] Status → umidade: %.1f%%, temp: %.1f°C\n", humidity, temperature);
}

void publishRfid(String tag, bool valid, String doseId = "") {
  StaticJsonDocument<200> doc;
  doc["type"]   = "RFID_READ";
  doc["tag"]    = tag;
  doc["valid"]  = valid;
  if (doseId.length() > 0) doc["doseId"] = doseId;

  char buf[200];
  serializeJson(doc, buf);
  mqtt.publish(TOPIC_RFID.c_str(), buf);

  Serial.printf("[MQTT] RFID → tag: %s | válida: %s\n", tag.c_str(), valid ? "SIM" : "NÃO");
}

void publishDispenseAck(int slot, String doseId, bool success, String errorCode = "") {
  StaticJsonDocument<200> doc;
  doc["type"]    = "DISPENSE_ACK";
  doc["slot"]    = slot;
  doc["doseId"]  = doseId;
  doc["success"] = success;
  if (!success && errorCode.length() > 0) doc["errorCode"] = errorCode;

  char buf[200];
  serializeJson(doc, buf);
  mqtt.publish(TOPIC_DISPENSE.c_str(), buf);

  Serial.printf("[MQTT] Dispense ACK → slot: %d | sucesso: %s\n", slot, success ? "SIM" : "NÃO");
}

// ─────────────────────────────────────────────
//  MQTT RECEIVE (callback)
// ─────────────────────────────────────────────
void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  String msg;
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];
  Serial.printf("[MQTT] Recebido em %s: %s\n", topic, msg.c_str());

  StaticJsonDocument<256> doc;
  DeserializationError err = deserializeJson(doc, msg);
  if (err) { Serial.println("[JSON] Erro ao parsear"); return; }

  String type    = doc["type"].as<String>();
  String command = doc["command"].as<String>();

  if (type == "CMD") {
    // ── Dispensar ───────────────────────────
    if (command == "DISPENSE") {
      int    slot   = doc["slot"]   | 1;
      String doseId = doc["doseId"] | "";

      if (!dispensing) {
        dispensing    = true;
        pendingSlot   = slot;
        pendingDoseId = doseId;
        // A dispensação acontece no loop() após validação RFID
        // ou aqui diretamente se vier comando direto do app (teste)
        dispenseSlot(slot);
        publishDispenseAck(slot, doseId, true);
        dispensing = false;
        blinkLed(3);
      } else {
        publishDispenseAck(slot, doseId, false, "BUSY");
      }
    }

    // ── Vibração ────────────────────────────
    else if (command == "VIBRATE_ON") {
      setVibrate(true);
      Serial.println("[Vibrate] ON");
    }
    else if (command == "VIBRATE_OFF") {
      setVibrate(false);
      Serial.println("[Vibrate] OFF");
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

  // Tag autorizada pode ser atualizada remotamente
  else if (type == "SET_TAG") {
    AUTHORIZED_TAG = doc["tag"].as<String>();
    Serial.printf("[RFID] Tag autorizada atualizada: %s\n", AUTHORIZED_TAG.c_str());
  }
}

// ─────────────────────────────────────────────
//  WIFI
// ─────────────────────────────────────────────
void connectWifi() {
  Serial.printf("[WiFi] Conectando a %s", WIFI_SSID);
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
//  MQTT CONNECT
// ─────────────────────────────────────────────
void connectMqtt() {
  mqtt.setServer(MQTT_BROKER, MQTT_PORT);
  mqtt.setCallback(onMqttMessage);
  mqtt.setKeepAlive(60);
  mqtt.setBufferSize(512);

  String clientId = "iasis_esp32_" + String(DISPENSER_ID);

  Serial.printf("[MQTT] Conectando ao broker %s...\n", MQTT_BROKER);
  while (!mqtt.connected()) {
    if (mqtt.connect(clientId.c_str(), MQTT_USER, MQTT_PASS)) {
      Serial.println("[MQTT] Conectado!");

      // Subscreve comandos
      mqtt.subscribe(TOPIC_CMD.c_str());
      Serial.printf("[MQTT] Subscrito em %s\n", TOPIC_CMD.c_str());

      // Publica status inicial
      publishStatus();
      blinkLed(3, 150);
    } else {
      Serial.printf("[MQTT] Falha (rc=%d), tentando em 5s...\n", mqtt.state());
      delay(5000);
    }
  }
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

  Serial.printf("[RFID] Tag lida: %s | Autorizada: %s\n", tag.c_str(), AUTHORIZED_TAG.c_str());

  bool valid = (tag == AUTHORIZED_TAG);

  if (valid) {
    // Feedback visual e sonoro
    blinkLed(2, 80);
    // Para vibração — dose foi validada fisicamente
    setVibrate(false);
  } else {
    // Tag desconhecida — 3 blinks rápidos
    blinkLed(3, 60);
  }

  publishRfid(tag, valid, pendingDoseId);

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}

// ─────────────────────────────────────────────
//  SETUP
// ─────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  Serial.println("\n═══ IASIS Dispenser v2.1.0 ═══");

  startTime = millis();

  // Pinos
  pinMode(PIN_LED,     OUTPUT);
  pinMode(PIN_VIBRATE, OUTPUT);
  pinMode(PIN_STEP,    OUTPUT);
  pinMode(PIN_DIR,     OUTPUT);
  pinMode(PIN_EN,      OUTPUT);
  digitalWrite(PIN_EN, HIGH);   // motor desabilitado por padrão

  // Tópicos MQTT com ID do dispenser
  TOPIC_STATUS   = "iasis/dispenser/" + String(DISPENSER_ID) + "/status";
  TOPIC_RFID     = "iasis/dispenser/" + String(DISPENSER_ID) + "/rfid";
  TOPIC_DISPENSE = "iasis/dispenser/" + String(DISPENSER_ID) + "/dispense";
  TOPIC_VIBRATE  = "iasis/dispenser/" + String(DISPENSER_ID) + "/vibrate";
  TOPIC_CMD      = "iasis/dispenser/" + String(DISPENSER_ID) + "/cmd";

  // Sensores
  dht.begin();
  SPI.begin();
  rfid.PCD_Init();

  Serial.println("[RFID] Leitor RC522 iniciado");
  Serial.printf("[DHT22] Sensor no pino %d\n", PIN_DHT);

  // Rede
  connectWifi();
  connectMqtt();

  blinkLed(5, 100);
  Serial.println("[IASIS] Sistema pronto ✓");
}

// ─────────────────────────────────────────────
//  LOOP
// ─────────────────────────────────────────────
void loop() {
  // Reconexão automática
  if (!mqtt.connected()) {
    Serial.println("[MQTT] Reconectando...");
    connectMqtt();
  }
  mqtt.loop();

  // Verifica RFID continuamente
  checkRfid();

  // Publica status a cada 30 segundos
  if (millis() - lastStatus > 30000) {
    publishStatus();
    lastStatus = millis();
  }

  // Padrão de vibração urgente (pulsa a cada 2s)
  if (vibrateActive) {
    static unsigned long lastVib = 0;
    if (millis() - lastVib > 2000) {
      digitalWrite(PIN_VIBRATE, HIGH); delay(300);
      digitalWrite(PIN_VIBRATE, LOW);  delay(200);
      digitalWrite(PIN_VIBRATE, HIGH); delay(300);
      digitalWrite(PIN_VIBRATE, LOW);
      lastVib = millis();
    }
  }

  delay(10);
}
