import uuid
from datetime import date, datetime, timezone

from sqlalchemy import JSON, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "app_user"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String, unique=True)
    password_hash: Mapped[str] = mapped_column(String)
    role: Mapped[str] = mapped_column(String, default="hoc_vien")  # hoc_vien | mc (AD-7)
    display_name: Mapped[str | None] = mapped_column(String, nullable=True)
    mc_title: Mapped[str | None] = mapped_column(String, nullable=True)  # chức danh (chỉ với MC)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    progress: Mapped["Progress"] = relationship(back_populates="user", uselist=False)


class Lesson(Base):
    __tablename__ = "lesson"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    buoi: Mapped[int] = mapped_column()          # thuộc buổi mấy (1..10)
    order_index: Mapped[int] = mapped_column()   # thứ tự toàn cục để mở khóa
    title: Mapped[str] = mapped_column(String)
    tip: Mapped[str] = mapped_column(String)     # mẹo ngắn
    prompt: Mapped[str] = mapped_column(String)  # đề thực hành
    brief: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # Thẻ nhiệm vụ: mục tiêu/bối cảnh/dàn ý/ví dụ
    xp: Mapped[int] = mapped_column(default=10)


class Clip(Base):
    __tablename__ = "clip"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("app_user.id"))
    lesson_id: Mapped[str | None] = mapped_column(ForeignKey("lesson.id"), nullable=True)
    content_lesson_id: Mapped[str | None] = mapped_column(ForeignKey("content_lesson.id"), nullable=True)  # v2 (FR-19)
    duration_seconds: Mapped[float] = mapped_column()
    audio_path: Mapped[str | None] = mapped_column(String, nullable=True)  # đường dẫn clip trong MediaStore (AD-4)
    status: Mapped[str] = mapped_column(String, default="queued")  # queued|processing|done|failed (AD-1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    score: Mapped["Score"] = relationship(back_populates="clip", uselist=False)


class Score(Base):
    """Phần Xác — tách biệt với review của MC (AD-5)."""
    __tablename__ = "score"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    clip_id: Mapped[str] = mapped_column(ForeignKey("clip.id"), unique=True)
    volume_label: Mapped[str] = mapped_column(String)     # tốt | nhỏ | to
    speed_wpm: Mapped[float] = mapped_column()            # chữ/phút
    filler_count: Mapped[int] = mapped_column()           # số "ừm/à/ờ" (GIẢ LẬP ở MVP)
    tip: Mapped[str] = mapped_column(String)
    is_mock: Mapped[bool] = mapped_column(default=True)   # đánh dấu chấm giả lập
    # "Xem lại lời bạn nói": transcript ASR THẬT (mock = None — không bao giờ hiện text giả)
    transcript: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    clip: Mapped["Clip"] = relationship(back_populates="score")


class Progress(Base):
    """Server sở hữu streak/XP (AD-3)."""
    __tablename__ = "progress"
    user_id: Mapped[str] = mapped_column(ForeignKey("app_user.id"), primary_key=True)
    xp: Mapped[int] = mapped_column(default=0)
    streak: Mapped[int] = mapped_column(default=0)
    tickets: Mapped[int] = mapped_column(default=0)  # số Vé Vàng đang có
    last_day: Mapped[date | None] = mapped_column(nullable=True)

    user: Mapped["User"] = relationship(back_populates="progress")


