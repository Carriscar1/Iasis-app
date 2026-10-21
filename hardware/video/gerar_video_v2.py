"""
IASIS — vídeo do stand, versão 2 (tons de bege e marrom, mascote narrador).

    python hardware/video/gerar_video_v2.py

Precisa, além do ambiente do iasis-cad: numba, Pillow e scikit-image
(o mascote 3D em mascote3d.py usa marching cubes).

Saídas em hardware/video/saida_v2/:
  IASIS_video_stand_v2.mp4   vídeo completo (1920×1080, 30 fps)
  legendas.srt               legenda da narração (para o Motion ou outro editor)
  roteiro_narracao.txt       o texto do locutor com os tempos, para gravar a voz
"""
from __future__ import annotations

import math
import os
import pickle
import subprocess
import sys
from multiprocessing import Pool
from pathlib import Path

import numpy as np
import trimesh
from PIL import Image, ImageDraw

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
import render3d as r      # noqa: E402
import estilo as e        # noqa: E402
import mascote3d as m3    # noqa: E402
from gerar_video import pecas, mover, girar_z, lerp   # noqa: E402

W, H, FPS = 1920, 1080, 30
# IASIS_LIMPO=1: sem legenda nem título (as animações viram slides, quem explica é o apresentador)
LIMPO = os.environ.get("IASIS_LIMPO") == "1"
SAIDA = AQUI / ("saida_slides" if LIMPO else "saida_v2")

r.tema("#1f1611", "#3a2a20", "#4a3a30", contraluz=[1.0, 0.85, 0.6], brilho=[0.9, 0.7, 0.45])

# cor de baixo → cor de cima
CORES = dict(
    tras=("#cdb08a", "#e6d3b3"), frente=("#d8bf98", "#f0e2c8"), tampa=("#a87d55", "#c9a27a"),
    coracao=("#5b93cf", "#afd0ee"), ecg=("#101d33", None), nome=("#8a5a3a", None),
    prateleira=("#b58d63", "#cfa97f"), disco=("#c98a4b", "#e2ad74"), paleta=("#d0694f", None),
    suporte_servo=("#8c7a6b", None), calha=("#93ad86", "#b9cfab"), painel=("#5b4636", None),
    motor=("#2f3034", "#55575d"), servo=("#2f63b0", "#4a86d8"), lcd=("#1f5a3a", None),
    rc522=("#2e5fa8", None), comprimido=("#e8504e", None), pulseira=("#5b93cf", "#afd0ee"),
)
FOCO = "#7cc4ff"


def cena(nomes, M):
    itens = {}
    for i, n in enumerate(nomes):
        base = n.replace("_corte", "")
        c1, c2 = CORES.get(base, CORES.get(base.split("_")[0], ("#cccccc", None)))
        itens[n] = r.item(M[n], c1, i, c2)
    return itens


def destacar(itens, foco, peso):
    for n, it in itens.items():
        if n in foco:
            it.cor_quadro = (1 - peso) * it.cor + peso * r.hexrgb(FOCO)
        else:
            it.cor_quadro = (1 - 0.7 * peso) * it.cor + 0.7 * peso * r.APAGADO


def centro(M, nomes):
    return np.mean([M[n].bounds.mean(0) for n in nomes], axis=0)


def suave(x):
    return r.suave(x)


def volta(x):
    """Easing com leve passada do ponto (efeito de "mola")."""
    x = min(max(x, 0.0), 1.0)
    c = 1.70158
    return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2


# ═══════════════════════════════════════════════════════════════════════════
#  Cenas. Cada uma devolve um dicionário com:
#    img (H,W,3 float) · titulo/descricao · narracao [(t0,t1,texto)]
#    mascote (x, y, humor, alvo_px ou None) · extras (função que desenha na camada)
# ═══════════════════════════════════════════════════════════════════════════
def fundo_2d():
    return r.fundo(H, W).copy()


def _pilula(d, x, y, ang, tam, alfa):
    """Comprimido 2D (cápsula metade bege, metade caramelo)."""
    c, s = math.cos(ang), math.sin(ang)
    for i, cor in enumerate([e.CREME, e.CARAMELO]):
        pts = []
        for k in range(16):
            a = math.pi / 2 + math.pi * k / 15 if i == 0 else -math.pi / 2 + math.pi * k / 15
            cx = -tam * 0.5 if i == 0 else tam * 0.5
            px, py = cx + tam * 0.5 * math.cos(a), tam * 0.5 * math.sin(a)
            pts.append((px, py))
        pts += [(0, tam * 0.5), (0, -tam * 0.5)] if i == 0 else [(0, -tam * 0.5), (0, tam * 0.5)]
        pts = [(x + px * c - py * s, y + px * s + py * c) for px, py in pts]
        d.polygon(pts, fill=cor + (alfa,))


