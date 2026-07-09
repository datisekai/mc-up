# McUp — Hướng dẫn lấy các biến môi trường (.env)

Copy `.env.example` → `.env` rồi điền. **Chạy demo hiện tại KHÔNG cần key nào** (dùng SQLite + ASR giả lập). Bảng dưới cho biết cái nào cần *bây giờ* và cái nào để *sau*.

| Biến | Cần khi nào | Bắt buộc? | Lấy ở đâu (mục dưới) |
|------|-------------|-----------|----------------------|
| `DATABASE_URL` | Ngay (đã có mặc định SQLite) | ✅ (có sẵn) | §1 |
| `JWT_SECRET` | Trước khi cho người thật đăng nhập | ✅ | §2 |
| `OPENAI_API_KEY` | Khi cắm chấm giọng thật (Epic 3) | ⏳ sau | §3 |
| Expo Push (projectId) | Push "MC đã nhận xét" — ĐÃ cắm | ✅ (có sẵn) | §6 |
| RevenueCat key | Khi bật bán gói Pro (IAP) | ⏳ sau | §7 |

---

## §1. `DATABASE_URL` — PostgreSQL

- **Demo (mặc định):** để trống → dùng SQLite (`sqlite+aiosqlite:///./mcup_dev.db`), không cần cài gì.
- **VPS:** `docker-compose.prod.yml` **tự set** DATABASE_URL trỏ tới service postgres trong compose — chỉ cần đặt `POSTGRES_PASSWORD` trong `.env`. **Không** commit mật khẩu thật vào git.

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

## §6. Expo Push — ĐÃ cắm xong

- Không cần API key trả phí. Push đi qua **Expo Push API** (backend `api/app/push.py`),
  token thiết bị lấy bằng `expo-notifications` (`client/src/push.ts`) — projectId đã gắn trong `app.json`.
- Chạy tự động khi user cấp quyền thông báo. Không có biến .env nào cần điền.

## §7. RevenueCat (bán gói Pro — IAP)

- https://www.revenuecat.com → đăng ký (miễn phí tới ngưỡng doanh thu).
- Tạo *Project* → *API Keys*: **public SDK key** (`appl_...`) dán vào `client/app.json → extra.revenuecat.iosKey`;
  **secret key** (`sk_...`) đặt `REVENUECAT_SECRET_KEY` trong `.env` server.
- Cần tài khoản **App Store Connect** (Apple, $99/năm — ĐÃ có) / **Google Play Console** ($25 một lần).
- Từng bước chi tiết: xem `client/IOS-RELEASE.md` §4. Để trống key = nút Pro hiện "sắp mở", app vẫn chạy.

> Clip giọng lưu trên đĩa VPS qua `LocalMediaStore` (volume `clipdata`, URL có ký HMAC + hết hạn).
> Khi scale lớn mới cần chuyển S3 — hiện không cần cấu hình gì.

---

## Tóm tắt: để chạy được từng mức
- **Xem demo ngay:** không cần gì (`./run.sh`).
- **Cho người thật đăng nhập:** §2 (JWT) — VPS thêm `POSTGRES_PASSWORD` (§1).
- **Chấm giọng thật:** §3 (OpenAI) — và nên bench §3b cho tiếng Việt trước.
- **Bán gói Pro:** §7 (RevenueCat).

> Nguyên tắc: mọi secret để trong `.env` (đã được `.gitignore` bỏ qua), **không commit lên git**. Trên VPS đặt qua biến môi trường của service, không để lộ.
