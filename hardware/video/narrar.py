"""
Coloca a voz do Iasinho no vídeo do stand, sincronizada com a legenda.

Lê legendas.srt, gera a fala de cada trecho, acelera de leve o trecho que
passar do tempo da cena e junta tudo em IASIS_video_stand_v2_narrado.mp4.
Deixe narrar.py, IASIS_video_stand_v2.mp4 e legendas.srt na mesma pasta
(ou passe --video e --srt).

Precisa de Python 3.10+ e ffmpeg no PATH (Windows: winget install ffmpeg).

Voz neural da Microsoft (a mais natural, precisa de internet):
    pip install edge-tts
    python narrar.py
    python narrar.py --voz pt-BR-AntonioNeural --tom +0Hz     # voz masculina, tom normal

100% offline com Piper (baixe o .onnx e o .onnx.json da voz para a mesma pasta):
    pip install piper-tts
    python narrar.py --motor piper --modelo pt_BR-faber-medium.onnx --fofo 1.08
"""
from __future__ import annotations

import argparse
import asyncio
import re
import subprocess
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
SAIDA = AQUI / "saida_v2"

def _padrao(nome):
    """Procura o arquivo ao lado do script e, se não achar, em saida_v2/."""
    return str(AQUI / nome if (AQUI / nome).exists() else SAIDA / nome)


# Como a voz deve falar certas palavras (o texto da legenda não muda).
PRONUNCIA = {
    "IASIS": "Iásis",
    "Iasinho": "Iazinho",
}


def ler_srt(caminho):
    blocos = re.split(r"\n\s*\n", caminho.read_text(encoding="utf-8").strip())
    falas = []
    for b in blocos:
        linhas = b.strip().splitlines()
        if len(linhas) < 3:
            continue
        a, b_ = [_seg(x) for x in linhas[1].split("-->")]
        falas.append((a, b_, " ".join(linhas[2:]).strip()))
    return falas


def _seg(ts):
    h, m, s = ts.strip().replace(",", ".").split(":")
    return int(h) * 3600 + int(m) * 60 + float(s)


def duracao(arq):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
                          str(arq)], capture_output=True, text=True, check=True).stdout
    return float(out.strip())


def para_falar(texto):
    texto = texto.replace("…", ", ").strip(" ,")
    for escrito, falado in PRONUNCIA.items():
        texto = re.sub(rf"\b{escrito}\b", falado, texto)
    return texto


# ─── Motores de voz ─────────────────────────────────────────────────────────
async def _edge(texto, destino, voz, ritmo, tom):
    import edge_tts
    await edge_tts.Communicate(texto, voz, rate=ritmo, pitch=tom).save(str(destino))


def gerar_edge(texto, destino, args):
    mp3 = destino.with_suffix(".mp3")
    asyncio.run(_edge(texto, mp3, args.voz, args.ritmo, args.tom))
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(mp3), "-ar", "48000", "-ac", "1", str(destino)],
                   check=True)
    mp3.unlink()


def gerar_piper(texto, destino, args):
    subprocess.run([sys.executable, "-m", "piper", "--model", args.modelo, "--output_file", str(destino),
                    "--length_scale", str(args.lentidao)], input=texto.encode("utf-8"), check=True)


def gerar_teste(texto, destino, args):
    """Sem voz: um tom com a duração aproximada da fala (só para testar a montagem)."""
    seg = 0.075 * len(texto)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"sine=frequency=440:duration={seg}",
                    "-ar", "48000", "-ac", "1", str(destino)], check=True)


MOTORES = {"edge": gerar_edge, "piper": gerar_piper, "teste": gerar_teste}


# ─── Montagem ───────────────────────────────────────────────────────────────
def main():
    p = argparse.ArgumentParser(description="Narração do vídeo do stand IASIS")
    p.add_argument("--motor", choices=MOTORES, default="edge")
    p.add_argument("--voz", default="pt-BR-FranciscaNeural", help="voz do edge-tts")
    p.add_argument("--ritmo", default="+6%", help="velocidade no edge-tts (ex.: +0%%, +10%%)")
    p.add_argument("--tom", default="+14Hz", help="tom no edge-tts: mais alto = mais fofinho")
    p.add_argument("--modelo", help="arquivo .onnx da voz do Piper")
    p.add_argument("--lentidao", type=float, default=0.95, help="Piper: < 1 fala mais rápido")
    p.add_argument("--fofo", type=float, default=1.0,
                   help="sobe o tom sem mudar a velocidade (1.06 a 1.12 deixa a voz mais de mascote)")
    p.add_argument("--video", default=_padrao("IASIS_video_stand_v2.mp4"))
    p.add_argument("--srt", default=_padrao("legendas.srt"))
    p.add_argument("--musica", help="mp3/wav de fundo opcional (fica baixinho, sem direitos autorais!)")
    args = p.parse_args()
    if args.motor == "piper" and not args.modelo:
        p.error("--motor piper precisa de --modelo arquivo.onnx")

    falas = ler_srt(Path(args.srt))
    destino = Path(args.video).resolve().parent      # tudo sai ao lado do vídeo
    pasta = destino / "voz"
    pasta.mkdir(exist_ok=True)
    total = duracao(args.video)
    entradas, filtros = [], []
    for i, (a, b, texto) in enumerate(falas):
        bruto = pasta / f"{i + 1:02d}_bruto.wav"
        print(f"[{i + 1}/{len(falas)}] {texto}")
        MOTORES[args.motor](para_falar(texto), bruto, args)
        # tempo disponível: até a próxima fala começar (ou o fim do vídeo)
        prox = falas[i + 1][0] if i + 1 < len(falas) else total
        janela = max(prox - a - 0.15, 0.5)
        d = duracao(bruto)
        cadeia = []
        if args.fofo != 1.0:
            cadeia.append(f"asetrate={int(48000 * args.fofo)},aresample=48000,atempo={1 / args.fofo:.4f}")
        if d > janela:
            acel = min(d / janela, 1.35)
            cadeia.append(f"atempo={acel:.3f}")
            if d / janela > 1.35:
                print(f"   aviso: fala {i + 1} ainda passa {d / 1.35 - janela:.1f} s do tempo da cena")
        ms = int(a * 1000)
        cadeia.append(f"adelay={ms}|{ms}")
        entradas += ["-i", str(bruto)]
        filtros.append(f"[{i}:a]{','.join(cadeia)}[v{i}]")
    n = len(falas)
    mix = "".join(f"[v{i}]" for i in range(n)) + f"amix=inputs={n}:normalize=0,apad,atrim=0:{total:.3f}"
    if args.musica:
        entradas += ["-stream_loop", "-1", "-i", args.musica]
        filtros.append(mix + "[voz]")
        filtros.append(f"[{n}:a]volume=0.12,atrim=0:{total:.3f},afade=t=out:st={total - 3:.3f}:d=3[mus]")
        filtros.append("[voz][mus]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5[saida]")
    else:
        filtros.append(mix + ",loudnorm=I=-16:TP=-1.5[saida]")
    narracao = pasta / "narracao.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", *entradas, "-filter_complex", ";".join(filtros),
                    "-map", "[saida]", "-ar", "48000", str(narracao)], check=True)
    final = destino / (Path(args.video).stem + "_narrado.mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", args.video, "-i", str(narracao), "-map", "0:v",
                    "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest",
                    "-movflags", "+faststart", str(final)], check=True)
    print("pronto:", final)


if __name__ == "__main__":
    main()
