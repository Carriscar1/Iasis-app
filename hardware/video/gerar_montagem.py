"""
IASIS — vídeo do manual de montagem: cada peça entrando no lugar, na ordem certa,
com a legenda do que fazer, e a fiação acendendo componente por componente.

    python hardware/video/gerar_montagem.py            # vídeo completo
    python hardware/video/gerar_montagem.py --quadros  # só um quadro de cada passo (para o manual)

As peças vêm de hardware/cad/dispenser.py (as mesmas dos STL). ESP32, A4988 e
LM2596 são caixas aproximadas, só para mostrar onde ficam. Saídas em
hardware/video/saida_manual/.
"""
from __future__ import annotations

import math
import pickle
import subprocess
import sys
from multiprocessing import Pool
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
sys.path.insert(0, str(AQUI.parent / "cad"))
import render3d as r                    # noqa: E402
import diagrama_fiacao as fiacao        # noqa: E402

W, H, FPS = 1920, 1080, 30
SAIDA = AQUI / "saida_manual"
CACHE = AQUI / ".cache_montagem.pkl"
FONTES = Path("/usr/share/fonts/opentype/inter")
CAFE, MARROM, AZUL = (40, 28, 20), (110, 80, 55), (52, 104, 170)
r.tema("#f7f1e8", "#e9dcc8", "#cbbba5", (1.0, 0.92, 0.8), (1.0, 0.9, 0.75))

COR = dict(frente_baixo="#d9b48a", frente_cima="#d9b48a", tras_baixo="#c9a57c", tras_cima="#c9a57c",
           tampa="#8fc7a8", portinha="#f2c879", prateleira="#e6d36f", disco="#e0905a", calha="#7fc27a",
           paleta="#d98fb5", suporte_servo="#c9c9c9", gabarito_trava="#9ad0e6", painel_esq="#a9b4c2",
           painel_dir="#a9b4c2", motor="#4a4a4a", servo="#3a6ea5", lcd="#2f6b4f", rc522="#2f8f9d",
           esp32="#1e2a3a", a4988="#7a4fa0", lm2596="#2b5fa8")
CORPO = ["frente_baixo", "frente_cima", "tras_baixo", "tras_cima"]
TRAS = ["tras_baixo", "tras_cima"]
FRENTE = ["frente_baixo", "frente_cima"]
TRAVA = ["prateleira", "motor", "suporte_servo", "servo", "paleta"]
PAINEIS = ["painel_esq", "esp32", "painel_dir", "a4988", "lm2596"]
TUDO = CORPO + ["calha"] + TRAVA + ["disco", "rc522", "lcd"] + PAINEIS + ["tampa", "portinha"]
NOMES = dict(frente_baixo="corpo frente baixo", frente_cima="corpo frente cima", tras_baixo="corpo trás baixo",
             tras_cima="corpo trás cima", tampa="tampa", portinha="portinha", prateleira="prateleira",
             disco="disco", calha="calha", paleta="paleta (trava)", suporte_servo="suporte do servo",
             gabarito_trava="gabarito", painel_esq="painel", painel_dir="painel")


def pecas():
    if CACHE.exists():
        return pickle.loads(CACHE.read_bytes())
    import trimesh
    import dispenser
    import iasis_cad as cad
    p, f, _ = dispenser.construir()
    m = {k: p[k] for k in ("frente_baixo", "frente_cima", "tras_baixo", "tras_cima", "tampa", "portinha",
                           "prateleira", "disco", "calha", "paleta", "suporte_servo", "gabarito_trava",
                           "painel_esq", "painel_dir")}
    m.update(motor=f["motor"], servo=f["servo"], lcd=f["lcd"], rc522=f["rc522"])
    # placas (caixas aproximadas) nos painéis
    m["esp32"] = cad.caixa(16, 26, 51, 79, 175, 227)
    m["a4988"] = cad.caixa(174, 184, 48, 68, 195, 215)
    m["lm2596"] = cad.caixa(176, 184, 44, 87, 150, 171)
    m = {k: trimesh.Trimesh(v.vertices.copy(), v.faces.copy()) for k, v in m.items()}
    CACHE.write_bytes(pickle.dumps(m))
    return m


