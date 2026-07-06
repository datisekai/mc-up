// Users.tsx — khu ④ (Pha B): tìm kiếm, đổi vai, tạo MC, reset mật khẩu + tặng vé (Pha C).
import { useEffect, useState } from "react";
import { Api } from "./api";

type U = {
  id: string; email: string; display_name: string | null; role: string; mc_title: string | null;
  is_guest: boolean; xp: number; streak: number; tickets: number;
};

export default function Users() {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<U[]>([]);
  const [err, setErr] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const load = (query = q) => Api.users(query).then(setUsers).catch((e) => setErr(e.message));
  useEffect(() => { load(""); }, []);

  return (
    <main className="main" style={{ display: "block" }}>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <b>👥 Người dùng</b>
          <button className="tiny" title="Mở form tạo tài khoản MC hoặc admin mới (kèm chức danh hiển thị trên thẻ bảo chứng)" onClick={() => setShowCreate(!showCreate)}>＋ Tạo MC / admin</button>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <input placeholder="Tìm theo email hoặc tên…" value={q} style={{ flex: 1 }}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()} />
          <button className="ghost" title="Tìm theo email hoặc tên hiển thị" onClick={() => load()}>Tìm</button>
        </div>
        {showCreate && <CreateForm onDone={() => { setShowCreate(false); load(); }} onErr={setErr} />}
        {err && <p className="err" style={{ marginTop: 6 }}>{err}</p>}
      </div>

      {users.map((u) => <UserRow key={u.id} u={u} onChanged={() => load()} />)}
      {users.length === 0 && <div className="card"><p className="muted">Không có kết quả.</p></div>}
    </main>
  );
}

function CreateForm({ onDone, onErr }: { onDone: () => void; onErr: (m: string) => void }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [role, setRole] = useState("mc");
  return (
    <div className="row" style={{ marginTop: 10, alignItems: "flex-end" }}>
      <div style={{ flex: 1, minWidth: 160 }}><label>Email</label><input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div style={{ width: 110 }}><label>Mật khẩu</label><input value={pw} onChange={(e) => setPw(e.target.value)} /></div>
      <div style={{ flex: 1, minWidth: 130 }}><label>Tên hiển thị</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div style={{ flex: 1, minWidth: 150 }}><label>Chức danh MC</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="vd: Dẫn 500+ sự kiện" /></div>
      <div style={{ width: 110 }}><label>Vai</label>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="mc">mc</option><option value="admin">admin</option><option value="hoc_vien">học viên</option>
        </select>
      </div>
      <button className="gold" title="Tạo tài khoản với thông tin bên trái — người này đăng nhập được ngay" onClick={async () => {
        try { await Api.createUser({ email, password: pw, display_name: name, role, mc_title: title || undefined }); onDone(); }
        catch (e: any) { onErr(e.message); }
      }}>Tạo</button>
    </div>
  );
}

function UserRow({ u, onChanged }: { u: U; onChanged: () => void }) {
  const [msg, setMsg] = useState("");
  async function act(fn: () => Promise<unknown>, ok: string) {
    try { await fn(); setMsg(ok); onChanged(); } catch (e: any) { setMsg(e.message); }
  }
  return (
    <div className="card" style={{ marginBottom: 8 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div style={{ minWidth: 220 }}>
          <b>{u.display_name || "(chưa đặt tên)"}</b> {u.is_guest && <span className="pill draft">khách</span>}
          <div className="muted">{u.email}</div>
          {u.mc_title && <div className="muted">🎤 {u.mc_title}</div>}
        </div>
        <div className="row">
          <span className="muted">🔥{u.streak} · ⭐{u.xp} · 🎟{u.tickets}</span>
          <select value={u.role} style={{ width: 110 }} title="Đổi vai: học viên / MC (nhận review Vé Vàng) / admin (vào trang này)"
            onChange={(e) => act(() => Api.patchUser(u.id, { role: e.target.value }), "Đã đổi vai ✓")}>
            <option value="hoc_vien">học viên</option><option value="mc">mc</option><option value="admin">admin</option>
          </select>
          <button className="tiny ghost" title="Tặng người này 1 Vé Vàng (gửi clip cho MC thật nhận xét)" onClick={() => act(() => Api.grant(u.id, { tickets_delta: 1 }), "+1 vé ✓")}>＋1 🎟</button>
          <button className="tiny ghost" title="Đặt mật khẩu mới cho người này (khi họ quên)" onClick={() => {
            const p = window.prompt("Mật khẩu mới cho " + u.email + ":");
            if (p) act(() => Api.patchUser(u.id, { password: p }), "Đã reset mật khẩu ✓");
          }}>Reset MK</button>
          {msg && <span className="saved">{msg}</span>}
        </div>
      </div>
    </div>
  );
}
