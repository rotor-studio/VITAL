#!/usr/bin/env bash
set -euo pipefail

# Activate conda env (defaults to "server") and launch uvicorn dev server.
ENV_NAME=${CONDA_ENV:-server}
HOST=${HOST:-0.0.0.0}
PORT=${PORT:-8000}

if ! command -v conda >/dev/null 2>&1; then
  echo "conda no está en PATH. Carga Conda y vuelve a intentar." >&2
  exit 1
fi

# Load conda into this non-interactive shell, then activate the env.
eval "$(conda shell.bash hook)"
conda activate "$ENV_NAME"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

exec uvicorn app.main:app --reload --host "$HOST" --port "$PORT"
