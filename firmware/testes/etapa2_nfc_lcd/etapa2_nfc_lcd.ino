/*
 * IASIS — Teste 2: ESP32 + RC522 + LCD 16x2
 * Resultado: na tela e no Monitor Serial (115200 baud)
 *
 * RC522: igual ao teste 1 (SDA 5, SCK 18, MOSI 23, MISO 19, RST 22, 3.3V)
 *
 * LCD 16x2 (paralelo, modo 4 bits):
 *   1 VSS → GND           2 VDD → 5V            3 V0 → meio do potenciometro
 *   4 RS  → GPIO 13       5 RW  → GND (obrigatorio)
 *   6 E   → GPIO 15       (veja PIN_LCD_E abaixo)
 *   11 D4 → GPIO 14       12 D5 → GPIO 25
 *   13 D6 → GPIO 33       14 D7 → GPIO 32
 *   15 A  → resistor 220 Ω → 5V      16 K → GND
 *   Potenciometro 10k: pontas no 5V e no GND, pino do meio no V0.
 *   Pinos 7 a 10 (D0–D3) ficam soltos.
 *
 * Bibliotecas: MFRC522 (GithubCommunity), LiquidCrystal (Arduino)
 */

#include <SPI.h>
#include <MFRC522.h>
#include <LiquidCrystal.h>

// ── Troque pelo UID anotado no teste 1 ──
const char* TAG_AUTORIZADA = "A3F2910C";

#define PIN_RFID_SS   5
#define PIN_RFID_RST  22

#define PIN_LCD_RS  13
#define PIN_LCD_E   15   // a placa nao tem GPIO 16/17; nao use o 12 (impede o boot)
                         // nem RX0/TX0 (sao a conexao USB com o computador)
#define PIN_LCD_D4  14
#define PIN_LCD_D5  25
#define PIN_LCD_D6  33
#define PIN_LCD_D7  32

MFRC522       rfid(PIN_RFID_SS, PIN_RFID_RST);
LiquidCrystal lcd(PIN_LCD_RS, PIN_LCD_E, PIN_LCD_D4, PIN_LCD_D5, PIN_LCD_D6, PIN_LCD_D7);

unsigned long voltarTelaEm = 0;

// O LCD nao tem acento: escreva "remedio", "conexao" etc.
void tela(const String& linha1, const String& linha2 = "") {
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print(linha1.substring(0, 16));
  lcd.setCursor(0, 1); lcd.print(linha2.substring(0, 16));
}

void telaEspera() {
  tela("Aproxime a", "pulseira...");
}

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
  Serial.println("\n=== IASIS | Teste 2: RC522 + LCD ===");

  lcd.begin(16, 2);
  tela("IASIS - Teste 2", "Iniciando...");
  // Se aparecer so uma fileira de quadradinhos: gire o potenciometro.
  // Se a tela acender mas ficar sem nada: confira RS, E e D4–D7.

  SPI.begin();
  rfid.PCD_Init();
  delay(50);

  byte versao = rfid.PCD_ReadRegister(MFRC522::VersionReg);
  Serial.printf("[RC522] Versao do chip: 0x%02X\n", versao);
  if (versao == 0x00 || versao == 0xFF) {
    Serial.println("[RC522] SEM COMUNICACAO — volte ao teste 1");
    tela("Erro no leitor", "Volte ao teste 1");
    while (true) delay(1000);
  }

  delay(800);
  telaEspera();
  Serial.println("Pronto. Aproxime a pulseira...");
}

void loop() {
  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    String uid    = lerUid();
    bool   valida = (uid == TAG_AUTORIZADA);

    Serial.printf("UID: %s -> %s\n", uid.c_str(), valida ? "AUTORIZADA" : "NEGADA");
    tela(uid, valida ? "Autorizada" : "Tag negada");

    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    voltarTelaEm = millis() + 3000;
  }

  if (voltarTelaEm && millis() > voltarTelaEm) {
    voltarTelaEm = 0;
    telaEspera();
  }

  delay(50);
}
