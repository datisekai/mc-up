#!/usr/bin/env bash
# McUp — cài nginx cho mcup.fun bằng 1 lệnh (chạy TRÊN VPS, sau khi ./deploy.sh đã chạy):
#
#   sudo ./setup-nginx.sh
#
# Làm gì: copy nginx.conf → sites-available/mcup (tự sửa cổng theo APP_PORT trong .env)
#         → enable → nginx -t → reload → chạy certbot lấy HTTPS (tự cài nếu thiếu).
set -euo pipefail
cd "$(dirname "$0")"

DOMAIN="mcup.fun"
SITE="/etc/nginx/sites-available/mcup"

if [ "$(id -u)" -ne 0 ]; then
  echo "⚠️  Cần quyền root: sudo ./setup-nginx.sh"
  exit 1
fi
if ! command -v nginx >/dev/null 2>&1; then
  echo "▶  Chưa có nginx — cài..."
  apt-get update -qq && apt-get install -y -qq nginx
fi

# --- Cổng backend: đọc APP_PORT từ .env (khớp deploy.sh) ---
APP_PORT="3011"
if [ -f .env ]; then
  P="$(grep -E '^APP_PORT=' .env | head -1 | cut -d= -f2- | tr -d '"'"'"' ' || true)"
  APP_PORT="${P:-3011}"
fi

# --- Copy config + sửa cổng cho đúng ---
cp nginx.conf "$SITE"
sed -i "s|proxy_pass http://127.0.0.1:[0-9]*|proxy_pass http://127.0.0.1:${APP_PORT}|" "$SITE"
ln -sf "$SITE" /etc/nginx/sites-enabled/mcup
# tắt trang default của nginx để không nuốt request domain
rm -f /etc/nginx/sites-enabled/default

echo "▶  Kiểm tra cấu hình nginx..."
nginx -t
systemctl reload nginx
echo "✅  nginx đang proxy ${DOMAIN} → 127.0.0.1:${APP_PORT}"

# --- Kiểm tra backend sống ---
if ! curl -fsS "http://127.0.0.1:${APP_PORT}/health" >/dev/null 2>&1; then
  echo "⚠️  Backend chưa chạy ở cổng ${APP_PORT} — chạy ./deploy.sh trước rồi chạy lại script này."
fi

# --- HTTPS bằng certbot (iOS BẮT BUỘC HTTPS) ---
if ! command -v certbot >/dev/null 2>&1; then
  echo "▶  Chưa có certbot — cài..."
  apt-get install -y -qq certbot python3-certbot-nginx
fi
echo "▶  Lấy chứng chỉ HTTPS cho ${DOMAIN} (cần DNS A record đã trỏ về IP máy này)..."
if certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --redirect \
    --non-interactive --agree-tos --register-unsafely-without-email 2>/dev/null \
   || certbot --nginx -d "$DOMAIN" --redirect \
    --non-interactive --agree-tos --register-unsafely-without-email; then
  echo ""
  echo "✅  XONG! Kiểm tra:"
  echo "    • https://${DOMAIN}/health     → {\"status\":\"ok\"}"
  echo "    • https://${DOMAIN}/           → landing"
  echo "    • https://${DOMAIN}/admin-web  → admin"
else
  echo ""
  echo "⚠️  Certbot chưa lấy được chứng chỉ. Nguyên nhân hay gặp:"
  echo "    - DNS chưa trỏ: tạo A record ${DOMAIN} (và www) → IP VPS này, chờ vài phút."
  echo "    - Cổng 80 bị firewall chặn: mở bằng  ufw allow 80,443/tcp"
  echo "    Rồi chạy lại:  sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} --redirect"
fi
