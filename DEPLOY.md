# Deploy McUp lên VPS (backend + landing + admin — cùng 1 container)

Backend **tự phục vụ tất cả**: landing (`/`), privacy (`/privacy`), terms (`/terms`),
admin (`/admin-web`), và toàn bộ API. Deploy backend là có luôn cả web.

Yêu cầu VPS: **Docker + Docker Compose** (Ubuntu: `curl -fsSL https://get.docker.com | sh`).

## Lần đầu (khoảng 5 phút)
```bash
git clone git@github.com:datisekai/mc-up.git mcup && cd mcup
cp .env.example .env
nano .env     # BẮT BUỘC đổi:
#   JWT_SECRET       (sinh: python3 -c "import secrets;print(secrets.token_urlsafe(48))")
#   POSTGRES_PASSWORD
#   DEBUG=false
#   OPENAI_API_KEY   (để chấm giọng thật; bỏ trống = chấm giả lập)
#   DOMAIN=api.mcup.vn   (đã trỏ DNS A record về IP VPS)  — HOẶC để DOMAIN=:80 nếu chưa có domain
docker compose -f docker-compose.prod.yml up -d --build
```

**Kiểm tra:**
- Có domain: `https://<DOMAIN>/health` · landing `https://<DOMAIN>/` · admin `https://<DOMAIN>/admin-web`
- Chưa có domain (DOMAIN=:80): `http://<IP-VPS>/health` · `http://<IP-VPS>/` (Caddy phục vụ HTTP cổng 80)

⚠️ **iOS chặn HTTP** — muốn app iPhone gọi được, PHẢI có domain + HTTPS (đặt DOMAIN thật).

Stack (gọn cho VPS yếu): **caddy** (HTTPS tự động) + **api** (FastAPI, chỉ mạng nội bộ) + **postgres**.
Dữ liệu (DB, clip, chứng chỉ HTTPS) đều có volume nên bền qua restart.
*(Redis worker & MinIO/S3 chưa dùng nên đã bỏ cho nhẹ — thêm lại khi scale, xem cuối file.)*

**App mobile trỏ về server:** sửa `API_BASE` trong `client/src/api.ts` thành `https://<DOMAIN>` rồi build lại (EAS).

**Beta hardening có sẵn** (chỉnh trong `.env`): quota 30 lượt chấm/user/ngày ·
5 tài khoản khách/IP/ngày · van tổng 300 khách/ngày · CORS theo `ALLOWED_ORIGINS`.

## Cập nhật khi có code mới
```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

## Lệnh hay dùng
```bash
docker compose -f docker-compose.prod.yml logs -f api    # xem log
docker compose -f docker-compose.prod.yml ps             # trạng thái
docker compose -f docker-compose.prod.yml down           # dừng (giữ dữ liệu)
docker compose -f docker-compose.prod.yml down -v        # dừng + XÓA dữ liệu
```

## Chịu tải trên VPS yếu (đã tích hợp — chỉnh trong .env)
- **`SCORING_CONCURRENCY`** (mặc định 2): số clip chấm ĐỒNG THỜI. Chấm = ffmpeg + Whisper rất nặng
  → giới hạn để spike nhiều user **XẾP HÀNG thay vì làm sập** (client tự hiện "mạng chậm", không mất bài).
  VPS 1 vCPU để **1-2**; 2-4 vCPU tăng dần **3-4**. Đây là nút điều chỉnh quan trọng nhất khi tải cao.
- **`MAX_CLIP_MB`** chặn upload quá lớn · **`CACHE_TTL_SEC`** cache danh sách lộ trình/MC giảm tải DB ·
  **`ASR_TIMEOUT_SEC`** call ASR treo không giữ slot mãi · pool Postgres đã giới hạn (10+20).
- **Nhiều tiến trình web** (VPS ≥ 2 vCPU): sửa CMD Docker thành `uvicorn ... --workers N` (mỗi worker
  có van riêng → concurrency thực = N × SCORING_CONCURRENCY). VPS yếu giữ 1 worker.
- Quá tải kéo dài thật sự → tách **worker chấm riêng qua Redis** (đã có Redis trong compose, hạ tầng sẵn).

## Nên làm cho production thật
- Đặt **Caddy** phía trước để có **HTTPS** (đã cấu hình sẵn — set `DOMAIN` trong .env).
- **`DEBUG=false`** + `JWT_SECRET` mạnh + `ALLOWED_ORIGINS=https://<domain>` trong .env.
- Backup định kỳ volume `pgdata`. Khi schema ổn định → dùng migration (Alembic).
- Backup định kỳ volume `pgdata`.
- Tạo bucket MinIO `mcup-clips` (console `:9001`, user/pass theo `.env`) — hoặc chuyển sang **S3** thật.
- Bảng DB được tạo tự động lúc khởi động (ORM). Khi schema ổn định, chuyển sang migration trong `db/migrations/`.
