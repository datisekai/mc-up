// App.tsx — khung admin: đăng nhập + sidebar 7 khu (Pha A: khu Nội dung).
import { useState } from "react";
import { Api, hasToken, setToken } from "./api";
import Audit from "./Audit";
import Content from "./Content";
import Metrics from "./Metrics";
import Ops from "./Ops";
import Rubrics from "./Rubrics";
import Users from "./Users";

// Vé & tiến độ gộp vào khu Người dùng (nút +1 vé / grant ở từng dòng)
const AREAS = [
  { key: "content", label: "📚 Nội dung", ready: true, tip: "Soạn/sửa giáo trình: thể loại, lộ trình, buổi, bài — sửa tại chỗ, duyệt rồi xuất bản" },
  { key: "rubrics", label: "🎯 Rubric chấm", ready: true, tip: "Chỉnh ngưỡng tốc độ & lời khen/nhắc theo thể loại — lưu là app đổi theo ngay" },
  { key: "users", label: "👥 Người dùng & vé", ready: true, tip: "Tìm người dùng, tạo tài khoản MC, đổi vai, reset mật khẩu, tặng Vé Vàng" },
  { key: "reviews", label: "🎤 Vận hành review", ready: true, tip: "Hàng đợi Vé Vàng: nghe clip, theo dõi hạn 72h, hoàn vé" },
  { key: "metrics", label: "📈 Số liệu", ready: true, tip: "Dashboard: người luyện, clip/ngày, % giọng thật, review đúng hạn" },
  { key: "audit", label: "🗂 Nhật ký", ready: true, tip: "Lịch sử thao tác admin — ai sửa gì, lúc nào" },
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
              title={a.tip} onClick={() => setArea(a.key)}>
              {a.label}
            </button>
          ))}
          <button style={{ marginTop: 18 }} title="Thoát phiên admin — quay về màn đăng nhập"
            onClick={() => { setToken(null); setAuthed(false); }}>
            Đăng xuất
          </button>
        </nav>
      </aside>
      {area === "content" && <Content />}
      {area === "rubrics" && <Rubrics />}
      {area === "users" && <Users />}
      {area === "reviews" && <Ops />}
      {area === "metrics" && <Metrics />}
      {area === "audit" && <Audit />}
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
          <button onClick={go} disabled={busy} title="Đăng nhập bằng tài khoản có vai admin">{busy ? "Đang vào..." : "Đăng nhập"}</button>
        </div>
      </div>
    </div>
  );
}
