// Metrics.tsx — khu ⑦ (Pha C): dashboard số liệu vận hành + chuỗi 14 ngày.
import { useEffect, useState } from "react";
import { Api } from "./api";

type M = {
  hoc_vien: number; guests: number; mcs: number; clips_total: number; clips_today: number;
  reviews_pending: number; reviews_overdue: number; tickets_outstanding: number;
  filler_avg_7d: number | null; real_asr_ratio_7d: number | null;
  by_day: { d: string; clips: number; users: number }[];
};

export default function Metrics() {
  const [m, setM] = useState<M | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { Api.metrics().then(setM).catch((e) => setErr(e.message)); }, []);
  if (err) return <main className="main"><p className="err">{err}</p></main>;
  if (!m) return <main className="main"><p className="muted">Đang tải…</p></main>;

  const cards = [
    ["Học viên", m.hoc_vien, `${m.guests} là khách`],
    ["MC", m.mcs, ""],
    ["Clip đã nộp", m.clips_total, `${m.clips_today} hôm nay`],
    ["Review đang chờ", m.reviews_pending, m.reviews_overdue ? `⚠ ${m.reviews_overdue} quá hạn 72h` : "đúng SLA"],
    ["Vé Vàng đang lưu hành", m.tickets_outstanding, ""],
    ["Từ đệm TB (7 ngày)", m.filler_avg_7d ?? "—", "thấp hơn = tốt"],
    ["Tỉ lệ ASR thật (7 ngày)", m.real_asr_ratio_7d != null ? Math.round(m.real_asr_ratio_7d * 100) + "%" : "—", "còn lại là giả lập"],
  ] as const;
  const maxClips = Math.max(1, ...m.by_day.map((d) => d.clips));

  return (
    <main className="main" style={{ display: "block" }}>
      <div className="row" style={{ alignItems: "stretch", marginBottom: 12 }}>
        {cards.map(([label, val, sub]) => (
          <div key={label} className="card" style={{ flex: 1, minWidth: 150 }}>
            <div className="muted" style={{ fontSize: 11.5 }}>{label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, margin: "2px 0" }}>{val}</div>
            {sub && <div className="muted" style={{ fontSize: 11 }}>{sub}</div>}
          </div>
        ))}
      </div>

      <div className="card">
        <b>Clip nộp theo ngày (14 ngày)</b>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120, marginTop: 12 }}>
          {m.by_day.map((d) => (
            <div key={d.d} style={{ flex: 1, textAlign: "center" }} title={`${d.d}: ${d.clips} clip · ${d.users} user mới`}>
              <div style={{
                height: Math.round((d.clips / maxClips) * 100) + "%",
                minHeight: d.clips ? 6 : 2,
                background: d.clips ? "var(--primary)" : "var(--hair)",
                borderRadius: 6,
              }} />
              <div className="muted" style={{ fontSize: 9, marginTop: 4 }}>{d.d.slice(8)}</div>
            </div>
          ))}
        </div>
        <p className="muted" style={{ marginTop: 8 }}>Di chuột lên cột để xem chi tiết (kèm số người dùng mới).</p>
      </div>
    </main>
  );
}