def intro_boas_vindas(t, ctx):
    img = fundo_2d()

    def desenho(camada):
        d = ImageDraw.Draw(camada)
        # linha de ECG atravessando a tela
        prog = suave(t / 2.2)
        pts = []
        for i in range(400):
            x = i / 399 * W
            u = (x - W * 0.42) / 60
            y = H * 0.42 - (90 * math.exp(-u * u * 4) * math.sin(u * 6) if abs(u) < 2 else 0)
            pts.append((x, y))
        n = int(len(pts) * prog)
        if n > 2:
            a = int(255 * (1 - suave((t - 2.2) / 0.8)))
            if a > 0:
                d.line(pts[:n], fill=e.AZUL_CLARO + (a,), width=6)
        # logo cresce no centro
        k = volta((t - 2.0) / 1.0) * 1.9
        if k > 0.02:
            cx, cy = W / 2, H * 0.40
            cor = [(cx + (p[0] - 60) * k, cy + (p[1] - 58.5) * k) for p in e.CORACAO_SVG]
            d.polygon(cor, fill=e.AZUL + (255,))
            d.line([(cx + (p[0] - 60) * k, cy + (p[1] - 58.5) * k) for p in e.ECG_SVG],
                   fill=e.MARINHO + (255,), width=max(2, int(4.5 * k)), joint="curve")
        a = int(255 * suave((t - 2.8) / 0.8))
        if a:
            f = r.fonte(110)
            d.text(((W - d.textlength("IASIS", font=f)) / 2, H * 0.55), "IASIS", font=f, fill=e.CREME + (a,))
            f2 = r.fonte(40, False)
            d.text(((W - d.textlength("Sua saúde em dia", font=f2)) / 2, H * 0.55 + 135), "Sua saúde em dia",
                   font=f2, fill=e.BEGE + (a,))

    # mascote entra pela direita e dá uma volta
    if t < 3.5:
        x, y = lerp((W + 200, H * 0.30), (W * 0.72, H * 0.28), suave(t / 3.0))
    else:
        a = (t - 3.5) * 1.1
        x, y = W * 0.5 + 560 * math.cos(a - 0.3), H * 0.22 + 70 * math.sin(a - 0.3)
    return dict(img=img, titulo=("Bem-vindo!", "Feira de projetos · IASIS"),
                narracao=[(0.6, 7.6, "Oi! Eu sou o Iasinho. Vem comigo conhecer o IASIS!")],
                mascote=(x, y, "feliz", None), extras=desenho)


def intro_problema(t, ctx):
    img = fundo_2d()

    def desenho(camada):
        d = ImageDraw.Draw(camada)
        rng = np.random.default_rng(3)
        for i in range(14):   # comprimidos flutuando
            x0, y0 = rng.uniform(80, W - 80), rng.uniform(140, H - 260)
            x = x0 + 30 * math.sin(t * 0.7 + i)
            y = y0 + 20 * math.cos(t * 0.9 + i * 1.7)
            _pilula(d, x, y, t * 0.5 + i, 46, 70)
        val = int(round(50 * suave((t - 0.6) / 2.2)))
        f = r.fonte(230)
        txt = f"{val}%"
        d.text(((W - d.textlength(txt, font=f)) / 2, H * 0.17), txt, font=f, fill=e.CARAMELO + (255,))
        a = int(255 * suave((t - 1.8) / 0.8))
        f2 = r.fonte(44, False)
        for i, l in enumerate(["dos pacientes com doenças crônicas", "não seguem o tratamento como deveriam"]):
            d.text(((W - d.textlength(l, font=f2)) / 2, H * 0.47 + 62 * i), l, font=f2, fill=e.CREME + (a,))
        f3 = r.fonte(26, False)
        l = "Fonte: Organização Mundial da Saúde, 2003"
        d.text(((W - d.textlength(l, font=f3)) / 2, H * 0.47 + 150), l, font=f3, fill=e.BEGE + (int(a * 0.8),))

    x, y = W * 0.82 + 20 * math.sin(t), H * 0.30
    return dict(img=img, titulo=("O problema", "Esquecer o remédio é muito comum"),
                narracao=[(0.4, 5.4, "Sabia que metade dos pacientes com doenças crônicas"),
                          (5.4, 9.6, "esquece ou erra o horário dos remédios?")],
                mascote=(x, y, "preocupado", None), extras=desenho)


