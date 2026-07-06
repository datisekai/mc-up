// Rubrics.tsx — khu ③ (Pha B): sửa ngưỡng/tip theo thể loại, ghi DB — KHÔNG deploy.
// Đổi rubric → tiêu chí học viên + bộ chấm tự khớp (1 nguồn sự thật, FR-15).
import { useEffect, useState } from "react";
import { Api } from "./api";

type Rub = {
  genre_id: string; genre: string; wpm_min: number; wpm_max: number; focus: string;
  tips: Record<string, string[]>; override: boolean; criteria: string[];
};
const TIP_LABELS: Record<string, string> = {
  good: "Khen (đạt)", fast: "Nhắc nói NHANH", slow: "Nhắc nói CHẬM", filler: "Nhắc TỪ ĐỆM",
};

export default function Rubrics() {
  const [rubs, setRubs] = useState<Rub[]>([]);
  const [err, setErr] = useState("");
  const load = () => Api.rubrics().then(setRubs).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  return (
    <main className="main" style={{ display: "block" }}>
      <div className="card" style={{ marginBottom: 12 }}>
        <b>🎯 Rubric chấm theo thể loại</b>
        <p className="muted" style={{ marginTop: 4 }}>
          Mỗi tình huống một POOL nhiều biến thể (mỗi dòng một câu) — app rút ngẫu nhiên cho đỡ lặp.
          Lưu = có hiệu lực NGAY với bộ chấm + tiêu chí học viên thấy. "Về mặc định" = xoá override, quay về registry code.
        </p>
        {err && <p className="err">{err}</p>}
      </div>
      {rubs.map((r) => <RubricCard key={r.genre_id} r={r} onChanged={load} />)}
    </main>
  );
}

function RubricCard({ r, onChanged }: { r: Rub; onChanged: () => void }) {
  const [min, setMin] = useState(r.wpm_min);
  const [max, setMax] = useState(r.wpm_max);
  const [focus, setFocus] = useState(r.focus);
  const [tips, setTips] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(TIP_LABELS).map(([k]) => [k, (r.tips[k] ?? []).join("\n")])));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function save() {
    setBusy(true); setMsg("");
    try {
      await Api.saveRubric(r.genre_id, {
        wpm_min: Number(min), wpm_max: Number(max), focus,
        tips: Object.fromEntries(Object.entries(tips).map(([k, v]) => [k, v.split("\n").map((x) => x.trim()).filter(Boolean)])),
      });
      setMsg("Đã lưu — hiệu lực ngay ✓");
      onChanged();
    } catch (e: any) { setMsg(e.message); }
    setBusy(false);
  }
  async function reset() {
    setBusy(true);
    try { await Api.resetRubric(r.genre_id); onChanged(); } catch (e: any) { setMsg(e.message); }
    setBusy(false);
  }

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <b>{r.genre} {r.override && <span className="pill draft">đã override</span>}</b>
        <div className="row">
          {r.override && <button className="tiny ghost" disabled={busy} onClick={reset}>Về mặc định</button>}
          <button className="tiny gold" disabled={busy} onClick={save}>Lưu rubric</button>
          {msg && <span className="saved">{msg}</span>}
        </div>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <div style={{ width: 130 }}>
          <label>Tốc độ min (wpm)</label>
          <input type="number" value={min} onChange={(e) => setMin(Number(e.target.value))} />
        </div>
        <div style={{ width: 130 }}>
          <label>Tốc độ max (wpm)</label>
          <input type="number" value={max} onChange={(e) => setMax(Number(e.target.value))} />
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <label>Chất thể loại (focus)</label>
          <input value={focus} onChange={(e) => setFocus(e.target.value)} />
        </div>
      </div>
      <div className="row" style={{ alignItems: "flex-start", marginTop: 4 }}>
        {Object.entries(TIP_LABELS).map(([k, lbl]) => (
          <div key={k} style={{ flex: 1, minWidth: 200 }}>
            <label>{lbl}</label>
            <textarea rows={3} value={tips[k]} onChange={(e) => setTips({ ...tips, [k]: e.target.value })} />
          </div>
        ))}
      </div>
      <p className="muted" style={{ marginTop: 6 }}>
        Học viên sẽ thấy: {r.criteria.join(" · ")}
      </p>
    </div>
  );
}
