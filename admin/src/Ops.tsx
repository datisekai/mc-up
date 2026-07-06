// Ops.tsx — vận hành review trên Ant Design: Segmented filter, cảnh báo SLA, audio, hoàn vé.
import { useEffect, useState } from "react";
import { App as AntApp, Button, Card, Empty, Popconfirm, Segmented, Space, Tag, Tooltip, Typography } from "antd";
import { Api } from "./api";

type Rv = {
  id: string; status: string; created_at: string; age_hours: number; overdue: boolean;
  hoc_vien: string; mc: string | null; clip_url: string | null; voice_url: string | null;
  note: string | null; speed_wpm: number | null; filler_count: number | null;
};

const FILTERS = [
  { value: "pending", label: "Đang chờ" },
  { value: "submitted", label: "Đã nhận xét" },
  { value: "expired", label: "Đã hoàn vé" },
  { value: "all", label: "Tất cả" },
];

export default function Ops() {
  const { message } = AntApp.useApp();
  const [status, setStatus] = useState("pending");
  const [rows, setRows] = useState<Rv[]>([]);
  const load = (st = status) => Api.reviews(st).then(setRows).catch((e) => message.error(e.message));
  useEffect(() => { load(); }, [status]);

  return (
    <Space direction="vertical" style={{ width: "100%" }} size={12}>
      <Card size="small">
        <Space style={{ width: "100%", justifyContent: "space-between" }} wrap>
          <b>Vận hành review — SLA 72h</b>
          <Tooltip title="Đang chờ: MC chưa trả lời (quá 72h viền đỏ) · Đã nhận xét: nghe được giọng MC · Đã hoàn vé: quá hạn hoặc hoàn tay">
            <Segmented options={FILTERS} value={status} onChange={(v) => setStatus(v as string)} />
          </Tooltip>
        </Space>
      </Card>

      {rows.length === 0 && <Card><Empty description="Không có yêu cầu nào" /></Card>}
      {rows.map((r) => (
        <Card key={r.id} size="small"
          style={r.overdue ? { borderColor: "#E5484D", borderWidth: 2 } : undefined}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ minWidth: 220 }}>
              <Space size={6} wrap>
                <b>{r.hoc_vien}</b>
                <Tag color={r.status === "submitted" ? "green" : r.status === "expired" ? "default" : "gold"}>
                  {r.status === "submitted" ? "đã nhận xét" : r.status === "expired" ? "đã hoàn vé" : "đang chờ"}
                </Tag>
                {r.overdue && <Tag color="red">QUÁ HẠN {r.age_hours}h</Tag>}
              </Space>
              <div>
                <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
                  {r.age_hours}h trước · {r.speed_wpm != null ? `${r.speed_wpm} chữ/phút · ${r.filler_count} từ đệm` : "chưa có điểm"}
                  {r.mc ? ` · MC: ${r.mc}` : ""}
                </Typography.Text>
              </div>
              {r.note && <Typography.Text italic type="secondary">"{r.note}"</Typography.Text>}
            </div>
            <Space wrap align="center">
              {r.clip_url && (
                <div>
                  <Typography.Text type="secondary" style={{ fontSize: 11, display: "block" }}>Clip học viên</Typography.Text>
                  <audio controls preload="none" src={r.clip_url} style={{ height: 32, width: 220 }} />
                </div>
              )}
              {r.voice_url && (
                <div>
                  <Typography.Text type="secondary" style={{ fontSize: 11, display: "block" }}>Giọng MC</Typography.Text>
                  <audio controls preload="none" src={r.voice_url} style={{ height: 32, width: 220 }} />
                </div>
              )}
              {r.status === "pending" && (
                <Popconfirm title="Hoàn vé cho học viên?" description="Yêu cầu đóng lại + học viên nhận lại 1 Vé Vàng."
                  okText="Hoàn vé" cancelText="Thôi"
                  onConfirm={async () => { await Api.refund(r.id); message.success("Đã hoàn vé"); load(); }}>
                  <Tooltip title="Dùng khi MC không kịp trả lời trong 72h">
                    <Button type="primary">Hoàn vé</Button>
                  </Tooltip>
                </Popconfirm>
              )}
            </Space>
          </div>
        </Card>
      ))}
    </Space>
  );
}
