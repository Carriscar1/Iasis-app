# Geometria do dispensador (medida dos STL originais)

Medidas em mm, no referencial de montagem (X largura, Y profundidade com a
frente em 0, Z altura com a mesa em 0). Tiradas com `secao` e
`espessura_ao_longo` sobre os originais de `hardware/cad/originais/`.

## Peças originais

| Arquivo original | Nome no código | Ocupa | Volume |
|---|---|---|---|
| `peca1_parte_de_tras.stl` | `tras` | X 0–200 · Y 100–200 · Z 0–280 | 1 792 cm³ |
| `peca2_parte_da_frente.stl` | `frente` | X 0–200 · Y −50–100 · Z 0–280 | 877 cm³ |
| `peca_do_teto.stl` | `tampa` | X 0–200 · Y 0–200 · Z 280–300 | 800 cm³ |

Nos arquivos originais as unidades são **cm** e o eixo z aponta **para baixo**
(o teto fica em z 0–2, o corpo em z 2–30). A conversão é a rotação de 180° em
X, `(x, y, z)cm → (10x, 10(20 − y), 10(30 − z))mm`, com a parte da frente
deslocada 10 cm em y antes. É uma rotação de verdade e não espelha a peça: os
respiros continuam do lado direito de quem olha a frente.

## Corpo (as duas metades juntas)

- Caixa de 200 × 200 × 280, **aberta em cima** (a tampa fecha) e com fundo.
- **Junta** entre as metades no plano **Y = 100**. A face da junta tem perfil em
  U: paredes laterais de 5 mm e fundo curvo (bojo), com os respiros da direita
  cortados ao meio nesse plano.
- Paredes: laterais e frente com **5 mm**; fundo da frente com **5,5 mm**.
- **Bojo da frente:** o fundo da parte da frente faz uma curva que engrossa as
  laterais embaixo (38 mm em Z = 20, 19 mm em Z = 40, 9 mm em Z = 60, 5 mm a
  partir de Z ≈ 80). Ela funciona como funil para a janela de retirada.
- **Enchimento da parte de trás** (maciço): os cantos de trás são arredondados
  por dentro em planta (raio ≈ 95 mm), e o fundo sobe em curva até a parede de
  trás (85 mm de altura em Y = 195, 38 mm em Y = 180, 19 mm em Y = 160, 5 mm em
  Y = 120). No topo ainda há uma faixa maciça de Y ≈ 165 a 200. **Parede de trás
  com só 5 mm:** X ≈ 80–125 e Z ≈ 90–210. Fora disso, 8 a 100 mm.

## Recursos

| Recurso | Onde | Observação |
|---|---|---|
| Janela do LCD | face da frente, X 65–135, Z 245–270 | 70 × 25, o tamanho da moldura de um LCD 16×2 |
| Janela de retirada da dose | face da frente, X 35–165, Z 5–65 | dá para a bandeja |
| Bandeja | X 35–165, Y −50–0; placa Z 0–5,5 | borda de 15,5 mm de altura: 3 mm na frente, 4 mm nos lados |
| Respiros | lateral direita (X 195–200) | 3 × 13 furos de Ø ≈ 9 mm, passo 12 mm, Y 32–176, Z 233/245/257 |
| Boca do corpo | topo, Z = 280 | formato da abertura em `cad.boca(...)`; fica mais estreita perto do topo por causa da faixa maciça de trás |

## Mudanças da versão 1 (`hardware/cad/dispenser.py`)

| Mudança | Como foi feita | Parâmetros |
|---|---|---|
| Frente arredondada | arestas verticais da frente do corpo com R30 (casca refeita com 5 mm), tampa com os mesmos cantos e a aresta de cima da frente com R8, cantos da bandeja com R12 | `raio_frente`, `raio_tampa_frente`, `raio_bandeja` |
| Logo | coração de 60 mm em relevo de 2 mm com o ECG em sulco de 1,2 mm, centro em X 100 / Z 170; "IASIS" de 20 mm em relevo de 1,2 mm em Z 112 | `logo_*`, `texto*` |
| Entrada de energia | furo Ø 12 na parede de trás em X 100 / Z 150 (parede de 5 mm ali) | `entrada_*` |
| Encaixe entre metades | macho de 1,6 × 5 mm na parte de trás, seguindo a face da junta a 1,7 mm da borda; fêmea de 2,0 × 5,5 mm na parte da frente (folga de 0,2 por lado) | `macho_*`, `folga` |
| Encaixe da tampa | aba de 2,5 × 6 mm por baixo da tampa, acompanhando a boca do corpo com folga de 0,25 | `aba_*` |

## Mecanismo e eletrônica (versão 2)

| Peça | Posição (mm) | Notas |
|---|---|---|
| Apoio da prateleira | anel nas paredes internas, Z 107–119, 12 mm, degraus a 45° | vão em X 72–128 na frente para a calha descer |
| Prateleira | Z 119–124, contorno = boca(119,5→280) − 0,5 | entra por cima; motor e suporte do servo presos por baixo |
| Disco | centro (100, 95), Ø 126, Z 124–144, apoiado na prateleira | 8 bolsos Ø 22 no raio 45; nº 1 na frente (saída), numeração horária; furo em D |
| NEMA 17 | sob a prateleira, centro (100, 95), Z 71–119 | 4 × M3 escareados a 31 mm; eixo até Z 143 |
| Saída | (100, 50), Ø 22 com chanfro; lábio de 2 mm | rebaixo por baixo onde a paleta gira |
| Paleta (trava) | eixo do servo em (124,7, 50); Z 119–121,5 | fechada: braço para −X; abre +90° (anti-horário visto de cima) |
| Servo SG90 | corpo X 118,8–141,6, Y 43,9–56,1, Z 91,8–114,5 | suporte com paredes só em +X e +Y, longe do giro do braço |
| Calha | X 82–118, Y 6–72,5, Z 5,5–88 | rampa de 39° até a janela; fica sob a saída |
| LCD | 4 pinos Ø 6 em (100 ± 37,5, Z 257,5 ± 15,5), saindo 7 mm da parede da frente | aba da tampa aberta em X 55–145 por causa da placa |
| RC522 | trilhos com canal em X 100 ± 30, Z 148–195, placa a 4 mm da parede | atrás do coração da logo |
| Painéis de eletrônica | esquerdo X 13–16, Y 38–92, Z 165–245; direito X 184–187, Z 140–220 | grade de furos Ø 3,4 a cada 8 mm |
| Parafusos da tampa | (15, 15), (185, 15) em ressaltos; (60, 188), (140, 188) no maciço de trás | M3 × 16; rebaixo de 12 mm na tampa |
| Versão dividida | corte em Z = 135, macho embaixo | nada atravessa esse plano além das paredes |

## Em aberto (perguntar à equipe antes de assumir)

- **Volume da impressora.** As metades têm 280 mm de altura e 200 × 150 de base.
  Se não couber, dá para dividir na altura com outra junta macho-fêmea.
- **Medidas de componentes** (SG90, eixo do NEMA, LCD, RC522) são valores típicos;
  os corpos de prova 4 e 5 conferem os críticos.
- **Conector de energia:** o Ø 12 deixa passar o plugue P4 até o borne interno.
  Com um conector P4 de painel, troque pelo furo que o fabricante indica.
