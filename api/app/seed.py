"""Seed lộ trình 10 buổi (rút gọn từ giáo trình). Chạy khi khởi động nếu bảng rỗng."""
from sqlalchemy import select

from .db import SessionLocal
from .models import (ContentLesson, ContentSession, Genre, LearningPath, Lesson, Level,
                     Progress, User)
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


# === Pha C · Mở rộng thể loại: nội dung thật, PUBLISHED sẵn ===
# {thể loại: [(buổi, [(tên bài, mẹo, đề)])]}
_GENRES: dict = {
    "MC đám cưới": [
        ("Đón khách & khai lễ", [
            ("Chào khách mời", "Giọng ấm, chậm rãi — tạo không khí trang trọng ngay từ lời chào.",
             "Chào khách mời đến dự lễ cưới và mời ổn định chỗ ngồi trong 45 giây."),
            ("Giới thiệu cô dâu chú rể", "Nhấn tên cô dâu chú rể bằng cảm xúc để tạo khoảnh khắc.",
             "Trân trọng giới thiệu cô dâu và chú rể tiến vào lễ đường."),
        ]),
        ("Nghi thức thiêng liêng", [
            ("Dẫn nghi thức trao nhẫn", "Chậm, thiêng liêng — để khoảnh khắc tự cất lời.",
             "Dẫn nghi thức trao nhẫn cưới, giữ nhịp trang nghiêm trong 40 giây."),
            ("Mời phát biểu", "Giới thiệu người phát biểu ngắn gọn, trang trọng.",
             "Mời đại diện gia đình lên phát biểu, dẫn dắt trong 30 giây."),
            ("Kết lễ & mời tiệc", "Khép lễ ấm áp, mời khách nhập tiệc thật tự nhiên.",
             "Cảm ơn khách và mời mọi người nhập tiệc chung vui."),
        ]),
    ],
    "MC sự kiện": [
        ("Khai mạc & giữ nhịp", [
            ("Khai mạc kéo năng lượng", "10 giây đầu phải kéo năng lượng cả khán phòng lên.",
             "Khai mạc một lễ khai trương: chào khán giả và mở màn trong 45 giây."),
            ("Giới thiệu đại biểu", "Đọc đúng chức danh, trang trọng nhưng không lê thê.",
             "Giới thiệu 3 khách mời VIP lên sân khấu, mỗi người 1–2 câu."),
        ]),
        ("Bản lĩnh sân khấu", [
            ("Dẫn chuyển tiết mục", "Câu chuyển cảnh giúp khán giả không hụt hơi giữa các tiết mục.",
             "Dẫn chuyển từ tiết mục văn nghệ sang phần trao giải, giữ mạch cảm xúc."),
            ("Xử lý sự cố (câu giờ)", "Sự cố là lúc bản lĩnh lộ rõ — bình tĩnh, hài hước, lấp khoảng trống.",
             "Máy chiếu bị lỗi — hãy 'câu giờ' 1 phút giữ khán giả không sốt ruột."),
            ("Bế mạc & cảm ơn", "Kết gọn, ấm, để lại dư âm và lời cảm ơn nhà tài trợ.",
             "Bế mạc sự kiện: cảm ơn khán giả và nhà tài trợ trong 45 giây."),
        ]),
    ],
    "MC livestream": [
        ("Lên sóng & giữ chân", [
            ("Mở màn 3 giây vàng", "3 giây đầu quyết định người xem ở hay lướt — nêu ngay lý do nên ở lại.",
             "Mở màn buổi live bán hàng: chào và cho biết hôm nay có gì hot trong 30 giây."),
            ("Tương tác bình luận", "Đọc tên người xem, trả lời realtime để giữ tương tác.",
             "Đọc và trả lời 3 bình luận giả định của người xem một cách tự nhiên."),
        ]),
        ("Chốt đơn & giữ nhịp", [
            ("Giới thiệu sản phẩm", "Lợi ích trước, thông số sau; nhanh nhưng rõ chữ ở đoạn quan trọng.",
             "Giới thiệu một sản phẩm bất kỳ trong 45 giây theo kiểu livestream."),
            ("Kêu gọi chốt đơn", "Tạo cảm giác khan hiếm & khẩn cấp mà vẫn chân thành.",
             "Kêu gọi người xem chốt đơn ngay với ưu đãi có hạn trong 30 giây."),
        ]),
    ],
}


async def seed_genres() -> None:
    """Bơm nội dung thật, PUBLISHED cho các thể loại Pha C. Idempotent theo tên thể loại."""
    async with SessionLocal() as s:
        for genre_name, sessions in _GENRES.items():
            exists = (await s.execute(select(Genre).where(Genre.name == genre_name))).scalar_one_or_none()
            if exists:  # thể loại đã có (vd tạo từ AI-split) → không seed đè
                continue
            genre = Genre(name=genre_name, status="published")
            s.add(genre)
            await s.flush()
            path = LearningPath(genre_id=genre.id, title=f"Lộ trình: {genre_name}", status="published")
            s.add(path)
            await s.flush()
            level = Level(path_id=path.id, name="Cơ bản", order_index=0, status="published")
            s.add(level)
            await s.flush()
            for si, (stitle, lessons) in enumerate(sessions):
                cs = ContentSession(level_id=level.id, title=stitle, order_index=si, status="published")
                s.add(cs)
                await s.flush()
                for li, (ltitle, tip, prompt) in enumerate(lessons):
                    s.add(ContentLesson(session_id=cs.id, title=ltitle, tip=tip, prompt=prompt,
                                        order_index=li, status="published"))
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


async def seed_admin() -> None:
    """Một admin mẫu để thử AI-split (admin@test.vn / 123456)."""
    async with SessionLocal() as s:
        from sqlalchemy import select

        exists = (await s.execute(select(User).where(User.email == "admin@test.vn"))).scalar_one_or_none()
        if exists:
            return
        admin = User(email="admin@test.vn", password_hash=hash_password("123456"),
                     role="admin", display_name="Admin")
        s.add(admin)
        await s.flush()
        s.add(Progress(user_id=admin.id))
        await s.commit()
