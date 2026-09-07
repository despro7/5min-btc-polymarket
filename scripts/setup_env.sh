#!/usr/bin/env bash
# Idempotent development environment bootstrap for the 5min BTC Polymarket skill.
# Creates a local .venv and installs Python dependencies from requirements.txt.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# The default image ships python3 but may lack the venv/ensurepip toolchain.
if ! python3 -c "import ensurepip" >/dev/null 2>&1; then
  if command -v sudo >/dev/null 2>&1; then
    sudo apt-get update -qq
    sudo apt-get install -y -qq python3-venv python3-pip
  else
    apt-get update -qq
    apt-get install -y -qq python3-venv python3-pip
  fi
fi

if [[ ! -x ".venv/bin/python" ]]; then
  python3 -m venv .venv
fi

.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements.txt

echo "Environment ready. Run scripts with .venv/bin/python (see README.md)."
