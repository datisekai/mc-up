// API client admin — same-origin (FastAPI serve /admin-web), token trong localStorage.
let token: string | null = localStorage.getItem("admin_token");

export function setToken(t: string | null) {
  token = t;
  if (t) localStorage.setItem("admin_token", t);
  else localStorage.removeItem("admin_token");
}
export function hasToken() { return !!token; }

async function req(path: string, opts: { method?: string; body?: any } = {}) {
  const r = await fetch(path, {
    method: opts.method || "GET",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const d = await r.json().catch(() => null);
  if (r.status === 401) { setToken(null); location.reload(); }
  if (!r.ok) throw new Error(d?.detail?.error?.message || d?.error?.message || "HTTP " + r.status);
  return d;
}

export type Brief = { objective?: string; context?: string; steps?: string[]; example?: string };
export type LessonNode = { id: string; title: string; tip: string; prompt: string; brief: Brief | null; status: string; order_index: number };
export type SessionNode = { id: string; title: string; status: string; order_index: number; lessons: LessonNode[] };
export type LevelNode = { id: string; name: string; status: string; sessions: SessionNode[] };
export type Tree = { id: string; title: string; genre: string; genre_id: string; status: string; is_free: boolean; levels: LevelNode[] };

export const Api = {
  login: (email: string, password: string) => req("/auth/login", { method: "POST", body: { email, password } }),
  genres: () => req("/admin/genres"),
  createGenre: (name: string) => req("/admin/genres", { method: "POST", body: { name } }),
  paths: () => req("/admin/paths"),
  createPath: (genre_id: string, title: string) => req("/admin/paths", { method: "POST", body: { genre_id, title } }),
  tree: (id: string): Promise<Tree> => req("/admin/paths/" + id),
  publish: (id: string) => req(`/admin/paths/${id}/publish`, { method: "POST" }),
  unpublish: (id: string) => req(`/admin/paths/${id}/unpublish`, { method: "POST" }),
  patch: (kind: string, id: string, fields: Record<string, unknown>) =>
    req(`/admin/nodes/${kind}/${id}`, { method: "PATCH", body: { fields } }),
  move: (kind: string, id: string, direction: number) =>
    req(`/admin/nodes/${kind}/${id}/move`, { method: "POST", body: { direction } }),
  createSession: (level_id: string, title: string) => req("/admin/sessions", { method: "POST", body: { level_id, title } }),
  createLesson: (session_id: string, title: string) => req("/admin/lessons", { method: "POST", body: { session_id, title } }),
  dupLesson: (id: string) => req(`/admin/lessons/${id}/duplicate`, { method: "POST" }),
  dupSession: (id: string) => req(`/admin/sessions/${id}/duplicate`, { method: "POST" }),
  aiSplit: (genre: string, raw_text: string) => req("/admin/ai-split", { method: "POST", body: { genre, raw_text } }),
  rubrics: () => req("/admin/rubrics"),
  saveRubric: (genre_id: string, fields: Record<string, unknown>) =>
    req(`/admin/rubrics/${genre_id}`, { method: "PUT", body: { fields } }),
  resetRubric: (genre_id: string) => req(`/admin/rubrics/${genre_id}`, { method: "DELETE" }),
  users: (q = "") => req("/admin/users?q=" + encodeURIComponent(q)),
  createUser: (b: { email: string; password: string; display_name: string; role: string; mc_title?: string }) =>
    req("/admin/users", { method: "POST", body: b }),
  patchUser: (id: string, fields: Record<string, unknown>) =>
    req(`/admin/users/${id}`, { method: "PATCH", body: { fields } }),
  grant: (id: string, b: { tickets_delta?: number; xp_delta?: number; streak_set?: number }) =>
    req(`/admin/users/${id}/grant`, { method: "POST", body: b }),
  reviews: (status = "all") => req("/admin/reviews?status=" + status),
  refund: (id: string) => req(`/admin/reviews/${id}/refund`, { method: "POST" }),
  metrics: () => req("/admin/metrics"),
  exportPath: (id: string) => req(`/admin/paths/${id}/export`),
  importPath: (data: unknown) => req("/admin/paths/import", { method: "POST", body: { data } }),
  audit: (limit = 100) => req("/admin/audit?limit=" + limit),
  aiSuggest: (body: { genre: string; lesson_title: string; prompt: string; field: string }) =>
    req("/admin/ai-suggest", { method: "POST", body }),
  criteria: (genre: string) => req("/admin/criteria?genre=" + encodeURIComponent(genre)),
};
