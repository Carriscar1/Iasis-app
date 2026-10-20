---
name: iasis-cad
description: Modela, altera e confere em 3D as peças do dispensador IASIS (corpo de duas metades, tampa, bandeja, furos, encaixes, suportes internos para ESP32/LCD/RC522/motor, logo na carcaça) e entrega STL em mm prontos para imprimir, com prévias e verificação de montagem. Use sempre que o assunto for peça 3D, STL, impressão 3D, encaixe, tampa, furo, suporte, arredondar, carcaça ou modelagem do dispensador — inclusive quando o usuário só anexar arquivos .STL do projeto ou pedir "faz a peça X", mesmo sem falar em CAD ou skill.
---

# IASIS CAD

Modelagem por malha (STL) das peças do dispensador, feita com código: as peças
nunca são editadas à mão. Tudo sai de `hardware/cad/dispenser.py`, que lê os
originais, aplica as mudanças com parâmetros e confere o resultado. Assim
qualquer ajuste (folga, raio, posição de furo) é trocar um número e rodar de novo.

## 1. Preparar

```bash
source .claude/skills/iasis-cad/scripts/setup.sh   # cria o venv uma vez; exporta $IASIS_CAD_PY
$IASIS_CAD_PY hardware/cad/dispenser.py            # gera STL + prévias + relatório
```

Bibliotecas: trimesh (malhas), manifold3d (booleanas robustas), shapely
(desenho 2D), matplotlib (prévias). Não há GPU nem janela: as prévias são
renderizadas por software (`scripts/render.py`).

## 2. Referencial e unidades — leia antes de medir qualquer coisa

Os STL originais (em `hardware/cad/originais/`) vieram do CAD da equipe **em
centímetros e de cabeça para baixo** (o teto fica em z = 0..2). Sempre carregue
com `cad.carregar_original(pasta, "tras" | "frente" | "tampa")`, que devolve em
**mm, de pé**, no referencial de montagem:

| Eixo | Significado |
|---|---|
| X | largura, 0 (esquerda) → 200 (direita), olhando a frente |
| Y | profundidade, 0 = face da frente, 200 = face de trás; a bandeja fica em Y < 0 |
| Z | altura, 0 = mesa, 280 = topo do corpo, 300 = topo da tampa |

As saídas ficam em mm, que é o que todo fatiador assume. Se o usuário mandar um
STL novo, descubra a unidade e a orientação antes de tudo (medidas de 20 × 28
"unidades" num dispensador são centímetros). As medidas e os recursos já
mapeados estão em `references/geometria-dispenser.md`. Leia esse arquivo antes
de mexer no corpo, porque ele poupa toda a fase de descoberta.

## 3. Fluxo de trabalho

1. **Inspecionar.** `scripts/inspecionar.py` gera relatório, prévia e cortes 2D.
   Os **cortes** são a fonte da verdade: mostram paredes, enchimentos maciços e
   furos sem a ilusão de profundidade de uma imagem 3D. Para saber a espessura num
   ponto, use `cad.espessura_ao_longo(malha, ponto_na_superficie, direcao)`.
   ```bash
   $IASIS_CAD_PY .claude/skills/iasis-cad/scripts/inspecionar.py --original tras \
       --cortes "z=150,y=100,x=100" --saida /tmp/insp
   ```
   Depois abra os PNG com a ferramenta de leitura de imagem e olhe de verdade.
2. **Planejar em coordenadas.** Escreva onde cada recurso vai (X, Y, Z em mm) e
   confira contra os cortes: janelas, respiros, enchimentos, a junta em Y = 100
   e a boca do corpo. Medida de componente (furo de conector, parafuso, placa)
   só vale com fonte: datasheet, foto com régua ou paquímetro. Sem fonte, use um
   valor seguro, deixe como **parâmetro** e avise o usuário para medir.
3. **Modelar no script.** Acrescente em `construir()` de `dispenser.py`, com os
   números em `PARAMETROS`. Peça nova = função nova + arquivo novo em `saida/`.
   As receitas abaixo cobrem quase tudo.
4. **Verificar.** O script já confere se cada peça está estanque e inteiriça e
   se a montagem tem sobreposição (tem que dar ~0 mm³). Depois **olhe** as
   prévias e os cortes ampliados das folgas (`saida/previas/`). Se um número não
   fechar, ache a causa com `cad.intersectar` e os limites (`.bounds`) do que
   sobrou. Não aumente a tolerância para fazer passar.
5. **Entregar.** STL em `hardware/cad/saida/`, prévias e um resumo: o que mudou,
   onde (em mm), o que foi assumido e o que precisa de medida real.

## 4. Receitas (`scripts/iasis_cad.py`)

