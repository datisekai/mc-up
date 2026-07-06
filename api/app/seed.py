"""Seed nội dung. Chạy khi khởi động nếu bảng rỗng.

Mỗi bài có 'brief' = Thẻ nhiệm vụ: mục tiêu, bối cảnh, gợi ý dàn ý, ví dụ mẫu
(giấu sau nút 'Xem gợi ý' ở client). 'Tiêu chí đạt' KHÔNG lưu ở đây — sinh động
từ rubric thể loại (rubrics.criteria_for) để luôn khớp với bộ chấm (FR-15).
"""
from sqlalchemy import select

from .db import SessionLocal
from .models import (ContentLesson, ContentSession, Genre, LearningPath, Lesson, Level,
                     Progress, User)
from .security import hash_password


def _b(objective: str, context: str, steps: list[str], example: str) -> dict:
    return {"objective": objective, "context": context, "steps": steps, "example": example}


# (buổi, tiêu đề, mẹo, đề, brief)
_LESSONS = [
    (1, "Vượt sợ nói", "Người nói tự tin = chuẩn bị + luyện tập + tư duy tích cực.",
     "Giới thiệu bản thân trong 1 phút: Tôi là ai, điều tôi tự hào nhất.",
     _b("Vượt cảm giác run bằng một bài giới thiệu bản thân tự tin.",
        "Tưởng tượng bạn đứng trước một nhóm mới — lớp học, buổi phỏng vấn, hay câu lạc bộ MC.",
        ["Chào + tên của bạn", "Bạn là ai (việc/sở thích)", "Điều bạn tự hào nhất — kèm 1 chi tiết cụ thể", "Một câu kết mở"],
        "Xin chào mọi người, mình là Minh. Mình đang là sinh viên năm 2 và rất mê dẫn chương trình. Điều mình tự hào nhất là năm ngoái đã tự tin dẫn đêm văn nghệ 300 khán giả — dù trước đó sợ micro lắm! Rất vui được làm quen với cả nhà.")),
    (2, "Luyện giọng: âm lượng", "Lấy hơi bằng bụng, mở khẩu hình, nói đủ to rõ.",
     "Đọc một đoạn tin tức, giữ âm lượng đều.",
     _b("Nói đủ to, rõ, đều hơi — nền tảng để khán giả nghe không mệt.",
        "Bạn đọc một bản tin ngắn như một phát thanh viên, giữ âm lượng ổn định từ đầu đến cuối.",
        ["Lấy hơi bằng bụng trước khi nói", "Mở khẩu hình, tròn vành rõ chữ", "Giữ âm lượng câu cuối ngang câu đầu", "Đọc chậm rãi, không nuốt chữ"],
        "Bản tin sáng nay: Thời tiết Hà Nội hôm nay nắng nhẹ, nhiệt độ cao nhất 30 độ. Người dân được khuyến cáo mang theo ô khi ra đường buổi trưa. Xin cảm ơn quý vị đã lắng nghe.")),
    (2, "Luyện giọng: tốc độ & ngữ điệu", "4 yếu tố: âm lượng, tốc độ, ngữ điệu, điểm nhấn.",
     "Kể một câu chuyện ngắn với nhiều cảm xúc.",
     _b("Dùng tốc độ và ngữ điệu để câu chuyện có cảm xúc, không đều đều buồn ngủ.",
        "Kể lại một kỷ niệm đáng nhớ như đang ngồi tâm sự với bạn thân.",
        ["Mở đầu chậm, đặt bối cảnh", "Đẩy nhanh + cao giọng ở cao trào", "Ngưng một nhịp trước câu quan trọng", "Hạ giọng, chậm lại ở câu kết"],
        "Hôm đó trời mưa rất to... mình đứng đợi xe buýt, ướt sũng. Bỗng nhiên — một bạn lạ che ô cho mình suốt 15 phút. Mình chưa kịp hỏi tên thì bạn ấy đã lên xe. Đến giờ mình vẫn nhớ nụ cười đó.")),
    (3, "Ngôn ngữ cơ thể", "55% thông điệp đến từ cơ thể. Tránh khoanh tay, cúi mặt, lắc lư.",
     "Nói về người bạn yêu quý nhất, giữ giao tiếp bằng mắt.",
     _b("Để cơ thể nói cùng lời — ánh mắt, tư thế, tay — thay vì đứng cứng đơ.",
        "Bạn chia sẻ về một người thân yêu, tập nhìn thẳng vào camera như đang trò chuyện.",
        ["Đứng thẳng, vai mở, hai chân vững", "Nhìn thẳng vào camera như nhìn vào mắt người nghe", "Dùng tay minh hoạ tự nhiên, tránh khoanh tay", "Mỉm cười khi nói điều tích cực"],
        "Người mình yêu quý nhất là bà ngoại. Bà là người dạy mình nấu ăn, kể chuyện cổ tích mỗi tối. Mỗi lần nhớ bà, mình lại thấy ấm lòng.")),
    (4, "Bài nói có cấu trúc (PREP)", "Point - Reason - Example - Point.",
     "Trình bày về một thói quen tốt theo cấu trúc PREP.",
     _b("Nói mạch lạc, có điểm nhấn nhờ khung PREP: Point–Reason–Example–Point.",
        "Bạn thuyết phục người nghe về một thói quen tốt trong 1 phút.",
        ["Point: nêu quan điểm ngay", "Reason: vì sao", "Example: một ví dụ/số liệu cụ thể", "Point: nhắc lại quan điểm để chốt"],
        "Mình tin dậy sớm thay đổi cả ngày của bạn. Vì buổi sáng yên tĩnh giúp tập trung nhất. Ví dụ, mình dậy lúc 5h30 và viết xong bài trước khi cả nhà thức giấc. Nên nếu muốn làm được nhiều hơn — hãy thử dậy sớm.")),
    (5, "Chia sẻ quan điểm", "Phân biệt ý kiến - sự thật - cảm xúc.",
     "Học online hay offline tốt hơn? Trình bày 2 phút.",
     _b("Trình bày quan điểm rõ ràng, phân biệt ý kiến – sự thật – cảm xúc.",
        "Một chủ đề tranh luận quen thuộc: học online vs offline. Bạn chọn một phía và bảo vệ.",
        ["Chọn rõ một phía ngay đầu", "Đưa 2 lý do, mỗi lý do 1 ví dụ", "Thừa nhận 1 điểm của phía kia", "Chốt lại lựa chọn của bạn"],
        "Mình nghiêng về học offline. Thứ nhất, được tương tác trực tiếp với thầy cô. Thứ hai, ít bị xao nhãng hơn. Dĩ nhiên online tiện lợi — nhưng với mình, sự tập trung quan trọng hơn.")),
    (6, "Tư duy phản biện", "5 câu hỏi: bằng chứng? nguồn? góc khác? bỏ sót gì? nếu ngược lại?",
     "Phân tích một mẩu quảng cáo bằng 5 câu hỏi phản biện.",
     _b("Nhìn một thông điệp bằng con mắt phản biện thay vì tin ngay.",
        "Chọn một quảng cáo bạn hay thấy (mỹ phẩm, đồ ăn...) và mổ xẻ nó.",
        ["Bằng chứng nào cho lời quảng cáo?", "Nguồn tin có đáng tin không?", "Có góc nhìn nào khác / họ giấu gì?", "Nếu ngược lại thì sao?"],
        "Quảng cáo nói 'kem này trắng da sau 7 ngày'. Bằng chứng đâu? Chỉ có lời người mẫu. Nguồn? Chính hãng bán — khó khách quan. Họ giấu gì? Không nói tác dụng phụ. Vậy mình sẽ tìm review độc lập trước khi mua.")),
    (7, "Phản hồi & đặt câu hỏi", "Câu hỏi: mở, đóng, làm rõ, phản biện.",
     "Nghe một quan điểm rồi đặt 1 câu hỏi làm rõ + 1 phản biện.",
     _b("Biết đặt câu hỏi đúng loại: làm rõ và phản biện, thay vì chỉ gật đầu.",
        "Ai đó vừa nói 'Giới trẻ bây giờ lười đọc sách'. Bạn phản hồi lại.",
        ["Nhắc lại ý họ để chắc mình hiểu đúng", "Đặt 1 câu hỏi làm rõ", "Đặt 1 câu phản biện lịch sự", "Giữ giọng tôn trọng, không công kích"],
        "Bạn nói giới trẻ lười đọc sách. Mình hỏi cho rõ: ý bạn là sách giấy, hay cả đọc trên mạng? Vì nếu tính cả bài viết, ebook thì có khi giới trẻ đọc nhiều hơn thế hệ trước đấy chứ?")),
    (8, "Tranh biện cơ bản", "Luận điểm - Lý do - Dẫn chứng.",
     "Nêu quan điểm: có nên cấm điện thoại trong trường học.",
     _b("Dựng một lập luận đủ 3 phần: Luận điểm – Lý do – Dẫn chứng.",
        "Chủ đề tranh biện học đường kinh điển. Chọn một phía.",
        ["Nêu luận điểm rõ ràng", "Đưa lý do chính", "Kèm dẫn chứng cụ thể", "Kết bằng một câu mạnh"],
        "Mình cho rằng nên hạn chế điện thoại trong giờ học. Lý do: nó gây xao nhãng. Dẫn chứng: một nghiên cứu cho thấy học sinh mất trung bình 20 phút để tập trung lại sau khi lướt điện thoại. Vì vậy, cất điện thoại giờ học là hợp lý.")),
    (9, "Tranh biện nâng cao", "Phản biện ý kiến/lập luận/dẫn chứng, không công kích cá nhân.",
     "Phản biện một quan điểm đối lập, giữ bình tĩnh.",
     _b("Phản biện vào lập luận, không công kích cá nhân, giữ bình tĩnh.",
        "Đối phương vừa nói 'Học đại học là lãng phí thời gian'. Bạn phản biện.",
        ["Ghi nhận điểm hợp lý của họ trước", "Chỉ ra lỗ hổng trong lập luận", "Đưa dẫn chứng ngược lại", "Giữ giọng điềm tĩnh, tôn trọng"],
        "Mình hiểu ý bạn — đúng là có người thành công không cần bằng cấp. Nhưng đó là số ít. Thực tế, phần lớn ngành nghề vẫn yêu cầu nền tảng đại học. Nên nói 'lãng phí' e là hơi vội.")),
    (10, "Thuyết trình tốt nghiệp", "Ứng dụng toàn bộ kỹ năng đã học.",
     "Thuyết trình 3-5 phút: Ước mơ nghề nghiệp của tôi.",
     _b("Tổng hợp mọi kỹ năng đã học vào một bài thuyết trình hoàn chỉnh, có cảm xúc.",
        "Bài 'tốt nghiệp' — trình bày ước mơ nghề nghiệp của bạn trước khán giả.",
        ["Mở đầu bằng một câu/khoảnh khắc gây chú ý", "Nêu ước mơ + vì sao (PREP)", "Kể một câu chuyện cá nhân minh hoạ", "Kết bằng lời kêu gọi/quyết tâm"],
        "Năm 10 tuổi, mình cầm chiếc micro đồ chơi và dẫn 'chương trình' cho cả xóm. Ước mơ của mình là trở thành MC chuyên nghiệp — vì mình tin lời nói có thể kết nối con người. Và hôm nay, mình đang đi những bước đầu tiên trên hành trình đó.")),
]


