# McUp

App luyện MC game-hóa. Kiến trúc theo Architecture Spine (hexagonal + async pipeline).

## Cấu trúc (theo spine)

```
mcup/
  client/     # React Native + Expo (Học viên + chế độ MC)
  api/        # FastAPI — HTTP, auth/role, chấm async, web landing/admin
  domain/     # nghiệp vụ thuần + ports (không phụ thuộc hạ tầng)
  adapters/   # AsrPort→Whisper/Google/Viettel, MediaStore local
  db/         # giáo trình seed (curriculum/*.json) + rubric
  Dockerfile + docker-compose.prod.yml   # deploy VPS (api + postgres, sau nginx)
  deploy.sh / setup-nginx.sh / nginx.conf # deploy 1 lệnh cho mcup.fun
```

## Chạy local (lần đầu)

```bash
# Backend (SQLite mặc định — KHÔNG cần Docker/key gì)
cd api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
./run.sh                      # → http://localhost:8000/health · web thử: /app

# App (Expo) — sửa IP LAN trong client/src/api.ts trước
cd ../client
npm install
npx expo start
```

## Triển khai (VPS + domain mcup.fun)
Xem **[DEPLOY.md](DEPLOY.md)** — `./deploy.sh` (backend Docker, cổng 3011) + `sudo ./setup-nginx.sh` (nginx + HTTPS).
Phát hành iOS/TestFlight: **[client/IOS-RELEASE.md](client/IOS-RELEASE.md)**.

## Env / API keys
Xem **[ENV-SETUP.md](ENV-SETUP.md)** — hướng dẫn lấy từng biến (`OPENAI_API_KEY` cho Whisper, `JWT_SECRET`, RevenueCat...), cần-khi-nào & giá. Demo local **không cần key nào**.

## Conventions (AD)
- id = UUID · thời gian UTC ISO-8601 · lỗi API = `{"error":{"code","message"}}` · log có `traceId` theo request/clip.
- Mọi vendor (ASR/storage/push/payment) sau **port** trong `domain/ports.py` (AD-2).
