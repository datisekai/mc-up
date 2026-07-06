// Content.tsx — khu Nội dung trên Ant Design. Logic giữ nguyên Pha A–D:
// sửa tại chỗ (blur = lưu) · nhân bản là công cụ số 1 · preview đúng mắt học viên ·
// ✨ AI gợi ý từng ô · mọi thứ là nháp tới khi Xuất bản.
import { useEffect, useState } from "react";
import {
  ArrowDownOutlined, ArrowUpOutlined, CopyOutlined, DownloadOutlined, EyeOutlined,
  InboxOutlined, PlusOutlined, RobotOutlined, ThunderboltOutlined, UndoOutlined, UploadOutlined,
} from "@ant-design/icons";
import {
  App as AntApp, Button, Card, Collapse, Empty, Input, Modal, Space, Tag, Tooltip, Typography,
} from "antd";
import { Api, Brief, LessonNode, Tree } from "./api";
import Preview from "./Preview";

const STATUS_COLOR: Record<string, string> = { draft: "gold", published: "green", archived: "default" };

function StatusTag({ s }: { s: string }) {
  return <Tag color={STATUS_COLOR[s] ?? "default"} style={{ marginInlineEnd: 0 }}>{s}</Tag>;
}

export default function Content() {
  const { message } = AntApp.useApp();
  const [paths, setPaths] = useState<any[]>([]);
  const [genres, setGenres] = useState<any[]>([]);
  const [tree, setTree] = useState<Tree | null>(null);
  const [preview, setPreview] = useState<{ lesson: LessonNode; genre: string } | null>(null);
  // modal hỏi 1 dòng text (thay window.prompt)
  const [ask, setAsk] = useState<{ title: string; value: string; onOk: (v: string) => void } | null>(null);

  async function loadLists() {
    try {
      setPaths(await Api.paths());
      setGenres(await Api.genres());
    } catch (e: any) { message.error(e.message); }
  }
  async function open(id: string) {
    try { setTree(await Api.tree(id)); } catch (e: any) { message.error(e.message); }
  }
  async function reload() { if (tree) await open(tree.id); await loadLists(); }
  useEffect(() => { loadLists(); }, []);

  async function save(kind: string, id: string, fields: Record<string, unknown>) {
    try { await Api.patch(kind, id, fields); message.success("Đã lưu", 0.8); }
    catch (e: any) { message.error(e.message); }
  }

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <div style={{ width: 320, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        <Card size="small" title="Lộ trình" extra={
          <Space size={6}>
            <Tooltip title="Tạo thể loại mới (vd: MC talkshow) — nhóm lớn nhất của nội dung">
              <Button size="small" icon={<PlusOutlined />} onClick={() =>
                setAsk({ title: "Tên thể loại mới", value: "", onOk: async (v) => { await Api.createGenre(v); await loadLists(); } })
              }>Thể loại</Button>
            </Tooltip>
            <Tooltip title="Tạo lộ trình học mới trong thể loại đang chọn ở ô AI chia (bắt đầu ở dạng nháp)">
              <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => {
                if (!genres.length) { message.warning("Tạo thể loại trước đã."); return; }
                setAsk({
                  title: `Tên lộ trình (thuộc "${genres[genres.length - 1].name}" — đổi thể loại bằng cách tạo từ AI chia)`,
                  value: `Lộ trình: ${genres[genres.length - 1].name}`,
                  onOk: async (v) => { const r = await Api.createPath(genres[genres.length - 1].id, v); await loadLists(); await open(r.id); },
                });
              }}>Lộ trình</Button>
            </Tooltip>
          </Space>
        }>
          {paths.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có — tạo tay hoặc AI chia" />}
          {paths.map((p) => (
            <div key={p.id} onClick={() => open(p.id)}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
                padding: "8px 10px", borderRadius: 10, cursor: "pointer",
                background: tree?.id === p.id ? "rgba(255,107,91,0.08)" : undefined,
                outline: tree?.id === p.id ? "2px solid #FF6B5B" : undefined,
              }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</div>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>{p.genre}</Typography.Text>
              </div>
              <StatusTag s={p.status} />
            </div>
          ))}
        </Card>

        <Card size="small">
          <Collapse ghost items={[{
            key: "ai",
            label: <b><RobotOutlined /> AI chia giáo trình</b>,
            children: <SplitForm genres={genres} onDone={async (t) => { setTree(t); await loadLists(); }} />,
          }]} />
        </Card>

        <Card size="small" title="Sao lưu" extra={
          <Tooltip title="Chọn file JSON (xuất bằng nút tải ở đầu cây) → tạo lộ trình mới ở dạng nháp">
            <Button size="small" icon={<UploadOutlined />} onClick={() => {
              const inp = document.createElement("input");
              inp.type = "file"; inp.accept = "application/json";
              inp.onchange = async () => {
                const f = inp.files?.[0]; if (!f) return;
                try {
                  const data = JSON.parse(await f.text());
                  const r = await Api.importPath(data);
                  await loadLists(); await open(r.id);
                  message.success("Đã nhập — bản nháp mới");
                } catch (e: any) { message.error(e.message); }
              };
              inp.click();
            }}>Nhập JSON</Button>
          </Tooltip>
        }>
          <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
            Nhập ra bản nháp mới — duyệt rồi mới xuất bản.
          </Typography.Text>
        </Card>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {!tree ? (
          <Card><Empty description="Chọn một lộ trình bên trái, hoặc tạo mới / AI chia" /></Card>
        ) : (
          <TreeEditor key={tree.id} tree={tree} onSave={save} onReload={reload}
            onPreview={(l) => setPreview({ lesson: l, genre: tree.genre })} />
        )}
      </div>

      {preview && <Preview lesson={preview.lesson} genre={preview.genre} onClose={() => setPreview(null)} />}

      <Modal open={!!ask} title={ask?.title} okText="Tạo" cancelText="Huỷ"
        onCancel={() => setAsk(null)}
        onOk={async () => { const v = ask!.value.trim(); if (!v) return; try { await ask!.onOk(v); } catch (e: any) { message.error(e.message); } setAsk(null); }}>
        <Input value={ask?.value ?? ""} onChange={(e) => setAsk((a) => a && { ...a, value: e.target.value })}
          onPressEnter={() => { /* Enter = OK do Modal xử lý */ }} autoFocus />
      </Modal>
    </div>
  );
}