| Quero... | Use |
|---|---|
| Arredondar aresta vertical | `arredondar_canto_vertical(m, canto, sentido_para_dentro, raio, z0, z1, parede=esp)`. Em peça **oca**, passe `parede`, senão o corte abre um buraco no canto |
| Arredondar aresta horizontal maciça | `arredondar_aresta(m, "YZ" ou "XZ", canto, sentido, raio, a0, a1)` |
| Furo | `subtrair(m, cilindro(r, p0, p1))`, atravessando 1 mm além das faces |
| Bloco, suporte, pino | `caixa(...)`, `cilindro(...)`, `extrudar(polígono, z0, z1)` + `unir([...])` |
| Desenho em outro plano | `extrudar_no_plano(polígono, "XZ" ou "YZ", a0, a1)` |
| Logo/texto em relevo | `logo_2d(largura)`, `texto_2d(texto, altura)` + `relevo_na_face_frontal(...)` |
| Encaixe macho-fêmea numa junta | `face = secao(A) ∩ secao(B)` no plano da junta → `macho_femea(face, recuo, largura, comprimento, folga)` |
| Aba de tampa, prateleira que desce por cima | `boca(corpo, z0, z1, retângulo)` → `faixa_interna(...)` ou `.buffer(-folga)` → `extrudar` |
| Furo com chanfro ou escareado | `furo_chanfrado(x, y, r, z_baixo, z_topo, chanfro)` (peça de revolução única) |
| Base de ressalto sem balanço | `cone(raio, altura, centro_base)` |
| Peça móvel (conferir o giro) | `girar(m, graus, eixo, ponto)` em passos + `interferencia` |
| Corpo de prova | `recortar(peça, x0, x1, y0, y1, z0, z1)` |
| STL já deitado para imprimir | `para_impressao(m, direção_que_fica_para_baixo)` |
| Conferir | `relatorio`, `interferencia(a, b)`, `secao`, `sombra_xy`, `espessura_ao_longo`, `render.renderizar` |

Detalhes que já custaram tempo:
- **Boca de tampa:** meça com `boca()`, que pega vários níveis. A parede curva da
  parte de trás estreita a abertura perto do topo, e um corte só deixava a aba
  encostando.
- **Seção exatamente numa face** (ex.: Y = 100) dá vazio; `secao` já refaz
  0,02 mm ao lado.
- **Enchimento maciço:** a parte de trás tem ~1,8 L de plástico nos cantos e no
  fundo curvo. Furo ali precisa de rebaixo por dentro; meça a espessura antes.
- **Prévia 3D do matplotlib engana a profundidade.** Use `render.py` (z-buffer).
- **`trimesh.path.polygons.projected` fecha furos** (deu 4× a área real). Para
  sombra vista de cima, use `sombra_xy`.
- **STL guarda float32.** Cilindro e cone que se cruzam com número de lados
  diferente geram triângulos que colapsam ao salvar. `salvar_stl` relê o arquivo
  e acusa. Para furo com chanfro, use `furo_chanfrado`.
- **Todo parafuso precisa de caminho para a chave.** Antes de pôr um parafuso,
  imagine a montagem: por onde ele entra e por onde passa a ferramenta. Um
  parafuso de trava radial no meio do disco não tinha acesso nenhum, e a solução
  foi o disco apoiar na prateleira e girar pelo lado chato do eixo.
- **Ordem de montagem é geometria.** Peça que entra depois de outra precisa
  passar pela abertura que sobra (`boca` no intervalo de altura do caminho).
  Abra rebaixos para ela (o apoio da prateleira tem um vão para a calha descer).

## 5. O dispensador completo (v2)

`dispenser.py` monta carcaça + mecanismo + eletrônica e salva em
`saida/montagem`, `imprimir_inteiro`, `imprimir_dividido` (corpo em 4) e
`corpo_de_prova`. As posições de cada peça estão em
`references/geometria-dispenser.md`. O guia para a equipe (o que imprimir,
peças compradas, montagem, ajustes) é `hardware/cad/README.md`: atualize-o
sempre que uma peça mudar.

## 6. Impressão

Folgas, espessuras mínimas, orientação e o limite de tamanho da impressora
estão em `references/impressao-fdm.md`. O ponto crítico deste projeto é o
**tamanho**: cada metade do corpo tem 280 mm de altura, o que passa do volume de
muitas impressoras. Confirme a impressora antes de prometer que uma peça cabe.

## 7. Combinados do projeto que valem aqui

- Tudo em português do Brasil, inclusive textos em relevo.
- A identidade visual é a mesma do app e do site: o coração com ECG vem de
  `src/components/Logo.tsx` (`cad.logo_2d` usa o mesmo desenho).
- Mensagens de commit descrevem o valor da mudança, sem citar atividade escolar.
- Nunca diga que uma peça "encaixa" ou "imprime bem" sem impressão real: diga o
  que foi verificado (estanque, sobreposição 0, folga X mm no corte).
