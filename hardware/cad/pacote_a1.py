"""
Monta o pacote de impressão para a Bambu Lab A1 (volume 256 × 256 × 256 mm).

    python hardware/cad/pacote_a1.py [destino.zip]

Rode depois de dispenser.py. Usa só as peças de saida/imprimir_dividido (o corpo
inteiro tem 280 mm de altura e não cabe na A1), confere se cada mesa cabe no
volume da impressora e numera os arquivos na ordem de impressão.
"""
from __future__ import annotations

import sys
import zipfile
from pathlib import Path

import trimesh

AQUI = Path(__file__).resolve().parent
SAIDA = AQUI / "saida"
VOLUME_A1 = (256.0, 256.0, 256.0)
MARGEM = 4.0             # mm livres em volta de cada peça na mesa
DENSIDADE_PLA = 1.24     # g/cm³

# mesa: [(arquivo, cópias, camada, paredes, preenchimento, suporte)]
MESAS = [
    ("mecanismo: disco e calha", [("disco", 1, 0.20, 3, 0.20, "não"),
                                  ("calha", 1, 0.20, 3, 0.10, "não")]),
    ("mecanismo: prateleira", [("prateleira", 1, 0.20, 3, 0.15, "não")]),
    ("portinha e painéis", [("portinha", 1, 0.20, 3, 0.15, "não"),
                            ("painel_eletronica_x2", 2, 0.20, 2, 0.15, "não")]),
    ("tampa", [("tampa", 1, 0.20, 3, 0.10, "não")]),
    ("corpo: frente de baixo", [("corpo_frente_baixo", 1, 0.24, 2, 0.10, "SIM, só na janela de baixo")]),
    ("corpo: frente de cima", [("corpo_frente_cima", 1, 0.24, 2, 0.10, "não")]),
    ("corpo: trás de baixo", [("corpo_tras_baixo", 1, 0.24, 2, 0.10, "não")]),
    ("corpo: trás de cima", [("corpo_tras_cima", 1, 0.24, 2, 0.10, "não")]),
]


def gramas(m: trimesh.Trimesh, preenchimento: float, paredes: int) -> float:
    volume = m.volume / 1000
    casca = min(volume, m.area * 0.04 * paredes / 100)
    return (casca + (volume - casca) * preenchimento) * DENSIDADE_PLA


def cabe_na_mesa(pecas):
    """Arruma as peças em fileiras (da maior para a menor) e diz se cabem em 256 × 256."""
    caixas = sorted(((m.extents[0], m.extents[1]) for m, _ in pecas), key=lambda e: -e[1])
    x = y = altura_fileira = 0.0
    for w, d in caixas:
        if x + w > VOLUME_A1[0] - MARGEM:
            x, y = 0.0, y + altura_fileira + MARGEM
            altura_fileira = 0.0
        x += w + MARGEM
        altura_fileira = max(altura_fileira, d)
    return y + altura_fileira <= VOLUME_A1[1] - MARGEM


