# IASIS — Bancada de testes do hardware

Roteiro para achar o curto, conferir cada peça e montar o dispensador um módulo
por vez. Cada etapa tem um código próprio nesta pasta:

| Etapa | Pasta | O que prova |
|---|---|---|
| 0 | (sem código) | Fonte e LM2596 entregando 5,0 V |
| 1 | `etapa1_nfc` | ESP32 e RC522 conversam (Monitor Serial) |
| 2 | `etapa2_nfc_lcd` | + LCD mostra a leitura |
| 3 | `etapa3_nfc_lcd_hivemq` | + a leitura chega no HiveMQ, e comandos voltam |
| 4 | `etapa4_nfc_lcd_hivemq_servo` | + a pulseira autorizada abre a trava |
| 5 | `etapa5_motor_passo` | Motor de passo sozinho: 180° a cada 8 s |
| 6 | `etapa6_integrado` | Tudo junto, falando o protocolo do app |
| 6b | `etapa6_vibracao_disco` | Módulo de vibração + pulseira + disco; responde o DISPENSE do app em `.../dispense` (`DISPENSE_ACK` com o mesmo `slot` e `doseId`) |

> **Situação dos códigos:** todos compilam sem erro e sem aviso no core ESP32
> 2.0.17 e 3.0.7. **Nenhum foi rodado numa placa ainda**: o primeiro teste real
> é o de vocês.

---

## 1. Onde o curto pode estar

Não dá para saber o lugar exato sem ver a montagem, mas o guia antigo tem pontos
em que um curto é fácil de acontecer. Estão em ordem de probabilidade, com o
jeito de conferir cada um.

### 🔴 Mais prováveis

**1. O ramal de 12 V do motor ficou vivo e solto nas etapas 1 a 4.**
O guia mandava "isolar as pontas" dos fios de 12 V que vão para o driver. Isso
significa que os dois fios ficavam energizados, soltos na bancada, enquanto se
montava o resto. Basta uma ponta encostar num jumper, num trilho da protoboard ou
na outra ponta para dar curto ou jogar 12 V no circuito de 5 V e 3,3 V.
→ **Correção:** nas etapas 0 a 4, o ramal do motor fica **desconectado** da
bifurcação. Se ele for de fio sem plugue, prenda num borne (KRE ou Wago), nunca só
com fita, e um fio longe do outro.

**2. Peça de 3 pinos ou mais encaixada no sentido errado da protoboard.**
Cada fileira de 5 furos é um fio só por dentro. Se o **potenciômetro** do LCD for
encaixado com as três pernas na mesma fileira, o 5 V e o GND ficam ligados direto
por ali. Vale o mesmo para a barra de pinos do RC522 e do LCD e para o borne do servo.
→ **Correção:** toda peça de pernas em linha tem que **atravessar** as fileiras,
com cada perna numa fileira diferente.

**3. Potenciômetro ligado com o pino do meio num dos trilhos.**
Se o pino do meio (cursor) for para o 5 V e uma ponta para o GND, girar o
potenciômetro até o fim liga o 5 V direto no GND.
→ **Correção:** **pontas** no 5 V e no GND, **meio** no V0 do LCD.

**4. Capacitor eletrolítico invertido.**
O de 100 µF do motor fica nos 12 V. Invertido, ele conduz, esquenta, estufa e
pode estourar, e o efeito é igual a um curto. O de 470 a 1000 µF do servo, nos
5 V, também.
→ **Correção:** a **listra** do capacitor (com o sinal "−") vai no **GND**. A
perna mais comprida é o +.

**5. Driver A4988 encaixado girado 180°.**
Girado, o pino VMOT cai na fileira onde deveria estar o DIR. Os 12 V entram na
lógica do driver e, por dentro dele, no 3,3 V do ESP32. Isso queima o ESP32 e
costuma deixar o driver em curto.
→ **Correção:** confira a serigrafia do módulo antes de ligar. O lado com
**VMOT, GND, 2B, 2A, 1A, 1B, VDD, GND** fica para o lado dos fios de 12 V e do
motor.

