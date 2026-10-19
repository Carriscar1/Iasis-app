#!/usr/bin/env bash
# Prepara o ambiente Python da skill iasis-cad (uma vez por máquina).
# Uso:  source .claude/skills/iasis-cad/scripts/setup.sh
# Depois disso, "$IASIS_CAD_PY" é o python com tudo instalado.
set -e
VENV="${IASIS_CAD_VENV:-$HOME/.cache/iasis-cad/venv}"
if [ ! -x "$VENV/bin/python" ]; then
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install -q --upgrade pip
  "$VENV/bin/pip" install -q "trimesh>=4.4" "manifold3d>=2.5" "shapely>=2.0" numpy scipy \
    matplotlib svgelements rtree networkx
fi
export IASIS_CAD_PY="$VENV/bin/python"
"$IASIS_CAD_PY" -c "import trimesh, manifold3d, shapely, svgelements; print('iasis-cad pronto:', trimesh.__version__)"