function SplitForm({ genres, onDone }: { genres: any[]; onDone: (t: Tree) => void }) {
  const { message } = AntApp.useApp();
  const [genre, setGenre] = useState("MC đám cưới");
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Space direction="vertical" style={{ width: "100%" }} size={8}>
      <Input value={genre} onChange={(e) => setGenre(e.target.value)} list="genre-list" addonBefore="Thể loại" />
      <datalist id="genre-list">{genres.map((g) => <option key={g.id} value={g.name} />)}</datalist>
      <Input.TextArea rows={5} value={raw} onChange={(e) => setRaw(e.target.value)}
        placeholder="Dán tài liệu thô — AI chia thành Buổi/Bài kèm Thẻ nhiệm vụ (luôn ra NHÁP để duyệt)." />
      <Tooltip title="Gửi tài liệu cho AI chia thành cây Buổi/Bài — kết quả là NHÁP, duyệt xong mới xuất bản">
        <Button type="primary" icon={<RobotOutlined />} loading={busy} disabled={!raw.trim()} onClick={async () => {
          setBusy(true);
          try { onDone(await Api.aiSplit(genre, raw)); } catch (e: any) { message.error(e.message); }
          setBusy(false);
        }}>Chia thành Buổi/Bài</Button>
      </Tooltip>
    </Space>
  );
}

// ===== Trình soạn cây =====

