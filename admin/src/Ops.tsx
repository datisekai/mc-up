// Ops.tsx — khu ⑤ (Pha C): hàng đợi Vé Vàng + SLA 72h, nghe clip/giọng MC, hoàn vé.
import { useEffect, useState } from "react";
import { Api } from "./api";

type Rv = {
  id: string; status: string; created_at: string; age_hours: number; overdue: boolean;
  hoc_vien: string; mc: string | null; clip_url: string | null; voice_url: string | null;
  note: string | null; speed_wpm: number | null; filler_count: number | null;
};

export default function Ops() {
  const [status, setStatus] = useState("pending");
  const [rows, setRows] = useState<Rv[]>([]);
  const [err, setErr] = useState("");
  const load = (st = status) => Api.reviews(st).then(setRows).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [status]);

  return (
    <main className="main" style={{ display: "block" }}>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <b>🎤 Vận hành review (SLA 72h)</b>
          <div className="row">
            {["pending", "submitted", "expired", "all"].map((st) => (
              <button key={st} className={"tiny " + (status === st ? "" : "ghost")} onClick={() => setStatus(st)}>
                {st === "pending" ? "Đang chờ" : st === "submitted" ? "Đã nhận xét" : st === "expired" ? "Đã hoàn vé" : "Tất cả"}
              </button>
            ))}
          </div>
        </div>
        {err && <p className="err">{err}</p>}
      </div>

      {rows.map((r) => (
        <div key={r.id} className="card" style={{ marginBottom: 8, ...(r.overdue ? { outline: "2px solid var(--primary)" } : {}) }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <b>{r.hoc_vien}</b>
              {" "}<span className={"pill " + (r.status === "submitted" ? "published" : r.status === "expired" ? "archived" : "draft")}>{r.status}</span>
              {r.overdue && <span className="pill" style={{ background: "#FFE3DE", color: "#B3271B", marginLeft: 6 }}>QUÁ HẠN {r.age_hours}h</span>}
              <div className="muted">
                {r.age_hours}h trước · {r.speed_wpm != null ? `${r.speed_wpm} wpm · ${r.filler_count} từ đệm` : "chưa có điểm"}
                {r.mc ? ` · MC: ${r.mc}` : ""}
              </div>
              {r.note && <div className="muted" style={{ fontStyle: "italic" }}>“{r.note}”</div>}
            </div>
            <div className="row">
              {r.clip_url && <span><label style={{ margin: 0 }}>Clip học viên</label><audio controls preload="none" src={r.clip_url} style={{ height: 32, width: 210 }} /></span>}
              {r.voice_url && <span><label style={{ margin: 0 }}>Giọng MC</label><audio controls preload="none" src={r.voice_url} style={{ height: 32, width: 210 }} /></span>}
              {r.status === "pending" && (
                <button className="tiny gold" onClick={async () => { await Api.refund(r.id); load(); }}>Hoàn vé</button>
              )}
            </div>
          </div>
        </div>
      ))}
      {rows.length === 0 && <div className="card"><p className="muted">Không có yêu cầu nào.</p></div>}
    </main>
  );
}
