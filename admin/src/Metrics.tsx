// Metrics.tsx — dashboard trên Ant Design: Statistic cards + bar chart 14 ngày.
import { useEffect, useState } from "react";
import { App as AntApp, Card, Col, Row, Statistic, Tooltip, Typography } from "antd";
import { Api } from "./api";

type M = {
  hoc_vien: number; guests: number; mcs: number; clips_total: number; clips_today: number;
  reviews_pending: number; reviews_overdue: number; tickets_outstanding: number;
  filler_avg_7d: number | null; real_asr_ratio_7d: number | null;
  by_day: { d: string; clips: number; users: number }[];
};

export default function Metrics() {
  const { message } = AntApp.useApp();
  const [m, setM] = useState<M | null>(null);
  useEffect(() => { Api.metrics().then(setM).catch((e) => message.error(e.message)); }, []);
  if (!m) return <Card loading />;

  const cards: [string, string | number, string?][] = [
    ["Học viên", m.hoc_vien, `${m.guests} là khách`],
    ["MC", m.mcs],
    ["Clip đã nộp", m.clips_total, `${m.clips_today} hôm nay`],
    ["Review đang chờ", m.reviews_pending, m.reviews_overdue ? `⚠ ${m.reviews_overdue} quá hạn 72h` : "đúng SLA"],
    ["Vé Vàng lưu hành", m.tickets_outstanding],
    ["Từ đệm TB (7 ngày)", m.filler_avg_7d ?? "—", "thấp hơn = tốt"],
    ["ASR thật (7 ngày)", m.real_asr_ratio_7d != null ? Math.round(m.real_asr_ratio_7d * 100) + "%" : "—", "còn lại là giả lập"],
  ];
  const maxClips = Math.max(1, ...m.by_day.map((d) => d.clips));

  return (
    <>
      <Row gutter={[12, 12]}>
        {cards.map(([label, val, sub]) => (
          <Col key={label} xs={12} md={8} lg={6} xl={6}>
            <Card size="small">
              <Statistic title={label} value={val} />
              {sub && <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>{sub}</Typography.Text>}
            </Card>
          </Col>
        ))}
      </Row>

      <Card size="small" title="Clip nộp theo ngày (14 ngày)" style={{ marginTop: 12 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 130 }}>
          {m.by_day.map((d) => (
            <Tooltip key={d.d} title={`${d.d}: ${d.clips} clip · ${d.users} người dùng mới`}>
              <div style={{ flex: 1, textAlign: "center", cursor: "default" }}>
                <div style={{
                  height: Math.max(d.clips ? 8 : 2, Math.round((d.clips / maxClips) * 100)),
                  background: d.clips ? "#FF6B5B" : "#EDE3D6",
                  borderRadius: 6,
                }} />
                <Typography.Text type="secondary" style={{ fontSize: 10 }}>{d.d.slice(8)}</Typography.Text>
              </div>
            </Tooltip>
          ))}
        </div>
      </Card>
    </>
  );
}
