from pydantic import BaseModel, EmailStr


class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    display_name: str | None = None
    role: str = "hoc_vien"


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str


class LessonOut(BaseModel):
    id: str
    buoi: int
    order_index: int
    title: str
    tip: str
    prompt: str
    brief: dict | None = None      # Thẻ nhiệm vụ: mục tiêu/bối cảnh/dàn ý/ví dụ
    criteria: list[str] = []       # Tiêu chí đạt (sinh từ rubric — FR-15)
    xp: int
    unlocked: bool
    done: bool


class SubmitClipIn(BaseModel):
    lesson_id: str | None = None
    content_lesson_id: str | None = None
    duration_seconds: float = 60.0


class ScoreOut(BaseModel):
    volume_label: str
    speed_wpm: float
    filler_count: int
    tip: str
    is_mock: bool


class ClipOut(BaseModel):
    id: str
    lesson_id: str
    status: str
    score: ScoreOut | None = None


class ProgressOut(BaseModel):
    xp: int
    streak: int
    tickets: int
    tier: str = "Đồng"
    practiced_today: bool = False


class Achievement(BaseModel):
    code: str
    title: str
    desc: str
    earned: bool


class ScorePoint(BaseModel):
    speed_wpm: float
    filler_count: int
    created_at: str


class LeaderboardEntry(BaseModel):
    rank: int
    name: str
    xp: int
    streak: int
    tier: str
    is_me: bool


class AiSplitIn(BaseModel):
    raw_text: str
    genre: str = "kỹ năng nói"


class SendTicketIn(BaseModel):
    clip_id: str


class BadgeOut(BaseModel):
    mc_name: str
    mc_title: str | None = None
    note: str
    audio_url: str | None = None


class ReviewRequestOut(BaseModel):
    id: str
    clip_id: str
    status: str
    badge: BadgeOut | None = None


class MCQueueItemOut(BaseModel):
    request_id: str
    hoc_vien_name: str | None = None
    speed_wpm: float | None = None
    filler_count: int | None = None


class SubmitReviewIn(BaseModel):
    request_id: str
    note: str
