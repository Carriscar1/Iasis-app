"""
Inspeciona STL antes de modelar: relatório, cortes 2D e prévias renderizadas.

    python inspecionar.py peca.stl [outra.stl ...] --saida pasta/
        [--cortes "z=10,z=150,y=100,x=100"] [--original tras|frente|tampa]

--original  carrega um STL original do projeto (cm, invertido) já convertido para
            o referencial de montagem; sem ele, o STL é lido como está.
Os cortes viram PNG com a forma exata da peça naquele plano — é a forma mais
confiável de entender paredes, furos e enchimentos.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import trimesh

import iasis_cad as cad
import render


def desenhar_corte(ax, geo, titulo):
    for g in getattr(geo, "geoms", [geo]):
        if g.is_empty or g.geom_type != "Polygon":
            continue
        ax.fill(*g.exterior.xy, color="#7fa7d9", ec="k", lw=0.6)
        for i in g.interiors:
            ax.fill(*i.xy, color="white", ec="k", lw=0.6)
    ax.set_aspect("equal"); ax.grid(alpha=0.3); ax.set_title(titulo, fontsize=9)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("stls", nargs="*")
    p.add_argument("--saida", default=".")
    p.add_argument("--cortes", default="")
    p.add_argument("--original", action="append", default=[],
                   help="nome de um original (tras, frente, tampa); pode repetir")
    p.add_argument("--pasta-originais", default="hardware/cad/originais")
    a = p.parse_args()

    malhas = {}
    for n in a.original:
        malhas[n] = cad.carregar_original(a.pasta_originais, n)
    for s in a.stls:
        malhas[Path(s).stem] = trimesh.load(s, force="mesh")
    saida = Path(a.saida); saida.mkdir(parents=True, exist_ok=True)

    for n, m in malhas.items():
        print(cad.relatorio(n, m))

    render.renderizar(list(malhas.values()), saida / "previa.png",
                      vistas=("iso", "frente", "iso_tras", "topo"))
    print("prévia:", saida / "previa.png")

    cortes = [c.split("=") for c in a.cortes.split(",") if c]
    if cortes:
        nomes = list(malhas)
        fig, axs = plt.subplots(len(nomes), len(cortes),
                                figsize=(3.8 * len(cortes), 4 * len(nomes)), squeeze=False)
        for i, n in enumerate(nomes):
            for j, (eixo, v) in enumerate(cortes):
                plano = {"z": "(x, y)", "y": "(x, z)", "x": "(y, z)"}[eixo]
                desenhar_corte(axs[i][j], cad.secao(malhas[n], eixo, float(v)),
                               f"{n}: {eixo}={v} {plano}")
        plt.tight_layout(); plt.savefig(saida / "cortes.png", dpi=90); plt.close(fig)
        print("cortes:", saida / "cortes.png")


if __name__ == "__main__":
    main()
