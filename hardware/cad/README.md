# Dispensador IASIS — arquivos para imprimir

Tudo sai de `dispenser.py` a partir dos modelos originais (`originais/`). Os STL
de `saida/` já estão **em milímetros e deitados na posição de impressão**: é só
abrir no fatiador.

> **O que foi conferido:** cada peça é um sólido fechado; nenhuma peça encosta
> em outra nem nos componentes (motor, servo, LCD, RC522); a paleta da trava
> gira de 0° a 90° sem bater; prateleira, disco e calha passam pela abertura de
> cima. **Nada disso foi impresso ainda:** por isso existem os corpos de prova.

## 1. Qual pasta usar

| Sua impressora | Use |
|---|---|
| Mesa ≥ 280 × 200 mm **e** altura ≥ 280 mm | `saida/imprimir_inteiro/` |
| Mesa ≥ 210 × 210 mm e altura ≥ 150 mm (ex.: Ender 3) | `saida/imprimir_dividido/` (corpo em 4 partes) |

`saida/montagem/` tem as peças na posição em que ficam no dispensador. Serve só
para conferir, não para imprimir.

## 2. Comece pelos corpos de prova (`saida/corpo_de_prova/`)

São pedaços pequenos (~50 g no total) que testam cada encaixe antes de gastar
~1 kg de filamento nas peças grandes. **Com a feira amanhã, pode pular: as folgas
já foram deixadas maiores.**

| Arquivo | Testa | Deu certo se... | Se não deu |
|---|---|---|---|
| `1_junta_parte_de_tras` + `1_junta_parte_da_frente` | encaixe entre as metades | entram com a mão, sem folga visível | apertado: `folga` 0,25 · frouxo: 0,15 |
| `2_corpo_canto_topo` + `2_tampa_canto` | aba da tampa e parafuso M3 da tampa | a tampa assenta reta e o M3 × 12 rosqueia firme | apertado: `aba_folga` 0,35 · parafuso solto: `furo_guia_m3` 2,3 |
| `3_divisao_baixo` + `3_divisao_cima` | junta da versão dividida | igual ao 1 | igual ao 1 |
| `4_disco_centro_no_eixo` | furo em D no eixo do motor | entra no eixo deslizando, sem jogo para girar | apertado: `eixo_diametro` 5,1 · com jogo: `eixo_chato` 4,4 |
| `5_suporte_servo` | encaixe do SG90 | o corpo do servo passa pela janela e as abas apoiam | meça o servo e ajuste `sg90_*` |

Mudou algum parâmetro? Rode o script de novo (seção 8) antes de imprimir as peças grandes.

## 3. Lista de impressão

**Perfil rápido** (versão para a feira): PLA, camada 0,28 mm, 2 perímetros, 10 % de
preenchimento nas peças grandes. As peças já estão orientadas. O corpo é oco por
dentro (o enchimento maciço dos originais saiu) e a tampa tem 5 mm: ~1 kg no total.

| Arquivo | Qtd | Preench. | Suporte | Observação |
|---|---|---|---|---|
| `corpo_parte_da_frente` (ou `corpo_frente_baixo` + `corpo_frente_cima`) | 1 | 15 % | **só na janela de baixo** (ponte de 130 mm) | a janela do LCD (70 mm) sai sem suporte |
| `corpo_parte_de_tras` (ou `corpo_tras_baixo` + `corpo_tras_cima`) | 1 | 15 % | não | deitada de costas |
| `tampa` | 1 | 15 % | não | de cabeça para baixo |
| `prateleira` | 1 | 25 % | não | de cabeça para baixo |
| `disco` | 1 | 25 % | não | números para cima |
| `calha` | 1 | 15 % | não | |
| `suporte_servo` | 1 | 50 % | não | |
| `paleta` | 1 | 100 % | não | peça fina, precisa ser maciça |
| `painel_eletronica_x2` | **2** | 25 % | não | |

## 4. Peças compradas

