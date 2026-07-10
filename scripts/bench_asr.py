#!/usr/bin/env python3
"""Bench ASR tiếng Việt: whisper-1 vs gpt-4o-mini-transcribe trên clip thật.

Chạy trên máy có OPENAI_API_KEY (đọc từ mcup/.env hoặc env):
    cd mcup && PYTHONPATH=. api/.venv/bin/python scripts/bench_asr.py uploads/*.m4a
    # hoặc trên VPS: docker compose -f docker-compose.prod.yml exec api \
    #   python scripts/bench_asr.py /data/uploads/<file>.m4a

In transcript 2 model cạnh nhau — nghe clip rồi tự chấm model nào đúng lời hơn.
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

MODELS = ["whisper-1", "gpt-4o-mini-transcribe"]


async def main(paths: list[str]) -> None:
    from api.app.config import settings
    from adapters.asr_whisper import WhisperAsr

    key = settings.openai_api_key or os.environ.get("OPENAI_API_KEY", "")
    if not key:
        print("Thiếu OPENAI_API_KEY (điền .env hoặc export)"); return
    for p in paths:
        if not os.path.exists(p):
            print(f"⚠️  bỏ qua {p} (không thấy file)"); continue
        print(f"\n{'='*70}\n🎧 {p}")
        for m in MODELS:
            try:
                r = await WhisperAsr(key, model=m)._call(p, "vi", m)
                print(f"\n[{m}] ({len(r.words)} word-timestamps)")
                print(f"  {r.text}")
            except Exception as e:
                print(f"\n[{m}] LỖI: {e}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    asyncio.run(main(sys.argv[1:]))
