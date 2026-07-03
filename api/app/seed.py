"""Seed lộ trình 10 buổi (rút gọn từ giáo trình). Chạy khi khởi động nếu bảng rỗng."""
from sqlalchemy import select

from .db import SessionLocal
from .models import Lesson, Progress, User
from .security import hash_password

# (buổi, tiêu đề, mẹo, đề thực hành)
_LESSONS = [
    (1, "Vượt sợ nói", "Người nói tự tin = chuẩn bị + luyện tập + tư duy tích cực.", "Giới thiệu bản thân trong 1 phút: Tôi là ai, điều tôi tự hào nhất."),
    (2, "Luyện giọng: âm lượng", "Lấy hơi bằng bụng, mở khẩu hình, nói đủ to rõ.", "Đọc một đoạn tin tức, giữ âm lượng đều."),
    (2, "Luyện giọng: tốc độ & ngữ điệu", "4 yếu tố: âm lượng, tốc độ, ngữ điệu, điểm nhấn.", "Kể một câu chuyện ngắn với nhiều cảm xúc."),
    (3, "Ngôn ngữ cơ thể", "55% thông điệp đến từ cơ thể. Tránh khoanh tay, cúi mặt, lắc lư.", "Nói về người bạn yêu quý nhất, giữ giao tiếp bằng mắt."),
    (4, "Bài nói có cấu trúc (PREP)", "Point - Reason - Example - Point.", "Trình bày về một thói quen tốt theo cấu trúc PREP."),
    (5, "Chia sẻ quan điểm", "Phân biệt ý kiến - sự thật - cảm xúc.", "Học online hay offline tốt hơn? Trình bày 2 phút."),
    (6, "Tư duy phản biện", "5 câu hỏi: bằng chứng? nguồn? góc khác? bỏ sót gì? nếu ngược lại?", "Phân tích một mẩu quảng cáo bằng 5 câu hỏi phản biện."),
    (7, "Phản hồi & đặt câu hỏi", "Câu hỏi: mở, đóng, làm rõ, phản biện.", "Nghe một quan điểm rồi đặt 1 câu hỏi làm rõ + 1 phản biện."),
    (8, "Tranh biện cơ bản", "Luận điểm - Lý do - Dẫn chứng.", "Nêu quan điểm: có nên cấm điện thoại trong trường học."),
    (9, "Tranh biện nâng cao", "Phản biện ý kiến/lập luận/dẫn chứng, không công kích cá nhân.", "Phản biện một quan điểm đối lập, giữ bình tĩnh."),
    (10, "Thuyết trình tốt nghiệp", "Ứng dụng toàn bộ kỹ năng đã học.", "Thuyết trình 3-5 phút: Ước mơ nghề nghiệp của tôi."),
]


async def seed_lessons() -> None:
    async with SessionLocal() as s:
        existing = (await s.execute(select(Lesson).limit(1))).first()
        if existing:
            return
        for i, (buoi, title, tip, prompt) in enumerate(_LESSONS):
            s.add(Lesson(buoi=buoi, order_index=i, title=title, tip=tip, prompt=prompt, xp=10))
        await s.commit()


async def seed_mc() -> None:
    """Một MC mẫu để xem chế độ MC (mc@test.vn / 123456)."""
    async with SessionLocal() as s:
        from sqlalchemy import select

        exists = (await s.execute(select(User).where(User.email == "mc@test.vn"))).scalar_one_or_none()
        if exists:
            return
        mc = User(email="mc@test.vn", password_hash=hash_password("123456"),
                  role="mc", display_name="MC Hạnh")
        mc.mc_title = "Dẫn 500+ sự kiện · cưới hỏi"
        s.add(mc)
        await s.flush()
        s.add(Progress(user_id=mc.id))
        await s.commit()
