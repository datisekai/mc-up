from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Mặc định SQLite để "chạy một lần" không cần Docker.
    # Trên VPS: đặt DATABASE_URL=postgresql+asyncpg://... (PostgreSQL).
    database_url: str = "sqlite+aiosqlite:///./mcup_dev.db"
    jwt_secret: str = "doi-secret-that-truoc-khi-deploy"
    app_version: str = "0.1.0"
    debug: bool = False              # True chỉ khi dev — prod KHÔNG lộ chi tiết lỗi nội bộ
    # ASR: chọn nhà cung cấp. "auto" = whisper nếu có OPENAI_API_KEY, không thì giả lập.
    asr_provider: str = "auto"  # auto | mock | whisper | google | viettel
    openai_api_key: str = ""
    google_stt_api_key: str = ""     # Google Cloud Speech-to-Text (vi-VN)
    viettel_stt_token: str = ""      # Viettel AI STT

    upload_dir: str = "./uploads"    # nơi LocalMediaStore lưu clip (demo)

    # ===== Beta hardening (nấc 2) =====
    # CORS: dev để "*"; prod đặt ALLOWED_ORIGINS="https://app.mcup.vn" (phẩy nếu nhiều)
    allowed_origins: str = "*"
    # Quota chấm điểm — mỗi lần chấm = 1 call Whisper trả tiền. 0 = không giới hạn.
    daily_clip_limit: int = 30       # lượt nộp bài / user / ngày (trần chống lạm dụng)
    mc_claim_timeout_min: int = 30   # MC nhận vé mà không xét trong X phút → tự nhả cho MC khác
    # ===== Chịu tải trên VPS yếu =====
    # Số clip CHẤM ĐỒNG THỜI. Chấm = ffmpeg (CPU) + Whisper (mạng) — nặng. Spike nhiều user
    # sẽ XẾP HÀNG thay vì làm sập server. VPS yếu để 1-2; mạnh hơn thì tăng.
    scoring_concurrency: int = 2
    asr_timeout_sec: float = 45.0    # timeout gọi ASR — call treo không giữ slot mãi
    max_clip_mb: float = 12.0        # chặn upload clip quá lớn
    cache_ttl_sec: int = 30          # cache đọc nóng (content/paths, mentors) giảm tải DB

    # Thanh năng lượng (Duolingo-style): max 30, mỗi bài tốn 10 → 3 bài/lần đầy.
    # Hồi 1 điểm / 15 phút → ~1 bài mỗi 2.5h, đầy lại toàn bộ sau ~7.5h. Pro = không tiêu.
    # (Chỉnh ENERGY_REGEN_MIN trong .env để nhanh/chậm hơn — nhỏ = hồi nhanh.)
    energy_max: int = 30
    energy_cost: int = 10
    energy_regen_min: int = 15
    guest_per_ip_daily: int = 5      # tài khoản khách mới / IP / ngày
    guest_daily_total: int = 300     # tổng khách mới / ngày (van tổng chống farm)

    # ===== IAP Pro qua RevenueCat =====
    # secret key (v1, dạng "sk_...") để backend GỌI RC REST xác minh entitlement — KHÔNG lộ ra client.
    revenuecat_secret_key: str = ""
    # entitlement id cấu hình trong RevenueCat (khớp client). Mặc định "pro".
    revenuecat_entitlement: str = "pro"
    # token bí mật để xác thực webhook RC (đặt trùng ở RC dashboard → Authorization header).
    revenuecat_webhook_token: str = ""


settings = Settings()
