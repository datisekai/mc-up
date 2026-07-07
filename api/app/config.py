from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Mặc định SQLite để "chạy một lần" không cần Docker.
    # Trên VPS: đặt DATABASE_URL=postgresql+asyncpg://... (PostgreSQL).
    database_url: str = "sqlite+aiosqlite:///./mcup_dev.db"
    jwt_secret: str = "doi-secret-that-truoc-khi-deploy"
    app_version: str = "0.1.0"
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
    # Thanh năng lượng (Duolingo-style): max 30, mỗi bài tốn 10 → 3 bài/lần đầy; hồi 1 điểm / 40 phút.
    # (đầy lại toàn bộ sau ~20h; ~1 bài mỗi ~6.7h). Pro = không tiêu năng lượng.
    energy_max: int = 30
    energy_cost: int = 10
    energy_regen_min: int = 40
    guest_per_ip_daily: int = 5      # tài khoản khách mới / IP / ngày
    guest_daily_total: int = 300     # tổng khách mới / ngày (van tổng chống farm)


settings = Settings()