async def seed_lessons() -> None:
    """Pha B admin-plan: bài v1 'Kỹ năng nói' seed THẲNG VÀO CÂY nội dung (published) —
    admin sửa được như mọi bài, hết dữ liệu cứng. Bảng Lesson cũ giữ cho clip lịch sử,
    KHÔNG seed nữa. Idempotent theo tên thể loại."""
    async with SessionLocal() as s:
        exists = (await s.execute(select(Genre).where(Genre.name == "Kỹ năng nói"))).scalar_one_or_none()
        if exists:
            return
        genre = Genre(name="Kỹ năng nói", status="published")
        s.add(genre)
        await s.flush()
        path = LearningPath(genre_id=genre.id, title="Lộ trình: Kỹ năng nói", status="published")
        s.add(path)
        await s.flush()
        level = Level(path_id=path.id, name="Cơ bản", order_index=0, status="published")
        s.add(level)
        await s.flush()
        sessions: dict[int, ContentSession] = {}
        counters: dict[int, int] = {}
        for buoi, title, tip, prompt, brief in _LESSONS:
            if buoi not in sessions:
                cs = ContentSession(level_id=level.id, title=f"Buổi {buoi}", order_index=buoi - 1, status="published")
                s.add(cs)
                await s.flush()
                sessions[buoi] = cs
                counters[buoi] = 0
            s.add(ContentLesson(session_id=sessions[buoi].id, title=title, tip=tip, prompt=prompt,
                                brief=brief, order_index=counters[buoi], status="published"))
            counters[buoi] += 1
        await s.commit()