class ReviewRequest(Base):
    """Hàng đợi review MC — máy trạng thái bền, SLA 72h (AD-6)."""
    __tablename__ = "review_request"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    clip_id: Mapped[str] = mapped_column(ForeignKey("clip.id"))
    hoc_vien_id: Mapped[str] = mapped_column(ForeignKey("app_user.id"))
    mc_id: Mapped[str | None] = mapped_column(ForeignKey("app_user.id"), nullable=True)
    status: Mapped[str] = mapped_column(String, default="pending")  # pending|submitted|expired
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class MCReview(Base):
    """Phần Hồn — do MC thật viết (AD-5). MVP: text; thật sẽ là voice."""
    __tablename__ = "mc_review"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    request_id: Mapped[str] = mapped_column(ForeignKey("review_request.id"), unique=True)
    mc_id: Mapped[str] = mapped_column(ForeignKey("app_user.id"))
    note: Mapped[str] = mapped_column(String)
    audio_path: Mapped[str | None] = mapped_column(String, nullable=True)  # giọng MC thật (crown jewel)
    # "Xem bản chữ" (a11y + nghe nơi công cộng): ASR trên giọng MC qua AsrPort, best-effort
    transcript: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Genre(Base):
    """Thể loại (AD-9). vd: kỹ năng nói, MC đám cưới, MC livestream."""
    __tablename__ = "genre"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String, unique=True)
    status: Mapped[str] = mapped_column(String, default="published")  # draft|published|archived (AD-12)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class LearningPath(Base):
    """Lộ trình (AD-9). Thuộc một Genre."""
    __tablename__ = "learning_path"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    genre_id: Mapped[str] = mapped_column(ForeignKey("genre.id"))
    title: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, default="draft")  # AD-12
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Level(Base):
    """Cấp độ (AD-9): Cơ bản/Trung cấp/Nâng cao."""
    __tablename__ = "level"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    path_id: Mapped[str] = mapped_column(ForeignKey("learning_path.id"))
    name: Mapped[str] = mapped_column(String)
    order_index: Mapped[int] = mapped_column(default=0)
    status: Mapped[str] = mapped_column(String, default="draft")


class ContentSession(Base):
    """Buổi (AD-9)."""
    __tablename__ = "content_session"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    level_id: Mapped[str] = mapped_column(ForeignKey("level.id"))
    title: Mapped[str] = mapped_column(String)
    order_index: Mapped[int] = mapped_column(default=0)
    status: Mapped[str] = mapped_column(String, default="draft")


class ContentLesson(Base):
    """Bài (AD-9): mẹo + đề. Đề gộp luôn ở đây cho gọn (1 bài 1 đề)."""
    __tablename__ = "content_lesson"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    session_id: Mapped[str] = mapped_column(ForeignKey("content_session.id"))
    title: Mapped[str] = mapped_column(String)
    tip: Mapped[str] = mapped_column(String, default="")
    prompt: Mapped[str] = mapped_column(String, default="")
    brief: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # Thẻ nhiệm vụ (Pha C+)
    order_index: Mapped[int] = mapped_column(default=0)
    status: Mapped[str] = mapped_column(String, default="draft")


class AuditLog(Base):
    """Nhật ký thao tác admin (Pha D admin-plan): ai sửa gì, lúc nào. Append-only."""
    __tablename__ = "audit_log"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    admin_id: Mapped[str] = mapped_column(ForeignKey("app_user.id"))
    action: Mapped[str] = mapped_column(String)   # patch|create|duplicate|move|publish|unpublish|rubric|user|grant|refund|import|ai-split
    entity: Mapped[str] = mapped_column(String)   # path|level|session|lesson|genre|rubric|user|review
    entity_id: Mapped[str] = mapped_column(String, default="")
    detail: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class RubricModule(Base):
    """Rubric override theo thể loại (Pha B admin-plan): admin sửa ngưỡng/tip trên web,
    KHÔNG deploy. Không có dòng → dùng registry code (rubrics.py) làm mặc định.
    tips = {"fast":[...], "slow":[...], "filler":[...], "good":[...]} — mảng = pool đa dạng."""
    __tablename__ = "rubric_module"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    genre_id: Mapped[str] = mapped_column(ForeignKey("genre.id"), unique=True)
    wpm_min: Mapped[int] = mapped_column(default=110)
    wpm_max: Mapped[int] = mapped_column(default=160)
    focus: Mapped[str] = mapped_column(String, default="rõ ràng, tự tin")
    tips: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class BadgeCard(Base):
    """Thẻ MC bảo chứng — tự sinh sau khi có MCReview (FR-11)."""
    __tablename__ = "badge_card"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    review_id: Mapped[str] = mapped_column(ForeignKey("mc_review.id"), unique=True)
    hoc_vien_id: Mapped[str] = mapped_column(ForeignKey("app_user.id"))
    mc_name: Mapped[str] = mapped_column(String)
    mc_title: Mapped[str | None] = mapped_column(String, nullable=True)
    note: Mapped[str] = mapped_column(String)
    audio_path: Mapped[str | None] = mapped_column(String, nullable=True)  # key file giọng MC
    # Snapshot tiến bộ cho thẻ khoe (P1-the-bao-chung-spec §8): {"before":{...},"after":{...}}
    # before = điểm clip ĐẦU TIÊN của học viên; after = điểm clip được review. Nullable — thẻ suy biến duyên dáng.
    stats: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
