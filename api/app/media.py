"""Instance MediaStore dùng chung (AD-4). Đổi sang MinIO/S3 khi deploy."""
from adapters.media_local import LocalMediaStore

from .config import settings

media = LocalMediaStore(settings.upload_dir)