**6. Solda feita pela equipe com ponte entre pinos vizinhos.**
O RC522 e o A4988 costumam vir com a barra de pinos solta. Uma gota de solda entre
**GND, RST e 3.3V** do RC522, que são vizinhos, faz curto no 3,3 V do ESP32.
→ **Correção:** olhe as soldas com a lupa da câmera do celular e meça
continuidade entre cada par de pinos vizinhos.

### 🟠 Também possíveis

7. **Trilhos misturados.** Um jumper de 5 V no trilho de 3,3 V. **5 V no pino 3V3
   do ESP32 queima a placa.** Muitas protoboards também têm os trilhos **cortados
   no meio**: confira com o multímetro.
8. **USB e fonte ligados juntos sem o diodo.** A fonte empurra corrente para a
   porta USB do computador.
9. **Polaridade da P4 ou do LM2596 invertida.** IN+ e IN− trocados queimam o
   LM2596, que depois pode ficar em curto. Meça a polaridade da P4 antes.
10. **Chave de fenda de metal no ajuste do VREF.** Ela pode encostar no VMOT
    vizinho. Ajuste devagar, com a ponta só no parafuso do trimpot.
11. **Motor conectado ou desconectado com o driver ligado.** Isso queima o A4988,
    e um A4988 queimado costuma ficar **em curto entre VMOT e GND**. A partir daí,
    toda vez que ligar parece que "tem um curto na montagem".
12. **Backlight do LCD sem resistor.** O LED do pino 15 direto no 5 V puxa
    corrente demais em módulos sem resistor próprio. Use o de 220 Ω.

### ⚠️ Peças que já podem estar estragadas pelo curto
Um curto anterior pode ter queimado alguma peça, e **essa peça passa a ser o
curto**. Por isso a seção 3 testa cada peça **sozinha**, antes de montar.

---

## 2. Revisão crítica do passo a passo do contexto

O plano do guia está certo: testar um módulo por vez com os exemplos das
bibliotecas. Abaixo está o que está certo, o que falta e o que mudei.

| Passo | Veredito | O que falta ou muda |
|---|---|---|
| 1 — Energia | Certo (5,0 V, medir antes de ligar carga, diodo 1N5819 opcional) | "Isolar as pontas" do ramal de 12 V é arriscado: **desconecte o ramal**. Meça a polaridade da P4. |
| 2 — RC522 | Certo (só 3V3, DumpInfo, anotar UID) | Conferir soldas da barra de pinos. O teste 1 lê o registrador de versão, que separa "fio errado" de "módulo ruim". |
| 3 — LCD | Certo (pontas do potenciômetro, RW no GND) | **Mudei o E do GPIO 12 para o 15.** O 12 é pino de boot: se ele estiver em nível alto quando o ESP32 liga, a placa não inicia, e isso parece defeito ou curto. A placa da equipe não tem GPIO 16/17 (só RX0/TX0, que são o USB), então sobra o 15. |
| 4 — Servo | Certo (5 V da protoboard, capacitor, testar solto) | O Sweep vai a 180° e pode forçar o servo no batente. Os testes vão de 0° a 90°. Com MG996R travado, o LM2596 não segura a corrente e o ESP32 reinicia (aparece *Brownout* no Serial). |
| 5 — A4988 | Certo (VDD no 3V3, VREF antes do motor, pares de bobina, nunca a quente) | Conferir a orientação do módulo (item 5 acima) e a polaridade do capacitor. |
| 11.4 — código do motor | Funciona | O teste 5 faz o que vocês pediram (180° a cada 8 s) e desliga o driver entre os giros. |

**Sobre o código do guia (11.6):** concordo com os 5 problemas críticos listados
no contexto. Mas só tive acesso ao **resumo** dele, não ao código. Se mandarem o
arquivo, reviso linha por linha.

**Sobre o firmware do repositório (v2.1.0):** o contexto está certo. Ele não
conecta no HiveMQ (sem TLS), usa a pinagem antiga e liga o vibrador no próprio
dispensador. Os testes 3, 4 e 6 já usam TLS com o certificado do HiveMQ.

---

## 3. Antes de montar: teste de cada peça sozinha

**Fonte desligada da tomada**, multímetro no modo **continuidade** (o que apita).

