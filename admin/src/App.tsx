// App.tsx — khung admin trên Ant Design: Sider mận sâu + Menu icon thật, login Card.
import { useState } from "react";
import {
  BarChartOutlined, BookOutlined, CustomerServiceOutlined, HistoryOutlined,
  LogoutOutlined, TeamOutlined, AimOutlined,
} from "@ant-design/icons";
import { Button, Card, Form, Input, Layout, Menu, Typography } from "antd";
import { Api, hasToken, setToken } from "./api";
import Audit from "./Audit";
import Content from "./Content";
import Metrics from "./Metrics";
import Ops from "./Ops";
import Rubrics from "./Rubrics";
import Users from "./Users";

const AREAS = [
  { key: "content", icon: <BookOutlined />, label: "Nội dung", tip: "Soạn/sửa giáo trình — sửa tại chỗ, duyệt rồi xuất bản" },
  { key: "rubrics", icon: <AimOutlined />, label: "Rubric chấm", tip: "Ngưỡng tốc độ & lời khen/nhắc theo thể loại — lưu là app đổi ngay" },
  { key: "users", icon: <TeamOutlined />, label: "Người dùng & vé", tip: "Tạo MC, đổi vai, reset mật khẩu, tặng Vé Vàng" },
  { key: "reviews", icon: <CustomerServiceOutlined />, label: "Vận hành review", tip: "Hàng đợi Vé Vàng: nghe clip, hạn 72h, hoàn vé" },
  { key: "metrics", icon: <BarChartOutlined />, label: "Số liệu", tip: "Người luyện, clip/ngày, % giọng thật, review đúng hạn" },
  { key: "audit", icon: <HistoryOutlined />, label: "Nhật ký", tip: "Ai sửa gì, lúc nào" },
];

export default function App() {
  const [authed, setAuthed] = useState(hasToken());
  const [area, setArea] = useState("content");

  if (!authed) return <Login onOk={() => setAuthed(true)} />;

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Layout.Sider width={220}>
        <div style={{ padding: "20px 20px 12px" }}>
          <Typography.Title level={4} style={{ color: "#FF6B5B", margin: 0, fontWeight: 800 }}>
            McUp <span style={{ color: "#C9BBD6", fontWeight: 500, fontSize: 13 }}>· Admin</span>
          </Typography.Title>
        </div>
        <Menu
          theme="dark" mode="inline" selectedKeys={[area]}
          onClick={(e) => setArea(e.key)}
          items={AREAS.map((a) => ({ key: a.key, icon: a.icon, label: a.label, title: a.tip }))}
        />
        <div style={{ padding: 14, position: "absolute", bottom: 0, width: "100%" }}>
          <Button block icon={<LogoutOutlined />} title="Thoát phiên admin"
            onClick={() => { setToken(null); setAuthed(false); }}>
            Đăng xuất
          </Button>
        </div>
      </Layout.Sider>

      <Layout.Content style={{ padding: 20, overflow: "auto" }}>
        {area === "content" && <Content />}
        {area === "rubrics" && <Rubrics />}
        {area === "users" && <Users />}
        {area === "reviews" && <Ops />}
        {area === "metrics" && <Metrics />}
        {area === "audit" && <Audit />}
      </Layout.Content>
    </Layout>
  );
}

function Login({ onOk }: { onOk: () => void }) {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function go(values: { email: string; pw: string }) {
    setBusy(true); setErr("");
    try {
      const r = await Api.login(values.email.trim(), values.pw);
      if (r.role !== "admin") { setErr("Tài khoản này không phải admin."); setBusy(false); return; }
      setToken(r.access_token);
      onOk();
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F6EDE2" }}>
      <Card style={{ width: 360 }} title={
        <span style={{ color: "#FF6B5B", fontWeight: 800, fontSize: 18 }}>McUp · Admin</span>
      }>
        <Typography.Paragraph type="secondary" style={{ marginTop: -6 }}>
          Quản lý nội dung — sửa tại chỗ, nháp trước, xuất bản sau.
        </Typography.Paragraph>
        <Form layout="vertical" onFinish={go} initialValues={{ email: "admin@test.vn", pw: "123456" }}>
          <Form.Item name="email" label="Email" rules={[{ required: true, message: "Nhập email" }]}>
            <Input autoComplete="username" />
          </Form.Item>
          <Form.Item name="pw" label="Mật khẩu" rules={[{ required: true, message: "Nhập mật khẩu" }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          {err && <Typography.Text type="danger">{err}</Typography.Text>}
          <Button type="primary" htmlType="submit" block loading={busy} style={{ marginTop: 8 }}
            title="Đăng nhập bằng tài khoản có vai admin">
            Đăng nhập
          </Button>
        </Form>
      </Card>
    </div>
  );
}