function TreeEditor({ tree, onSave, onReload, onPreview }: {
  tree: Tree;
  onSave: (kind: string, id: string, fields: Record<string, unknown>) => void;
  onReload: () => void;
  onPreview: (l: LessonNode) => void;
}) {
  const { message, modal } = AntApp.useApp();
  const [busy, setBusy] = useState(false);
  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    try { await fn(); await onReload(); } catch (e: any) { message.error(e.message); }
    setBusy(false);
  }

  return (
    <Space direction="vertical" style={{ width: "100%" }} size={12}>
      <Card size="small">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <InlineInput big defaultValue={tree.title} onCommit={(v) => onSave("path", tree.id, { title: v })} />
            <Typography.Text type="secondary">Thể loại: {tree.genre}</Typography.Text>
          </div>
          <Space>
            <StatusTag s={tree.status} />
            <Tooltip title="Tải cả cây lộ trình này về file JSON — backup hoặc chuyển môi trường">
              <Button icon={<DownloadOutlined />} onClick={async () => {
                const data = await Api.exportPath(tree.id);
                const a = document.createElement("a");
                a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
                a.download = `mcup-${tree.genre}-${tree.id.slice(0, 6)}.json`;
                a.click();
              }} />
            </Tooltip>
            {tree.status === "published" ? (
              <Tooltip title="Đưa cả lộ trình về nháp — học viên lập tức KHÔNG thấy nữa">
                <Button danger loading={busy} onClick={() => modal.confirm({
                  title: "Gỡ xuất bản cả lộ trình?",
                  content: "Học viên sẽ không thấy lộ trình này cho tới khi xuất bản lại.",
                  okText: "Gỡ xuất bản", cancelText: "Thôi",
                  onOk: () => act(() => Api.unpublish(tree.id)),
                })}>Gỡ xuất bản</Button>
              </Tooltip>
            ) : (
              <Tooltip title="Xuất bản cả lộ trình — học viên thấy ngay trong app">
                <Button type="primary" loading={busy} onClick={() => act(() => Api.publish(tree.id))}>
                  Duyệt & Xuất bản
                </Button>
              </Tooltip>
            )}
          </Space>
        </div>
      </Card>

      {tree.levels.map((lv) => (
        <div key={lv.id}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "4px 0 8px" }}>
            <div style={{ flex: 1 }}>
              <InlineInput small defaultValue={lv.name} onCommit={(v) => onSave("level", lv.id, { name: v })} />
            </div>
            <Tooltip title="Thêm một buổi học mới vào cấp độ này (dạng nháp)">
              <Button size="small" icon={<PlusOutlined />} disabled={busy}
                onClick={() => act(async () => Api.createSession(lv.id, "Buổi mới"))}>Buổi</Button>
            </Tooltip>
          </div>

          {lv.sessions.map((s0, si) => (
            <Card key={s0.id} size="small" style={{ marginBottom: 10, background: "#FBF6EE", opacity: s0.status === "archived" ? 0.55 : 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <InlineInput defaultValue={s0.title} onCommit={(v) => onSave("session", s0.id, { title: v })} />
                </div>
                <StatusTag s={s0.status} />
                <Tooltip title="Đẩy buổi này LÊN trong thứ tự học">
                  <Button size="small" type="text" icon={<ArrowUpOutlined />} disabled={busy || si === 0}
                    onClick={() => act(() => Api.move("session", s0.id, -1))} />
                </Tooltip>
                <Tooltip title="Đẩy buổi này XUỐNG trong thứ tự học">
                  <Button size="small" type="text" icon={<ArrowDownOutlined />} disabled={busy || si === lv.sessions.length - 1}
                    onClick={() => act(() => Api.move("session", s0.id, 1))} />
                </Tooltip>
                <Tooltip title="Nhân bản cả buổi kèm toàn bộ bài (bản sao là nháp) — cách nhập liệu nhanh nhất">
                  <Button size="small" type="text" icon={<CopyOutlined />} disabled={busy}
                    onClick={() => act(() => Api.dupSession(s0.id))} />
                </Tooltip>
                {s0.status !== "archived" ? (
                  <Tooltip title="Lưu trữ buổi — ẩn khỏi app nhưng không xoá, khôi phục được">
                    <Button size="small" type="text" icon={<InboxOutlined />} disabled={busy}
                      onClick={() => act(() => Api.patch("session", s0.id, { status: "archived" }))} />
                  </Tooltip>
                ) : (
                  <Tooltip title="Khôi phục buổi từ lưu trữ về nháp">
                    <Button size="small" type="text" icon={<UndoOutlined />} disabled={busy}
                      onClick={() => act(() => Api.patch("session", s0.id, { status: "draft" }))} />
                  </Tooltip>
                )}
              </div>

              {s0.lessons.map((l, li) => (
                <LessonCard key={l.id} lesson={l} genre={tree.genre}
                  canUp={li > 0} canDown={li < s0.lessons.length - 1} busy={busy}
                  onSave={(f) => onSave("lesson", l.id, f)}
                  onMove={(d) => act(() => Api.move("lesson", l.id, d))}
                  onDup={() => act(() => Api.dupLesson(l.id))}
                  onArchive={() => act(() => Api.patch("lesson", l.id, { status: l.status === "archived" ? "draft" : "archived" }))}
                  onPreview={() => onPreview(l)} />
              ))}
              <Tooltip title="Thêm một bài mới vào buổi này (dạng nháp) — mở ra để điền đề & Thẻ nhiệm vụ">
                <Button size="small" type="dashed" icon={<PlusOutlined />} disabled={busy}
                  onClick={() => act(() => Api.createLesson(s0.id, "Bài mới"))}>Bài</Button>
              </Tooltip>
            </Card>
          ))}
        </div>
      ))}
    </Space>
  );
}

