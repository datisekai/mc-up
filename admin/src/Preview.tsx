// Preview.tsx — "Xem như học viên": render Thẻ nhiệm vụ y hệt màn luyện trong app,
// kèm tiêu chí đạt sinh từ rubric thể loại. Giữ tông "Sân khấu ấm" của APP (không theo antd).
import { useEffect, useState } from "react";
import { Button } from "antd";
import { Api, LessonNode } from "./api";

export default function Preview({ lesson, genre, onClose }: {
  lesson: LessonNode; genre: string; onClose: () => void;
}) {
  const [criteria, setCriteria] = useState<string[]>([]);
  const [showEx, setShowEx] = useState(false);
  useEffect(() => { Api.criteria(genre).then((r) => setCriteria(r.criteria)).catch(() => {}); }, [genre]);
  const b = lesson.brief ?? {};

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="phone" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <b style={{ color: "#FF6B5B" }}>McUp · như học viên thấy</b>
          <Button size="small" onClick={onClose} title="Đóng bản xem trước, quay lại trình soạn">Đóng</Button>
        </div>

        {lesson.tip && (
          <div style={{ background: "#F6EDE2", borderRadius: 12, padding: 11, fontSize: 13.5 }}>{lesson.tip}</div>
        )}
        <div className="pv-label">Đề bài</div>
        <div className="pv-prompt">{lesson.prompt || "(chưa có đề)"}</div>
        <div className="pv-label" style={{ marginTop: 10 }}>Gợi ý dàn ý</div>
        {(b.steps ?? []).map((s, i) => <div key={i} className="pv-text">{i + 1}.  {s}</div>)}
        {!(b.steps ?? []).length && <div className="pv-muted">(chưa có dàn ý)</div>}

        {b.objective && (<><div className="pv-label">Mục tiêu</div><div className="pv-text">{b.objective}</div></>)}
        {b.context && (<><div className="pv-label">Tình huống</div><div className="pv-text">{b.context}</div></>)}

        <div className="pv-label">Tiêu chí đạt <span style={{ textTransform: "none", fontWeight: 600 }}>(tự sinh từ rubric "{genre}")</span></div>
        {criteria.map((c, i) => (
          <div key={i} className="pv-crit"><span className="pv-dot" /><span className="pv-text">{c}</span></div>
        ))}

        {b.example && (showEx ? (
          <div className="pv-example">
            <div style={{ fontStyle: "normal", fontWeight: 800, fontSize: 10, color: "#7A6E82", marginBottom: 6 }}>
              VÍ DỤ MẪU · tham khảo cách làm, đừng đọc nguyên văn
            </div>
            "{b.example}"
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            <Button onClick={() => setShowEx(true)} title="Trong app, ví dụ mẫu bị giấu sau nút này để chống học vẹt">
              Bí quá? Xem gợi ý mẫu
            </Button>
          </div>
        ))}

        <div style={{ marginTop: 16, background: "#FF6B5B", color: "#fff", borderRadius: 999, padding: 13, textAlign: "center", fontWeight: 800, fontSize: 14 }}>
          Bắt đầu quay (nói vào mic)
        </div>
      </div>
    </div>
  );
}
