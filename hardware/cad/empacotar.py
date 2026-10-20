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

# arquivo: (quantidade, preenchimento, suporte, observação)
PECAS = {
    "corpo_parte_da_frente": (1, 0.15, "só na janela de baixo", "ponte de 130 mm na janela da bandeja"),
    "corpo_frente_baixo":    (1, 0.15, "só na janela de baixo", "ponte de 130 mm na janela da bandeja"),
    "corpo_frente_cima":     (1, 0.15, "não", ""),
    "corpo_parte_de_tras":   (1, 0.15, "não", "deitada de costas"),
    "corpo_tras_baixo":      (1, 0.15, "não", ""),
    "corpo_tras_cima":       (1, 0.15, "não", ""),
    "tampa":                 (1, 0.15, "não", "de cabeça para baixo"),
    "prateleira":            (1, 0.25, "não", ""),
    "disco":                 (1, 0.25, "não", "números para cima"),
    "calha":                 (1, 0.15, "não", ""),
    "suporte_servo":         (1, 0.50, "não", ""),
    "paleta":                (1, 1.00, "não", "peça fina, 100 % de preenchimento"),
    "painel_eletronica_x2":  (2, 0.25, "não", "imprimir 2 cópias"),
}


def gramas(stl: Path, preenchimento: float) -> float:
    """Estimativa: casca de 1,2 mm (3 perímetros) + preenchimento no miolo."""
    m = trimesh.load(stl, force="mesh")
    volume = m.volume / 1000                       # cm³
    casca = min(volume, m.area * 0.12 / 100)       # área (mm²) × 1,2 mm → cm³
    return (casca + (volume - casca) * preenchimento) * DENSIDADE_PLA


def tabela(pasta: Path):
    linhas, total = [], 0.0
    for stl in sorted(pasta.glob("*.stl")):
        qtd, preench, suporte, obs = PECAS[stl.stem]
        g = gramas(stl, preench) * qtd
        total += g
        e = trimesh.load(stl, force="mesh").extents
        linhas.append(f"  {stl.name:28s} {qtd:>3}   {e[0]:5.0f} x {e[1]:4.0f} x {e[2]:4.0f} mm   "
                      f"{preench * 100:>4.0f} %   {suporte:22s} ~{g:5.0f} g   {obs}")
    return "\n".join(linhas), total


def leia_me():
    t_inteiro, g_inteiro = tabela(SAIDA / "imprimir_inteiro")
    t_dividido, g_dividido = tabela(SAIDA / "imprimir_dividido")
    return f"""IASIS — DISPENSADOR DE MEDICAMENTOS — ARQUIVOS PARA IMPRESSÃO 3D
=================================================================

Projeto: IASIS (TCC — ecossistema de adesão a medicamentos)

Todos os STL estão em MILÍMETROS e JÁ DEITADOS NA POSIÇÃO DE IMPRESSÃO
(é só abrir no fatiador, sem girar nem escalar).


QUAL PASTA IMPRIMIR
-------------------
O corpo do dispensador tem 28 cm de altura. Use a pasta que couber na sua impressora:

  imprimir_inteiro/   corpo em 2 peças. Precisa de mesa >= 280 x 200 mm
                      e altura >= 280 mm.
  imprimir_dividido/  corpo em 4 peças. Cabe em impressora de 220 x 220 x 150 mm
                      (ex.: Ender 3, Bambu A1/P1, Prusa MK4).

As demais peças (tampa, prateleira, disco etc.) são iguais nas duas pastas.
Imprima UMA das pastas inteira, não as duas.


CONFIGURAÇÃO
------------
  Material ........ PLA (ou PETG)
  Camada .......... 0,2 mm
  Perímetros ...... 3 (paredes de 1,2 mm)
  Topo/fundo ...... 4 camadas
  Preenchimento ... conforme a tabela abaixo
  Suporte ......... só onde indicado (corpo da frente: a janela de baixo tem
                    uma ponte de 130 mm; a janela de cima, de 70 mm, sai sem)
  Escala .......... 100 % (não redimensionar: há encaixes com folga de 0,2 mm)


PEÇAS — VERSÃO INTEIRA (imprimir_inteiro/)
  arquivo                      qtd   tamanho                   preench.  suporte                 filamento
{t_inteiro}
  TOTAL APROXIMADO: {g_inteiro:.0f} g de filamento

PEÇAS — VERSÃO DIVIDIDA (imprimir_dividido/)
  arquivo                      qtd   tamanho                   preench.  suporte                 filamento
{t_dividido}
  TOTAL APROXIMADO: {g_dividido:.0f} g de filamento

(A estimativa de filamento é aproximada; o fatiador dá o valor exato.)


CORPOS DE PROVA (corpo_de_prova/) — RECOMENDADO IMPRIMIR PRIMEIRO
-----------------------------------------------------------------
Pedaços pequenos (~50 g no total, poucas horas) que testam os encaixes
na mesma impressora que vai fazer as peças grandes. Se possível, imprima
estes primeiro e entregue para a equipe conferir antes das peças grandes:

  1_junta_parte_de_tras + 1_junta_parte_da_frente  encaixe entre as metades do corpo
  2_corpo_canto_topo + 2_tampa_canto               encaixe da tampa
  3_divisao_baixo + 3_divisao_cima                 junta da versão dividida
  4_disco_centro_no_eixo                           furo do disco no eixo do motor
  5_suporte_servo                                  encaixe do servo SG90


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
