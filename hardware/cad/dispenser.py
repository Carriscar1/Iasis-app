"""
IASIS — gera as peças do dispensador a partir dos STL originais.

    python hardware/cad/dispenser.py

Lê  hardware/cad/originais/*.stl  (cm, de cabeça para baixo)
Gera hardware/cad/saida/*.stl      (mm, de pé, prontos para o fatiador)
     hardware/cad/saida/previas/*.png

Referencial (mm): X = largura (0 esquerda → 200 direita, olhando a frente),
Y = profundidade (0 = face da frente, 200 = face de trás), Z = altura (0 = mesa).
Mude os PARAMETROS abaixo e rode de novo; nada é editado à mão nos STL.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from shapely.geometry import box

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI.parents[1] / ".claude/skills/iasis-cad/scripts"))
import iasis_cad as cad   # noqa: E402
import render             # noqa: E402

PARAMETROS = dict(
    # Arredondamento da frente
    raio_frente=30.0,         # arestas verticais da frente do corpo e da tampa
    raio_tampa_frente=8.0,    # aresta de cima da frente da tampa
    raio_bandeja=12.0,        # cantos da bandeja
    parede=5.0,               # espessura da casca do corpo (medida nos originais)
    parede_bandeja=3.5,       # espessura da borda da bandeja (3 a 4 mm nos originais)

    # Entrada de energia na parede de trás
    entrada_diametro=12.0,    # passa o plugue P4 ou um conector P4 de painel; MEÇA o seu
    entrada_x=100.0,          # centro da parede de trás (ali ela tem 5 mm)
    entrada_z=150.0,

    # Logo na frente (mesmo desenho do app)
    logo_largura=60.0,
    logo_centro_z=170.0,
    logo_relevo=2.0,          # quanto o coração sai da face
    ecg_profundidade=1.2,     # sulco do batimento dentro do coração
    texto="IASIS",
    texto_altura=20.0,
    texto_centro_z=112.0,
    texto_relevo=1.2,

    # Encaixe macho-fêmea entre as duas metades (junta em Y = 100)
    junta_y=100.0,
    macho_recuo=1.7,          # distância da borda da parede até o macho
    macho_largura=1.6,
    macho_comprimento=5.0,
    folga=0.2,                # por lado. 0,2 mm costuma servir em FDM; ajuste à impressora

    # Aba da tampa que entra no corpo
    aba_altura=6.0,           # o LCD termina em Z = 270; a aba vai até 274
    aba_espessura=2.5,
    aba_folga=0.25,
)


def construir(P=PARAMETROS):
    orig = AQUI / "originais"
    tras = cad.carregar_original(orig, "tras")
    frente = cad.carregar_original(orig, "frente")
    tampa = cad.carregar_original(orig, "tampa")
    topo = 280.0

    # ── 1. Frente arredondada ───────────────────────────────────────────────
    R, w = P["raio_frente"], P["parede"]
    for canto, sentido in [((0, 0), (1, 1)), ((200, 0), (-1, 1))]:
        frente = cad.arredondar_canto_vertical(frente, canto, sentido, R, 0, topo, parede=w)
        tampa = cad.arredondar_canto_vertical(tampa, canto, sentido, R, topo, topo + 20)
    tampa = cad.arredondar_aresta(tampa, "YZ", (0, topo + 20), (1, -1),
                                  P["raio_tampa_frente"], 0, 200)
    rb = P["raio_bandeja"]
    for canto, sentido in [((35, -50), (1, 1)), ((165.1, -50), (-1, 1))]:
        frente = cad.arredondar_canto_vertical(frente, canto, sentido, rb, 0, 15.5,
                                               parede=P["parede_bandeja"])

    # ── 2. Logo e nome na face da frente ────────────────────────────────────
    coracao, ecg = cad.logo_2d(P["logo_largura"])
    relevo = cad.relevo_na_face_frontal(coracao, 0.0, P["logo_relevo"], (100, P["logo_centro_z"]))
    sulco = cad.relevo_na_face_frontal(ecg, -(P["logo_relevo"] - P["ecg_profundidade"]),
                                       P["ecg_profundidade"] + 0.5, (100, P["logo_centro_z"]))
    relevo = cad.subtrair(relevo, sulco)
    nome = cad.relevo_na_face_frontal(cad.texto_2d(P["texto"], P["texto_altura"]), 0.0,
                                      P["texto_relevo"], (100, P["texto_centro_z"]))
    frente = cad.unir([frente, relevo, nome])

    # ── 3. Entrada de energia atrás ─────────────────────────────────────────
    ex, ez, d = P["entrada_x"], P["entrada_z"], P["entrada_diametro"]
    esp = cad.espessura_ao_longo(tras, (ex, 200, ez), (0, -1, 0))
    furo = cad.cilindro(d / 2, (ex, 201, ez), (ex, 200 - esp - 1, ez))
    tras = cad.subtrair(tras, furo)

    # ── 4. Encaixe entre as metades (macho na de trás, fêmea na da frente) ──
    jy = P["junta_y"]
    face = cad.secao(tras, "y", jy + 0.05).intersection(cad.secao(frente, "y", jy - 0.05))
    macho2d, femea2d = cad.macho_femea(face, P["macho_recuo"], P["macho_largura"],
                                       P["macho_comprimento"], P["folga"])
    L = P["macho_comprimento"]
    macho = cad.extrudar_no_plano(macho2d, "XZ", jy - L, jy + 0.5)
    femea = cad.extrudar_no_plano(femea2d, "XZ", jy - L - 0.5, jy + 0.01)
    tras = cad.unir([tras, macho])
    frente = cad.subtrair(frente, femea)

    # ── 5. Aba da tampa que entra na boca do corpo ──────────────────────────
    corpo = cad.unir([tras, frente])
    abertura = cad.boca(corpo, topo - P["aba_altura"] - 0.5, topo - 0.01, box(-1, -60, 201, 201))
    aba2d = cad.faixa_interna(abertura, P["aba_folga"], P["aba_espessura"])
    aba = cad.extrudar(aba2d, topo - P["aba_altura"], topo + 0.5)
    tampa = cad.unir([tampa, aba])

    return dict(tras=tras, frente=frente, tampa=tampa,
                _macho=macho, _face=face, _entrada_espessura=esp)


def verificar(p):
    ok = True
    print("── Peças")
    for n in ("tras", "frente", "tampa"):
        print("  " + cad.relatorio(n, p[n]))
        ok &= p[n].is_watertight and p[n].body_count == 1
    print("── Montagem (sobreposição deve ser ~0 mm³)")
    for a, b in [("tras", "frente"), ("tras", "tampa"), ("frente", "tampa")]:
        v = cad.interferencia(p[a], p[b])
        print(f"  {a} × {b}: {v:.2f} mm³")
        ok &= v < 1.0
    print(f"── Parede de trás na entrada de energia: {p['_entrada_espessura']:.1f} mm")
    print("── Tudo certo" if ok else "── ATENÇÃO: verificação falhou")
    return ok


def previas(p, pasta):
    pasta.mkdir(parents=True, exist_ok=True)
    pecas = [p["tras"], p["frente"], p["tampa"]]
    render.renderizar(pecas, pasta / "montagem.png", vistas=("iso", "frente", "iso_tras", "direita"),
                      titulos=["isométrica", "frente", "traseira", "lateral direita"])
    explodida = [p["tras"].copy(), p["frente"].copy(), p["tampa"].copy()]
    explodida[1].apply_translation([0, -70, 0])
    explodida[2].apply_translation([0, 0, 70])
    render.renderizar(explodida, pasta / "explodida.png", vistas=("iso", "iso_tras"),
                      titulos=["vista explodida", "vista explodida (trás)"])
    render.renderizar([p["tras"]], pasta / "tras_junta.png", vistas=("iso", "frente"),
                      titulos=["parte de trás: macho na junta", "vista da junta"])
    render.renderizar([p["frente"]], pasta / "frente_junta.png", vistas=((150, 20), (180, 0)),
                      titulos=["parte da frente: fêmea na junta", "vista da junta"])
    render.renderizar([p["tampa"]], pasta / "tampa_aba.png", vistas=((-35, -35), (-35, 30)),
                      titulos=["tampa por baixo: aba", "tampa por cima"])
    _cortes(p, pasta / "cortes_encaixes.png")


def _cortes(p, saida):
    """Cortes 2D ampliados que mostram as folgas dos encaixes."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from shapely.geometry import box as caixa2d

    def desenha(ax, geo, cor):
        for g in getattr(geo, "geoms", [geo]):
            if g.is_empty or g.geom_type != "Polygon":
                continue
            ax.fill(*g.exterior.xy, color=cor, alpha=0.6, lw=0.5, ec="k")
            for i in g.interiors:
                ax.fill(*i.xy, color="white", lw=0.5, ec="k")

    fig, axs = plt.subplots(1, 3, figsize=(15, 5))
    # junta das metades, vista de cima (corte em Z = 150), canto esquerdo
    for n, c in [("tras", "#7fa7d9"), ("frente", "#e0a96d")]:
        desenha(axs[0], cad.secao(p[n], "z", 150).intersection(caixa2d(-1, 85, 15, 115)), c)
    axs[0].set_title("Junta das metades (corte Z=150, parede esquerda)")
    # aba da tampa, corte vertical em X = 100 perto da frente
    for n, c in [("frente", "#e0a96d"), ("tampa", "#9fd39a")]:
        desenha(axs[1], cad.secao(p[n], "x", 100).intersection(caixa2d(-12, 262, 18, 302)), c)
    axs[1].set_title("Tampa sobre a frente (corte X=100)")
    # aba da tampa no canto arredondado, vista de cima
    for n, c in [("frente", "#e0a96d"), ("tampa", "#9fd39a")]:
        desenha(axs[2], cad.secao(p[n], "z", 277).intersection(caixa2d(-2, -2, 45, 45)), c)
    axs[2].set_title("Canto arredondado + aba (corte Z=277)")
    for ax in axs:
        ax.set_aspect("equal"); ax.grid(alpha=0.3); ax.set_xlabel("mm"); ax.set_ylabel("mm")
    plt.tight_layout(); plt.savefig(saida, dpi=100); plt.close(fig)


if __name__ == "__main__":
    pecas = construir()
    ok = verificar(pecas)
    saida = AQUI / "saida"
    for n, arquivo in [("tras", "corpo_parte_de_tras.stl"), ("frente", "corpo_parte_da_frente.stl"),
                       ("tampa", "tampa.stl")]:
        cad.salvar_stl(pecas[n], saida / arquivo)
    previas(pecas, saida / "previas")
    print(f"STL e prévias em {saida}")
    sys.exit(0 if ok else 1)
