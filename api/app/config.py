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


settings = Settings()
