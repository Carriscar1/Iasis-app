"""
Chaveiro do IASIS: o coração da logo com o ECG em relevo e uma tag NFC escondida dentro.

    python hardware/cad/chaveiro.py

Saídas em hardware/cad/saida/chaveiro/:
  chaveiro_com_pausa.stl   peça única; a impressora pausa, a tag entra no bolso e a impressão fecha por cima
  chaveiro_base.stl + chaveiro_tampa.stl   versão sem pausa: duas metades para colar com a tag no meio
  chaveiro.png             prévia

A medida da tag é suposta (adesivo ou moeda NFC de Ø 25 mm, até 1,2 mm de espessura):
meça a de vocês e ajuste TAG_DIAMETRO e TAG_ESPESSURA.
"""
from __future__ import annotations

import sys
from pathlib import Path

from shapely import affinity
from shapely.geometry import Point
from shapely.ops import polylabel

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI.parents[1] / ".claude/skills/iasis-cad/scripts"))
import iasis_cad as cad   # noqa: E402
import render             # noqa: E402

LARGURA = 50.0            # coração de 50 × 45 mm
TAG_DIAMETRO = 25.0
TAG_ESPESSURA = 1.2
FOLGA_TAG = 0.5           # no diâmetro
CAMADA = 0.2              # altura de camada usada para calcular a pausa
FUNDO = 1.2               # plástico embaixo da tag (6 camadas)
TETO = 1.4                # plástico em cima da tag (7 camadas): a leitura passa por aqui
RELEVO_ECG = 0.8
ARGOLA_RAIO, ARGOLA_FURO = 6.0, 2.2


def arredonda_camada(v):
    return round(round(v / CAMADA) * CAMADA, 2)


def construir():
    coracao, ecg = cad.logo_2d(LARGURA)
    centro = polylabel(coracao, 0.05)
    r_bolso = (TAG_DIAMETRO + FOLGA_TAG) / 2
    parede = coracao.exterior.distance(centro) - r_bolso
    z_bolso0 = FUNDO
    z_bolso1 = arredonda_camada(FUNDO + TAG_ESPESSURA + 0.2)
    z_topo = arredonda_camada(z_bolso1 + TETO)

    # argola no vão de cima do coração
    topo = coracao.bounds[3]
    argola_c = (0.0, topo - 1.0)
    contorno = coracao.union(Point(argola_c).buffer(ARGOLA_RAIO, resolution=32))
    contorno = contorno.buffer(2.5, resolution=32).buffer(-2.5, resolution=32)   # fecha a fresta entre argola e lobos
    corpo = cad.extrudar(contorno, 0, z_topo)
    corpo = cad.subtrair(corpo, [
        cad.cilindro(ARGOLA_FURO, (*argola_c, -1), (*argola_c, z_topo + 1)),
        cad.cilindro(r_bolso, (centro.x, centro.y, z_bolso0), (centro.x, centro.y, z_bolso1), secoes=96),
    ])
    # "IASIS" gravado nas costas (espelhado: lê certo olhando por trás)
    nome = affinity.scale(cad.texto_2d("IASIS", 6.0), xfact=-1, origin=(0, 0))
    nome = affinity.translate(nome, centro.x, centro.y)
    corpo = cad.subtrair(corpo, cad.extrudar(nome, -1, 0.4))
    relevo = cad.extrudar(ecg, z_topo - 0.01, z_topo + RELEVO_ECG)
    inteiro = cad.unir([corpo, relevo])

    # a base corta bem no teto do bolso: o furo é refeito passando 1 mm para cima para o bolso ficar aberto
    base = cad.subtrair(cad.recortar(inteiro, -40, 40, -40, 40, -1, z_bolso1),
                        cad.cilindro(r_bolso, (centro.x, centro.y, z_bolso0), (centro.x, centro.y, z_bolso1 + 1),
                                     secoes=96))
    tampa = cad.recortar(inteiro, -40, 40, -40, 40, z_bolso1, z_topo + 5)
    info = dict(parede=parede, z_bolso1=z_bolso1, z_topo=z_topo,
                pausa=arredonda_camada(z_bolso1 + CAMADA), troca_cor=arredonda_camada(z_topo + CAMADA),
                tamanho=inteiro.extents)
    return inteiro, base, tampa, info


def main():
    inteiro, base, tampa, info = construir()
    pasta = AQUI / "saida" / "chaveiro"
    pasta.mkdir(parents=True, exist_ok=True)
    for nome, m in (("chaveiro_com_pausa", inteiro), ("chaveiro_base", base), ("chaveiro_tampa", tampa)):
        print(cad.relatorio(nome, m))
        # a peça com pausa tem 2 cascas: a de fora e a do bolso fechado (a tag fica nele)
        cascas = m.split(only_watertight=False)
        cheias = [c for c in cascas if c.volume > 0]
        assert m.is_watertight and len(cheias) == 1, nome
    cad.salvar_stl(cad.para_impressao(inteiro, (0, 0, -1)), pasta / "chaveiro_com_pausa.stl")
    cad.salvar_stl(cad.para_impressao(base, (0, 0, -1)), pasta / "chaveiro_base.stl")
    # a tampa vai com a face lisa (a de dentro) na mesa
    cad.salvar_stl(cad.para_impressao(tampa, (0, 0, -1)), pasta / "chaveiro_tampa.stl")
    vista = inteiro.copy()
    render.renderizar([vista], pasta / "chaveiro.png", vistas=("iso", "topo"),
                      titulos=["chaveiro", "de cima"], cores=["#5b93cf"])
    e = info["tamanho"]
    print(f"tamanho {e[0]:.0f} x {e[1]:.0f} x {e[2]:.1f} mm · parede em volta da tag {info['parede']:.1f} mm")
    print(f"pausa na camada {info['pausa']:.2f} mm · troca de cor do ECG na camada {info['troca_cor']:.2f} mm")


if __name__ == "__main__":
    main()
