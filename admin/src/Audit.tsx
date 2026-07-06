// Audit.tsx — nhật ký thao tác trên Ant Design Table (chỉ đọc).
import { useEffect, useState } from "react";
import { App as AntApp, Card, Table, Tag, Typography } from "antd";
import { Api } from "./api";

type Row = { id: string; admin: string; action: string; entity: string; entity_id: string; detail: any; at: string };

const ACTION_META: Record<string, { label: string; color: string }> = {
  patch: { label: "Sửa", color: "blue" },
  publish: { label: "Xuất bản", color: "green" },
  unpublish: { label: "Gỡ xuất bản", color: "orange" },
  "ai-split": { label: "AI chia", color: "purple" },
  rubric: { label: "Rubric", color: "magenta" },
  user: { label: "Tạo user", color: "cyan" },
  grant: { label: "Grant", color: "gold" },
  refund: { label: "Hoàn vé", color: "volcano" },
  import: { label: "Nhập JSON", color: "geekblue" },
};

export default function Audit() {
  const { message } = AntApp.useApp();
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => { Api.audit(200).then(setRows).catch((e) => message.error(e.message)); }, []);

  return (
    <Card size="small" title="Nhật ký thao tác" extra={
      <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>200 gần nhất · append-only, không sửa được</Typography.Text>
    }>
      <Table rowKey="id" dataSource={rows} size="small" pagination={{ pageSize: 25 }}
        columns={[
          {
            title: "Lúc", dataIndex: "at", width: 160,
            render: (v: string) => new Date(v).toLocaleString("vi-VN"),
          },
          { title: "Admin", dataIndex: "admin", width: 140 },
          {
            title: "Thao tác", dataIndex: "action", width: 130,
            render: (a: string) => {
              const meta = ACTION_META[a] ?? { label: a, color: "default" };
              return <Tag color={meta.color}>{meta.label}</Tag>;
            },
          },
          { title: "Đối tượng", dataIndex: "entity", width: 100 },
          {
            title: "Chi tiết", dataIndex: "detail",
            render: (d: any) => d ? <Typography.Text type="secondary" style={{ fontSize: 12 }}>{JSON.stringify(d)}</Typography.Text> : null,
          },
        ]} />
    </Card>
  );
}
