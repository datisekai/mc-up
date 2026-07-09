#!/usr/bin/env bash
# McUp — deploy APP iOS bằng 1 lệnh (build cloud EAS + tự submit lên TestFlight).
# Pipeline app TÁCH BIỆT backend: backend/web = ../deploy.sh trên VPS, app = script này.
#
#   ./release-ios.sh          # build production (env ép https://mcup.fun trong eas.json) + submit
#   ./release-ios.sh --ota    # chỉ đẩy bản vá JS qua EAS Update (không cần build/review lại)
#
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v eas >/dev/null 2>&1; then
  echo "⚠️  Chưa có eas-cli:  npm i -g eas-cli  rồi  eas login"
  exit 1
fi

if [ "${1:-}" = "--ota" ]; then
  # Chỉ đổi code JS/TS (không thêm thư viện native, không đổi app.json native config)
  # → đẩy thẳng tới máy user qua EAS Update, vài phút là nhận.
  echo "▶  Đẩy bản vá OTA lên channel production..."
  eas update --channel production --message "$(git log -1 --pretty=%s)"
  exit 0
fi

echo "▶  Build iOS production (API = https://mcup.fun, khoá trong eas.json) + submit TestFlight..."
eas build --platform ios --profile production --auto-submit
echo ""
echo "✅  Xong phần đẩy — chờ Apple process (~15-60 phút) rồi build hiện trong TestFlight."
echo "    Đổi native/thư viện mới → PHẢI build lại (script này)."
echo "    Chỉ sửa JS/TS → lần sau dùng:  ./release-ios.sh --ota  (nhanh, không cần review)"
