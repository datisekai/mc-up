// API client cho app McUp.
//
// API_BASE lấy từ biến môi trường EXPO_PUBLIC_API_URL — tách env RÕ RÀNG:
//   - DEV local (Expo Go):  client/.env  (gitignored) → IP LAN máy bạn (cp .env.example .env)
//   - BUILD TestFlight/APK: eas.json → build.<profile>.env → LUÔN là https://mcup.fun (prod)
// Không set gì → fallback an toàn: dev = localhost, build thật = prod.
export const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ??
  (__DEV__ ? "http://localhost:8000" : "https://mcup.fun");

// Lỗi API có phân loại: mạng (không kết nối được) vs xác thực (token hỏng) vs khác.
// Nhờ đó App phân biệt "mạng chập chờn → giữ phiên, thử lại" với "token hết hạn → về đăng nhập".
export class ApiError extends Error {
  status: number;
  isNetwork: boolean;
  constructor(message: string, status = 0, isNetwork = false) {
    super(message);
    this.status = status;
    this.isNetwork = isNetwork;
  }
  get isAuth() { return this.status === 401 || this.status === 403; }
}

// Timeout để request treo không kẹt app (vd splash "Đang mở" mãi) — thành lỗi mạng thử lại được.
function withTimeout(ms: number): AbortSignal {
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

async function req(path: string, opts: { method?: string; token?: string; body?: any } = {}) {
  let r: Response;
  try {
    r = await fetch(API_BASE + path, {
      method: opts.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(opts.token ? { Authorization: "Bearer " + opts.token } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: withTimeout(15_000),
    });
  } catch {
    throw new ApiError("Không kết nối được máy chủ — kiểm tra mạng giúp mình nhé.", 0, true);
  }
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new ApiError(data?.detail?.error?.message || data?.error?.message || "HTTP " + r.status, r.status);
  return data;
}

export const Api = {
  register: (email: string, password: string, display_name: string, role = "hoc_vien") =>
    req("/auth/register", { method: "POST", body: { email, password, display_name, role } }),
  login: (email: string, password: string) =>
    req("/auth/login", { method: "POST", body: { email, password } }),
  guest: () => req("/auth/guest", { method: "POST" }),
  upgrade: (token: string, email: string, password: string, display_name?: string) =>
    req("/auth/upgrade", { method: "POST", token, body: { email, password, display_name } }),
  lessons: (token: string) => req("/lessons", { token }),
  progress: (token: string) => req("/me/progress", { token }),
  submitMock: (token: string, lesson_id: string, duration_seconds = 30) =>
    req("/practice/submit", { method: "POST", token, body: { lesson_id, duration_seconds } }),
  submitMockContent: (token: string, content_lesson_id: string, duration_seconds = 30) =>
    req("/practice/submit", { method: "POST", token, body: { content_lesson_id, duration_seconds } }),
  contentPaths: (token: string) => req("/content/paths", { token }),
  contentLessons: (token: string, pathId: string) => req("/content/paths/" + pathId + "/lessons", { token }),
  clip: (token: string, id: string) => req("/clips/" + id, { token }),
  sendTicket: (token: string, clip_id: string) =>
    req("/vevang/send", { method: "POST", token, body: { clip_id } }),
  myReviews: (token: string) => req("/me/reviews", { token }),
  mcQueue: (token: string) => req("/mc/queue", { token }),
  mcReview: (token: string, request_id: string, note: string) =>
    req("/mc/review", { method: "POST", token, body: { request_id, note } }),
  mcClaim: (token: string, request_id: string) => req("/mc/claim", { method: "POST", token, body: { request_id } }),
  mcRelease: (token: string, request_id: string) => req("/mc/release", { method: "POST", token, body: { request_id } }),
  mentors: (token: string) => req("/mentors", { token }),
  leaderboard: (token: string) => req("/leaderboard", { token }),
  achievements: (token: string) => req("/me/achievements", { token }),
  scores: (token: string) => req("/me/scores", { token }),
  setPushToken: (token: string, pushToken: string) =>
    req("/me/push-token", { method: "POST", token, body: { token: pushToken } }),
  iapRefresh: (token: string) => req("/iap/refresh", { method: "POST", token }),
};

// Upload clip audio thật (multipart) — expo-av trả về uri file cục bộ
export async function submitAudio(token: string, lesson_id: string, uri: string, duration: number, content_lesson_id?: string) {
  const fd = new FormData();
  if (content_lesson_id) fd.append("content_lesson_id", content_lesson_id);
  else fd.append("lesson_id", lesson_id);
  fd.append("duration_seconds", String(duration));
  fd.append("file", { uri, name: "clip.m4a", type: "audio/m4a" } as any);
  const r = await fetch(API_BASE + "/practice/submit-audio", {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
    body: fd,
    signal: withTimeout(90_000),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new ApiError(data?.detail?.error?.message || "HTTP " + r.status, r.status);
  return data;
}

// MC gửi nhận xét bằng GIỌNG THẬT (multipart)
export async function submitMcVoice(token: string, request_id: string, uri: string, note: string) {
  const fd = new FormData();
  fd.append("request_id", request_id);
  fd.append("note", note);
  fd.append("file", { uri, name: "voice.m4a", type: "audio/m4a" } as any);
  const r = await fetch(API_BASE + "/mc/review-audio", {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
    body: fd,
    signal: withTimeout(90_000),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new ApiError(data?.detail?.error?.message || "HTTP " + r.status, r.status);
  return data;
}