- **Bipe contínuo ou ~0 Ω = curto.** Não use a peça.
- **Bipe curto que some** é normal em peças com capacitor (ele está carregando).
- Centenas de ohms ou mais é normal em placas com chip. Na dúvida, compare com
  outra peça igual.

| Peça | Entre quais pontos medir | Esperado |
|---|---|---|
| LM2596 | IN+ e IN− · OUT+ e OUT− | Sem bipe contínuo |
| ESP32 | 3V3 e GND · VIN e GND | Sem bipe contínuo |
| RC522 | 3.3V e GND · cada pino com o vizinho | Sem bipe |
| LCD | pino 1 (VSS) e 2 (VDD) · 15 e 16 | Sem bipe contínuo |
| Servo | fio vermelho e marrom | Sem bipe contínuo |
| A4988 | VMOT e GND · VDD e GND | Sem bipe contínuo. **Bipe aqui = driver queimado** |
| NEMA 17 | entre os 4 fios | Só 2 pares têm continuidade (1 a 5 Ω cada); entre pares, nada |
| Capacitores | as duas pernas | Bipe curto que some |

Depois, a prova de vida do **ESP32 sozinho, pelo USB e sem nada ligado nele**:
grave o exemplo *Blink* (ou o teste 1) e encoste o dedo no regulador (a pecinha
de 3 pernas perto do USB) e no chip. **Morno é normal; quente demais para segurar
o dedo é defeito.**

---

## 4. Regras que valem em todas as etapas

### Distribuição da energia
```
Tomada → Fonte 12 V 2 A → P4 → bifurcação ─┬─ Ramal A → LM2596 (IN+ / IN−)
                                            │              └→ OUT 5,0 V → trilho 5V e GND
                                            └─ Ramal B → A4988 VMOT/GND
                                                        (DESCONECTADO até a etapa 5)

Trilho 5V   → VIN do ESP32 (via diodo, veja abaixo), LCD, servo
3V3 do ESP32 → trilho 3V3 → RC522 e VDD do A4988
GND: tudo ligado junto (LM2596, ESP32, RC522, LCD, servo, A4988, fonte)
```

- **12 V nunca entra num trilho da protoboard.** Ele vai só na fileira do VMOT
  do A4988.
- Use um par de trilhos para **5 V** e o outro para **3,3 V**. Marque com fita
  e caneta. Ligue os dois GND entre si.
- **5 V nunca no pino 3V3 do ESP32**, e o **RC522 nunca no 5 V**.
- Confira se o ESP32 **atravessa o canal do meio** da protoboard. Se não sobrar
  furo livre de um lado, use duas protoboards lado a lado.

### Monitor Serial com a fonte ligada
O ESP32 recebe 5 V da fonte pelo VIN e do computador pelo USB. Os dois ao mesmo
tempo, sem proteção, mandam corrente da fonte para o USB.
- **Com diodo 1N5819 (recomendado):** a perna sem listra vai no trilho de 5 V, e
  a perna **com listra vai no VIN**. Regule o LM2596 em **5,3 V** (o diodo derruba
  ~0,3 V). Com isso, USB e fonte podem ficar ligados juntos.
- **Sem o diodo:** nunca USB e VIN ao mesmo tempo. Para gravar, desligue a fonte e
  tire o fio do VIN. Nessa condição só dá para ver o Serial alimentando pelo USB.
  Compre o diodo: custa centavos e vale para todas as etapas.

### Ritual de toda vez que for ligar
1. Fonte **fora da tomada**. Monte a etapa.
2. Continuidade: **5V–GND, 3V3–GND** (e **12V–GND** na etapa 5+). Nada de bipe contínuo.
3. Ligue a fonte e **conte 5 segundos** olhando e tocando: LM2596, ESP32, RC522,
   driver. Cheiro, fumaça, LED que apaga ou peça quente → **tira da tomada**.
4. Meça com tudo ligado: trilho 5V entre **4,8 e 5,2 V**; 3V3 entre **3,2 e 3,4 V**.
   Se o 5 V cair muito em relação ao que estava sem carga, alguma coisa está
   puxando corrente demais.

---

## 5. Etapa 0 — Fonte e LM2596

1. Fonte na tomada, nada ligado na P4. Meça o plugue: **+12 V no fio que vai para
   o IN+**. Se der −12 V, a polaridade está invertida.
