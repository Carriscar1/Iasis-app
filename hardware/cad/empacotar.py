"""
Monta o pacote para mandar a uma gráfica 3D: STL, imagens e LEIA-ME com a
lista de peças, configurações e estimativa de filamento.

    python hardware/cad/empacotar.py [destino.zip]

Rode depois de dispenser.py (usa os arquivos de hardware/cad/saida).
"""
from __future__ import annotations

import sys
import zipfile
from pathlib import Path

import trimesh

AQUI = Path(__file__).resolve().parent
SAIDA = AQUI / "saida"
DENSIDADE_PLA = 1.24  # g/cm³

# arquivo: (quantidade, preenchimento, suporte, observação, prioridade)
PECAS = {
    "corpo_parte_da_frente": (1, 0.10, "só na janela de baixo", "ponte de 130 mm na janela da bandeja", 1),
    "corpo_frente_baixo":    (1, 0.10, "só na janela de baixo", "ponte de 130 mm na janela da bandeja", 1),
    "corpo_frente_cima":     (1, 0.10, "não", "", 1),
    "corpo_parte_de_tras":   (1, 0.10, "não", "deitada de costas", 1),
    "corpo_tras_baixo":      (1, 0.10, "não", "", 1),
    "corpo_tras_cima":       (1, 0.10, "não", "", 1),
    "tampa":                 (1, 0.10, "não", "de cabeça para baixo", 1),
    "portinha":              (1, 0.15, "não", "tampinha de abastecer; face de cima na mesa", 1),
    "prateleira":            (1, 0.15, "não", "", 2),
    "disco":                 (1, 0.20, "não", "de cabeça para baixo (cubo para cima)", 2),
    "calha":                 (1, 0.10, "não", "", 2),
    "suporte_servo":         (1, 0.30, "não", "", 2),
    "paleta":                (1, 1.00, "não", "peça fina, 100 % de preenchimento", 2),
    "painel_eletronica_x2":  (2, 0.15, "não", "imprimir 2 cópias (opcional)", 3),
}


def gramas(stl: Path, preenchimento: float) -> float:
    """Estimativa: casca de 0,8 mm (2 perímetros) + preenchimento no miolo."""
    m = trimesh.load(stl, force="mesh")
    volume = m.volume / 1000                       # cm³
    casca = min(volume, m.area * 0.08 / 100)       # área (mm²) × 0,8 mm → cm³
    return (casca + (volume - casca) * preenchimento) * DENSIDADE_PLA


def tabela(pasta: Path):
    linhas, total = [], 0.0
    for stl in sorted(pasta.glob("*.stl")):
        qtd, preench, suporte, obs, prio = PECAS[stl.stem]
        g = gramas(stl, preench) * qtd
        total += g
        e = trimesh.load(stl, force="mesh").extents
        linhas.append((prio, f"  {prio}  {stl.name:28s} {qtd:>3}   {e[0]:5.0f} x {e[1]:4.0f} x {e[2]:4.0f} mm   "
                             f"{preench * 100:>4.0f} %   {suporte:22s} ~{g:5.0f} g   {obs}"))
    return "\n".join(l for _, l in sorted(linhas)), total


def horas(g):
    return f"~{g / 60:.0f} h numa impressora rápida (Bambu/Prusa MK4) ou ~{g / 25:.0f} h numa comum (Ender 3)"


