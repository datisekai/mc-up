// Audit.tsx — khu Nhật ký (Pha D): ai sửa gì, lúc nào. Append-only, chỉ đọc.
import { useEffect, useState } from "react";
import { Api } from "./api";

type Row = { id: string; admin: string; action: string; entity: string; entity_id: string; detail: any; at: string };

const ACTION_LABEL: Record<string, string> = {
  patch: "✏️ Sửa", publish: "✅ Xuất bản", unpublish: "↩️ Gỡ xuất bản", "ai-split": "🧠 AI chia",
  rubric: "🎯 Rubric", user: "👤 Tạo user", grant: "🎁 Grant", refund: "🎟 Hoàn vé", import: "⬆ Nhập JSON",
};

export default function Audit() {
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState("");
  useEffect(() => { Api.audit(200).then(setRows).catch((e) => setErr(e.message)); }, []);

  return (
    <main className="main" style={{ display: "block" }}>
      <div className="card" style={{ marginBottom: 12 }}>
        <b>🗂 Nhật ký thao tác</b>
        <p className="muted" style={{ marginTop: 4 }}>200 thao tác gần nhất — ai sửa gì, lúc nào. Không xoá/sửa được.</p>
        {err && <p className="err">{err}</p>}
      </div>
      <div className="card">
        {rows.length === 0 && <p className="muted">Chưa có thao tác nào.</p>}
        {rows.map((r) => (
          <div key={r.id} className="row" style={{ padding: "7px 0", borderBottom: "1px solid var(--hair)", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13 }}>
              <b>{ACTION_LABEL[r.action] ?? r.action}</b> · {r.entity}
              {r.detail && <span className="muted"> — {JSON.stringify(r.detail)}</span>}
            </span>
            <span className="muted" style={{ whiteSpace: "nowrap" }}>
              {r.admin} · {new Date(r.at).toLocaleString("vi-VN")}
            </span>
          </div>
        ))}
      </div>
    </main>
  );
}