| Item | Qtd | Onde |
|---|---|---|
| Parafuso M3 × 12 cabeça chata (escareado) | 4 | tampa |
| Parafuso M3 × 8 cabeça chata (escareado) | 4 | motor na prateleira |
| Parafuso M3 × 10 cabeça chata (escareado) | 2 | suporte do servo na prateleira |
| Parafuso M3 × 6 | 4 | LCD |
| Parafuso M3 × 8 | 8 | painéis |
| Parafusos do SG90 | — | vêm com o servo |
| Abraçadeiras finas, cola para PLA | — | eletrônica nos painéis, juntas |

Os furos para parafuso no plástico têm 2,5 mm: o M3 entra rosqueando.

## 5. Montagem (nesta ordem)

1. **Corpo:** encaixe a parte de trás na da frente pelo macho-fêmea, com uma
   linha de cola. Na versão dividida, monte primeiro as duas de baixo e depois
   as duas de cima.
2. **Calha:** desça pela abertura de cima até o fundo da parte da frente, com a
   rampa virada para a janela da bandeja.
3. **Prateleira:**
   - parafuse o NEMA 17 por baixo (4 × M3 × 8 escareados);
   - parafuse o suporte do servo (2 × M3 × 10);
   - prenda o SG90 no suporte com os parafusos dele;
   - encaixe o braço do servo na paleta;
   - desça o conjunto pela abertura de cima até assentar no apoio das paredes.
4. **Disco:** encaixe no eixo. Ele apoia na prateleira e gira pelo lado chato do
   eixo, sem parafuso (o atrito do disco na prateleira é mais de 10× menor que a
   força do motor).
5. **RC522:** desce por cima nos trilhos atrás do coração da logo (a pulseira é
   aproximada no coração).
6. **LCD:** 4 × M3 × 6 nos pinos atrás da janela de cima.
7. **Eletrônica:** ESP32, LM2596 e A4988 nos painéis (abraçadeira ou parafuso),
   painéis nos pinos das laterais. Os fios do motor e do servo sobem pelos rasgos
   da prateleira; a fonte entra pelo furo de trás.
8. **Tampa:** 4 × M3 × 12 escareados.

## 6. Ajustes depois de montar

- **Trava:** com o firmware do teste 6 em `SERVO_FECHADO`, monte o braço do
  servo de modo que a paleta cubra a saída. Ao abrir, a paleta tem que girar no
  **sentido anti-horário visto de cima** (para a frente). Se girar para trás,
  troque os valores de `SERVO_FECHADO` e `SERVO_ABERTO` no firmware.
- **Disco:** antes de ligar, gire o disco à mão até a marca do compartimento 1
  ficar na seta gravada na prateleira. Os números estão em sentido horário. Se,
  ao pedir o compartimento 2, chegar o 8, inverta um par de fios do motor
  (1A ↔ 1B).

## 7. Medidas assumidas (confira)

| Medida | Valor usado | Como conferir |
|---|---|---|
| Folgas de encaixe | 0,25 mm por lado (0,3 na tampa) | corpos de prova 1, 2 e 3 |
| Eixo do NEMA 17 | Ø 5 mm, chato a 4,5 mm, 24 mm de comprimento | corpo de prova 4 |
| SG90 | 22,8 × 12,2 × 22,7 mm, furos das abas a 27,8 mm | corpo de prova 5 |
| LCD 16×2 | furos a 75 × 31 mm, moldura de 7 mm | régua no LCD |
| RC522 | placa de 60 × 40 mm | régua na placa |
| Entrada de energia | Ø 12 mm | passa o plugue P4 |

Os compartimentos têm 22 mm de diâmetro e 20 mm de altura. Cabe a dose de um
horário, com alguns comprimidos.

## 8. Gerar de novo

```bash
source .claude/skills/iasis-cad/scripts/setup.sh
$IASIS_CAD_PY hardware/cad/dispenser.py
```

O script mostra a verificação completa e só termina com "Tudo certo" se tudo passar.
