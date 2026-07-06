// Users.tsx — người dùng & vé trên Ant Design (Table + Modal tạo MC).
import { useEffect, useState } from "react";
import { FireOutlined, GiftOutlined, KeyOutlined, PlusOutlined, StarOutlined, TagOutlined } from "@ant-design/icons";
import {
  App as AntApp, Button, Card, Form, Input, Modal, Select, Space, Table, Tag, Tooltip, Typography,
} from "antd";
import { Api } from "./api";

type U = {
  id: string; email: string; display_name: string | null; role: string; mc_title: string | null;
  is_guest: boolean; xp: number; streak: number; tickets: number;
};

export default function Users() {
  const { message, modal } = AntApp.useApp();
  const [users, setUsers] = useState<U[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form] = Form.useForm();
  const load = (q = "") => Api.users(q).then(setUsers).catch((e) => message.error(e.message));
  useEffect(() => { load(); }, []);

  const columns = [
    {
      title: "Người dùng", key: "u",
      render: (_: unknown, u: U) => (
        <div>
          <Space size={6}>
            <b>{u.display_name || "(chưa đặt tên)"}</b>
            {u.is_guest && <Tag color="gold">khách</Tag>}
            {u.role !== "hoc_vien" && <Tag color={u.role === "admin" ? "red" : "blue"}>{u.role}</Tag>}
          </Space>
          <div><Typography.Text type="secondary" style={{ fontSize: 12 }}>{u.email}</Typography.Text></div>
          {u.mc_title && <Typography.Text type="secondary" style={{ fontSize: 12 }}><TagOutlined /> {u.mc_title}</Typography.Text>}
        </div>
      ),
    },
    {
      title: "Tiến độ", key: "p", width: 190,
      render: (_: unknown, u: U) => (
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          <FireOutlined style={{ color: "#F5A623" }} /> {u.streak} · <StarOutlined style={{ color: "#FF6B5B" }} /> {u.xp} · 🎟 {u.tickets}
        </Typography.Text>
      ),
    },
    {
      title: "Vai", key: "role", width: 130,
      render: (_: unknown, u: U) => (
        <Tooltip title="Đổi vai: học viên / MC (nhận review Vé Vàng) / admin (vào trang này)">
          <Select size="small" value={u.role} style={{ width: 110 }}
            options={[{ value: "hoc_vien", label: "học viên" }, { value: "mc", label: "mc" }, { value: "admin", label: "admin" }]}
            onChange={async (v) => { try { await Api.patchUser(u.id, { role: v }); message.success("Đã đổi vai"); load(); } catch (e: any) { message.error(e.message); } }} />
        </Tooltip>
      ),
    },
    {
      title: "", key: "act", width: 110,
      render: (_: unknown, u: U) => (
        <Space size={4}>
          <Tooltip title="Tặng người này 1 Vé Vàng (gửi clip cho MC thật nhận xét)">
            <Button size="small" type="text" icon={<GiftOutlined />} onClick={async () => {
              try { await Api.grant(u.id, { tickets_delta: 1 }); message.success("+1 Vé Vàng"); load(); }
              catch (e: any) { message.error(e.message); }
            }} />
          </Tooltip>
          <Tooltip title="Đặt mật khẩu mới cho người này (khi họ quên)">
            <Button size="small" type="text" icon={<KeyOutlined />} onClick={() => {
              let pw = "";
              modal.confirm({
                title: `Mật khẩu mới cho ${u.email}`,
                content: <Input.Password placeholder="Mật khẩu mới" onChange={(e) => { pw = e.target.value; }} />,
                okText: "Đặt lại", cancelText: "Thôi",
                onOk: async () => {
                  if (!pw) return;
                  await Api.patchUser(u.id, { password: pw });
                  message.success("Đã reset mật khẩu");
                },
              });
            }} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: "100%" }} size={12}>
      <Card size="small">
        <Space style={{ width: "100%", justifyContent: "space-between" }} wrap>
          <Input.Search placeholder="Tìm theo email hoặc tên…" allowClear style={{ width: 320 }}
            onSearch={(q) => load(q)} />
          <Tooltip title="Tạo tài khoản MC hoặc admin mới (kèm chức danh hiển thị trên thẻ bảo chứng)">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowCreate(true)}>Tạo MC / admin</Button>
          </Tooltip>
        </Space>
      </Card>

      <Table rowKey="id" dataSource={users} columns={columns} size="middle" pagination={{ pageSize: 20 }} />

      <Modal open={showCreate} title="Tạo tài khoản" okText="Tạo" cancelText="Huỷ"
        onCancel={() => setShowCreate(false)}
        onOk={() => form.submit()}>
        <Form form={form} layout="vertical" initialValues={{ role: "mc" }}
          onFinish={async (v) => {
            try {
              await Api.createUser({ email: v.email, password: v.password, display_name: v.display_name, role: v.role, mc_title: v.mc_title || undefined });
              message.success("Đã tạo — người này đăng nhập được ngay");
              setShowCreate(false); form.resetFields(); load();
            } catch (e: any) { message.error(e.message); }
          }}>
          <Form.Item name="email" label="Email" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="password" label="Mật khẩu" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="display_name" label="Tên hiển thị" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="mc_title" label="Chức danh MC (hiện trên thẻ bảo chứng)"><Input placeholder="vd: Dẫn 500+ sự kiện" /></Form.Item>
          <Form.Item name="role" label="Vai">
            <Select options={[{ value: "mc", label: "mc" }, { value: "admin", label: "admin" }, { value: "hoc_vien", label: "học viên" }]} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
