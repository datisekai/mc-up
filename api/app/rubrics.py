"""Rubric chấm theo thể loại (FR-15, AD-11).

Rubric = LÕI (mọi thể loại) + MODULE cộng theo Genre. Bộ chấm đọc rubric để đặt
ngưỡng tốc độ nói và sinh gợi ý SÁT NGHỀ (đám cưới cần chậm-ấm, sự kiện cần lửa,
livestream cần bắt tai). Đây là 'rubric as data' — nay là registry theo tên thể
loại; Pha sau admin CRUD sẽ ghi xuống DB mà không đổi hợp đồng hàm chấm.
"""

CORE: dict = {
    "wpm_min": 110,
    "wpm_max": 160,
    "focus": "rõ ràng, tự tin",
    "tips": {
        "fast": "Thử chậm lại một nhịp ở câu mở đầu nhé 👏",
        "slow": "Có thể tăng nhịp một chút cho cuốn hơn nha!",
        "filler": "Bạn đang tiến bộ — để ý bớt từ đệm 'ừm/à' một chút nha!",
        "good": "Giữ nhịp tốt lắm, tiếp tục nào!",
    },
}

# Module cộng theo thể loại — chỉ ghi phần KHÁC lõi (đè lên lõi khi trộn).
MODULES: dict = {
    "MC đám cưới": {
        "wpm_min": 100, "wpm_max": 150,  # cần chậm rãi, ấm, trang trọng
        "focus": "ấm áp, trang trọng, chạm cảm xúc",
        "tips": {
            "fast": "Đám cưới cần sự ấm áp — chậm lại để khách cảm nhận khoảnh khắc thiêng liêng nhé 💍",
            "slow": "Nhịp chậm rãi rất hợp không khí lễ — cứ giữ vậy nha!",
            "filler": "Lời dẫn lễ cưới cần mượt — luyện bỏ 'ừm/à' để câu chúc trọn vẹn hơn.",
            "good": "Giọng ấm, nhịp trang trọng — rất hợp vai MC đám cưới! 💐",
        },
    },
    "MC sự kiện": {
        "wpm_min": 120, "wpm_max": 170,  # cần năng lượng, giữ nhịp sân khấu
        "focus": "năng lượng, cuốn hút, giữ nhịp sân khấu",
        "tips": {
            "fast": "Năng lượng tốt! Nhưng ghìm nhịp ở đoạn giới thiệu để khán giả kịp bắt.",
            "slow": "Sự kiện cần lửa — đẩy nhịp nhanh hơn để giữ năng lượng sân khấu nhé 🔥",
            "filler": "MC sự kiện cần dứt khoát — cắt 'ừm/à' để câu dẫn gọn và chắc.",
            "good": "Nhịp cuốn, đầy năng lượng — chuẩn chất MC sự kiện!",
        },
    },
    "MC livestream": {
        "wpm_min": 130, "wpm_max": 185,  # nhanh, tương tác, giữ người xem
        "focus": "tự nhiên, tương tác, giữ chân người xem",
        "tips": {
            "fast": "Nhanh nhẹn hợp livestream — chỉ cần rõ chữ ở đoạn chốt đơn nhé!",
            "slow": "Livestream cần nhịp bắt tai hơn — tăng tốc chút để người xem không lướt.",
            "filler": "Giảm 'ừm/à' để lời dẫn livestream trôi chảy, giữ chân người xem lâu hơn.",
            "good": "Nhịp tự nhiên, cuốn — người xem sẽ ở lại lâu!",
        },
    },
}


def get_rubric(genre_name: str | None) -> dict:
    """Rubric hiệu lực = CORE trộn MODULE theo thể loại (khớp chính xác rồi khớp mờ)."""
    if not genre_name:
        return CORE
    mod = MODULES.get(genre_name)
    if not mod:
        low = genre_name.lower()
        for k, v in MODULES.items():
            if k.lower() in low or low in k.lower():
                mod = v
                break
    if not mod:
        return CORE
    merged = {**CORE, **mod}
    merged["tips"] = {**CORE["tips"], **mod.get("tips", {})}
    return merged
