"""Nhận diện hiển thị theo thể loại (Pha C) — màu nhấn + tagline cho pill chọn lộ trình.

Registry theo tên thể loại (không đổi schema); app dùng để mỗi thể loại một vẻ.
Pha sau admin CRUD sẽ ghi xuống DB mà không đổi hợp đồng API.
"""

GENRE_META: dict = {
    "kỹ năng nói": {"color": "#FF6B5B", "tagline": "Nền tảng nói tự tin"},
    "MC đám cưới": {"color": "#E86A92", "tagline": "Ấm áp, trang trọng"},
    "MC sự kiện": {"color": "#FF8A3D", "tagline": "Năng lượng sân khấu"},
    "MC livestream": {"color": "#7B61FF", "tagline": "Bắt tai, giữ người xem"},
}
_DEFAULT = {"color": "#FFC24B", "tagline": ""}


def meta_for(genre_name: str | None) -> dict:
    if not genre_name:
        return _DEFAULT
    m = GENRE_META.get(genre_name)
    if m:
        return m
    low = genre_name.lower()
    for k, v in GENRE_META.items():  # khớp mờ theo từ khóa
        if k.lower() in low or low in k.lower():
            return v
    return _DEFAULT
