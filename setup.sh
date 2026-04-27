#!/bin/bash
# setup.sh — Bootstrap a bare machine to run WaterF with Docker.
#
# After this script completes, run:
#   make up            # build and start all services
#   make import-forecast  # load forecast data into DB
#
# Usage: bash setup.sh

set -e

echo "=============================="
echo " WaterF Setup"
echo "=============================="

# ── 1. Docker ─────────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo ""
  echo "[1/4] Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
else
  echo "[1/4] Docker already installed — $(docker --version)"
fi

# ── 2. Docker Compose ─────────────────────────────────────────────────────────
if ! docker compose version &>/dev/null 2>&1; then
  echo ""
  echo "[2/4] Installing Docker Compose plugin..."
  COMPOSE_VERSION=$(curl -fsSL https://api.github.com/repos/docker/compose/releases/latest \
    | grep '"tag_name"' | sed -E 's/.*"v([^"]+)".*/\1/')
  ARCH=$(uname -m)
  sudo mkdir -p /usr/local/lib/docker/cli-plugins
  sudo curl -fsSL "https://github.com/docker/compose/releases/download/v${COMPOSE_VERSION}/docker-compose-linux-${ARCH}" \
    -o /usr/local/lib/docker/cli-plugins/docker-compose
  sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
  echo "  ✓ Docker Compose v${COMPOSE_VERSION} installed"
else
  echo "[2/4] Docker Compose already installed — $(docker compose version)"
fi

# ── 3. Python3 + psycopg2-binary (for make import-forecast) ──────────────────
echo ""
echo "[3/4] Setting up Python3 and psycopg2-binary..."
if ! command -v python3 &>/dev/null; then
  if command -v apt-get &>/dev/null; then
    apt-get update -q && apt-get install -y -q python3 python3-pip
  elif command -v yum &>/dev/null; then
    yum install -y python3 python3-pip
  elif command -v dnf &>/dev/null; then
    dnf install -y python3 python3-pip
  fi
fi

if ! python3 -m pip --version &>/dev/null 2>&1; then
  curl -sS https://bootstrap.pypa.io/get-pip.py | python3
fi

python3 -m pip install psycopg2-binary -q --break-system-packages 2>/dev/null || python3 -m pip install psycopg2-binary -q
echo "  ✓ psycopg2-binary ready"

# ── 4. Environment file ───────────────────────────────────────────────────────
echo ""
echo "[4/4] Setting up .env..."
if [ ! -f .env ]; then
  cp .env.docker .env
  echo "  ✓ .env created from .env.docker"
else
  echo "  .env already exists — skipping (edit manually if needed)"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "=============================="
echo " Setup complete."
echo ""
echo " Next steps:"
echo "   make up              # build images and start all services"
echo "   make import-forecast # load forecast data into DB"
echo "   make allow-remote-db # allow 192.168.12.0/24 to connect to DB (run once, for waterBalanceScript machine)"
echo "=============================="
