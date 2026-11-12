/*
 * IASIS — Teste do motor em micropasso 1/16 (com o disco encaixado)
 * A4988: STEP 26, DIR 27, EN 21, VDD 3V3, VMOT 12 V, SLEEP ligado no RESET
 *        MS1, MS2 e MS3 TODOS no 3V3 (micropasso 1/16 → 3200 micropassos = 1 volta)
 * Monitor Serial em 115200: ele dá 1 volta em cada velocidade. Anote a que gira liso.
 */
#define PIN_STEP 26
#define PIN_DIR  27
#define PIN_EN   21
#define MICROPASSO       16
#define PASSOS_VOLTA     (200 * MICROPASSO)
#define PASSOS_RAMPA     (40 * MICROPASSO)
#define SENTIDO_HORARIO  true

// meio período em µs por micropasso (o equivalente em passo inteiro está no comentário)
const unsigned long velocidades[] = {1000, 750, 500, 375, 250};   // 16000, 12000, 8000, 6000, 4000

void girar(long passos, unsigned long cruzeiro) {
  unsigned long inicio = cruzeiro * 2;
  digitalWrite(PIN_DIR, SENTIDO_HORARIO ? HIGH : LOW);
  digitalWrite(PIN_EN, LOW);
  delay(1000);
  long rampa = min((long)PASSOS_RAMPA, passos / 2);
  for (long i = 0; i < passos; i++) {
    unsigned long meio = cruzeiro;
    long dist = min(i, passos - 1 - i);
    if (dist < rampa) meio = inicio - (inicio - cruzeiro) * dist / rampa;
    digitalWrite(PIN_STEP, HIGH); delayMicroseconds(meio);
    digitalWrite(PIN_STEP, LOW);  delayMicroseconds(meio);
  }
  delay(500);
  digitalWrite(PIN_EN, HIGH);
}

void setup() {
  pinMode(PIN_EN, OUTPUT);   digitalWrite(PIN_EN, HIGH);
  pinMode(PIN_STEP, OUTPUT); digitalWrite(PIN_STEP, LOW);
  pinMode(PIN_DIR, OUTPUT);
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=== IASIS | Motor em micropasso 1/16 ===");
}

void loop() {
  for (unsigned long v : velocidades) {
    Serial.printf("Meio periodo %lu us (= %lu em passo inteiro): 1 volta...\n", v, v * MICROPASSO);
    girar(PASSOS_VOLTA, v);
    delay(3000);
  }
  Serial.println("--- recomecando ---");
}
