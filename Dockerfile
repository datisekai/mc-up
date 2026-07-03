# Backend McUp (FastAPI). Build từ thư mục mcup/.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1

WORKDIR /app/mcup

# Cài deps trước để tận dụng cache
COPY api/requirements.txt api/requirements.txt
RUN pip install --no-cache-dir -r api/requirements.txt

# Copy toàn bộ mã (api + domain + adapters + db)
COPY . .

# Chạy từ root mcup/ để api/ adapters/ domain/ import sạch (không sys.path hack)
WORKDIR /app/mcup
EXPOSE 8000

CMD ["uvicorn", "api.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
