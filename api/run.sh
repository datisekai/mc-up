#!/usr/bin/env bash
# Chạy backend McUp một phát. Mặc định SQLite (không cần Docker).
set -e
cd "$(dirname "$0")"          # mcup/api
[ -d .venv ] || python3 -m venv .venv
source .venv/bin/activate
pip install -q -r requirements.txt
cd ..                         # mcup/ (root) — để api/ adapters/ domain/ import sạch, không sys.path hack
echo "→ http://localhost:8000/health   (Ctrl+C để dừng)"
# --host 0.0.0.0 để điện thoại (Expo Go) trong cùng mạng LAN gọi được
uvicorn api.app.main:app --reload --host 0.0.0.0 --port 8000