def _miniatura(M):
    it = cena(["tras", "frente", "tampa", "coracao", "ecg", "nome"], M)
    img, cob = r.renderizar(it.values(), r.orbita((100, 75, 140), -28, 16, 900), (100, 75, 138),
                            W=360, H=360, cobertura=True)
    rgba = np.dstack([r.para_u8(img), (cob * 255).astype(np.uint8)])
    return Image.fromarray(rgba, "RGBA")


def intro_solucao(t, ctx):
    img = fundo_2d()
    if "mini" not in ctx:
        ctx["mini"] = _miniatura(ctx["M"])
    cartoes = [("Dispensador", "Libera a dose certa", "na hora certa"),
               ("Pulseira", "Avisa e confirma", "quem está tomando"),
               ("Aplicativo", "Mostra a adesão e", "avisa o cuidador")]
    xs = [W * 0.2, W * 0.5, W * 0.8]
    yc = H * 0.44

    def desenho(camada):
        d = ImageDraw.Draw(camada)
        for i, (tit, l1, l2) in enumerate(cartoes):
            ap = volta((t - 0.8 - 2.2 * i) / 0.8)
            if ap <= 0.01:
                continue
            w, h = 440 * min(ap, 1.06), 400 * min(ap, 1.06)
            x0, y0 = xs[i] - w / 2, yc - h / 2
            d.rounded_rectangle([x0, y0, x0 + w, y0 + h], radius=34, fill=e.BEGE + (245,))
            if ap > 0.9:
                if i == 0:
                    camada.alpha_composite(ctx["mini"].resize((210, 210)), (int(xs[i] - 105), int(y0 + 18)))
                elif i == 1:
                    d.ellipse([xs[i] - 78, y0 + 50, xs[i] + 78, y0 + 196], outline=e.AZUL + (255,), width=26)
                    d.rounded_rectangle([xs[i] - 26, y0 + 104, xs[i] + 26, y0 + 142], radius=8, fill=e.MARINHO + (255,))
                else:
                    d.rounded_rectangle([xs[i] - 62, y0 + 30, xs[i] + 62, y0 + 226], radius=20, fill=e.MARINHO + (255,))
                    d.rounded_rectangle([xs[i] - 52, y0 + 46, xs[i] + 52, y0 + 210], radius=10, fill=(234, 242, 250, 255))
                    for k, hh in enumerate([60, 95, 75, 120]):
                        d.rounded_rectangle([xs[i] - 40 + k * 22, y0 + 196 - hh, xs[i] - 26 + k * 22, y0 + 196],
                                            radius=4, fill=e.AZUL + (255,))
                ft, fl = r.fonte(40), r.fonte(28, False)
                d.text((xs[i] - d.textlength(tit, font=ft) / 2, y0 + 240), tit, font=ft, fill=e.CAFE + (255,))
                for k, l in enumerate([l1, l2]):
                    d.text((xs[i] - d.textlength(l, font=fl) / 2, y0 + 296 + 36 * k), l, font=fl, fill=(110, 80, 55, 255))
        # linhas pontilhadas animadas entre os cartões
        for i in range(2):
            ap = suave((t - 2.6 - 2.2 * i) / 0.8)
            if ap > 0:
                xa, xb = xs[i] + 230, xs[i + 1] - 230
                fase = (t * 60) % 30
                x = xa - fase
                while x < xa + (xb - xa) * ap:
                    if x >= xa:
                        d.line([x, yc, min(x + 14, xb), yc], fill=e.AZUL_CLARO + (255,), width=6)
                    x += 30
        # cadeado: fluxo de segurança fechado
        a = suave((t - 8.6) / 0.8)
        if a > 0:
            al = int(255 * a)
            cx, cy = W / 2, H * 0.80
            fecha = 18 * (1 - suave((t - 9.2) / 0.6))
            d.arc([cx - 30, cy - 70 - fecha, cx + 30, cy - 10 - fecha], 180, 360, fill=e.CARAMELO + (al,), width=10)
            d.rounded_rectangle([cx - 44, cy - 40, cx + 44, cy + 22], radius=10, fill=e.CARAMELO + (al,))
            f = r.fonte(34)
            l = "Fluxo de segurança fechado"
            d.text((cx + 64, cy - 30), l, font=f, fill=e.CREME + (al,))

    # mascote vai de cartão em cartão
    k = min(int(max(t - 0.8, 0) // 2.2), 2)
    alvo = (xs[k], yc - 120)
    x, y = lerp((xs[max(k - 1, 0)] + 120, H * 0.18), (xs[k] + 150, H * 0.17), suave(((t - 0.8) % 2.2) / 1.0))
    if t > 8.4:
        x, y = lerp((xs[2] + 150, H * 0.17), (W * 0.36, H * 0.70), suave((t - 8.4) / 1.2))
        alvo = (W / 2, H * 0.78)
    return dict(img=img, titulo=("A solução", "Três partes que trabalham juntas"),
                narracao=[(0.5, 4.6, "O IASIS junta três partes:"),
                          (4.6, 8.4, "um dispensador, uma pulseira e um aplicativo."),
                          (8.6, 13.6, "E a dose só sai quando o paciente encosta a pulseira no aparelho.")],
                mascote=(x, y, "feliz", alvo), extras=desenho)


CASCA = ["tras", "frente", "tampa", "coracao", "ecg", "nome"]
TUDO = CASCA + ["prateleira", "disco", "paleta", "suporte_servo", "calha", "painel_esq", "painel_dir",
                "motor", "servo", "lcd", "rc522"]


def _quadro3d(itens, olho, alvo, sombra=True):
    img, cob = r.renderizar(itens, olho, alvo, cobertura=True)
    if sombra:
        base = Image.fromarray(r.para_u8(r.fundo(H, W)))
        p = r.projetar((100, 75, 0), olho, alvo)
        q = r.projetar((300, 75, 0), olho, alvo)
        if p and q:
            larg = abs(q[0] - p[0]) * 1.5 + 200
            base = e.sombra_chao(base, (p[0], p[1] + 12), larg, larg * 0.22)
        fundo = np.asarray(base, np.float32) / 255
        img = fundo * (1 - cob[..., None]) + img * cob[..., None]
    return img


def cena_por_fora(t, ctx):
    it = ctx.setdefault("casca", cena(CASCA, ctx["M"]))
    # primeira frase: uma volta inteira; segunda ("Na frente..."): fica de frente, balançando
    az = -30 + 360 * suave(t / 7.0) + 14 * math.sin(max(t - 7.0, 0) / 7 * math.pi)
    olho = r.orbita((100, 75, 140), az, 16 + 5 * math.sin(t / 14 * 2 * math.pi), 860)
    img = _quadro3d(it.values(), olho, (100, 75, 138))
    alvo = r.projetar((100, -10, 170), olho, (100, 75, 138)) if math.cos(math.radians(az)) > 0.3 else None
    return dict(img=img, titulo=("O dispensador por fora", "Impresso em 3D pela equipe"),
                narracao=[(0.4, 6.6, "Esse é o dispensador do IASIS, impresso em 3D pela nossa equipe."),
                          (7.0, 13.6, "Na frente: a telinha, a nossa logo e a bandeja onde o remédio chega.")],
                mascote=(W * 0.80, H * 0.30, "feliz", alvo))


def cena_de_cima(t, ctx):
    M = ctx["M"]
    it = ctx.setdefault("tudo", cena(TUDO, M))
    for n in ("painel_esq", "painel_dir"):
        it[n].visivel = False
    sobe = suave((t - 4.0) / 2.0)
    it["tampa"].T = mover(480 * sobe, 0, 40 * sobe)
    it["tampa"].visivel = sobe < 0.98
    el = 84 - 22 * suave((t - 5.5) / 3.0)
    alvo = (100, 95, 150)
    olho = r.orbita(alvo, -10 + 10 * t / 9, el, 760)
    img = _quadro3d(it.values(), olho, alvo)
    mira = r.projetar((100, 95, 145 if t > 5 else 285), olho, alvo)
    return dict(img=img, titulo=("Visto de cima", "A tampa sai para abastecer os remédios"),
                narracao=[(0.4, 4.0, "Visto de cima: a tampa é presa por quatro parafusos."),
                          (4.6, 8.8, "Tirando a tampa, aparecem os oito compartimentos do disco.")],
                mascote=(W * 0.78, H * 0.62, "surpreso" if 5 < t < 6.5 else "feliz", mira))


DESLOC = dict(tampa=(0, 0, 190), frente=(0, -170, 0), coracao=(0, -170, 0), ecg=(0, -170, 0),
              nome=(0, -170, 0), lcd=(0, -170, 0), rc522=(0, -170, 0), tras=(0, 130, 0),
              prateleira=(0, 0, 45), motor=(0, 0, 25), servo=(0, 0, 25), suporte_servo=(0, 0, 25),
              paleta=(0, 0, 45), disco=(0, 0, 110), calha=(0, -80, -10),
              painel_esq=(-90, 0, 0), painel_dir=(90, 0, 0))
ATRASO = dict(tampa=0.0, frente=0.12, coracao=0.12, ecg=0.12, nome=0.12, lcd=0.12, rc522=0.12,
              tras=0.2, disco=0.3, prateleira=0.38, motor=0.45, servo=0.45, suporte_servo=0.45,
              paleta=0.45, calha=0.52, painel_esq=0.6, painel_dir=0.6)
T_ESTOURO, T_VOLTA = 4.0, 11.0


def cena_explodida(t, ctx):
    M = ctx["M"]
    it = ctx.setdefault("tudo", cena(TUDO, M))
    for n, x in it.items():
        x.visivel = True
        a = ATRASO.get(n, 0.3)
        ida = volta((t - T_ESTOURO - a) / 1.1)
        vem = suave((t - T_VOLTA - (0.6 - a)) / 1.4)
        k = ida * (1 - vem)
        dx, dy, dz = np.array(DESLOC.get(n, (0, 0, 0))) * k
        c = M[n].bounds.mean(0)
        giro = 10 * math.sin((t - T_ESTOURO) * 3 + a * 9) * k * (1 - suave((t - T_ESTOURO - 2) / 2))
        x.T = mover(dx, dy, dz) @ girar_z(giro, c[0], c[1])
    tremor = 6 * math.exp(-max(t - T_ESTOURO, 0) * 6) * math.sin(t * 90) if t > T_ESTOURO else 0
    alvo = (100 + tremor, 60, 145)
    olho = r.orbita(alvo, -38 + 22 * t / 16, 22, 1080)
    img = _quadro3d(it.values(), olho, alvo)
    meio = r.projetar((100, 75, 150), olho, alvo)

    def efeitos(camada):
        e.explosao(camada, meio, t - T_ESTOURO)
        e.explosao(camada, meio, t - (T_VOLTA + 1.9), n=30, semente=11)

    humor = "surpreso" if T_ESTOURO - 0.3 < t < T_ESTOURO + 1.5 else "feliz"
    return dict(img=img, titulo=("Desmontando a caixa", "Todas as peças, uma a uma"),
                narracao=[(0.4, 3.6, "Agora, vamos desmontar a caixa!"),
                          (5.2, 10.6, "São onze peças impressas, mais o motor, o servo, o leitor e a tela."),
                          (11.2, 15.6, "E tudo volta pro lugar com encaixes.")],
                mascote=(W * 0.82, H * 0.26, humor, meio if t < T_ESTOURO else None), extras=efeitos)


INTERIOR = ["tras", "prateleira", "disco", "paleta", "suporte_servo", "calha", "painel_esq", "painel_dir",
            "motor", "servo"]
FRENTE_DENTRO = ["frente", "lcd", "rc522", "prateleira", "disco", "painel_esq", "painel_dir"]
PARTES = [
    ("interior", ["disco"], (100, 95, 132), -25, 42, 360, "Por dentro · O disco",
     "8 compartimentos, um para cada horário", "Esse é o disco: oito compartimentos, um para cada horário de remédio."),
    ("interior", ["motor"], (100, 95, 100), -32, -12, 330, "Por dentro · O motor",
     "Motor de passo NEMA 17", "Embaixo dele, o motor de passo gira o disco certinho até a dose da vez."),
    ("interior", ["paleta", "servo", "suporte_servo"], (118, 50, 112), 24, -14, 250, "Por dentro · A trava",
     "Servo que só abre com a pulseira", "Essa é a trava: o servo só abre a saída depois que a pulseira é validada."),
    ("interior", ["calha"], (100, 40, 48), -42, 14, 300, "Por dentro · A calha",
     "O caminho até a bandeja", "A calha leva o remédio até a bandeja, direto para a mão do paciente."),
    ("frente", ["rc522"], (100, 6, 170), 180, 8, 260, "Por dentro · O leitor da pulseira",
     "Fica atrás do coração da logo", "Atrás do coração da logo fica o leitor da pulseira. É só encostar!"),
    ("frente", ["lcd"], (100, 6, 257), 180, 4, 250, "Por dentro · A tela",
     "Mostra horário e status", "E aqui a tela mostra o horário e o que está acontecendo."),
]
DUR_PARTE = 9.0


def cena_pecas(t, ctx):
    M = ctx["M"]
    if "interior" not in ctx:
        ctx["interior"] = cena(INTERIOR, M)
        ctx["frente"] = cena(FRENTE_DENTRO, M)
    k = min(int(t // DUR_PARTE), len(PARTES) - 1)
    tl = t - DUR_PARTE * k
    seg = PARTES[k]
    ant = PARTES[k - 1] if k > 0 and PARTES[k - 1][0] == seg[0] else None
    mov = suave(tl / 2.0)
    if ant is None:
        alvo = np.array(seg[2], float)
        dist, az, el = seg[5] * (1.5 - 0.5 * mov), seg[3] - 25 * (1 - mov), seg[4]
    else:
        alvo = lerp(ant[2], seg[2], mov)
        dist = ant[5] + (seg[5] - ant[5]) * mov
        az, el = ant[3] + (seg[3] - ant[3]) * mov, ant[4] + (seg[4] - ant[4]) * mov
    az += 6 * math.sin(tl / DUR_PARTE * math.pi)
    itens = ctx[seg[0]]
    destacar(itens, seg[1], suave((tl - 0.5) / 1.3))
    olho = r.orbita(alvo, az, el, dist)
    img = _quadro3d(itens.values(), olho, alvo, sombra=False)
    mira = r.projetar(centro(M, seg[1]), olho, alvo)
    mx, my = (W * 0.80, H * 0.30)
    if mira:
        mx = min(max(mira[0] + 330, 260), W - 220)
        my = min(max(mira[1] - 230, 230), H - 360)
    escurece = 0.0
    if k == 4 and tl < 0.5:
        escurece = 1 - tl / 0.5
    if k == 3 and tl > DUR_PARTE - 0.5:
        escurece = (tl - (DUR_PARTE - 0.5)) / 0.5
    t0 = DUR_PARTE * k
    return dict(img=img, titulo=(seg[6], seg[7]), titulo_janela=(t0 + 0.3, t0 + DUR_PARTE - 0.3),
                narracao=[(t0 + 1.0, t0 + DUR_PARTE - 0.4, seg[8])],
                mascote=(mx, my, "feliz", mira), escurece=escurece)


def cena_funcionamento(t, ctx):
    M = ctx["M"]
    nomes = ["tras", "frente_corte", "coracao_corte", "ecg_corte", "nome_corte", "prateleira", "disco",
             "paleta", "suporte_servo", "calha", "motor", "servo", "lcd", "rc522", "comprimido", "pulseira"]
    it = ctx.setdefault("fluxo", cena(nomes, M))
    cx, cy = 100.0, 95.0
    eixo = (124.7, 50.0)
    it["lcd"].cor_quadro = r.hexrgb("#9dffc6") if 0.6 < t < 6 and int(t * 2) % 2 == 0 else None
    pz = suave((t - 3.0) / 1.6) - suave((t - 5.6) / 1.0)
    it["pulseira"].T = mover(100, -170 + 152 * pz, 170)
    it["pulseira"].visivel = 2.8 < t < 6.8
    it["rc522"].cor_quadro = r.hexrgb("#9dffc6") if 4.6 < t < 6.2 else None
    giro = 45 * suave((t - 6.3) / 3.0)
    it["disco"].T = girar_z(giro, cx, cy)
    ang = 90 * (suave((t - 10.2) / 1.8) - suave((t - 18.0) / 1.8))
    it["paleta"].T = girar_z(ang, *eixo)
    a0 = math.radians(-135 + giro)
    pos_disco = (cx + 45 * math.cos(a0), cy + 45 * math.sin(a0), 128.0)
    caminho = [(11.6, pos_disco), (12.6, (100, 50, 47)), (14.8, (100, 8, 11)), (15.8, (100, -24, 9.5))]
    pos = pos_disco
    if t > caminho[0][0]:
        pos = caminho[-1][1]
        for (ta, pa), (tb, pb) in zip(caminho, caminho[1:]):
            if ta <= t <= tb:
                s = (t - ta) / (tb - ta)
                pos = lerp(pa, pb, s * s if tb == 12.6 else suave(s))
                break
    it["comprimido"].T = mover(*pos)
    alvo = lerp((112, 40, 130), (108, 20, 70), suave((t - 11.5) / 3.5))
    if t < 6.5:
        alvo = lerp((95, -20, 175), (112, 40, 130), suave((t - 5.0) / 1.5))
    dist = 480 - 60 * suave((t - 5.0) / 1.5) - 45 * suave((t - 11.0) / 2.5)
    olho = r.orbita(alvo, 38 + 6 * math.sin(t / 22 * math.pi), 22, dist)
    img = _quadro3d(it.values(), olho, alvo, sombra=False)
    if t < 3:
        foco = (100, 8, 257)
    elif t < 6.3:
        foco = (100, -10, 170)
    elif t < 10:
        foco = (100, 95, 140)
    elif t < 11.6:
        foco = (110, 45, 120)
    else:
        foco = pos
    mira = r.projetar(foco, olho, alvo)
    passos = [(0.3, 3.0, "1. Hora do remédio", "Chegou a hora do remédio: a tela avisa, e o celular também."),
              (3.2, 6.3, "2. A pulseira", "O paciente encosta a pulseira no coração da logo…"),
              (6.5, 10.0, "3. O disco gira", "…o disco gira até o compartimento certo…"),
              (10.2, 12.8, "4. A trava abre", "…a trava abre…"),
              (13.0, 17.6, "5. A dose chega", "…e a dose escorrega pela calha até a bandeja!"),
              (17.8, 21.6, "Dose registrada", "Pronto! Fica tudo registrado no app, e o cuidador acompanha.")]
    atual = next((p for p in passos if p[0] - 0.2 <= t <= p[1] + 0.2), passos[-1])
    return dict(img=img, titulo=("Como funciona", atual[2]),
                narracao=[(a, b, txt) for a, b, _, txt in passos],
                mascote=(W * 0.15, H * 0.30, "surpreso" if 12.6 < t < 14 else "feliz", mira))


def cena_final(t, ctx):
    it = ctx.setdefault("casca", cena(CASCA, ctx["M"]))
    az = -20 + 40 * suave(t / 12)
    alvo = (270, 75, 140)
    olho = r.orbita(alvo, az, 12, 1150)
    img = _quadro3d(it.values(), olho, alvo)

    def desenho(camada):
        d = ImageDraw.Draw(camada)
        a = int(255 * suave((t - 0.8) / 1.0))
        x0 = W * 0.52
        ft, f2, f3 = r.fonte(120), r.fonte(44, False), r.fonte(34, False)
        d.text((x0, H * 0.25), "IASIS", font=ft, fill=e.CREME + (a,))
        d.text((x0 + 4, H * 0.25 + 150), "Sua saúde em dia", font=f2, fill=e.BEGE + (a,))
        b = int(255 * suave((t - 2.2) / 1.0))
        for i, l in enumerate(["Dispensador · Pulseira · Aplicativo",
                               "ODS 3: Saúde e bem-estar   ·   ODS 9: Inovação",
                               "Venha testar no nosso stand!"]):
            d.text((x0 + 4, H * 0.25 + 250 + 58 * i), l, font=f3,
                   fill=(e.CARAMELO if i == 2 else e.CREME) + (b,))

    return dict(img=img, titulo=("Obrigado!", "Equipe IASIS"),
                narracao=[(0.6, 5.6, "Esse é o IASIS: sua saúde em dia."),
                          (6.0, 11.4, "Vem testar com a gente aqui no stand!")],
                mascote=(W * 0.85, H * 0.18 + 20 * math.sin(t * 2), "feliz", None), extras=desenho)


CENAS = [
    ("01_boas_vindas", 8, intro_boas_vindas),
    ("02_problema", 10, intro_problema),
    ("03_solucao", 14, intro_solucao),
    ("04_por_fora", 14, cena_por_fora),
    ("05_de_cima", 9, cena_de_cima),
    ("06_desmontando", 16, cena_explodida),
    ("07_por_dentro", int(DUR_PARTE * len(PARTES)), cena_pecas),
    ("08_como_funciona", 22, cena_funcionamento),
    ("09_encerramento", 12, cena_final),
]


# ═══════════════════════════════════════════════════════════════════════════
#  Composição de cada quadro
# ═══════════════════════════════════════════════════════════════════════════
def compor(q, t, dur, estado):
    img = q["img"]
    f = min(1.0, t / 0.4, (dur - t) / 0.4)
    f = min(f, 1 - q.get("escurece", 0.0))
    img = r.fundo(H, W) * (1 - f) + img * f
    base = Image.fromarray(r.para_u8(img)).convert("RGBA")
    camada = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    if q.get("extras"):
        q["extras"](camada)
    # mascote: movimento suavizado entre quadros + flutuação
    mx, my, humor, alvo = q["mascote"]
    px, py = estado.get("pos", (mx, my))
    px, py = px + (mx - px) * 0.12, py + (my - py) * 0.12
    estado["pos"] = (px, py)
    py += 14 * math.sin(t * 2 * math.pi / 1.6)
    falando = not LIMPO and any(a <= t <= b for a, b, _ in q["narracao"])
    aponta = None
    if alvo is not None:
        aponta = math.degrees(math.atan2(-(alvo[1] - py), alvo[0] - px))
    m = m3.mascote(t, falando, aponta, humor, escala=0.8)
    camada.alpha_composite(m, (int(px - m.width / 2), int(py - m.height / 2)))
    # título da cena e legenda da narração
    tj = q.get("titulo_janela", (0.3, dur - 0.3))
    if not LIMPO:
        e.titulo_cena(camada, q["titulo"][0], q["titulo"][1], r.janela(t, tj[0], tj[1], 0.5))
    for a, b, txt in ([] if LIMPO else q["narracao"]):
        al = r.janela(t, a, b, 0.25)
        if al > 0:
            e.legenda_narracao(camada, txt, al)
    e.marca(camada)
    final = Image.alpha_composite(base, camada).convert("RGB")
    return np.asarray(final)


PEDACO = 14


def trabalhos():
    js = []
    for nome, dur, _ in CENAS:
        a, k = 0, 0
        while a < dur:
            js.append((nome, k, a, min(dur, a + PEDACO)))
            a += PEDACO
            k += 1
    return sorted(js, key=lambda j: -(j[3] - j[2]))


def gravar(job):
    nome, k, a, b = job
    dur, func = next((d, f) for n, d, f in CENAS if n == nome)
    ctx = {"M": pecas()}
    partes = SAIDA / "partes"
    partes.mkdir(parents=True, exist_ok=True)
    destino = partes / f"{nome}_{k:02d}.mp4"
    if destino.exists():           # retomada: pedaço já gravado inteiro fica como está
        return job
    temp = destino.with_suffix(".tmp.mp4")
    g = r.Gravador(temp)
    estado = {}
    # pré-aquece a posição do mascote para não "pular" na emenda dos pedaços
    for i in range(max(0, int(a * FPS) - 25), int(a * FPS)):
        q = func(i / FPS, ctx)
        mx, my = q["mascote"][:2]
        px, py = estado.get("pos", (mx, my))
        estado["pos"] = (px + (mx - px) * 0.12, py + (my - py) * 0.12)
    for i in range(int(a * FPS), int(b * FPS)):
        t = i / FPS
        g.quadro(compor(func(t, ctx), t, dur, estado))
    g.fechar()
    temp.rename(destino)
    return job


def srt_e_roteiro():
    def ts(s):
        h, s = divmod(s, 3600); m, s = divmod(s, 60)
        return f"{int(h):02d}:{int(m):02d}:{int(s):02d},{int(round((s % 1) * 1000)):03d}"
    ctx = {"M": pecas()}
    linhas, roteiro, inicio, n = [], [], 0.0, 1
    for nome, dur, func in CENAS:
        vistos = set()
        for t in np.arange(0, dur, 0.5):
            q = func(float(t), ctx)
            for a, b, txt in q["narracao"]:
                if (a, txt) not in vistos:
                    vistos.add((a, txt))
                    linhas.append(f"{n}\n{ts(inicio + a)} --> {ts(inicio + b)}\n{txt}\n")
                    roteiro.append(f"[{ts(inicio + a)[:8]}]  {txt}")
                    n += 1
        inicio += dur
    (SAIDA / "legendas.srt").write_text("\n".join(linhas), encoding="utf-8")
    cab = ("ROTEIRO DO LOCUTOR — IASIS (Iasinho)\n"
           "Leia no ritmo dos tempos abaixo, em tom animado e acolhedor, falando com quem assiste.\n"
           "Grave por cena e cole no vídeo nos tempos indicados (ou use o recurso de voz do Motion).\n\n")
    (SAIDA / "roteiro_narracao.txt").write_text(cab + "\n".join(roteiro) + "\n", encoding="utf-8")


def montar():
    lista = SAIDA / "lista.txt"
    arqs = []
    for nome, _, _ in CENAS:
        arqs += sorted(f for f in (SAIDA / "partes").glob(f"{nome}_*.mp4") if ".tmp" not in f.name)
    lista.write_text("".join(f"file '{f.resolve()}'\n" for f in arqs))
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lista),
                    "-c", "copy", "-movflags", "+faststart", str(SAIDA / "IASIS_video_stand_v2.mp4")], check=True)
    lista.unlink()


if __name__ == "__main__":
    SAIDA.mkdir(parents=True, exist_ok=True)
    pecas()
    js = trabalhos()
    with Pool(4) as pool:
        for feito in pool.imap_unordered(gravar, js):
            print("pronto:", feito, flush=True)
    montar()
    srt_e_roteiro()
    print("vídeo:", SAIDA / "IASIS_video_stand_v2.mp4", flush=True)
