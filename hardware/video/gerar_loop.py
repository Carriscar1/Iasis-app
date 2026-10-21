"""
IASIS — vídeo em loop para o monitor do stand (só o 3D, sem narração).

    python hardware/video/gerar_loop.py

O dispensador monta e desmonta, a câmera passa peça por peça (com destaque que
acende e apaga) e o Iasinho sobrevoa a tela só olhando. Tudo tem período de
72 s: o último quadro emenda no primeiro, então dá para deixar em repetição
sem pulo. Saída: hardware/video/saida_loop/IASIS_loop_3D.mp4
"""
from __future__ import annotations

import math
import subprocess
import sys
from multiprocessing import Pool
from pathlib import Path

import numpy as np
from PIL import Image

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
import render3d as r                      # noqa: E402
import estilo as e                        # noqa: E402
import mascote3d as m3                    # noqa: E402
import qr_voto                            # noqa: E402
from gerar_video import pecas, mover, girar_z, lerp   # noqa: E402
from gerar_video_v2 import TUDO, cena, suave, volta, _quadro3d   # noqa: E402  (também aplica o tema quente)

W, H, FPS = 1920, 1080, 30
LOOP = 72.0
SAIDA = AQUI / "saida_loop"

# afastamento de cada peça na vista explodida (mm)
DESLOC = dict(tampa=(0, 0, 250), frente=(0, -230, 0), coracao=(0, -230, 0), ecg=(0, -230, 0),
              nome=(0, -230, 0), lcd=(0, -150, 0), rc522=(0, -120, 0), tras=(0, 170, 0),
              disco=(0, 0, 165), prateleira=(0, 0, 90), paleta=(0, 0, 90), servo=(0, 0, 90),
              suporte_servo=(0, 0, 90), motor=(0, 0, 30), calha=(0, -95, -12),
              painel_esq=(-150, 0, 0), painel_dir=(150, 0, 0))
ATRASO = dict(tampa=0.0, frente=0.1, coracao=0.1, ecg=0.1, nome=0.1, lcd=0.25, rc522=0.25, tras=0.15,
              disco=0.35, prateleira=0.45, paleta=0.45, servo=0.45, suporte_servo=0.45, motor=0.6,
              calha=0.55, painel_esq=0.7, painel_dir=0.7)
# durante o tour peça por peça, a casca se afasta mais para não tapar o miolo
EXTRA = dict(frente=(0, -400, 0), coracao=(0, -400, 0), ecg=(0, -400, 0), nome=(0, -400, 0),
             tras=(0, 300, 0), tampa=(0, 0, 160), painel_esq=(-130, 0, 0), painel_dir=(130, 0, 0))
T_ABRE, T_FECHA = 8.0, 62.0          # começa a desmontar / começa a montar
FOCO_INI, FOCO_FIM = 16.0, 58.0

# (peças em foco, título, descrição, azimute, elevação, distância)
GRUPOS = [
    (["disco"], "Disco de doses", "8 compartimentos, um para cada horário", -20, 48, 430),
    (["motor"], "Motor de passo NEMA 17", "Gira o disco até a dose certa", -32, -12, 360),
    (["paleta", "servo", "suporte_servo"], "Trava com servo", "Só abre depois que a pulseira é lida", 24, -14, 280),
    (["calha"], "Calha", "Leva a dose até a bandeja", -42, 16, 380),
    (["rc522"], "Leitor da pulseira (RFID)", "Fica atrás do coração da logo", -12, 6, 300),
    (["lcd"], "Tela LCD 16×2", "Mostra horário e status", -8, 4, 300),
    (["painel_esq", "painel_dir"], "Painéis da eletrônica", "ESP32, driver do motor e regulador de 5 V",
     -62, 18, 760),
    (["tampa"], "Tampa", "Sai com 4 parafusos para abastecer", -25, 40, 520),
]
DUR_G = (FOCO_FIM - FOCO_INI) / len(GRUPOS)


def abertura(t, atraso=0.0):
    """0 = montado, 1 = explodido."""
    ida = volta((t - T_ABRE - atraso) / 1.3)
    vem = suave((t - T_FECHA - (0.7 - atraso)) / 1.6)
    return ida * (1 - vem)


def peso_foco(t):
    return suave((t - FOCO_INI) / 1.6) - suave((t - (FOCO_FIM - 1.6)) / 1.6)


def desloc(n, t):
    return np.array(DESLOC.get(n, (0, 0, 0))) * abertura(t, ATRASO.get(n, 0.3)) \
        + np.array(EXTRA.get(n, (0, 0, 0))) * peso_foco(t)


def posicao_explodida(M, nomes, t):
    return np.mean([M[n].bounds.mean(0) + desloc(n, t) for n in nomes], axis=0)


