/*
 * IASIS — Teste 4: ESP32 + RC522 + LCD + HiveMQ + servo (trava)
 * Resultado: a pulseira AUTORIZADA abre a trava por 3 s; tag desconhecida
 * nao mexe no servo. Tudo aparece na tela, no Serial e no HiveMQ.
 *
 * Montagem: teste 3 + servo
 *   Marrom/preto (GND) → GND     Vermelho (V+) → 5V da protoboard (NUNCA no 5V do ESP32)
 *   Laranja/amarelo (sinal) → GPIO 4
 *   Capacitor 470–1000 µF entre o V+ e o GND, perto do servo (listra = negativo)
 * Primeiro teste com o servo SOLTO, fora da trava.
 *
 * Antes de gravar: copie secrets.example.h → secrets.h e preencha.
 *
 * Como ver chegando na nuvem: no console do HiveMQ Cloud, abra o Web Client,
 * conecte com o usuario iasis_app e assine o topico  iasis/#
 * Ao aproximar a pulseira chega, em iasis/dispenser/01/rfid:
 *   {"type":"RFID_READ","tag":"A3F2910C","valid":true}
 * Para testar o caminho de volta, publique em iasis/dispenser/01/cmd:
 *   {"type":"CMD","command":"STATUS_REQ"}
 * e o comando aparece no LCD.
 *
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

#if __has_include("secrets.h")
  #include "secrets.h"
#else
  #error "Copie secrets.example.h para secrets.h (mesma pasta do .ino) e preencha"
#endif

// 1 = nao confere o certificado do HiveMQ. Use SO para diagnosticar: se com 0
// nao conecta e com 1 conecta, o problema e o certificado, nao a senha.
#define TLS_INSEGURO 0

#define PIN_RFID_SS   5
#define PIN_RFID_RST  22

#define PIN_LCD_RS  13
#define PIN_LCD_E   17
#define PIN_LCD_D4  14
#define PIN_LCD_D5  25
#define PIN_LCD_D6  33
#define PIN_LCD_D7  32

#define PIN_SERVO      4
#define SERVO_FECHADO  0     // angulos de teste: ajuste depois de montar a trava
#define SERVO_ABERTO   90
#define TEMPO_ABERTO   3000  // ms

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

MFRC522          rfid(PIN_RFID_SS, PIN_RFID_RST);
LiquidCrystal    lcd(PIN_LCD_RS, PIN_LCD_E, PIN_LCD_D4, PIN_LCD_D5, PIN_LCD_D6, PIN_LCD_D7);
WiFiClientSecure rede;
PubSubClient     mqtt(rede);
Servo            trava;

String TOPICO_STATUS, TOPICO_RFID, TOPICO_CMD;

unsigned long voltarTelaEm   = 0;
unsigned long ultimaTentativa = 0;
unsigned long ultimoStatus   = 0;
unsigned long fecharTravaEm  = 0;

// ─── Tela ───────────────────────────────────
void tela(const String& linha1, const String& linha2 = "") {
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print(linha1.substring(0, 16));
  lcd.setCursor(0, 1); lcd.print(linha2.substring(0, 16));
}

void telaEspera() {
  String rede = WiFi.status() != WL_CONNECTED ? "Sem WiFi"
              : mqtt.connected()              ? "Nuvem OK"
              :                                 "Sem nuvem";
  tela("Use a pulseira", rede);
}

// ─── Nuvem ──────────────────────────────────
void publicarStatus() {
  JsonDocument doc;
  doc["type"]     = "STATUS";
  doc["online"]   = true;
  doc["firmware"] = "teste-4";
  doc["uptime"]   = millis() / 1000;
  char buf[160];
  serializeJson(doc, buf);
  mqtt.publish(TOPICO_STATUS.c_str(), buf, true);
}

void aoReceber(char* topico, byte* payload, unsigned int tamanho) {
  JsonDocument doc;
  if (deserializeJson(doc, payload, tamanho)) {
    Serial.println("[MQTT] Mensagem recebida nao e JSON valido");
    return;
  }
  String comando = doc["command"] | "";
  if (comando.length() == 0) comando = doc["type"] | "?";
  Serial.printf("[MQTT] Recebido em %s: %s\n", topico, comando.c_str());
  tela("Comando recebido", comando);
  voltarTelaEm = millis() + 3000;

  if (comando == "STATUS_REQ") publicarStatus();
}

// Uma tentativa por vez: o leitor continua funcionando mesmo sem internet
void manterConexao() {
  if (mqtt.connected()) { mqtt.loop(); return; }

  if (WiFi.status() != WL_CONNECTED) {
    // Reconectar leva alguns segundos: so recomeca a cada 15 s
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
  } else {
    // rc=-2: nao chegou no servidor (endereco, porta ou certificado)
    // rc=4 ou 5: usuario/senha errados ou sem permissao
    Serial.printf("[MQTT] Falhou, rc=%d\n", mqtt.state());
  }
  if (!voltarTelaEm) telaEspera();
}

// ─── RFID ───────────────────────────────────
String lerUid() {
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  return uid;
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== IASIS | Teste 4: RC522 + LCD + HiveMQ + servo ===");

  lcd.begin(16, 2);
  tela("IASIS - Teste 4", "Iniciando...");

  // 500–2400 µs cobre SG90 e MG996R. Se o servo zumbir parado nas pontas,
  // troque por 1000, 2000.
  trava.setPeriodHertz(50);
  trava.attach(PIN_SERVO, 500, 2400);
  trava.write(SERVO_FECHADO);

  SPI.begin();
  rfid.PCD_Init();
  delay(50);
  byte versao = rfid.PCD_ReadRegister(MFRC522::VersionReg);
  Serial.printf("[RC522] Versao do chip: 0x%02X\n", versao);

  String base   = String("iasis/dispenser/") + DISPENSER_ID;
  TOPICO_STATUS = base + "/status";
  TOPICO_RFID   = base + "/rfid";
  TOPICO_CMD    = base + "/cmd";

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
  // Espera no maximo 15 s; se nao der, segue offline e tenta de novo no loop
  for (int i = 0; i < 30 && WiFi.status() != WL_CONNECTED; i++) delay(500);
  Serial.printf("[WiFi] %s\n", WiFi.status() == WL_CONNECTED
                ? ("Conectado, IP " + WiFi.localIP().toString()).c_str()
                : "Nao conectou (o leitor segue funcionando)");

  tela("Conectando", "nuvem...");
  ultimaTentativa = millis() - 15000;
  manterConexao();
  telaEspera();
}

void loop() {
  manterConexao();

  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    String uid    = lerUid();
    bool   valida = (uid == TAG_AUTORIZADA);

    bool enviado = false;
    if (mqtt.connected()) {
      JsonDocument doc;
      doc["type"]  = "RFID_READ";
      doc["tag"]   = uid;
      doc["valid"] = valida;
      char buf[160];
      serializeJson(doc, buf);
      enviado = mqtt.publish(TOPICO_RFID.c_str(), buf);
    }

    Serial.printf("UID: %s -> %s | nuvem: %s\n", uid.c_str(),
                  valida ? "AUTORIZADA" : "NEGADA", enviado ? "enviado" : "NAO enviado");
    tela(uid, String(valida ? "OK " : "NEG ") + (enviado ? "enviado" : "sem nuvem"));

    if (valida) {
      Serial.println("[Servo] Abrindo trava");
      trava.write(SERVO_ABERTO);
      fecharTravaEm = millis() + TEMPO_ABERTO;
    }

    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    voltarTelaEm = millis() + 3000;
  }

  if (voltarTelaEm && millis() > voltarTelaEm) {
    voltarTelaEm = 0;
    telaEspera();
  }

  if (fecharTravaEm && millis() > fecharTravaEm) {
    fecharTravaEm = 0;
    Serial.println("[Servo] Fechando trava");
    trava.write(SERVO_FECHADO);
  }

  if (mqtt.connected() && millis() - ultimoStatus > 30000) {
    ultimoStatus = millis();
    publicarStatus();
  }

  delay(20);
}