def main():
    destino = Path(sys.argv[1]) if len(sys.argv) > 1 else AQUI / "IASIS_Bambu_A1.zip"
    origem = SAIDA / "imprimir_dividido"
    linhas, total, ok = [], 0.0, True
    arquivos = []
    for i, (titulo, itens) in enumerate(MESAS, 1):
        pecas = []
        for nome, copias, camada, paredes, preench, suporte in itens:
            m = trimesh.load(origem / f"{nome}.stl", force="mesh")
            e = m.extents
            cabe = all(e[k] <= VOLUME_A1[k] - MARGEM for k in range(3)) and m.is_watertight
            ok &= cabe
            g = gramas(m, preench, paredes) * copias
            total += g
            pecas += [(m, nome)] * copias
            arq = f"mesa{i}_{nome}.stl"
            arquivos.append((origem / f"{nome}.stl", arq))
            linhas.append(f"  {i}   {arq:34s} {copias:>2}x  {e[0]:4.0f} x {e[1]:4.0f} x {e[2]:4.0f} mm  "
                          f"{camada:.2f} mm  {paredes} paredes  {preench * 100:3.0f} %  ~{g:4.0f} g  "
                          f"suporte: {suporte}{'' if cabe else '   ✗ NÃO CABE'}")
        mesa_ok = cabe_na_mesa(pecas)
        ok &= mesa_ok
        print(f"mesa {i} ({titulo}): {'cabe' if mesa_ok else '✗ não cabe'} na A1")
    if not ok:
        sys.exit("Alguma peça ou mesa não cabe na A1: nada foi empacotado.")

    texto = LEIA_ME.format(tabela="\n".join(linhas), total=total, horas=total / 60)
    with zipfile.ZipFile(destino, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("IASIS_Bambu_A1/LEIA-ME.txt", texto)
        for f, arq in arquivos:
            z.write(f, f"IASIS_Bambu_A1/{arq}")
        for f in sorted((SAIDA / "corpo_de_prova").glob("*.stl")):
            z.write(f, f"IASIS_Bambu_A1/testes_opcionais/{f.name}")
        for f in sorted((SAIDA / "previas").glob("*.png")):
            z.write(f, f"IASIS_Bambu_A1/imagens/{f.name}")
    print(destino)


LEIA_ME = """IASIS — ARQUIVOS PARA A BAMBU LAB A1 (volume 256 x 256 x 256 mm)
=================================================================

TODAS as peças deste pacote cabem na A1 (conferido: a maior tem
200 x 200 mm de base e 145 mm de altura). O corpo vem em 4 partes porque,
inteiro, ele tem 280 mm de altura.

COMO ABRIR
----------
1. DESCOMPACTE o zip primeiro (o Bambu Studio não abre o .zip direto).
2. No Bambu Studio: Arquivo > Importar > Importar 3MF/STL...
3. Importe só os arquivos de UMA mesa por vez (todos que começam com o
   mesmo "mesaN_"). Se perguntar sobre unidade ou escala, responda NÃO:
   os arquivos já estão em milímetros.
4. Aperte "A" (Organizar) e depois "Fatiar".
   NÃO gire nem redimensione: as peças já estão na posição de impressão.

CONFIGURAÇÃO (PLA)
------------------
  Impressora ....... Bambu Lab A1, bico 0,4 mm
  Filamento ........ PLA (Bambu PLA Basic ou outro PLA). Não use PETG.
  Bico ............. 220 °C
  Mesa ............. 60 °C (placa texturizada PEI)
  Ventoinha ........ 100 %
  Velocidade ....... padrão do perfil
  Escala ........... 100 %
  Calibração ....... deixe marcados "Flow dynamics calibration" e
                     "Bed leveling" (auto)
  Suporte .......... SÓ na mesa 5 (corpo_frente_baixo): tipo árvore (tree),
                     "apenas na mesa" (on build plate only). Nas outras, desligado.

PEÇAS, NA ORDEM DE IMPRESSÃO
----------------------------
  Mesa  arquivo                           qtd  tamanho              camada   paredes  preench.  filamento
{tabela}

  TOTAL: ~{total:.0f} g de PLA (tenham 2 rolos) · ~{horas:.0f} h na A1, somando tudo.
  O Bambu Studio mostra o tempo e o peso exatos de cada mesa.

Por que essa ordem: as mesas 1 a 4 são o mecanismo e a tampa (peças menores,
dá para testar o motor e o disco enquanto o corpo imprime).

DICAS
-----
  - Lave a placa PEI com água e detergente antes. Não precisa de cola.
  - Mesa 3: os painéis são 2 cópias do mesmo arquivo. No Bambu Studio,
    clique com o botão direito no painel > "Adicionar instância" (ou "+").
  - Se algum encaixe ficar apertado (disco no eixo ou portinha), avise:
    a folga é um número no script e o arquivo sai de novo em segundos.

TESTES OPCIONAIS (testes_opcionais/)
------------------------------------
Pedaços pequenos para testar encaixes antes das peças grandes. Com pressa,
pode pular: as folgas já foram deixadas maiores.

IMAGENS (imagens/)
------------------
Vistas da montagem, do interior e da versão dividida, para referência.
"""


if __name__ == "__main__":
    main()