const SPARK_TIP: Record<string, string> = {
  prompt: "AI gợi ý ĐỀ BÀI — điền vào ô, bạn sửa tiếp rồi click ra ngoài để lưu",
  tip: "AI gợi ý MẸO NGẮN — sửa được trước khi lưu",
  objective: "AI gợi ý MỤC TIÊU học của bài",
  context: "AI gợi ý TÌNH HUỐNG sân khấu",
  steps: "AI gợi ý DÀN Ý (mỗi dòng một bước)",
  example: "AI gợi ý VÍ DỤ LỜI DẪN MẪU (học viên thấy sau nút Bí quá?)",
};

function LessonCard({ lesson, genre, canUp, canDown, busy, onSave, onMove, onDup, onArchive, onPreview }: {
  lesson: LessonNode; genre: string; canUp: boolean; canDown: boolean; busy: boolean;
  onSave: (fields: Record<string, unknown>) => void;
  onMove: (d: number) => void; onDup: () => void; onArchive: () => void; onPreview: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [brief, setBrief] = useState<Brief>(lesson.brief ?? {});
  const [tipV, setTipV] = useState(lesson.tip);
  const [promptV, setPromptV] = useState(lesson.prompt);
  const [sparkBusy, setSparkBusy] = useState<string | null>(null);

  function saveBrief(patch: Partial<Brief>) {
    const next = { ...brief, ...patch };
    setBrief(next);
    onSave({ brief: next });
  }
  async function spark(field: string) {
    setSparkBusy(field);
    try {
      const r = await Api.aiSuggest({ genre, lesson_title: lesson.title, prompt: promptV, field });
      if (field === "tip") { setTipV(r.value); onSave({ tip: r.value }); }
      else if (field === "prompt") { setPromptV(r.value); onSave({ prompt: r.value }); }
      else { setBrief((b) => ({ ...b, [field]: r.value })); saveBrief({ [field]: r.value } as Partial<Brief>); }
    } finally { setSparkBusy(null); }
  }

  const F = ({ label, field, value, onCommit }: { label: string; field: string; value: string; onCommit: (v: string) => void }) => (
    <div style={{ marginTop: 8 }}>
      <Typography.Text type="secondary" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</Typography.Text>
      <div style={{ display: "flex", gap: 6, alignItems: "flex-start", marginTop: 2 }}>
        <InlineArea defaultValue={value} onCommit={onCommit} />
        <Tooltip title={SPARK_TIP[field]}>
          <Button icon={<ThunderboltOutlined />} loading={sparkBusy === field} disabled={!!sparkBusy}
            onClick={() => spark(field)} />
        </Tooltip>
      </div>
    </div>
  );

  return (
    <Card size="small" style={{ marginBottom: 8, opacity: lesson.status === "archived" ? 0.55 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Button size="small" type="text" onClick={() => setOpen(!open)}
          title={open ? "Thu gọn bài" : "Mở ra để sửa đề bài, mẹo và Thẻ nhiệm vụ"}>
          {open ? "▾" : "▸"}
        </Button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <InlineInput defaultValue={lesson.title} onCommit={(v) => onSave({ title: v })} />
        </div>
        <StatusTag s={lesson.status} />
        <Tooltip title="Đẩy bài LÊN trong buổi"><Button size="small" type="text" icon={<ArrowUpOutlined />} disabled={busy || !canUp} onClick={() => onMove(-1)} /></Tooltip>
        <Tooltip title="Đẩy bài XUỐNG trong buổi"><Button size="small" type="text" icon={<ArrowDownOutlined />} disabled={busy || !canDown} onClick={() => onMove(1)} /></Tooltip>
        <Tooltip title="Nhân bản bài (bản sao là nháp) — sửa vài chữ là có bài mới"><Button size="small" type="text" icon={<CopyOutlined />} disabled={busy} onClick={onDup} /></Tooltip>
        <Tooltip title="Xem bài đúng như học viên thấy trong app (kèm tiêu chí chấm tự sinh)"><Button size="small" type="text" icon={<EyeOutlined />} onClick={onPreview} /></Tooltip>
        <Tooltip title={lesson.status === "archived" ? "Khôi phục bài từ lưu trữ về nháp" : "Lưu trữ bài — ẩn khỏi app nhưng không xoá"}>
          <Button size="small" type="text" icon={lesson.status === "archived" ? <UndoOutlined /> : <InboxOutlined />} disabled={busy} onClick={onArchive} />
        </Tooltip>
      </div>

      {open && (
        <div style={{ borderTop: "1px solid #EDE3D6", marginTop: 8, paddingTop: 2 }}>
          <F label="Đề bài" field="prompt" value={promptV} onCommit={(v) => { setPromptV(v); onSave({ prompt: v }); }} />
          <F label="Mẹo ngắn" field="tip" value={tipV} onCommit={(v) => { setTipV(v); onSave({ tip: v }); }} />
          <F label="Mục tiêu (Thẻ nhiệm vụ)" field="objective" value={brief.objective ?? ""} onCommit={(v) => saveBrief({ objective: v })} />
          <F label="Tình huống" field="context" value={brief.context ?? ""} onCommit={(v) => saveBrief({ context: v })} />
          <F label="Dàn ý (mỗi dòng một bước)" field="steps" value={(brief.steps ?? []).join("\n")}
            onCommit={(v) => saveBrief({ steps: v.split("\n").map((x) => x.trim()).filter(Boolean) })} />
          <F label='Ví dụ mẫu (ẩn sau "Bí quá?" trong app)' field="example" value={brief.example ?? ""} onCommit={(v) => saveBrief({ example: v })} />
          <Typography.Text type="secondary" style={{ display: "block", marginTop: 10, fontSize: 12.5 }}>
            Tiêu chí đạt KHÔNG nhập tay — sinh tự động từ rubric thể loại "{genre}" (1 nguồn sự thật). Bấm <EyeOutlined /> để xem.
          </Typography.Text>
        </div>
      )}
    </Card>
  );
}

function InlineInput({ defaultValue, onCommit, big, small }: {
  defaultValue: string; onCommit: (v: string) => void; big?: boolean; small?: boolean;
}) {
  const [v, setV] = useState(defaultValue);
  useEffect(() => setV(defaultValue), [defaultValue]);
  return (
    <Input variant="borderless" value={v}
      style={big ? { fontSize: 17, fontWeight: 800, paddingLeft: 0 }
        : small ? { fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, color: "#7A6E82", paddingLeft: 0 }
        : { fontWeight: 600, paddingLeft: 0 }}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { if (v !== defaultValue) onCommit(v); }} />
  );
}
function InlineArea({ defaultValue, onCommit }: { defaultValue: string; onCommit: (v: string) => void }) {
  const [v, setV] = useState(defaultValue);
  useEffect(() => setV(defaultValue), [defaultValue]);
  return <Input.TextArea autoSize={{ minRows: 1, maxRows: 6 }} value={v} style={{ flex: 1 }}
    onChange={(e) => setV(e.target.value)} onBlur={() => { if (v !== defaultValue) onCommit(v); }} />;
}