def suave(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


def janela(t, a, b):
    return suave((t - a) / max(b - a, 1e-6))


def mover(v):
    T = np.eye(4)
    T[:3, 3] = v
    return T


def girar_z(graus, cx, cy):
    a = math.radians(graus)
    T = np.eye(4)
    T[:2, :2] = [[math.cos(a), -math.sin(a)], [math.sin(a), math.cos(a)]]
    T[:2, 3] = [cx - (T[0, 0] * cx + T[0, 1] * cy), cy - (T[1, 0] * cx + T[1, 1] * cy)]
    return T


def entra(de, t, a=0.0, b=1.0):
    """Translação que leva a peça de `de` (deslocamento) até o lugar entre as frações a e b."""
    return mover(np.asarray(de, float) * (1 - janela(t, a, b)))


INTERIOR = dict(alvo=(100, 55, 120), az=205, el=30, dist=1000)
BAIXO = dict(alvo=(105, 60, 112), az=-20, el=-52, dist=470)

# Cada passo: (duração, título, legenda, câmera, função t∈[0,1] → {peça: transformação ou None})
PASSOS = []


def passo(dur, titulo, legenda, cam, presentes, movimento=None, quadro=0.9):
    PASSOS.append(dict(dur=dur, titulo=titulo, legenda=legenda, cam=cam, presentes=presentes,
                       movimento=movimento or (lambda t: {}), quadro=quadro))


passo(5, "", "", dict(alvo=(100, 80, 150), az=-30, el=18, dist=1050, giro=20), TUDO)
GRADE = {}
for k, n in enumerate(["frente_baixo", "frente_cima", "tras_baixo", "tras_cima", "tampa", "portinha", "prateleira",
                       "disco", "calha", "paleta", "suporte_servo", "gabarito_trava", "painel_esq", "painel_dir"]):
    GRADE[n] = (k % 5 * 300 - 600, 360 - (k // 5) * 360)
passo(9, "As peças impressas", "Confira se tem todas antes de começar (os painéis são 2 iguais)",
      dict(alvo=(0, 10, 40), az=0, el=62, dist=2150), list(GRADE), lambda t: {})
passo(9, "Passo 1 · Corpo", "Encaixe as 4 partes do corpo (macho-fêmea) com um fio de cola. A bandeja fica na frente.",
      dict(alvo=(100, 75, 140), az=-35, el=22, dist=1150), CORPO,
      lambda t: {"frente_cima": entra((0, 0, 140), t, 0.0, 0.35), "tras_baixo": entra((0, 170, 0), t, 0.4, 0.75),
                 "tras_cima": entra((0, 170, 140), t, 0.4, 0.75)})
passo(9, "Passo 2 · Calha", "Desça a calha 2 cm afastada da frente e empurre até a lingueta passar pela janela. "
      "Cole os pés no fundo.", dict(INTERIOR, alvo=(100, 50, 70), dist=900), FRENTE + ["calha"],
      lambda t: {"calha": mover((0, 13 * (1 - janela(t, 0.6, 0.85)), 230 * (1 - janela(t, 0.0, 0.55))))})
passo(7, "Passo 3 · Motor na prateleira", "Prateleira de cabeça para baixo: motor por baixo com 4 parafusos "
      "M3 x 8 cabeça chata.", BAIXO, ["prateleira", "motor"], lambda t: {"motor": entra((0, 0, -90), t, 0.05, 0.6)})
passo(9, "Passo 4 · Suporte do servo", "Gabarito com o pino na saída e a borda na frente → cole o suporte nos "
      "recortes → tire o gabarito.", BAIXO, ["prateleira", "motor", "gabarito_trava", "suporte_servo"],
      lambda t: {"gabarito_trava": mover((0, 0, -70 * (1 - janela(t, 0.0, 0.25)) - 90 * janela(t, 0.75, 0.95))),
                 "suporte_servo": entra((0, 0, -80), t, 0.3, 0.6)})


def _servo_paleta(t):
    from dispenser import PARAMETROS
    ex, ey = PARAMETROS["trava_eixo"]
    giro = PARAMETROS["trava_abre"] * (janela(t, 0.72, 0.84) - janela(t, 0.88, 1.0))
    return {"servo": entra((0, 70, 0), t, 0.0, 0.4),
            "paleta": girar_z(giro, ex, ey) @ entra((0, 0, -50), t, 0.45, 0.68)}


passo(8, "Passo 5 · Servo e paleta", "Servo desliza por trás e parafusa nas abas. Paleta no braço do servo, "
      "tampando a saída (servo em fechado).", BAIXO, TRAVA, _servo_paleta, quadro=0.7)
passo(7, "Passo 6 · Prateleira no corpo", "Desça a prateleira montada até assentar no degrau das paredes. "
      "Fios sobem pelos rasgos.", INTERIOR, FRENTE + ["calha"] + TRAVA,
      lambda t: {n: entra((0, 0, 210), t, 0.05, 0.8) for n in TRAVA})
passo(6, "Passo 7 · Disco", "Encaixe o disco no eixo com o CORAÇÃO gravado em cima da saída.",
      INTERIOR, FRENTE + ["calha"] + TRAVA + ["disco"], lambda t: {"disco": entra((0, 0, 150), t, 0.05, 0.7)})
passo(8, "Passo 8 · Leitor e tela", "RC522 desce nos trilhos atrás do coração. LCD nos 4 pinos com "
      "parafusos M3 x 6.", dict(INTERIOR, alvo=(100, 40, 200), dist=950),
      FRENTE + ["calha"] + TRAVA + ["disco", "rc522", "lcd"],
      lambda t: {"rc522": entra((0, 0, 120), t, 0.0, 0.45), "lcd": entra((0, 70, 0), t, 0.5, 0.9)})
passo(8, "Passo 9 · Painéis de eletrônica", "ESP32, A4988 e LM2596 presos nos painéis com abraçadeira. "
      "Painéis nos pinos das laterais: M3 x 8.", dict(INTERIOR, alvo=(100, 60, 190), dist=1000),
      FRENTE + ["calha"] + TRAVA + ["disco", "rc522", "lcd"] + PAINEIS,
      lambda t: {**{n: entra((70, 0, 0), t, 0.05, 0.5) for n in ("painel_esq", "esp32")},
                 **{n: entra((-70, 0, 0), t, 0.5, 0.95) for n in ("painel_dir", "a4988", "lm2596")}})
FIACAO = [
    ("energia", "Energia", "Fonte 12 V → LM2596 regulado em 5,3 V (trilho 5V) e 12 V direto no VMOT do A4988. "
     "Todos os GND juntos."),
    ("rc522", "Leitor RC522", "SDA 5 · SCK 18 · MOSI 23 · MISO 19 · RST 22 · 3.3V no 3V3 (NUNCA no 5V)."),
    ("lcd", "Tela LCD", "RS 13 · E 15 · D4 14 · D5 25 · D6 33 · D7 32 · RW no GND · V0 no meio do potenciômetro."),
    ("a4988", "Motor (A4988)", "STEP 26 · DIR 27 · EN 21 · VDD no 3V3 · VMOT no 12V com capacitor 100 µF · "
     "SLEEP ligado no RESET."),
    ("servo", "Servo da trava", "Laranja no GPIO 17 · vermelho no 5V do LM2596 · marrom no GND · capacitor "
     "470–1000 µF."),
    ("vibra", "Módulo de vibração", "IN no GPIO 4 · VCC no 5V · GND no GND."),
]
for k, (g, tit, leg) in enumerate(FIACAO):
    passo(6, f"Passo 10 · Fiação: {tit}", leg, None, [], dict(grupos=[x for x, *_ in FIACAO[:k + 1]], destaque=g))
passo(8, "Passo 11 · Tampa", "Tampa com 4 parafusos M3 x 12 cabeça chata. A portinha só encaixa: é por "
      "ela que se abastece o disco.", dict(alvo=(100, 80, 160), az=-30, el=24, dist=1150), TUDO,
      lambda t: {"tampa": entra((0, 0, 130), t, 0.1, 0.55), "portinha": entra((0, 0, 170), t, 0.6, 0.9)})
passo(7, "Pronto!", "Grave o firmware etapa6_trava e ajuste a trava pelo Monitor Serial (a = abre, f = fecha).",
      dict(alvo=(100, 80, 150), az=-20, el=18, dist=1050, giro=30), TUDO)

INICIO = np.cumsum([0] + [p["dur"] for p in PASSOS])
DURACAO = float(INICIO[-1])


def fonte(tam, peso="SemiBold"):
    return ImageFont.truetype(str(FONTES / f"InterDisplay-{peso}.otf"), tam)


def textos(img, p, t, alfa):
    """Título do passo no alto e legenda grande embaixo, com fundo para ler no celular."""
    camada = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(camada)
    a = int(255 * alfa)
    if p["titulo"]:
        ft = fonte(44, "Bold")
        lt = d.textlength(p["titulo"], font=ft)
        d.rounded_rectangle([40, 34, 40 + lt + 56, 118], radius=22, fill=(40, 28, 20, int(230 * alfa)))
        d.text((68, 76), p["titulo"], font=ft, fill=(255, 255, 255, a), anchor="lm")
    if p["legenda"]:
        fl = fonte(36, "Medium")
        palavras, linhas, atual = p["legenda"].split(), [], ""
        for w in palavras:
            teste = (atual + " " + w).strip()
            if d.textlength(teste, font=fl) > W - 240 and atual:
                linhas.append(atual)
                atual = w
            else:
                atual = teste
        linhas.append(atual)
        h = 30 + 48 * len(linhas)
        y0 = H - h - 40
        d.rounded_rectangle([80, y0, W - 80, y0 + h], radius=22, fill=(255, 255, 255, int(235 * alfa)),
                            outline=(52, 104, 170, a), width=3)
        for k, l in enumerate(linhas):
            d.text((W / 2, y0 + 15 + 24 + 48 * k), l, font=fl, fill=(40, 28, 20, a), anchor="mm")
    img.alpha_composite(camada)


def abertura(img, t):
    d = ImageDraw.Draw(img)
    a = int(255 * min(1, t * 3, (1 - t) * 4))
    d.text((W / 2, 150), "Manual de montagem", font=fonte(88, "Black"), fill=(40, 28, 20, a), anchor="mm")
    d.text((W / 2, 240), "IASIS · dispensador inteligente de medicamentos", font=fonte(40, "Medium"),
           fill=(110, 80, 55, a), anchor="mm")


def quadro(tempo, ctx):
    k = int(np.searchsorted(INICIO, tempo, side="right") - 1)
    k = min(k, len(PASSOS) - 1)
    p = PASSOS[k]
    t = (tempo - INICIO[k]) / p["dur"]
    alfa = min(1.0, (tempo - INICIO[k]) / 0.5, (INICIO[k + 1] - tempo) / 0.4)
    if isinstance(p["movimento"], dict):                       # passo de fiação: diagrama 2D
        dia = fiacao.desenhar(p["movimento"]["grupos"], p["movimento"]["destaque"], titulo=False)
        dia = dia.resize((int(W * 0.74), int(H * 0.74)), Image.LANCZOS)
        img = Image.new("RGBA", (W, H), fiacao.FUNDO + (255,))
        img.paste(dia, ((W - dia.width) // 2, 126))
        textos(img, p, t, max(alfa, 0.0))
        return np.asarray(img.convert("RGB"))
    M = ctx["M"]
    itens = ctx.setdefault("itens", {n: r.item(M[n], COR[n], i) for i, n in enumerate(M)})
    mov = p["movimento"](t)
    lista = []
    for n in p["presentes"]:
        it = itens[n]
        it.T = mov.get(n)
        if n in GRADE and k == 1:                             # mesa com as peças espalhadas
            c = M[n].bounds.mean(0)
            gx, gy = GRADE[n]
            it.T = mover((gx - c[0], gy - c[1], -M[n].bounds[0][2]))
        lista.append(it)
    cam = p["cam"]
    az = cam["az"] + cam.get("giro", 0) * (t - 0.5)
    olho = r.orbita(np.asarray(cam["alvo"], float), az, cam["el"], cam["dist"])
    img = Image.fromarray(r.para_u8(r.renderizar(lista, olho, cam["alvo"], W=W, H=H, ss=2))).convert("RGBA")
    if k == 1:
        d = ImageDraw.Draw(img)
        for n in GRADE:
            c = M[n].bounds.mean(0)
            gx, gy = GRADE[n]
            prof = M[n].bounds[1][1] - M[n].bounds[0][1]
            pt = r.projetar((gx, gy - prof / 2 - 25, 0), olho, cam["alvo"], W=W, H=H)
            if pt:
                d.text((pt[0], pt[1] + 14), NOMES[n], font=fonte(26, "Bold"), fill=(40, 28, 20, 255), anchor="mm")
    if k == 0:
        abertura(img, t)
    if p["cam"] in (INTERIOR,) or (p["cam"] and p["cam"].get("az") == 205):
        d = ImageDraw.Draw(img)
        d.text((W - 60, 76), "vista sem a parte de trás", font=fonte(30, "Medium"), fill=(110, 80, 55, 255),
               anchor="rm")
    textos(img, p, t, max(alfa, 0.0))
    return np.asarray(img.convert("RGB"))


PEDACO = 6.0


def gravar(job):
    i, a, b = job
    partes = SAIDA / "partes_montagem"
    partes.mkdir(parents=True, exist_ok=True)
    destino = partes / f"{i:02d}.mp4"
    if destino.exists():
        return job
    temp = destino.with_suffix(".tmp.mp4")
    ctx = {"M": pecas()}
    g = r.Gravador(temp)
    for f in range(int(round(a * FPS)), int(round(b * FPS))):
        g.quadro(quadro(f / FPS, ctx))
    g.fechar()
    temp.rename(destino)
    return job


def montar():
    arqs = sorted(f for f in (SAIDA / "partes_montagem").glob("*.mp4") if ".tmp" not in f.name)
    lista = SAIDA / "lista_montagem.txt"
    lista.write_text("".join(f"file '{f.resolve()}'\n" for f in arqs))
    destino = SAIDA / "IASIS_manual_de_montagem.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lista),
                    "-c", "copy", "-movflags", "+faststart", str(destino)], check=True)
    lista.unlink()
    return destino


def quadros_do_manual():
    """Um quadro de cada passo (no fim do movimento), para as páginas do manual."""
    pasta = SAIDA / "passos"
    pasta.mkdir(parents=True, exist_ok=True)
    ctx = {"M": pecas()}
    for k, p in enumerate(PASSOS):
        tempo = INICIO[k] + p["dur"] * p["quadro"]
        Image.fromarray(quadro(tempo, ctx)).save(pasta / f"passo_{k:02d}.png")
    print(pasta)


if __name__ == "__main__":
    SAIDA.mkdir(parents=True, exist_ok=True)
    pecas()
    if "--quadros" in sys.argv:
        quadros_do_manual()
        sys.exit()
    jobs = [(i, i * PEDACO, min(DURACAO, (i + 1) * PEDACO)) for i in range(int(math.ceil(DURACAO / PEDACO)))]
    with Pool(4) as pool:
        for feito in pool.imap_unordered(gravar, jobs):
            print("pronto:", feito, flush=True)
    print("vídeo:", montar(), f"({DURACAO:.0f} s)")
