# Deploy McUp backend lên VPS

Yêu cầu VPS: đã cài **Docker** + **Docker Compose** (Ubuntu: `curl -fsSL https://get.docker.com | sh`).

## Lần đầu
```bash
git clone <repo-của-bạn> mcup && cd mcup
cp .env.example .env
nano .env            # ĐỔI JWT_SECRET + POSTGRES_PASSWORD; điền OPENAI_API_KEY nếu muốn ASR thật
docker compose -f docker-compose.prod.yml up -d --build
```
→ API chạy ở `http://<IP-VPS>:8000` · kiểm tra: `curl http://localhost:8000/health`

Stack gồm: **api** (FastAPI) + **postgres** + **redis** + **minio** (object storage clip). Postgres/clip/minio đều có volume nên dữ liệu bền qua các lần restart.

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
