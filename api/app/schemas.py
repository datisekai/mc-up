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
    transcript: str | None = None  # lời user nói (chỉ ASR thật) — client tô từ đệm
    unclear: bool = False          # ASR thật nhưng không nghe được → app hiện trạng thái riêng, KHÔNG hiện số
    passed: bool = True            # RỚT (im lặng/quá ngắn/lạc đề) = false → bài KHÔNG tính hoàn thành (V4-2)
    fail_reason: str | None = None # khong_nghe_ro | qua_ngan | lac_de
    coverage: dict | None = None   # "đủ ý chưa": {steps, covered[]} đối chiếu dàn ý
    positives: list[str] = []      # "Đã tốt": tổng hợp rõ ràng
    improvements: list[str] = []   # "Cần cải thiện": tổng hợp rõ ràng


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
    # Thanh năng lượng
    energy: int = 30
    energy_max: int = 30
    energy_cost: int = 10
    energy_secs_to_next: int = 0   # giây tới khi hồi thêm 1 điểm
    is_pro: bool = False
    # Bộ máy giữ chân
    coins: int = 0
    streak_freezes: int = 0
    league_tier: int = 0
    league_name: str = "Đồng"


class Achievement(BaseModel):
    code: str
    title: str
    desc: str
    earned: bool
    progress: int = 0   # giá trị hiện tại (vd 3 bài)
    target: int = 1     # mốc để mở khoá (vd 5 bài) → app vẽ "3/5"


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
    stats: dict | None = None       # before/after cho thẻ khoe (P1)
    transcript: str | None = None   # "Xem bản chữ" — ASR giọng MC (best-effort)


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
    state: str = "free"                 # free | mine | taken (feedback #4)
    claimer_name: str | None = None     # tên MC đang giữ (khi taken)


class SubmitReviewIn(BaseModel):
    request_id: str
    note: str