def camera(t, M):
    k = abertura(t, 0.3)
    az = -30 + 70 * math.sin(2 * math.pi * t / LOOP)
    el = 20 + 6 * math.sin(4 * math.pi * t / LOOP)
    alvo = np.array([100, 90, 140 + 70 * k])
    dist = 900 + 650 * k
    # bloco de foco: vai de peça em peça e volta para a vista geral
    w = peso_foco(t)
    if w <= 0:
        return r.orbita(alvo, az, el, dist), alvo, None, 0.0
    i = int(min(max(t - FOCO_INI, 0) // DUR_G, len(GRUPOS) - 1))
    tl = t - FOCO_INI - i * DUR_G
    g = GRUPOS[i]
    if i > 0:
        a = GRUPOS[i - 1]
        s = suave(tl / 1.4)
        f_alvo = lerp(posicao_explodida(M, a[0], t), posicao_explodida(M, g[0], t), s)
        f_az, f_el, f_d = (lerp(a[3:6], g[3:6], s))
    else:
        f_alvo, (f_az, f_el, f_d) = posicao_explodida(M, g[0], t), g[3:6]
    f_az += 5 * math.sin(tl / DUR_G * math.pi)
    alvo = lerp(alvo, f_alvo, w)
    az, el, dist = az + (f_az - az) * w, el + (f_el - el) * w, dist + (f_d - dist) * w
    brilho = suave((tl - 0.7) / 0.8) - suave((tl - (DUR_G - 0.7)) / 0.6)
    return r.orbita(alvo, az, el, dist), alvo, (i, brilho * w), w


def quadro(t, ctx):
    M = ctx["M"]
    it = ctx.setdefault("itens", cena(TUDO, M))
    for n, x in it.items():
        a = ATRASO.get(n, 0.3)
        k = abertura(t, a)
        d = desloc(n, t)
        c = M[n].bounds.mean(0)
        giro = 8 * math.sin((t - T_ABRE) * 3 + a * 9) * k * (1 - suave((t - T_ABRE - 1.5) / 2))
        x.T = mover(*d) @ girar_z(giro, c[0], c[1])
        x.cor_quadro = None
    olho, alvo, foco, w = camera(t, M)
    if foco is not None:
        i, p = foco
        for n, x in it.items():
            if n in GRUPOS[i][0]:
                x.cor_quadro = np.clip(x.cor * (1 + 0.22 * p) + 0.05 * p, 0, 1)
            else:
                x.cor_quadro = (1 - 0.72 * p) * x.cor + 0.72 * p * r.APAGADO
    img = _quadro3d(it.values(), olho, alvo, sombra=w < 0.5)

    camada = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    # brilho ao desmontar e ao fechar
    meio = r.projetar((100, 75, 150), olho, alvo)
    e.explosao(camada, meio, t - T_ABRE, n=45)
    e.explosao(camada, meio, t - (T_FECHA + 2.0), n=25, semente=11)
    # título: peça em foco ou nome do projeto
    if foco is not None:
        g = GRUPOS[foco[0]]
        tl = t - FOCO_INI - foco[0] * DUR_G
        e.titulo_cena(camada, g[1], g[2], r.janela(tl, 0.6, DUR_G - 0.5, 0.4) * w)
    al = r.janela(t % LOOP, -1, FOCO_INI - 1.0, 0.6) + r.janela(t % LOOP, FOCO_FIM + 1.0, LOOP + 1, 0.6)
    e.titulo_cena(camada, "Dispensador IASIS", "Projeto completo · impresso em 3D", min(al, 1.0))
    # Iasinho: dá duas voltas pelas bordas da tela, olhando para a peça
    th = 2 * math.pi * 2 * t / LOOP + math.pi / 4
    mx = W / 2 + 0.39 * W * math.cos(th)
    my = H * 0.5 + 0.31 * H * math.sin(th) + 12 * math.sin(2 * math.pi * t / 1.6)
    if foco is not None:
        ponto = r.projetar(posicao_explodida(M, GRUPOS[foco[0]][0], t), olho, alvo)
    else:
        ponto = meio
    olha = math.degrees(math.atan2(-(ponto[1] - my), ponto[0] - mx)) if ponto else None
    humor = "surpreso" if T_ABRE - 0.2 < t < T_ABRE + 1.6 else "feliz"
    # QR de votação fixo no canto inferior esquerdo (o Iasinho passa por cima dele)
    qr = qr_voto.cartao()
    camada.alpha_composite(qr, (8, H - qr.height + 4))
    m = m3.mascote(t, False, None, humor, escala=0.7, olha=olha)
    camada.alpha_composite(m, (int(mx - m.width / 2), int(my - m.height / 2)))
    e.marca(camada)
    base = Image.fromarray(r.para_u8(img)).convert("RGBA")
    return np.asarray(Image.alpha_composite(base, camada).convert("RGB"))


PEDACO = 12


def gravar(job):
    k, a, b = job
    partes = SAIDA / "partes"
    partes.mkdir(parents=True, exist_ok=True)
    destino = partes / f"{k:02d}.mp4"
    if destino.exists():
        return job
    temp = destino.with_suffix(".tmp.mp4")
    ctx = {"M": pecas()}
    g = r.Gravador(temp)
    for i in range(int(round(a * FPS)), int(round(b * FPS))):
        g.quadro(quadro(i / FPS, ctx))
    g.fechar()
    temp.rename(destino)
    return job


def montar():
    arqs = sorted(f for f in (SAIDA / "partes").glob("*.mp4") if ".tmp" not in f.name)
    lista = SAIDA / "lista.txt"
    lista.write_text("".join(f"file '{f.resolve()}'\n" for f in arqs))
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lista),
                    "-c", "copy", "-movflags", "+faststart", str(SAIDA / "IASIS_loop_3D.mp4")], check=True)
    lista.unlink()


if __name__ == "__main__":
    SAIDA.mkdir(parents=True, exist_ok=True)
    pecas()
    js = [(k, k * PEDACO, min(LOOP, (k + 1) * PEDACO)) for k in range(int(math.ceil(LOOP / PEDACO)))]
    with Pool(4) as pool:
        for feito in pool.imap_unordered(gravar, js):
            print("pronto:", feito, flush=True)
    montar()
    print("vídeo:", SAIDA / "IASIS_loop_3D.mp4", flush=True)
