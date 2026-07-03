// API client cho app McUp.
// ĐỔI cho đúng nơi backend chạy:
//  - iOS simulator:      http://localhost:8000
//  - Android emulator:   http://10.0.2.2:8000
//  - Thiết bị thật (Expo Go): http://<IP-máy-bạn>:8000  (vd http://192.168.1.10:8000)
export const API_BASE = "http://192.168.1.17:8000"; // IP LAN máy Mac — iPhone cùng Wi-Fi gọi được

async function req(path: string, opts: { method?: string; token?: string; body?: any } = {}) {
  const r = await fetch(API_BASE + path, {
    method: opts.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(opts.token ? { Authorization: "Bearer " + opts.token } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(data?.detail?.error?.message || data?.error?.message || "HTTP " + r.status);
  return data;
}

export const Api = {
  register: (email: string, password: string, display_name: string, role = "hoc_vien") =>
    req("/auth/register", { method: "POST", body: { email, password, display_name, role } }),
  login: (email: string, password: string) =>
    req("/auth/login", { method: "POST", body: { email, password } }),
  lessons: (token: string) => req("/lessons", { token }),
  progress: (token: string) => req("/me/progress", { token }),
  submitMock: (token: string, lesson_id: string, duration_seconds = 30) =>
    req("/practice/submit", { method: "POST", token, body: { lesson_id, duration_seconds } }),
  clip: (token: string, id: string) => req("/clips/" + id, { token }),
  sendTicket: (token: string, clip_id: string) =>
    req("/vevang/send", { method: "POST", token, body: { clip_id } }),
  myReviews: (token: string) => req("/me/reviews", { token }),
  mcQueue: (token: string) => req("/mc/queue", { token }),
  mcReview: (token: string, request_id: string, note: string) =>
    req("/mc/review", { method: "POST", token, body: { request_id, note } }),
  leaderboard: (token: string) => req("/leaderboard", { token }),
  achievements: (token: string) => req("/me/achievements", { token }),
  scores: (token: string) => req("/me/scores", { token }),
};

// Upload clip audio thật (multipart) — expo-av trả về uri file cục bộ
export async function submitAudio(token: string, lesson_id: string, uri: string, duration: number) {
  const fd = new FormData();
  fd.append("lesson_id", lesson_id);
  fd.append("duration_seconds", String(duration));
  fd.append("file", { uri, name: "clip.m4a", type: "audio/m4a" } as any);
  const r = await fetch(API_BASE + "/practice/submit-audio", {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
    body: fd,
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(data?.detail?.error?.message || "HTTP " + r.status);
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
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(data?.detail?.error?.message || "HTTP " + r.status);
  return data;
}
