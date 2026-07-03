# McUp

App luyện MC game-hóa. Scaffold Story 1.1 — nền dự án theo Architecture Spine (hexagonal + async pipeline).

## Cấu trúc (theo spine)

```
mcup/
  client/     # React Native + Expo (Học viên + chế độ MC)
  api/        # FastAPI — cổng HTTP, auth/role, enqueue job
  domain/     # nghiệp vụ thuần + ports (không phụ thuộc hạ tầng)
  adapters/   # AsrPort→Whisper, MediaStore, PushPort, BillingPort, DB
  workers/    # pipeline: DSP âm lượng/tốc độ, gọi ASR, đếm từ đệm
  db/         # migrations SQL (PostgreSQL)
  docker-compose.yml  # hạ tầng local: PostgreSQL + Redis + MinIO
```

## Chạy local (lần đầu)

```bash
cp .env.example .env            # điền secret

# 1) Hạ tầng (Postgres + Redis + MinIO)
docker compose up -d
psql "$DATABASE_URL" -f db/migrations/0001_init.sql   # hoặc dùng công cụ migrate

# 2) Backend (FastAPI)
cd api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# → http://localhost:8000/health

# 3) App (Expo)
cd ../client
npm install
npx expo start
```

## Triển khai
Backend + PostgreSQL + Redis + workers + object storage tự-host trên **VPS** (xem Architecture Spine, mục Stack & Deferred).

## Env / API keys
Xem **[ENV-SETUP.md](ENV-SETUP.md)** — hướng dẫn lấy từng biến (`OPENAI_API_KEY` cho Whisper, `S3_*`, `JWT_SECRET`...), cần-khi-nào & giá. Demo hiện tại **không cần key nào**.

## Conventions (AD)
- id = UUID · thời gian UTC ISO-8601 · lỗi API = `{"error":{"code","message"}}` · log có `traceId` theo request/clip.
- Mọi vendor (ASR/storage/push/payment) sau **port** trong `domain/ports.py` (AD-2).
