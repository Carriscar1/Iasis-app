# Dispensador IASIS — arquivos para imprimir

Tudo sai de `dispenser.py` a partir dos modelos originais (`originais/`). Os STL
de `saida/` já estão **em milímetros e deitados na posição de impressão**: é só
abrir no fatiador.

> **O que foi conferido:** cada peça é um sólido fechado; nenhuma peça encosta
> em outra nem nos componentes (motor, LCD, RC522); prateleira, disco e calha
> passam pela abertura de cima; a queda inteira da saída cai dentro da calha.
> **Nada disso foi impresso ainda:** por isso existem os corpos de prova.

## Versão 3: caminho da dose

| O quê | Como ficou |
|---|---|
| Disco | Ø 140 × 22 mm, **7 bolsos de Ø 30** (Ø 31,5 embaixo, para nada encunhar) no raio 48. Cabe bala e bala de goma |
| Posição de descanso | a 8ª posição não tem bolso, tem um **coração gravado**. Monte o disco com o coração sobre a saída: parado em casa, nada cai |
| Sem atrito | o disco não arrasta na prateleira: um cubo por baixo apoia no ressalto do motor e o disco fica 0,8 mm acima. Furo do eixo com 0,25 mm de folga |
| Saída | Ø 34 com chanfro de 2 mm (maior que o bolso). Entre a saída e o bolso vizinho sobram 4 mm de prateleira |
| Calha | rampa de chapa a 50°, 43 mm de largura por dentro e paredes até Z 112 |
| Portinha | abertura de 120 × 120 mm na tampa com uma tampinha cônica (45°, folga de 0,4 mm). Sai puxando pelo furo de Ø 24 |
| Trava | **desligada** (`trava=False`): o firmware atual não move o servo e a paleta fechada seguraria a dose |


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
| `4_disco_centro_no_eixo` | furo em D e cubo no eixo do motor | entra no eixo deslizando, sem jogo para girar | apertado: `furo_eixo_folga` 0,35 · com jogo: 0,15 |
| `5_tampa_portinha_canto` + `5_portinha_canto` | encaixe da portinha | assenta sem prender e sai com o dedo | presa: `portinha_folga` 0,6 |

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
| `portinha` | 1 | 15 % | não | face de cima na mesa |
| `prateleira` | 1 | 25 % | não | de cabeça para baixo |
| `disco` | 1 | 20 % | não | de cabeça para baixo (cubo para cima) |
| `calha` | 1 | 15 % | não | |
| `painel_eletronica_x2` | **2** | 25 % | não | |

## 4. Peças compradas

| Item | Qtd | Onde |
|---|---|---|
| Parafuso M3 × 12 cabeça chata (escareado) | 4 | tampa |
| Parafuso M3 × 8 cabeça chata (escareado) | 4 | motor na prateleira |
| Parafuso M3 × 6 | 4 | LCD |
| Parafuso M3 × 8 | 8 | painéis |
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
   - desça o conjunto pela abertura de cima até assentar no apoio das paredes.
4. **Disco:** encaixe no eixo com o **coração sobre a saída**. O cubo de baixo
   apoia no ressalto do motor e o disco gira pelo lado chato do eixo, sem
   parafuso e sem arrastar na prateleira.
5. **RC522:** desce por cima nos trilhos atrás do coração da logo (a pulseira é
   aproximada no coração).
6. **LCD:** 4 × M3 × 6 nos pinos atrás da janela de cima.
7. **Eletrônica:** ESP32, LM2596 e A4988 nos painéis (abraçadeira ou parafuso),
   painéis nos pinos das laterais. Os fios do motor e do servo sobem pelos rasgos
   da prateleira; a fonte entra pelo furo de trás.
8. **Tampa:** 4 × M3 × 12 escareados. Para abastecer, tire só a **portinha**
   (puxe pelo furo) e coloque as doses nos bolsos de 1 a 7.

## 6. Ajustes depois de montar

- **Disco:** antes de ligar, gire o disco à mão até o coração (e a marca na
  borda) ficar na seta gravada na prateleira. Os números estão em sentido
  horário. Se, ao pedir uma dose, chegar o 7 em vez do 1, inverta um par de fios
  do motor (1A ↔ 1B).
- **Volta inteira (`MODO_DEMO 1`):** os 7 bolsos passam pela saída em uma volta.
  Para cada dose cair parada, sem raspar, gire 25 passos por vez com uma pausa
  de ~0,5 s entre eles.

## 7. Medidas assumidas (confira)

| Medida | Valor usado | Como conferir |
|---|---|---|
| Folgas de encaixe | 0,25 mm por lado (0,3 na tampa) | corpos de prova 1, 2 e 3 |
| Eixo do NEMA 17 | Ø 5 mm, chato a 4,5 mm, 24 mm de comprimento | corpo de prova 4 |
| Ressalto do NEMA 17 | Ø 22, 2 mm de altura (o cubo do disco apoia nele) | régua no motor |
| LCD 16×2 | furos a 75 × 31 mm, moldura de 7 mm | régua no LCD |
| RC522 | placa de 60 × 40 mm | régua na placa |
| Entrada de energia | Ø 12 mm | passa o plugue P4 |

Os bolsos têm 30 mm de diâmetro (31,5 embaixo) e 22 mm de altura: cabe a dose
de um horário, bala ou bala de goma.

## 8. Gerar de novo

```bash
source .claude/skills/iasis-cad/scripts/setup.sh
$IASIS_CAD_PY hardware/cad/dispenser.py
```

O script mostra a verificação completa e só termina com "Tudo certo" se tudo passar.
