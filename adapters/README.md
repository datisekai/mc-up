# adapters/

Hiện thực các port trong `domain/ports.py`. Mỗi vendor một adapter, tiêm vào từ ngoài.

Kế hoạch:
- `asr_whisper.py` — AsrPort qua OpenAI Whisper API (Epic 3). Sau: `asr_phowhisper.py` self-host.
- `media_minio.py` — MediaStore qua MinIO/S3 (AD-4).
- `push_expo.py` — PushPort qua Expo (Epic 4).
- `billing_revenuecat.py` — BillingPort (Epic 5).
- `db_*` — repository PostgreSQL.