2. Tire da tomada. Ligue **só o ramal A** no **IN+ / IN−** do LM2596. O ramal B
   fica desconectado.
3. Ligue a fonte. Meça **OUT+ / OUT−** e gire o trimpot até **5,0 V** (ou **5,3 V**
   se usar o diodo). Ele pode precisar de muitas voltas, e o sentido que baixa
   muda de um módulo para outro: guie-se pelo multímetro.
4. Tire da tomada. Ligue o OUT nos trilhos 5V/GND. Ligue de novo e confira a
   tensão no trilho.

**Passou se:** a tensão fica estável e nada esquenta.

---

## 6. Etapa 1 — ESP32 + RC522 (Monitor Serial)

| RC522 | ESP32 |
|---|---|
| SDA | GPIO 5 |
| SCK | GPIO 18 |
| MOSI | GPIO 23 |
| MISO | GPIO 19 |
| IRQ | solto |
| GND | GND |
| RST | GPIO 22 |
| 3.3V | **3V3** (nunca 5 V) |

ESP32: **VIN** no trilho 5 V (pelo diodo) e **GND** no trilho GND.

**Código:** `etapa1_nfc`. Biblioteca: **MFRC522** (GithubCommunity).
Monitor Serial em **115200**.

**Passou se:**
- aparece `Versao do chip: 0x91` ou `0x92` (ou `0x88`/`0xB2`/`0x12` nos clones);
- ao aproximar a pulseira, aparece o **UID**. **Anote o UID**: ele vai em todos os
  outros testes.

**Se der errado:**
- `0x00` costuma ser fio solto ou trocado.
- `0xFF` costuma ser MISO errado ou o módulo sem energia.
- Lê o chip mas não lê a pulseira: aproxime mais devagar, a 1 ou 2 cm da antena,
  e teste o cartão branco que veio com o kit.

---

## 7. Etapa 2 — + LCD

Mantém tudo da etapa 1 e acrescenta:

| LCD (pino) | Ligação |
|---|---|
| 1 VSS | GND |
| 2 VDD | 5 V |
| 3 V0 | **meio** do potenciômetro (as pontas no 5 V e no GND) |
| 4 RS | GPIO 13 |
| 5 RW | **GND** (obrigatório: impede o LCD de mandar 5 V para o ESP32) |
| 6 E | **GPIO 15** |
| 7 a 10 (D0–D3) | soltos |
| 11 D4 | GPIO 14 |
| 12 D5 | GPIO 25 |
| 13 D6 | GPIO 33 |
| 14 D7 | GPIO 32 |
| 15 A | resistor 220 Ω → 5 V |
| 16 K | GND |

**Código:** `etapa2_nfc_lcd`. Troque `TAG_AUTORIZADA` pelo UID anotado.
Bibliotecas: MFRC522 e **LiquidCrystal** (Arduino).

**Passou se:** a tela mostra "Aproxime a pulseira", e ao aproximar mostra o UID
com **Autorizada** (ou **Tag negada** para outro cartão).

**Se der errado:**
- Só uma fileira de quadradinhos: gire o potenciômetro.
- Acende mas não escreve: confira RS, E e D4–D7.
- Letras estranhas: um dos D4–D7 está trocado.
- O ESP32 parou de ligar depois do LCD: confira se o E está mesmo no **15** e não
  no 12. Nunca use RX0/TX0: são a conexão USB com o computador.

---

## 8. Etapa 3 — + HiveMQ Cloud

Montagem igual à etapa 2. A diferença é a nuvem.

**Preparar o HiveMQ (uma vez só; o contexto diz que ainda não foi criado):**
1. Crie um cluster gratuito (*Serverless*) no HiveMQ Cloud com a conta do projeto.
2. Na área de credenciais (*Access Management*), crie dois usuários com
   permissão de publicar e assinar: `iasis_esp32` e `iasis_app`.
3. Copie o endereço do cluster (algo como `xxxx.s1.eu.hivemq.cloud`).