# === Pha C · Mở rộng thể loại: nội dung thật, PUBLISHED sẵn (kèm Thẻ nhiệm vụ) ===
# {thể loại: [(buổi, [(tên bài, mẹo, đề, brief)])]}
_GENRES: dict = {
    "MC đám cưới": [
        ("Đón khách & khai lễ", [
            ("Chào khách mời", "Giọng ấm, chậm rãi — tạo không khí trang trọng ngay từ lời chào.",
             "Chào khách mời đến dự lễ cưới và mời ổn định chỗ ngồi trong 45 giây.",
             _b("Mở màn lễ cưới ấm áp, tạo bầu không khí trang trọng ngay từ lời chào.",
                "Khách vừa đến, còn đang tìm chỗ ngồi, hội trường hơi ồn. Bạn là MC bước ra sân khấu.",
                ["Lời chào trang trọng ('Kính thưa quý vị...')", "Giới thiệu dịp (lễ thành hôn của ai)", "Mời khách ổn định chỗ ngồi", "Một câu tạo cảm xúc chờ đợi"],
                "Kính thưa quý vị quan khách! Chào mừng quý vị đã đến chung vui trong lễ thành hôn của cô dâu Lan và chú rể Nam. Xin kính mời quý vị an tọa, để cùng nhau chờ đón khoảnh khắc thiêng liêng nhất hôm nay.")),
            ("Giới thiệu cô dâu chú rể", "Nhấn tên cô dâu chú rể bằng cảm xúc để tạo khoảnh khắc.",
             "Trân trọng giới thiệu cô dâu và chú rể tiến vào lễ đường.",
             _b("Tạo khoảnh khắc bùng cảm xúc khi cô dâu chú rể xuất hiện.",
                "Đèn tắt bớt, nhạc nổi lên, mọi ánh mắt hướng về cửa lễ đường.",
                ["Hạ giọng dẫn dắt tạo hồi hộp", "Nhấn mạnh tên cô dâu, chú rể bằng cảm xúc", "Mời khách hướng về lễ đường + vỗ tay", "Giữ nhịp chậm để khách kịp cảm nhận"],
                "Và giờ đây, khoảnh khắc tất cả chúng ta chờ đợi... Xin quý vị hướng ánh nhìn về phía cuối lễ đường, và dành một tràng pháo tay thật nồng nhiệt chào đón cô dâu xinh đẹp cùng chú rể điển trai tiến vào lễ đường!")),
        ]),
        ("Nghi thức thiêng liêng", [
            ("Dẫn nghi thức trao nhẫn", "Chậm, thiêng liêng — để khoảnh khắc tự cất lời.",
             "Dẫn nghi thức trao nhẫn cưới, giữ nhịp trang nghiêm trong 40 giây.",
             _b("Dẫn khoảnh khắc thiêng liêng — nhịp chậm, ấm, để cảm xúc dẫn dắt.",
                "Cô dâu chú rể trên lễ đường, cả hội trường lặng đi dõi theo.",
                ["Mời mọi người hướng về lễ đường", "Nói ý nghĩa chiếc nhẫn", "Mời chú rể trao nhẫn, rồi cô dâu", "Một câu lắng đọng chốt khoảnh khắc"],
                "Xin kính mời toàn thể quan khách cùng hướng về lễ đường... Chiếc nhẫn cưới tuy nhỏ bé, nhưng chứa trọn lời hứa yêu thương trọn đời. Xin mời chú rể trao nhẫn cho người con gái mình yêu thương... và cô dâu, xin trao lại lời hứa của mình.")),
            ("Mời phát biểu", "Giới thiệu người phát biểu ngắn gọn, trang trọng.",
             "Mời đại diện gia đình lên phát biểu, dẫn dắt trong 30 giây.",
             _b("Chuyển mạch sang phần phát biểu mượt mà, trang trọng.",
                "Sau nghi thức, đến lượt đại diện hai gia đình chia sẻ.",
                ["Một câu chuyển mạch cảm xúc", "Giới thiệu người phát biểu (vai vế, tên)", "Mời lên sân khấu + vỗ tay", "Lùi lại nhường sân khấu"],
                "Hôn lễ hôm nay trọn vẹn hơn nhờ tình thương của hai bên gia đình. Xin trân trọng kính mời ông Nguyễn Văn A — đại diện nhà trai — lên có đôi lời phát biểu. Xin một tràng pháo tay ạ!")),
            ("Kết lễ & mời tiệc", "Khép lễ ấm áp, mời khách nhập tiệc thật tự nhiên.",
             "Cảm ơn khách và mời mọi người nhập tiệc chung vui.",
             _b("Khép lễ ấm áp và mời khách nhập tiệc thật tự nhiên.",
                "Nghi thức xong, chuyển sang phần tiệc chung vui.",
                ["Cảm ơn quan khách đã đến chung vui", "Một lời chúc cho cô dâu chú rể", "Mời khách nhập tiệc", "Chúc ngon miệng, vui vẻ"],
                "Thay mặt hai gia đình, xin cảm ơn quý vị đã đến chung vui và gửi lời chúc phúc cho đôi uyên ương. Kính chúc cô dâu chú rể trăm năm hạnh phúc! Và bây giờ, xin mời quý vị cùng nâng ly khai tiệc. Chúc quý vị một buổi tiệc thật vui!")),
        ]),
    ],
    "MC sự kiện": [
        ("Khai mạc & giữ nhịp", [
            ("Khai mạc kéo năng lượng", "10 giây đầu phải kéo năng lượng cả khán phòng lên.",
             "Khai mạc một lễ khai trương: chào khán giả và mở màn trong 45 giây.",
             _b("Mở màn bùng năng lượng — ghim sự chú ý ngay 10 giây đầu.",
                "Lễ khai trương một thương hiệu. Khán phòng còn ồn, khách đang ổn định chỗ.",
                ["Câu chào bật năng lượng (mời pháo tay)", "Nêu dịp & tên thương hiệu", "Một câu tạo khí thế", "Dẫn vào chương trình"],
                "Kính thưa quý vị khách quý! Xin một tràng pháo tay thật lớn chào mừng tất cả chúng ta trong ngày đặc biệt hôm nay — lễ khai trương thương hiệu ABC! Đây không chỉ là ngày mở cửa một cửa hàng, mà là ngày mở ra một hành trình mới. Và ngay bây giờ, xin mời quý vị bước vào chương trình!")),
            ("Giới thiệu đại biểu", "Đọc đúng chức danh, trang trọng nhưng không lê thê.",
             "Giới thiệu 3 khách mời VIP lên sân khấu, mỗi người 1–2 câu.",
             _b("Giới thiệu đại biểu trang trọng, đọc đúng chức danh, không lê thê.",
                "Phần nghi thức: xướng tên các khách mời quan trọng có mặt.",
                ["Câu mở phần giới thiệu đại biểu", "Xướng đúng chức danh + họ tên từng người", "Nhịp đều, mỗi người một tràng pháo tay", "Cảm ơn sự hiện diện của quý đại biểu"],
                "Về tham dự chương trình hôm nay, xin trân trọng giới thiệu: Ông Trần Văn B — Giám đốc Sở Công thương. Bà Lê Thị C — Chủ tịch Hiệp hội Doanh nghiệp. Và ông David — đại diện đối tác quốc tế. Xin một tràng pháo tay chào mừng quý đại biểu!")),
        ]),
        ("Bản lĩnh sân khấu", [
            ("Dẫn chuyển tiết mục", "Câu chuyển cảnh giúp khán giả không hụt hơi giữa các tiết mục.",
             "Dẫn chuyển từ tiết mục văn nghệ sang phần trao giải, giữ mạch cảm xúc.",
             _b("Chuyển cảnh mượt để khán giả không hụt hơi giữa hai phần.",
                "Tiết mục văn nghệ vừa kết thúc, tiếp theo là lễ trao giải.",
                ["Khen/điểm lại tiết mục vừa rồi một câu", "Câu cầu nối dẫn sang phần tiếp", "Tạo háo hức cho phần sắp tới", "Giới thiệu phần trao giải"],
                "Một tiết mục thật bùng nổ, xin cảm ơn các nghệ sĩ! Và sau những phút giây thăng hoa cảm xúc, đã đến lúc chúng ta vinh danh những gương mặt xuất sắc nhất đêm nay. Xin mời quý vị cùng đến với phần được mong chờ nhất — lễ trao giải!")),
            ("Xử lý sự cố (câu giờ)", "Sự cố là lúc bản lĩnh lộ rõ — bình tĩnh, hài hước, lấp khoảng trống.",
             "Máy chiếu bị lỗi — hãy 'câu giờ' 1 phút giữ khán giả không sốt ruột.",
             _b("Giữ bình tĩnh, hài hước, lấp khoảng trống khi sự cố xảy ra.",
                "Máy chiếu đột ngột lỗi, kỹ thuật đang xử lý. Khán giả bắt đầu xì xào.",
                ["Trấn an nhẹ nhàng, không hoảng", "Thêm một câu hài hước duyên dáng", "Tương tác với khán giả (hỏi/mini game)", "Bắc cầu quay lại chương trình khi sẵn sàng"],
                "Xin quý vị chờ trong giây lát, bộ phận kỹ thuật đang 'phù phép' cho màn hình thêm lung linh ạ. Trong lúc chờ, xin hỏi nhỏ: quý vị nào hôm nay đến sớm nhất chương trình ạ? À, có anh áo xanh kìa — cảm ơn anh! Vâng, và màn hình đã sẵn sàng, xin mời chúng ta tiếp tục!")),
            ("Bế mạc & cảm ơn", "Kết gọn, ấm, để lại dư âm và lời cảm ơn nhà tài trợ.",
             "Bế mạc sự kiện: cảm ơn khán giả và nhà tài trợ trong 45 giây.",
             _b("Kết chương trình gọn, ấm, để lại dư âm và cảm ơn đúng người.",
                "Chương trình đã xong, đến lúc khép lại và tiễn khách.",
                ["Tóm một câu điểm nhấn của chương trình", "Cảm ơn nhà tài trợ + khán giả", "Một lời chúc/hẹn gặp lại", "Câu chào kết"],
                "Vậy là chương trình đã khép lại với thật nhiều cảm xúc. Xin chân thành cảm ơn nhà tài trợ ABC đã đồng hành, và cảm ơn quý khán giả đã ở lại đến phút cuối. Kính chúc quý vị sức khỏe, và hẹn gặp lại trong những sự kiện tiếp theo. Xin trân trọng cảm ơn!")),
        ]),
    ],
    "MC livestream": [
        ("Lên sóng & giữ chân", [
            ("Mở màn 3 giây vàng", "3 giây đầu quyết định người xem ở hay lướt — nêu ngay lý do nên ở lại.",
             "Mở màn buổi live bán hàng: chào và cho biết hôm nay có gì hot trong 30 giây.",
             _b("Ghim người xem trong 3 giây đầu — nêu ngay lý do đáng ở lại.",
                "Bạn vừa bấm nút live, người xem đang lác đác vào, dễ lướt đi ngay.",
                ["Chào nhanh + gọi thân mật ('cả nhà ơi')", "Nêu ngay hôm nay có gì hot/ưu đãi", "Tạo lý do ở lại ('cuối live có quà')", "Kêu gọi thả tim/chia sẻ"],
                "Cả nhà ơi, chào cả nhà đã vào live! Hôm nay shop có deal cực sốc — giảm tới 50% chỉ trong 1 tiếng live thôi nha. Ai ở lại tới cuối còn có quà tặng bí mật nữa đó! Cả nhà thả tim và share giúp em nào!")),
            ("Tương tác bình luận", "Đọc tên người xem, trả lời realtime để giữ tương tác.",
             "Đọc và trả lời 3 bình luận giả định của người xem một cách tự nhiên.",
             _b("Giữ tương tác realtime — đọc tên, trả lời bình luận để người xem thấy được quan tâm.",
                "Bình luận đang chạy liên tục. Bạn vừa nói vừa 'bắt' comment.",
                ["Đọc tên người bình luận", "Trả lời đúng câu hỏi của họ", "Khen/cảm ơn để tạo thiện cảm", "Khéo léo lái về sản phẩm"],
                "À, bạn Hương hỏi 'áo này có size M không?' — Có nha Hương ơi, còn đủ size từ S đến XL luôn. Cảm ơn bạn Tuấn vừa share live nha! Còn bạn Mai hỏi giá — chị nói ngay đây, chỉ 199k thôi mà chất vải xịn lắm nè.")),
        ]),
        ("Chốt đơn & giữ nhịp", [
            ("Giới thiệu sản phẩm", "Lợi ích trước, thông số sau; nhanh nhưng rõ chữ ở đoạn quan trọng.",
             "Giới thiệu một sản phẩm bất kỳ trong 45 giây theo kiểu livestream.",
             _b("Bán bằng lợi ích trước, thông số sau; nhanh nhưng rõ ở đoạn quan trọng.",
                "Bạn cầm sản phẩm lên, cần khiến người xem muốn mua ngay.",
                ["Nêu lợi ích/nỗi đau nó giải quyết trước", "Cho xem cận cảnh + demo nhanh", "Thông số/chất liệu ngắn gọn", "Chốt bằng giá + ưu đãi"],
                "Cả nhà có hay bị khô da mùa lạnh không? Em có ngay kem dưỡng này nè — thấm cực nhanh, không nhờn. Chất kem mịn nè cả nhà thấy không? Thành phần B5 lành tính cho cả da nhạy cảm. Giá gốc 350k, nhưng trong live hôm nay chỉ còn 249k thôi ạ!")),
            ("Kêu gọi chốt đơn", "Tạo cảm giác khan hiếm & khẩn cấp mà vẫn chân thành.",
             "Kêu gọi người xem chốt đơn ngay với ưu đãi có hạn trong 30 giây.",
             _b("Tạo cảm giác khan hiếm & khẩn cấp mà vẫn chân thành, để người xem chốt ngay.",
                "Sản phẩm đã giới thiệu xong, giờ là lúc thúc đẩy hành động.",
                ["Nhắc lại ưu đãi hấp dẫn", "Tạo khan hiếm (số lượng/thời gian có hạn)", "Hướng dẫn cách chốt đơn cụ thể", "Thúc một câu kêu gọi mạnh"],
                "Cả nhà ơi, mức giá 249k này chỉ áp dụng trong 10 phút tới thôi nha, mà kho chỉ còn 20 suất! Ai muốn chốt thì gõ ngay 'CHỐT' kèm size vào bình luận, shop lên đơn liền tay. Nhanh tay kẻo lỡ cả nhà ơi — hết là hết thật đó!")),
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
                for li, (ltitle, tip, prompt, brief) in enumerate(lessons):
                    s.add(ContentLesson(session_id=cs.id, title=ltitle, tip=tip, prompt=prompt,
                                        brief=brief, order_index=li, status="published"))
        await s.commit()


async def seed_mc() -> None:
    """Một MC mẫu để xem chế độ MC (mc@test.vn / 123456)."""
    async with SessionLocal() as s:
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
        exists = (await s.execute(select(User).where(User.email == "admin@test.vn"))).scalar_one_or_none()
        if exists:
            return
        admin = User(email="admin@test.vn", password_hash=hash_password("123456"),
                     role="admin", display_name="Admin")
        s.add(admin)
        await s.flush()
        s.add(Progress(user_id=admin.id))
        await s.commit()
