#!/usr/bin/env bash
# Smoke-test vòng lặp lõi (chạy khi server đã lên ở :8000).
set -e
B=http://localhost:8000
J() { python3 -c "import sys,json;print(json.load(sys.stdin)$1)"; }

echo "1) Đăng ký"
TOKEN=$(curl -s -X POST $B/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"linh@test.vn","password":"123456","display_name":"Linh"}' | J "['access_token']")

echo "2) Lộ trình"; curl -s $B/lessons -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys,json;[print(' ',x['order_index'],x['title'],'mở=',x['unlocked']) for x in json.load(sys.stdin)[:3]]"

L0=$(curl -s $B/lessons -H "Authorization: Bearer $TOKEN" | J "[0]['id']")
echo "3) Nộp bài"; CID=$(curl -s -X POST $B/practice/submit -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d "{\"lesson_id\":\"$L0\",\"duration_seconds\":30}" | J "['id']")

echo "4) Chấm phần Xác"
for i in $(seq 1 10); do R=$(curl -s $B/clips/$CID -H "Authorization: Bearer $TOKEN"); \
  [ "$(echo "$R" | J "['status']")" = "done" ] && break; done
echo "$R" | python3 -m json.tool --no-ensure-ascii

echo "5) Streak/XP"; curl -s $B/me/progress -H "Authorization: Bearer $TOKEN" | python3 -m json.tool --no-ensure-ascii
