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

## Em aberto (perguntar à equipe antes de assumir)

- **Volume da impressora.** As metades têm 280 mm de altura e 200 × 150 de base.
  Se não couber, dá para dividir na altura com outra junta macho-fêmea.
- **Leiaute interno:** onde ficam o disco de compartimentos, o NEMA 17, o servo da
  trava, o ESP32, o LM2596 e o RC522. Ainda não há suportes internos. O RC522 lê
  através de alguns mm de plástico; atrás do coração da logo é um alvo natural
  para "aproxime a pulseira".
- **Conector de energia:** o Ø 12 deixa passar o plugue P4 até o borne interno.
  Com um conector P4 de painel, troque pelo furo que o fabricante indica.
- **Fixação da tampa:** hoje é só por encaixe. Se precisar travar, o caminho é
  colocar parafusos ou travas de pressão.
