# workers/

Pipeline xử lý media bất đồng bộ (AD-1) — Celery trên Redis.

Kế hoạch (Epic 3):
- nhận Job từ queue khi clip được nộp
- DSP: âm lượng (RMS), tốc độ (word_count/thời lượng) — `librosa`
- gọi `AsrPort` để lấy transcript + timestamps
- đếm từ đệm (cách chốt ở POC Story 3.1)
- ghi kết quả vào một `Score` duy nhất của clip (AD-5), đẩy về client
