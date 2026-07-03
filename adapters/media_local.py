"""LocalMediaStore — hiện thực MediaStore (AD-4) lưu clip ra đĩa (demo/dev).

Production: đổi sang adapter MinIO/S3 cùng interface, trả URL có ký & hết hạn.
Ở đây trả đường dẫn file cục bộ để pipeline chấm (Whisper) mở được.
"""
from __future__ import annotations

from pathlib import Path


class LocalMediaStore:
    def __init__(self, base_dir: str = "./uploads"):
        self.base = Path(base_dir)
        self.base.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        return self.base / key

    async def put(self, key: str, data: bytes, content_type: str = "audio/m4a") -> str:
        p = self._path(key)
        p.write_bytes(data)
        return str(p)

    async def signed_url(self, key: str, expires_seconds: int = 3600) -> str:
        # Demo: trả đường dẫn cục bộ. Production (MinIO/S3): trả presigned URL.
        return str(self._path(key))

    def local_path(self, key: str) -> str:
        return str(self._path(key))
