# McUp — Hướng dẫn lấy các biến môi trường (.env)

Copy `.env.example` → `.env` rồi điền. **Chạy demo hiện tại KHÔNG cần key nào** (dùng SQLite + ASR giả lập). Bảng dưới cho biết cái nào cần *bây giờ* và cái nào để *sau*.

| Biến | Cần khi nào | Bắt buộc? | Lấy ở đâu (mục dưới) |
|------|-------------|-----------|----------------------|
| `DATABASE_URL` | Ngay (đã có mặc định SQLite) | ✅ (có sẵn) | §1 |
| `JWT_SECRET` | Trước khi cho người thật đăng nhập | ✅ | §2 |
| `OPENAI_API_KEY` | Khi cắm chấm giọng thật (Epic 3) | ⏳ sau | §3 |
| `S3_*` (object storage) | Khi lưu clip thật (Epic 3) | ⏳ sau | §4 |
| `REDIS_URL` | Khi chạy queue Celery thật | ⏳ sau | §5 |
| Expo Push token | Khi làm nhắc streak (Epic 4) | ⏳ sau | §6 |
| RevenueCat key | Khi làm thanh toán (Epic 5) | ⏳ sau | §7 |

---

## §1. `DATABASE_URL` — PostgreSQL

- **Demo (mặc định):** để trống → dùng SQLite (`sqlite+aiosqlite:///./mcup_dev.db`), không cần cài gì.
- **Local giống production:** chạy `docker compose up -d` (đã có sẵn Postgres) rồi đặt:
  ```
  DATABASE_URL=postgresql+asyncpg://mcup:mcup@localhost:5432/mcup
  ```
- **VPS:** sau khi cài PostgreSQL trên VPS, dùng dạng `postgresql+asyncpg://<user>:<pass>@<host>:5432/<db>`. **Không** commit mật khẩu thật vào git.

## §2. `JWT_SECRET` — chuỗi bí mật ký token

Tự sinh, không phải xin ai. Chạy 1 lệnh:
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```
Copy kết quả vào `JWT_SECRET=`. Mỗi môi trường (local/VPS) một secret khác nhau, giữ kín.

## §3. `OPENAI_API_KEY` — Whisper (chấm giọng thật)

Dùng cho ASR chuyển giọng→chữ (thay `MockAsr`). ~**$0.006/phút** audio.

**Các bước:**
1. Vào https://platform.openai.com → đăng ký/đăng nhập.
2. **Billing** → thêm thẻ, nạp một ít credit (vd $5–10 là dư cho thử nghiệm).
3. **API keys** → https://platform.openai.com/api-keys → **Create new secret key** → copy (chỉ hiện 1 lần).
4. Dán vào `OPENAI_API_KEY=sk-...`.

> ⚠️ **Quan trọng cho tiếng Việt:** Whisper **bỏ từ đệm** ("ừm/à/ờ") và chúng trùng từ thật → phần *đếm từ đệm* chưa chắc chính xác. Đây đúng là thứ **POC Story 3.1** phải bench. Cân nhắc thêm lựa chọn tiếng Việt tốt hơn ở §3b.

### §3b. (Tùy chọn) STT chuyên tiếng Việt — để cân nhắc ở POC
- **Google Cloud Speech-to-Text** (`vi-VN`, giữ từ đệm tốt hơn, có word timestamp): https://console.cloud.google.com → tạo project → bật *Speech-to-Text API* → *APIs & Services → Credentials* → tạo API key/service account. Giá ~$0.016/phút.
- **Azure AI Speech** (`vi-VN`): https://portal.azure.com → tạo *Speech* resource → lấy *Key* + *Region*. ~$1/giờ.
- **FPT.AI STT** (chuyên VN, 3 giọng vùng miền): https://fpt.ai → đăng ký → *Speech to Text* → lấy API key. Giá liên hệ sales.
- **Viettel AI STT** (chuyên VN, ~96%): https://viettelgroup.ai → đăng ký (có 60 phút miễn phí) → lấy key.

**Adapter Whisper đã được viết sẵn** (`adapters/asr_whisper.py`) và **tự kích hoạt** khi có `OPENAI_API_KEY`: pipeline chọn Whisper qua `adapters/asr_factory.py`; nếu lỗi/chưa có clip thật thì tự lùi về giả lập (`is_mock=true`), không vỡ. Muốn dùng STT khác (Google/Viettel): viết adapter mới cùng interface `AsrPort` rồi sửa factory — **không đụng domain** (AD-2).

> Bật Whisper: thêm `OPENAI_API_KEY=sk-...` vào `.env` rồi chạy lại. Chấm thật end-to-end còn cần **clip audio thật** (Story 3.2 upload) — hiện demo chưa upload audio nên vẫn lùi về giả lập cho tới khi có.

## §4. `S3_*` — Object storage cho clip (AD-4)

Clip video/giọng là dữ liệu nhạy cảm → lưu ở object storage, dùng URL có ký & hết hạn.

- **Local/VPS tự-host (MinIO — miễn phí):** đã có trong `docker-compose.yml`.
  ```
  S3_ENDPOINT=http://localhost:9000
  S3_BUCKET=mcup-clips
  S3_ACCESS_KEY=mcup
  S3_SECRET_KEY=mcup12345
  ```
  Mở console MinIO http://localhost:9001 (mcup / mcup12345) → tạo bucket `mcup-clips`. Trên VPS: đổi endpoint/khóa cho chắc.
- **Hoặc AWS S3:** https://console.aws.amazon.com/s3 → tạo bucket → IAM tạo user có quyền S3 → lấy *Access key* + *Secret key* → đặt `S3_ENDPOINT` rỗng/khu vực AWS.

## §5. `REDIS_URL` — Queue (Celery)

Demo hiện chạy chấm bằng background task trong tiến trình (không cần Redis). Khi chuyển sang Celery thật:
- Local/VPS: đã có Redis trong `docker-compose.yml` → `REDIS_URL=redis://localhost:6379/0`.

## §6. Expo Push (nhắc streak — Epic 4)

- Không cần API key trả phí. Cần **tài khoản Expo**: https://expo.dev → đăng ký (miễn phí).
- App RN lấy *Expo push token* trên thiết bị; backend gửi qua Expo Push API. Làm khi vào Epic 4.

## §7. RevenueCat (thanh toán freemium — Epic 5)

- https://www.revenuecat.com → đăng ký (có gói miễn phí tới ngưỡng doanh thu).
- Tạo *Project* → *API Keys* (public SDK key cho app, secret key cho server).
- Cần thêm: tài khoản **App Store Connect** (Apple, $99/năm) và **Google Play Console** ($25 một lần) để bán in-app. Làm khi tới Epic 5.

---

## Tóm tắt: để chạy được từng mức
- **Xem demo ngay:** không cần gì (`./run.sh`).
- **Cho người thật đăng nhập:** §2 (JWT) + §1 (Postgres nếu muốn bền).
- **Chấm giọng thật:** §3 (OpenAI) — và nên bench §3b cho tiếng Việt trước.
- **Lưu clip thật:** §4 (MinIO/S3).
- **Đủ MVP:** thêm §5, §6, §7 theo từng epic.

> Nguyên tắc: mọi secret để trong `.env` (đã được `.gitignore` bỏ qua), **không commit lên git**. Trên VPS đặt qua biến môi trường của service, không để lộ.
