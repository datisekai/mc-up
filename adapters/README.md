# adapters/

Hiện thực các port trong `domain/ports.py`. Mỗi vendor một adapter, tiêm vào từ ngoài.

Đã có:
- `asr_whisper.py` / `asr_google.py` / `asr_viettel.py` / `asr_mock.py` — AsrPort, chọn qua `ASR_PROVIDER` (`asr_factory.py`). Sau: `asr_phowhisper.py` self-host.
- `media_local.py` — MediaStore lưu đĩa (volume Docker) + URL ký HMAC. Sau: `media_s3.py` khi scale.
- `content_split_openai.py` / `content_split_mock.py` — tách nội dung bài bằng AI.

Push (Expo Push API) ở `api/app/push.py`; IAP (RevenueCat) ở `api/app/routers/iap.py`.