**Preparar o código:**
1. Abra `etapa3_nfc_lcd_hivemq.ino` e preencha a seção **CONFIGURAÇÕES**, logo
   abaixo dos `#include`: Wi-Fi (**2,4 GHz**, porque o ESP32 não enxerga 5 GHz),
   endereço do cluster, usuário, senha e o UID da pulseira. As etapas 4 e 6 têm a
   mesma seção.
2. ⚠️ **O repositório é público.** Não faça commit desses arquivos com as senhas
   reais: preencha só na cópia do computador que grava a placa.
3. Bibliotecas: + **PubSubClient** (Nick O'Leary) e **ArduinoJson** 7.x.

**Ver chegando na nuvem:** no console do HiveMQ, abra o **Web Client**, conecte
com `iasis_app` e assine `iasis/#`. Aproxime a pulseira e deve chegar, em
`iasis/dispenser/01/rfid`:
```json
{"type":"RFID_READ","tag":"A3F2910C","valid":true}
```
**Testar o caminho de volta:** publique em `iasis/dispenser/01/cmd`:
```json
{"type":"CMD","command":"STATUS_REQ"}
```
O LCD mostra "Comando recebido".

**Passou se:** a leitura aparece nos três lugares (LCD, Serial e Web Client) e o
comando volta para o LCD.

**Se der errado** (veja o `rc=` no Serial):
- `rc=-2`: não chegou no servidor (endereço, porta ou certificado). Para
  diagnosticar, mude `TLS_INSEGURO` para `1`. Se conectar assim, o problema é o
  certificado. **Volte para `0` depois**: com `1`, a conexão não confere com quem
  está falando.
- `rc=4` ou `rc=5`: usuário ou senha errados, ou sem permissão.
- O leitor **continua funcionando sem internet**: a tela mostra "Sem nuvem" e o
  código tenta reconectar sozinho.

---

## 9. Etapa 4 — + servo (trava)

Acrescente o servo:

| Fio do servo | Ligação |
|---|---|
| Marrom / preto | GND |
| Vermelho | **5 V da protoboard** (nunca o 5 V do ESP32) |
| Laranja / amarelo | GPIO 4 |

+ **capacitor de 470 a 1000 µF** (10 V ou mais) entre o vermelho e o GND, perto do
servo, **listra no GND**.

**Primeiro teste com o servo solto**, fora da trava.

**Código:** `etapa4_nfc_lcd_hivemq_servo` (preencha a seção CONFIGURAÇÕES igual à
etapa 3). Biblioteca: + **ESP32Servo**.

**Passou se:** a pulseira **autorizada** gira o servo para 90°, ele volta para 0°
depois de 3 s, e a leitura continua chegando no HiveMQ. **Um cartão
desconhecido não mexe no servo.**

**Se der errado:**
- O ESP32 reinicia quando o servo mexe (aparece *Brownout* no Serial): falta o
  capacitor, ou o servo puxa mais do que o LM2596 aguenta. Um MG996R travado
  chega a 2,5 A.
- O servo zumbe parado: troque `500, 2400` por `1000, 2000` no `attach`.
- Para ajustar os ângulos da trava de verdade, mude `SERVO_FECHADO` e
  `SERVO_ABERTO`.

---

## 10. Etapa 5 — Motor de passo sozinho

**Monte numa protoboard separada, ou desmonte o resto.** Aqui só entram o ESP32,
o A4988 e o motor. Siga **exatamente** esta ordem:

1. Fonte fora da tomada. Encaixe o A4988 conferindo a orientação.
2. Capacitor **100 µF, 25 V ou mais**, colado em VMOT e GND, **listra no GND**.
3. **VDD no 3V3** do ESP32 e o GND ao lado do VDD no GND.
4. Ligue o **SLEEP no RESET**, com um fio entre os dois. MS1, MS2 e MS3 ficam soltos.
5. **STEP → GPIO 26**, **DIR → GPIO 27**, **EN → GPIO 21**.
6. Agora conecte o **ramal B** (12 V) no VMOT e no GND. **Motor ainda desconectado.**
7. Ligue a fonte e **ajuste o VREF**: ponta preta no GND, vermelha no parafuso do
   trimpot. Para 1 A, conforme o resistor ao lado do chip:
   **R100 → 0,8 V · R068 → 0,54 V · R050 → 0,4 V**.
8. Tire da tomada. Ache os pares de bobina com o multímetro (1 a 5 Ω entre os fios
   do mesmo par). Um par em **1A/1B**, o outro em **2A/2B**.
9. Ligue a fonte.

**Código:** `etapa5_motor_passo` (sem bibliotecas). Cole um pedaço de fita no eixo.

**Passou se:** a cada 8 s o eixo dá meia volta, e a cada 2 giros (uma volta
inteira) **a fita para exatamente no mesmo lugar**. Entre os giros, o driver e o
motor ficam frios ou mornos.

**Se der errado:**
- Só vibra, não gira: par de bobina trocado, ou mude `MEIO_PERIODO_US` para 5000.
- A fita "anda" a cada volta: está perdendo passo. Suba um pouco o VREF.
- O driver esquenta muito: VREF alto demais.
- ⚠️ **Nunca mexa nos fios do motor com a fonte ligada.**

---

## 11. Etapa 6 — Tudo integrado

Junte as montagens das etapas 4 e 5. Os pinos não se repetem:

| Componente | Pinos |
|---|---|
| RC522 | SDA 5 · SCK 18 · MOSI 23 · MISO 19 · RST 22 · 3V3 |
| LCD | RS 13 · **E 15** · D4 14 · D5 25 · D6 33 · D7 32 |
| Servo | GPIO 4 (5 V da protoboard) |
| A4988 | STEP 26 · DIR 27 · EN 21 · VDD no 3V3 |

**Antes de ligar:** com a fonte fora da tomada, gire o disco à mão até o
**compartimento 1 ficar na saída**. Sem sensor de posição zero, é assim que o
código sabe onde o disco está.

**Código:** `etapa6_integrado` (preencha a seção CONFIGURAÇÕES). Ele segue o formato de mensagens
do app e **nunca libera dose sozinho**: a pulseira só gera o `RFID_READ`, e o
disco e a trava só se mexem quando chega um `DISPENSE`.

**Testar sem o app**, publicando em `iasis/dispenser/01/cmd` pelo Web Client:
```json
{"type":"CMD","command":"VIBRATE_ON","pattern":"urgent"}
```
→ LCD: "Hora do remedio!"
```json
{"type":"CMD","command":"DISPENSE","slot":2,"doseId":"test"}
```
→ o disco avança até o compartimento 2, a trava abre por 2 s, fecha, e chega
`DISPENSE_ACK` em `.../dispense`.

**Testar com o app:** na tela *Configurar dispensador*, use o mesmo broker, o
usuário `iasis_app` e o ID `01`. O fluxo fechado passa a usar o hardware real.

**Proteções que entraram no código:**
- Dois `DISPENSE` com o mesmo `doseId` (paciente logado em dois aparelhos): só o
  primeiro libera. O segundo recebe `DUPLICATE`.
- Comando chegando no meio de uma dispensa: recebe `BUSY`.
- Compartimento fora do disco: `BAD_SLOT`.

**O que este código assume e precisa ser confirmado pela equipe:**
- O servo é a **trava da saída**: o disco gira com a trava fechada, e a trava
  abre para a dose cair. Se a mecânica do 3D for outra, só a função
  `dispensar()` muda.
- **8 compartimentos** (`COMPARTIMENTOS`). Tem que ser 4, 5, 8 ou 10.
- **Nada vibra**: o `VIBRATE_ON` acende o alerta no LCD e o estado é devolvido ao
  app, até decidirem quem faz a pulseira vibrar.
- **Sem DHT22**: o app mostra "--" em umidade e temperatura.

---

## 12. Bibliotecas (Arduino IDE → Gerenciar bibliotecas)

| Biblioteca | Autor | Etapas |
|---|---|---|
| MFRC522 | GithubCommunity | 1, 2, 3, 4, 6 |
| LiquidCrystal | Arduino | 2, 3, 4, 6 |
| PubSubClient | Nick O'Leary | 3, 4, 6 |
| ArduinoJson (7.x) | Benoit Blanchon | 3, 4, 6 |
| ESP32Servo | Kevin Harrington | 4, 6 |

Placa: **ESP32 Dev Module** (pacote *esp32 by Espressif*, 2.x ou 3.x).
