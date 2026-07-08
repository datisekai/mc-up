#!/usr/bin/env bash
# McUp — deploy 1 lệnh. Chạy backend (kèm landing/admin) trên cổng APP_PORT trong .env.
# Nginx trên host của bạn reverse-proxy domain → cổng này (xem nginx.conf).
#
#   ./deploy.sh
#
set -euo pipefail
cd "$(dirname "$0")"

COMPOSE="docker compose -f docker-compose.deploy.yml"

# --- 0. Kéo code mới nhất ---
if [ -d .git ]; then
  BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)"
  echo "▶  Kéo code mới nhất (git pull origin ${BRANCH})..."
  BEFORE="$(git rev-parse HEAD 2>/dev/null || echo none)"
  # --ff-only: chỉ tua nhanh, tránh merge/conflict trên VPS (.env đã gitignore nên không đụng)
  if git pull --ff-only origin "$BRANCH"; then
    AFTER="$(git rev-parse HEAD 2>/dev/null || echo none)"
    # Nếu chính deploy.sh vừa được cập nhật → chạy lại bản MỚI cho an toàn
    if [ "$BEFORE" != "$AFTER" ] && [ -z "${MCUP_REEXEC:-}" ]; then
      echo "↻  deploy.sh có bản mới — chạy lại..."
      export MCUP_REEXEC=1
      exec bash "$0" "$@"
    fi
  else
    echo "⚠️  git pull không thành công (mạng / có thay đổi cục bộ) — deploy code hiện tại."
  fi
fi

# --- 1. Kiểm tra .env ---
if [ ! -f .env ]; then
  cp .env.example .env
  echo "⚠️  Chưa có .env — đã tạo từ mẫu."
  echo "   MỞ .env đổi: JWT_SECRET, POSTGRES_PASSWORD, OPENAI_API_KEY, APP_PORT, DEBUG=false"
  echo "   rồi chạy lại ./deploy.sh"
  exit 1
fi

# --- 2. Lấy APP_PORT từ .env (mặc định 3011) ---
APP_PORT="$(grep -E '^APP_PORT=' .env | head -1 | cut -d= -f2- | tr -d '"'"'"' ' || true)"
APP_PORT="${APP_PORT:-3011}"
export APP_PORT

# Cảnh báo nếu quên đổi secret
if grep -q '^JWT_SECRET=doi-secret' .env 2>/dev/null; then
  echo "⚠️  JWT_SECRET vẫn là giá trị mặc định — NÊN đổi trong .env trước khi chạy thật."
fi

# --- 3. Build & chạy ---
echo "▶  Build & chạy McUp trên cổng ${APP_PORT} (chỉ localhost — nginx proxy vào)..."
$COMPOSE up -d --build

# --- 4. Chờ health ---
echo "⏳  Chờ server sẵn sàng..."
for i in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:${APP_PORT}/health" >/dev/null 2>&1; then
    echo ""
    echo "✅  McUp đang chạy tại http://127.0.0.1:${APP_PORT}"
    echo "    • Landing : http://127.0.0.1:${APP_PORT}/"
    echo "    • Admin   : http://127.0.0.1:${APP_PORT}/admin-web"
    echo "    • API     : http://127.0.0.1:${APP_PORT}/health"
    echo ""
    echo "→ Bước cuối: trỏ nginx (domain của bạn) vào cổng ${APP_PORT} — xem nginx.conf"
    exit 0
  fi
  sleep 2
done

echo "⚠️  Server chưa phản hồi sau 80s. Xem log:"
echo "    $COMPOSE logs -f api"
exit 1
