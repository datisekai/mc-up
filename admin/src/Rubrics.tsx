// Rubrics.tsx — rubric editor trên Ant Design. Đổi ngưỡng/tip → app đổi NGAY, không deploy.
import { useEffect, useState } from "react";
import { UndoOutlined } from "@ant-design/icons";
import { App as AntApp, Button, Card, Input, InputNumber, Space, Tag, Tooltip, Typography } from "antd";
import { Api } from "./api";

type Rub = {
  genre_id: string; genre: string; wpm_min: number; wpm_max: number; focus: string;
  tips: Record<string, string[]>; override: boolean; criteria: string[];
};
const TIP_LABELS: Record<string, string> = {
  good: "Khen (đạt)", fast: "Nhắc nói NHANH", slow: "Nhắc nói CHẬM", filler: "Nhắc TỪ ĐỆM",
};

export default function Rubrics() {
  const { message } = AntApp.useApp();
  const [rubs, setRubs] = useState<Rub[]>([]);
  const load = () => Api.rubrics().then(setRubs).catch((e) => message.error(e.message));
  useEffect(() => { load(); }, []);

  return (
    <Space direction="vertical" style={{ width: "100%" }} size={12}>
      <Card size="small">
        <b>Rubric chấm theo thể loại</b>
        <Typography.Paragraph type="secondary" style={{ margin: "4px 0 0", fontSize: 13 }}>
          Mỗi tình huống một POOL nhiều biến thể (mỗi dòng một câu) — app rút ngẫu nhiên cho đỡ lặp.
          Lưu = có hiệu lực NGAY với bộ chấm + tiêu chí học viên. "Về mặc định" = xoá override.
        </Typography.Paragraph>
      </Card>
      {rubs.map((r) => <RubricCard key={r.genre_id} r={r} onChanged={load} />)}
    </Space>
  );
}

function RubricCard({ r, onChanged }: { r: Rub; onChanged: () => void }) {
  const { message } = AntApp.useApp();
  const [min, setMin] = useState(r.wpm_min);
  const [max, setMax] = useState(r.wpm_max);
  const [focus, setFocus] = useState(r.focus);
  const [tips, setTips] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(TIP_LABELS).map(([k]) => [k, (r.tips[k] ?? []).join("\n")])));
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await Api.saveRubric(r.genre_id, {
        wpm_min: Number(min), wpm_max: Number(max), focus,
        tips: Object.fromEntries(Object.entries(tips).map(([k, v]) => [k, v.split("\n").map((x) => x.trim()).filter(Boolean)])),
      });
      message.success("Đã lưu — hiệu lực ngay với bộ chấm");
      onChanged();
    } catch (e: any) { message.error(e.message); }
    setBusy(false);
  }
  async function reset() {
    setBusy(true);
    try { await Api.resetRubric(r.genre_id); message.success("Đã về mặc định"); onChanged(); }
    catch (e: any) { message.error(e.message); }
    setBusy(false);
  }

  return (
    <Card size="small" title={<Space>{r.genre}{r.override && <Tag color="gold">đã override</Tag>}</Space>}
      extra={
        <Space>
          {r.override && (
            <Tooltip title="Xoá chỉnh sửa của bạn — quay về rubric mặc định của hệ thống">
              <Button size="small" icon={<UndoOutlined />} disabled={busy} onClick={reset}>Về mặc định</Button>
            </Tooltip>
          )}
          <Tooltip title="Lưu rubric — bộ chấm AI + tiêu chí học viên đổi theo NGAY, không cần deploy">
            <Button size="small" type="primary" loading={busy} onClick={save}>Lưu rubric</Button>
          </Tooltip>
        </Space>
      }>
      <Space wrap size={12} style={{ marginBottom: 8 }}>
        <span>Tốc độ (chữ/phút): <InputNumber size="small" value={min} onChange={(v) => setMin(v ?? min)} style={{ width: 80 }} />
          {" – "}<InputNumber size="small" value={max} onChange={(v) => setMax(v ?? max)} style={{ width: 80 }} /></span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>Chất thể loại:
          <Input size="small" value={focus} onChange={(e) => setFocus(e.target.value)} style={{ width: 280 }} /></span>
      </Space>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
        {Object.entries(TIP_LABELS).map(([k, lbl]) => (
          <div key={k}>
            <Typography.Text type="secondary" style={{ fontSize: 11.5, fontWeight: 700 }}>{lbl}</Typography.Text>
            <Input.TextArea rows={3} value={tips[k]} onChange={(e) => setTips({ ...tips, [k]: e.target.value })} />
          </div>
        ))}
      </div>
      <Typography.Text type="secondary" style={{ display: "block", marginTop: 8, fontSize: 12.5 }}>
        Học viên sẽ thấy: {r.criteria.join(" · ")}
      </Typography.Text>
    </Card>
  );
}
