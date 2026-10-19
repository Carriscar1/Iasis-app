/*
 * IASIS — Teste 5: ESP32 + driver A4988 + motor NEMA 17
 * Resultado: meia volta (180°) a cada 8 segundos, sempre no mesmo sentido.
 *
 * Ligações do A4988:
 *   VMOT → +12 V (ramal do motor)    GND (ao lado do VMOT) → GND da fonte
 *   Capacitor 100 µF / 25 V+ colado em VMOT e GND (listra = negativo no GND)
 *   VDD  → 3V3 do ESP32              GND (ao lado do VDD) → GND
 *   STEP → GPIO 26   DIR → GPIO 27   EN → GPIO 21
 *   SLEEP ligado ao RESET (um fio entre os dois)
 *   MS1, MS2, MS3 soltos (passo inteiro: 200 passos = 1 volta)
 *   1A/1B → uma bobina do motor     2A/2B → a outra bobina
 *
 * NUNCA conecte ou desconecte o motor com a fonte ligada.
 * Ajuste o VREF ANTES de ligar o motor (veja o guia).
 *
 * Teste da fita: cole um pedaço de fita no eixo. A cada 2 movimentos (1 volta)
 * a fita tem que voltar exatamente ao mesmo lugar. Se ela "andar" um pouco a
 * cada volta, o motor está perdendo passo: suba um pouco o VREF ou aumente
 * MEIO_PERIODO_US.
 *
 * Sem bibliotecas.
 */

#define PIN_STEP  26
#define PIN_DIR   27
#define PIN_EN    21

#define PASSOS_POR_VOLTA  200
#define PASSOS_MEIA_VOLTA (PASSOS_POR_VOLTA / 2)   // 180°
#define MEIO_PERIODO_US   2000                     // 2000 → ~0,4 s por meia volta
                                                   // se só vibrar, teste 5000
#define INTERVALO_MS      8000

unsigned long ultimoGiro = 0;
unsigned long giros      = 0;

void girar(int passos, bool horario) {
  digitalWrite(PIN_DIR, horario ? HIGH : LOW);
  digitalWrite(PIN_EN, LOW);   // liga o driver (EN é ativo em LOW)
  delay(5);                    // dá tempo das bobinas energizarem

  for (int i = 0; i < passos; i++) {
    digitalWrite(PIN_STEP, HIGH); delayMicroseconds(MEIO_PERIODO_US);
    digitalWrite(PIN_STEP, LOW);  delayMicroseconds(MEIO_PERIODO_US);
  }

  delay(50);                   // segura a posição um instante antes de soltar
  digitalWrite(PIN_EN, HIGH);  // desliga o driver: motor e A4988 não esquentam parados
}

void setup() {
  // EN primeiro, em HIGH: o motor não pode se mexer enquanto o resto inicia
  pinMode(PIN_EN, OUTPUT);
  digitalWrite(PIN_EN, HIGH);
  pinMode(PIN_STEP, OUTPUT);
  pinMode(PIN_DIR, OUTPUT);
  digitalWrite(PIN_STEP, LOW);

  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== IASIS | Teste 5: motor de passo ===");
  Serial.println("180 graus a cada 8 s. Observe a fita no eixo.");

  ultimoGiro = millis() - INTERVALO_MS;  // primeiro giro já na largada
}

void loop() {
  if (millis() - ultimoGiro >= INTERVALO_MS) {
    ultimoGiro = millis();
    giros++;

    unsigned long inicio = millis();
    girar(PASSOS_MEIA_VOLTA, true);
    Serial.printf("Giro %lu: 180 graus em %lu ms%s\n", giros, millis() - inicio,
                  giros % 2 == 0 ? "  <- volta completa: a fita deve estar no lugar inicial" : "");
  }
}
