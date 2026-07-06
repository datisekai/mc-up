# Deploy McUp backend lên VPS

Yêu cầu VPS: đã cài **Docker** + **Docker Compose** (Ubuntu: `curl -fsSL https://get.docker.com | sh`).

## Lần đầu
```bash
git clone <repo-của-bạn> mcup && cd mcup
cp .env.example .env
nano .env            # BẮT BUỘC: JWT_SECRET + POSTGRES_PASSWORD + DOMAIN; OPENAI_API_KEY cho ASR thật
docker compose -f docker-compose.prod.yml up -d --build
```
→ Có domain (DNS A record → IP VPS): API tự có **HTTPS** tại `https://<DOMAIN>` (Caddy + Let's Encrypt).
→ Kiểm tra: `curl https://<DOMAIN>/health` · admin: `https://<DOMAIN>/admin-web`

Stack gồm: **caddy** (HTTPS) + **api** (FastAPI, chỉ bind localhost) + **postgres** + **redis** + **minio**.
Postgres/clip/minio/cert đều có volume nên dữ liệu bền qua restart.

**App mobile trỏ về server:** sửa `API_BASE` trong `client/src/api.ts` thành `https://<DOMAIN>` rồi build lại app.

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

## Nên làm cho production thật
- Đặt **Nginx/Caddy** phía trước để có **HTTPS** (Let's Encrypt) và tên miền.
- Đổi CORS trong `api/app/main.py` từ `*` về đúng domain app.
- Backup định kỳ volume `pgdata`.
- Tạo bucket MinIO `mcup-clips` (console `:9001`, user/pass theo `.env`) — hoặc chuyển sang **S3** thật.
- Bảng DB được tạo tự động lúc khởi động (ORM). Khi schema ổn định, chuyển sang migration trong `db/migrations/`.
