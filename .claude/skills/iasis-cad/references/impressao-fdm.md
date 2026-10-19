# Regras de impressão FDM para as peças do IASIS

Valores típicos de impressora FDM com bico de 0,4 mm em PLA/PETG. São ponto de
partida: a impressora do laboratório pode pedir outros. Quando um encaixe for
crítico, imprima antes um **corpo de prova** (um pedaço de 30 mm da junta) e só
depois a peça inteira.

## Folgas

| Situação | Folga por lado |
|---|---|
| Encaixe deslizante (macho-fêmea, aba de tampa) | 0,2 mm (0,15 numa impressora bem calibrada; 0,3 numa folgada) |
| Encaixe por pressão | 0,05 a 0,1 mm |
| Furo vertical | sai de 0,1 a 0,3 mm menor: compense ou passe broca |
| Furo horizontal | sai ovalado em cima; acima de Ø 8 tudo bem, abaixo use forma de gota |

## Espessuras

- Parede mínima: **1,2 mm** (3 perímetros). Entre um sulco e a face, deixe ≥ 1,2.
- Relevo de texto ou logo: traço ≥ 1 mm de largura e 0,8 a 2 mm de altura.
- Pino ou macho: largura ≥ 1,6 mm (4 perímetros), senão quebra ao montar.

## Orientação

- Balanço (parte sem nada embaixo) até **45°** imprime sem suporte. Furo e janela
  na parede vertical fazem ponte: até ~20 mm sai limpo, acima disso pode ceder.
- Relevo numa face vertical imprime bem de pé. Na face de baixo, precisa de suporte.
- Parte de trás: de costas na mesa (face Y = 200 para baixo), com o macho da junta
  para cima.
- Parte da frente: a bandeja e a logo saem da face da frente, então ela não deita
  de frente. De pé (Z para cima), o topo das janelas vira ponte: a do LCD tem
  70 mm (costuma sair) e a de retirada tem **130 mm** (precisa de suporte).
- Tampa: de cabeça para baixo, com a aba para cima. A aresta arredondada da frente
  fica junto da mesa; se as primeiras camadas cederem, troque o arredondamento
  por um chanfro de 45°.

## Tamanho

Confira o volume útil da impressora antes de tudo. **Cada metade tem 280 mm de
altura**, mais do que muitas impressoras de mesa (220 a 256 mm são comuns). Se
não couber, divida a peça com uma junta macho-fêmea extra (`cad.macho_femea`).

## Material e tempo

A parte de trás tem cerca de 1,8 L de volume, por causa do enchimento maciço.
Com 10 a 15 % de preenchimento ela fica muito mais leve, e o fatiador mostra o
consumo real de filamento. Se ficar pesada demais, vale esvaziar o enchimento
deixando uma casca de 3 a 5 mm.
