# Backend McUp (FastAPI). Build từ thư mục mcup/.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1

# ffmpeg BẮT BUỘC: scoring._rms_volume decode audio đo âm lượng thật (FR-13)
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app/mcup

# Cài deps trước để tận dụng cache
COPY api/requirements.txt api/requirements.txt
RUN pip install --no-cache-dir -r api/requirements.txt

# CHỈ copy phần backend/web cần lúc runtime — client (app mobile) deploy RIÊNG qua EAS,
# đổi code client không đụng image này.
COPY api/ api/
COPY adapters/ adapters/
COPY domain/ domain/
COPY db/ db/

# Chạy từ root mcup/ để api/ adapters/ domain/ import sạch (không sys.path hack)
WORKDIR /app/mcup
EXPOSE 8000

CMD ["uvicorn", "api.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