def leia_me():
    t_inteiro, g_inteiro = tabela(SAIDA / "imprimir_inteiro")
    t_dividido, g_dividido = tabela(SAIDA / "imprimir_dividido")
    return f"""IASIS — DISPENSADOR DE MEDICAMENTOS — ARQUIVOS PARA IMPRESSÃO 3D
=================================================================

*** URGENTE: precisamos das peças para uma FEIRA. Priorize VELOCIDADE. ***
*** Acabamento de rascunho está ótimo.                                ***

Todos os STL estão em MILÍMETROS e JÁ DEITADOS NA POSIÇÃO DE IMPRESSÃO
(é só abrir no fatiador, sem girar nem escalar).


CAMINHO DA DOSE (versão 3)
--------------------------
  - Disco com 7 bolsos de Ø 30 mm x 22 mm (cabe bala e bala de goma), mais
    largos embaixo (Ø 31,5) para nada encunhar.
  - A posição com o CORAÇÃO gravado é a de descanso: monte o disco com o
    coração sobre a saída. Assim nada cai antes da hora.
  - Saída da prateleira com Ø 34 mm (maior que o bolso) e calha a 50°.
  - O disco não arrasta na prateleira: o cubo de baixo apoia no motor e o
    disco fica 0,8 mm acima.
  - PORTINHA na tampa (120 x 120 mm): sai puxando pelo furo, para abastecer
    e mexer lá dentro sem tirar os parafusos.
  - A trava com servo saiu: a dose cai sozinha quando o bolso chega na saída.


QUAL PASTA IMPRIMIR
-------------------
  imprimir_dividido/  RECOMENDADO. Corpo em 4 peças que cabem em qualquer
                      impressora de 220 x 220 x 150 mm. Dá para imprimir as
                      peças EM PARALELO em várias impressoras — é o mais rápido.
  imprimir_inteiro/   corpo em 2 peças. Só se tiver impressora com mesa
                      >= 280 x 200 mm e altura >= 280 mm.

As demais peças (tampa, prateleira, disco etc.) são iguais nas duas pastas.
Imprima UMA das pastas, não as duas.


CONFIGURAÇÃO (perfil rápido)
----------------------------
  Material ........ PLA
  Bico ............ 0,4 mm (se tiver 0,6 mm, melhor ainda: use camada 0,3)
  Camada .......... 0,28 mm ("rascunho"/"draft")
  Perímetros ...... 2
  Topo/fundo ...... 3 camadas
  Preenchimento ... conforme a tabela (10 % nas peças grandes; padrão "grade" ou "giroide")
  Velocidade ...... a máxima confiável da impressora
  Suporte ......... só na janela de baixo da peça da frente (ponte de 130 mm),
                    tocando a mesa ou "em todo lugar" só nessa região
  Escala .......... 100 % (não redimensionar: há encaixes)


ORDEM DE PRIORIDADE (coluna "P")
--------------------------------
  1 = corpo e tampa (o dispensador montado)          IMPRIMIR PRIMEIRO
  2 = mecanismo (prateleira, disco, calha)           em seguida
  3 = painéis de eletrônica                          opcional (dá para usar fita dupla face)


PEÇAS — VERSÃO DIVIDIDA (imprimir_dividido/)  ← recomendada
  P  arquivo                      qtd   tamanho                   preench.  suporte                 filamento
{t_dividido}
  TOTAL: ~{g_dividido:.0f} g  →  {horas(g_dividido)}
         (dividindo entre várias impressoras, o tempo cai na mesma proporção)

PEÇAS — VERSÃO INTEIRA (imprimir_inteiro/)
  P  arquivo                      qtd   tamanho                   preench.  suporte                 filamento
{t_inteiro}
  TOTAL: ~{g_inteiro:.0f} g  →  {horas(g_inteiro)}

(Filamento e tempo são estimativas; o fatiador dá o valor exato.)


CORPOS DE PROVA (corpo_de_prova/) — SÓ SE SOBRAR TEMPO
------------------------------------------------------
Pedaços pequenos para testar encaixes. Com pressa, pode pular:
as folgas já foram deixadas maiores para impressão rápida.


IMAGENS (imagens/)
------------------
Vistas da montagem, do interior e da versão dividida, para referência.
"""


def main():
    destino = Path(sys.argv[1]) if len(sys.argv) > 1 else AQUI / "IASIS_impressao_3D.zip"
    with zipfile.ZipFile(destino, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("IASIS_impressao_3D/LEIA-ME.txt", leia_me())
        for pasta in ("imprimir_inteiro", "imprimir_dividido", "corpo_de_prova"):
            for f in sorted((SAIDA / pasta).glob("*.stl")):
                z.write(f, f"IASIS_impressao_3D/{pasta}/{f.name}")
        for f in sorted((SAIDA / "previas").glob("*.png")):
            z.write(f, f"IASIS_impressao_3D/imagens/{f.name}")
    print(destino)


if __name__ == "__main__":
    main()
