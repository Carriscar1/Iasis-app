/*
 * IASIS — Teste 1: ESP32 + leitor RFID/NFC RC522
 * Resultado: só no Monitor Serial (115200 baud)
 *
 * Ligações (RC522 → ESP32):
 *   SDA → GPIO 5    SCK  → GPIO 18   MOSI → GPIO 23
 *   MISO → GPIO 19  RST  → GPIO 22   IRQ  → (solto)
 *   GND → GND       3.3V → 3V3   (NUNCA no 5V)
 *
 * Biblioteca: MFRC522 (GithubCommunity)
 */

#include <SPI.h>
#include <MFRC522.h>

#define PIN_RFID_SS   5
#define PIN_RFID_RST  22

MFRC522 rfid(PIN_RFID_SS, PIN_RFID_RST);

unsigned long ultimoAviso = 0;

String lerUid() {
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  return uid;
}

// Lê o registrador de versão do chip. É o teste que diz se a fiação SPI
// está certa ANTES de qualquer cartão chegar perto.
bool conferirLeitor() {
  byte versao = rfid.PCD_ReadRegister(MFRC522::VersionReg);
  Serial.printf("[RC522] Versao do chip: 0x%02X ", versao);

  if (versao == 0x91 || versao == 0x92) {
    Serial.println("(MFRC522 original) OK");
    return true;
  }
  if (versao == 0x88 || versao == 0xB2 || versao == 0x12) {
    Serial.println("(clone, costuma funcionar) OK");
    return true;
  }
  if (versao == 0x00 || versao == 0xFF) {
    Serial.println("-> SEM COMUNICACAO");
    Serial.println("   Confira: 3.3V e GND, SDA no 5, SCK no 18, MOSI no 23, MISO no 19, RST no 22.");
    Serial.println("   0x00 costuma ser fio solto; 0xFF costuma ser MISO trocado ou modulo sem energia.");
    return false;
  }
  Serial.println("-> valor desconhecido, siga testando com uma etiqueta");
  return true;
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== IASIS | Teste 1: ESP32 + RC522 ===");

  SPI.begin();
  rfid.PCD_Init();
  delay(50);

  if (conferirLeitor()) {
    // Autoteste interno do chip (opcional, demora ~1 s)
    bool ok = rfid.PCD_PerformSelfTest();
    Serial.printf("[RC522] Autoteste interno: %s\n", ok ? "PASSOU" : "falhou (clones as vezes falham aqui e leem normal)");
    rfid.PCD_Init();  // o autoteste exige reiniciar o chip depois
  }

  Serial.println("Aproxime a pulseira ou um cartao do leitor...");
}

void loop() {
  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    MFRC522::PICC_Type tipo = rfid.PICC_GetType(rfid.uid.sak);

    Serial.println("----------------------------------------");
    Serial.printf("UID:  %s  (%d bytes)\n", lerUid().c_str(), rfid.uid.size);
    Serial.print("Tipo: ");
    Serial.println(rfid.PICC_GetTypeName(tipo));
    Serial.println("-> Anote o UID da pulseira: ele vai no teste 2 em diante.");

    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
  }

  // Sinal de vida a cada 10 s, para saber que a placa não travou
  if (millis() - ultimoAviso > 10000) {
    ultimoAviso = millis();
    Serial.println("(aguardando etiqueta...)");
  }

  delay(50);
}
