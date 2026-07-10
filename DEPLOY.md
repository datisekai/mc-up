# Deploy McUp lên VPS (backend + landing + admin — cùng 1 container)

> File này là pipeline **WEB + BACKEND** (VPS). Pipeline **APP mobile** tách riêng:
> `client/release-ios.sh` (EAS → TestFlight) — xem `client/IOS-RELEASE.md`. Hai bên độc lập:
> đổi client không cần đụng VPS, đổi backend không cần build lại app (trừ khi đổi API contract).

Backend **tự phục vụ tất cả**: landing (`/`), privacy (`/privacy`), terms (`/terms`),
admin (`/admin-web`), và toàn bộ API. Deploy backend là có luôn cả web.

Stack: **nginx trên host** (SSL, cổng 80/443) → **api** (FastAPI, Docker, bind `127.0.0.1:3011`) + **postgres**.
Yêu cầu VPS: **Docker + Docker Compose** (Ubuntu: `curl -fsSL https://get.docker.com | sh`).

## Lần đầu — domain mcup.fun (khoảng 5 phút)
Trỏ DNS trước: A record `mcup.fun` (và `www`) → IP VPS.
```bash
git clone git@github.com:datisekai/mc-up.git mcup && cd mcup
cp .env.example .env
nano .env     # BẮT BUỘC đổi:
#   JWT_SECRET       (sinh: python3 -c "import secrets;print(secrets.token_urlsafe(48))")
#   POSTGRES_PASSWORD
#   OPENAI_API_KEY   (để chấm giọng thật; bỏ trống = chấm giả lập)
./deploy.sh              # backend chạy ở 127.0.0.1:3011 (APP_PORT trong .env)
sudo ./setup-nginx.sh    # nginx proxy mcup.fun → 3011 + certbot HTTPS (1 lệnh)
```

**Kiểm tra:** `https://mcup.fun/health` · landing `https://mcup.fun/` · admin `https://mcup.fun/admin-web`

⚠️ **iOS chặn HTTP** — app iPhone chỉ gọi được qua HTTPS (setup-nginx.sh đã lo, kèm redirect 80→443).

**App mobile:** `client/src/api.ts` đã trỏ sẵn production → `https://mcup.fun` (bản build EAS tự dùng).

**Beta hardening có sẵn** (chỉnh trong `.env`): quota 30 lượt chấm/user/ngày ·
5 tài khoản khách/IP/ngày · van tổng 300 khách/ngày · CORS theo `ALLOWED_ORIGINS`.

## Cập nhật khi có code mới
```bash
./deploy.sh          # tự git pull + build lại + chạy — 1 lệnh
```
Đổi schema DB (thêm cột/bảng) **tự nâng cấp bằng Alembic lúc khởi động, KHÔNG mất dữ liệu**
(migration trong `api/migrations/`; DB đời cũ được tự "stamp" baseline lần đầu).
Khi dev đổi `models.py` → sinh migration mới:
`PYTHONPATH=. api/.venv/bin/alembic -c api/alembic.ini revision --autogenerate -m "mô tả"` rồi commit.

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

## Nên làm cho production thật
- `JWT_SECRET` mạnh + `ALLOWED_ORIGINS=https://mcup.fun` trong .env (`DEBUG=false` là mặc định).
- Backup định kỳ volume `pgdata` (DB) + `clipdata` (clip giọng).
- Khi scale lớn: tách worker chấm riêng (Redis queue) + chuyển clip sang S3 — hạ tầng hiện tại chưa cần.
