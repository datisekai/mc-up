// App.tsx — khung admin: đăng nhập + sidebar 7 khu (Pha A: khu Nội dung).
import { useState } from "react";
import { Api, hasToken, setToken } from "./api";
import Content from "./Content";

const AREAS = [
  { key: "content", label: "📚 Nội dung", ready: true },
  { key: "rubrics", label: "🎯 Rubric chấm", ready: false, phase: "B" },
  { key: "users", label: "👥 Người dùng", ready: false, phase: "B" },
  { key: "reviews", label: "🎤 Vận hành review", ready: false, phase: "C" },
  { key: "economy", label: "🎟 Vé & tiến độ", ready: false, phase: "C" },
  { key: "metrics", label: "📈 Số liệu", ready: false, phase: "C" },
];

export default function App() {
  const [authed, setAuthed] = useState(hasToken());
  const [area, setArea] = useState("content");

  if (!authed) return <Login onOk={() => setAuthed(true)} />;

  return (
    <div className="shell">
      <aside className="side">
        <h1>McUp · Admin</h1>
        <nav className="nav">
          {AREAS.map((a) => (
            <button key={a.key} className={area === a.key ? "on" : ""} disabled={!a.ready}
              onClick={() => setArea(a.key)}>
              {a.label}
              {!a.ready && <span className="soon">Pha {a.phase}</span>}
            </button>
          ))}
          <button style={{ marginTop: 18 }} onClick={() => { setToken(null); setAuthed(false); }}>
            Đăng xuất
          </button>
        </nav>
      </aside>
      {area === "content" && <Content />}
    </div>
  );
}

function Login({ onOk }: { onOk: () => void }) {
  const [email, setEmail] = useState("admin@test.vn");
  const [pw, setPw] = useState("123456");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true); setErr("");
    try {
      const r = await Api.login(email.trim(), pw);
      if (r.role !== "admin") { setErr("Tài khoản này không phải admin."); setBusy(false); return; }
      setToken(r.access_token);
      onOk();
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  }

  return (
    <div className="login-wrap">
      <div className="card" style={{ width: 340 }}>
        <h2 style={{ color: "var(--primary)", marginBottom: 4 }}>McUp · Admin</h2>
        <p className="muted" style={{ marginBottom: 10 }}>Quản lý nội dung — sửa tại chỗ, nháp trước, xuất bản sau.</p>
        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} />
        <label>Mật khẩu</label>
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && go()} />
        {err && <p className="err" style={{ marginTop: 8 }}>{err}</p>}
        <div style={{ marginTop: 12 }}>
          <button onClick={go} disabled={busy}>{busy ? "Đang vào..." : "Đăng nhập"}</button>
        </div>
      </div>
    </div>
  );
}
