// Content.tsx — khu ① Nội dung (Pha A): danh sách lộ trình + trình soạn cây.
// Triết lý nhập liệu: sửa tại chỗ (blur = lưu) · nhân bản là công cụ số 1 ·
// preview đúng mắt học viên · ✨ AI gợi ý từng ô · mọi thứ là draft tới khi Xuất bản.
import { useEffect, useState } from "react";
import { Api, Brief, LessonNode, Tree } from "./api";
import Preview from "./Preview";

export default function Content() {
  const [paths, setPaths] = useState<any[]>([]);
  const [genres, setGenres] = useState<any[]>([]);
  const [tree, setTree] = useState<Tree | null>(null);
  const [err, setErr] = useState("");
  const [savedTick, setSavedTick] = useState(0);
  const [preview, setPreview] = useState<{ lesson: LessonNode; genre: string } | null>(null);
  const [showSplit, setShowSplit] = useState(false);

  async function loadLists() {
    try {
      setPaths(await Api.paths());
      setGenres(await Api.genres());
    } catch (e: any) { setErr(e.message); }
  }
  async function open(id: string) {
    try { setTree(await Api.tree(id)); setErr(""); } catch (e: any) { setErr(e.message); }
  }
  async function reload() { if (tree) await open(tree.id); await loadLists(); }
  useEffect(() => { loadLists(); }, []);

  function flashSaved() { setSavedTick((t) => t + 1); }

  // lưu tại chỗ: blur → PATCH → nháy "Đã lưu"
  async function save(kind: string, id: string, fields: Record<string, unknown>) {
    try { await Api.patch(kind, id, fields); flashSaved(); } catch (e: any) { setErr(e.message); }
  }

  async function newGenre() {
    const name = window.prompt("Tên thể loại mới (vd: MC talkshow):");
    if (!name?.trim()) return;
    await Api.createGenre(name.trim());
    await loadLists();
  }
  async function newPath() {
    if (!genres.length) { setErr("Tạo thể loại trước đã."); return; }
    const gname = window.prompt("Thuộc thể loại nào?\n" + genres.map((g, i) => `${i + 1}. ${g.name}`).join("\n") + "\n\nNhập số:");
    const gi = parseInt(gname || "", 10) - 1;
    if (isNaN(gi) || !genres[gi]) return;
    const title = window.prompt("Tên lộ trình:", `Lộ trình: ${genres[gi].name}`);
    if (!title?.trim()) return;
    const r = await Api.createPath(genres[gi].id, title.trim());
    await loadLists();
    await open(r.id);
  }

  return (
    <main className="main">
      <div className="col-list">
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <b>Lộ trình</b>
            <span className="row" style={{ gap: 6 }}>
              <button className="tiny ghost" onClick={newGenre}>＋ Thể loại</button>
              <button className="tiny" onClick={newPath}>＋ Lộ trình</button>
            </span>
          </div>
          {paths.length === 0 && <p className="muted">Chưa có — tạo tay hoặc dùng AI chia bên dưới.</p>}
          {paths.map((p) => (
            <div key={p.id} className={"pathrow" + (tree?.id === p.id ? " on" : "")} onClick={() => open(p.id)}>
              <div>
                <div className="t">{p.title}</div>
                <div className="g">{p.genre}</div>
              </div>
              <span className={"pill " + p.status}>{p.status}</span>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <b>🧠 AI chia giáo trình</b>
            <button className="tiny ghost" onClick={() => setShowSplit(!showSplit)}>{showSplit ? "Thu gọn" : "Mở"}</button>
          </div>
          {showSplit && <SplitForm genres={genres} onDone={async (t) => { setTree(t); await loadLists(); }} onErr={setErr} />}
        </div>

        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <b>📦 Sao lưu</b>
            <button className="tiny ghost" onClick={async () => {
              // Nhập JSON (đúng format export) → cây MỚI luôn draft
              const inp = document.createElement("input");
              inp.type = "file"; inp.accept = "application/json";
              inp.onchange = async () => {
                const f = inp.files?.[0]; if (!f) return;
                try {
                  const data = JSON.parse(await f.text());
                  const r = await Api.importPath(data);
                  await loadLists(); await open(r.id);
                } catch (e: any) { setErr(e.message); }
              };
              inp.click();
            }}>⬆ Nhập JSON</button>
          </div>
          <p className="muted" style={{ marginTop: 4 }}>Xuất từng lộ trình bằng nút ⬇ ở đầu cây. Nhập ra bản nháp mới — duyệt rồi mới xuất bản.</p>
        </div>

        {err && <p className="err">{err}</p>}
      </div>

      <div className="col-tree">
        {!tree ? (
          <div className="card"><p className="muted">Chọn một lộ trình bên trái, hoặc tạo mới / AI chia.</p></div>
        ) : (
          <TreeEditor key={tree.id} tree={tree} onSave={save} onReload={reload}
            onPreview={(l) => setPreview({ lesson: l, genre: tree.genre })} savedTick={savedTick} />
        )}
      </div>

      {preview && <Preview lesson={preview.lesson} genre={preview.genre} onClose={() => setPreview(null)} />}
    </main>
  );
}

function SplitForm({ genres, onDone, onErr }: { genres: any[]; onDone: (t: Tree) => void; onErr: (m: string) => void }) {
  const [genre, setGenre] = useState("MC đám cưới");
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <label>Thể loại</label>
      <input value={genre} onChange={(e) => setGenre(e.target.value)} list="genre-list" />
      <datalist id="genre-list">{genres.map((g) => <option key={g.id} value={g.name} />)}</datalist>
      <label>Giáo trình thô</label>
      <textarea rows={5} value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="Dán tài liệu thô — AI chia thành Buổi/Bài kèm Thẻ nhiệm vụ (luôn ra NHÁP để duyệt)." />
      <div style={{ marginTop: 8 }}>
        <button disabled={busy || !raw.trim()} onClick={async () => {
          setBusy(true); onErr("");
          try { onDone(await Api.aiSplit(genre, raw)); } catch (e: any) { onErr(e.message); }
          setBusy(false);
        }}>{busy ? "Đang chia..." : "Chia thành Buổi/Bài"}</button>
      </div>
    </div>
  );
}

// ===== Trình soạn cây =====

function TreeEditor({ tree, onSave, onReload, onPreview, savedTick }: {
  tree: Tree;
  onSave: (kind: string, id: string, fields: Record<string, unknown>) => void;
  onReload: () => void;
  onPreview: (l: LessonNode) => void;
  savedTick: number;
}) {
  const [busy, setBusy] = useState(false);
  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    try { await fn(); await onReload(); } catch { /* lỗi đã hiện ở err */ }
    setBusy(false);
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <InlineInput big defaultValue={tree.title} onCommit={(v) => onSave("path", tree.id, { title: v })} />
            <div className="muted">Thể loại: {tree.genre} {savedTick > 0 && <span className="saved"> · Đã lưu ✓</span>}</div>
          </div>
          <div className="row">
            <span className={"pill " + tree.status}>{tree.status}</span>
            <button className="tiny ghost" title="Xuất JSON (backup)" onClick={async () => {
              const data = await Api.exportPath(tree.id);
              const a = document.createElement("a");
              a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
              a.download = `mcup-${tree.genre}-${tree.id.slice(0, 6)}.json`;
              a.click();
            }}>⬇ JSON</button>
            {tree.status === "published"
              ? <button className="ghost" disabled={busy} onClick={() => act(() => Api.unpublish(tree.id))}>Gỡ xuất bản</button>
              : <button className="gold" disabled={busy} onClick={() => act(() => Api.publish(tree.id))}>✓ Duyệt & Xuất bản</button>}
          </div>
        </div>
      </div>

      {tree.levels.map((lv) => (
        <div key={lv.id}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="kicker" style={{ flex: 1 }}>
              <InlineInput small defaultValue={lv.name} onCommit={(v) => onSave("level", lv.id, { name: v })} />
            </div>
            <button className="tiny ghost" disabled={busy}
              onClick={() => act(async () => Api.createSession(lv.id, "Buổi mới"))}>＋ Buổi</button>
          </div>

          {lv.sessions.map((s0, si) => (
            <div key={s0.id} className="sess" style={s0.status === "archived" ? { opacity: .55 } : undefined}>
              <div className="sess-head">
                <InlineInput defaultValue={s0.title} onCommit={(v) => onSave("session", s0.id, { title: v })} />
                <span className={"pill " + s0.status}>{s0.status}</span>
                <button className="tiny ghost" disabled={busy || si === 0} title="Lên"
                  onClick={() => act(() => Api.move("session", s0.id, -1))}>↑</button>
                <button className="tiny ghost" disabled={busy || si === lv.sessions.length - 1} title="Xuống"
                  onClick={() => act(() => Api.move("session", s0.id, 1))}>↓</button>
                <button className="tiny ghost" disabled={busy} title="Nhân bản buổi + toàn bộ bài"
                  onClick={() => act(() => Api.dupSession(s0.id))}>⧉</button>
                {s0.status !== "archived"
                  ? <button className="tiny ghost" disabled={busy} title="Lưu trữ (ẩn khỏi app)"
                      onClick={() => act(() => Api.patch("session", s0.id, { status: "archived" }))}>🗄</button>
                  : <button className="tiny ghost" disabled={busy}
                      onClick={() => act(() => Api.patch("session", s0.id, { status: "draft" }))}>Khôi phục</button>}
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
              <button className="tiny ghost" disabled={busy}
                onClick={() => act(() => Api.createLesson(s0.id, "Bài mới"))}>＋ Bài</button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

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

  // ✨ AI gợi ý một ô — điền vào field + lưu nháp; admin sửa tiếp thoải mái (AD-10)
  async function spark(field: string) {
    setSparkBusy(field);
    try {
      const r = await Api.aiSuggest({ genre, lesson_title: lesson.title, prompt: promptV, field });
      if (field === "tip") { setTipV(r.value); onSave({ tip: r.value }); }
      else if (field === "prompt") { setPromptV(r.value); onSave({ prompt: r.value }); }
      else saveBrief({ [field]: r.value } as Partial<Brief>);
    } finally { setSparkBusy(null); }
  }

  return (
    <div className="les" style={lesson.status === "archived" ? { opacity: .55 } : undefined}>
      <div className="les-head">
        <button className="tiny ghost" onClick={() => setOpen(!open)}>{open ? "▾" : "▸"}</button>
        <InlineInput defaultValue={lesson.title} onCommit={(v) => onSave({ title: v })} />
        <span className={"pill " + lesson.status}>{lesson.status}</span>
        <button className="tiny ghost" disabled={busy || !canUp} onClick={() => onMove(-1)}>↑</button>
        <button className="tiny ghost" disabled={busy || !canDown} onClick={() => onMove(1)}>↓</button>
        <button className="tiny ghost" disabled={busy} title="Nhân bản" onClick={onDup}>⧉</button>
        <button className="tiny ghost" title="Xem như học viên" onClick={onPreview}>👁</button>
        <button className="tiny ghost" disabled={busy} title={lesson.status === "archived" ? "Khôi phục" : "Lưu trữ"}
          onClick={onArchive}>{lesson.status === "archived" ? "↩" : "🗄"}</button>
      </div>

      {open && (
        <div className="les-body">
          <label>Đề bài</label>
          <div className="field-row">
            <InlineArea defaultValue={promptV} onCommit={(v) => { setPromptV(v); onSave({ prompt: v }); }} />
            <button className="spark" disabled={!!sparkBusy} onClick={() => spark("prompt")}>{sparkBusy === "prompt" ? "…" : "✨"}</button>
          </div>
          <label>Mẹo ngắn</label>
          <div className="field-row">
            <InlineArea defaultValue={tipV} onCommit={(v) => { setTipV(v); onSave({ tip: v }); }} />
            <button className="spark" disabled={!!sparkBusy} onClick={() => spark("tip")}>{sparkBusy === "tip" ? "…" : "✨"}</button>
          </div>
          <label>Mục tiêu (Thẻ nhiệm vụ)</label>
          <div className="field-row">
            <InlineArea defaultValue={brief.objective ?? ""} onCommit={(v) => saveBrief({ objective: v })} />
            <button className="spark" disabled={!!sparkBusy} onClick={() => spark("objective")}>{sparkBusy === "objective" ? "…" : "✨"}</button>
          </div>
          <label>Tình huống</label>
          <div className="field-row">
            <InlineArea defaultValue={brief.context ?? ""} onCommit={(v) => saveBrief({ context: v })} />
            <button className="spark" disabled={!!sparkBusy} onClick={() => spark("context")}>{sparkBusy === "context" ? "…" : "✨"}</button>
          </div>
          <label>Dàn ý (mỗi dòng một bước)</label>
          <div className="field-row">
            <InlineArea defaultValue={(brief.steps ?? []).join("\n")}
              onCommit={(v) => saveBrief({ steps: v.split("\n").map((x) => x.trim()).filter(Boolean) })} />
            <button className="spark" disabled={!!sparkBusy} onClick={() => spark("steps")}>{sparkBusy === "steps" ? "…" : "✨"}</button>
          </div>
          <label>Ví dụ mẫu (ẩn sau "Bí quá?" trong app)</label>
          <div className="field-row">
            <InlineArea defaultValue={brief.example ?? ""} onCommit={(v) => saveBrief({ example: v })} />
            <button className="spark" disabled={!!sparkBusy} onClick={() => spark("example")}>{sparkBusy === "example" ? "…" : "✨"}</button>
          </div>
          <p className="muted" style={{ marginTop: 8 }}>
            Tiêu chí đạt KHÔNG nhập tay — sinh tự động từ rubric thể loại "{genre}" (1 nguồn sự thật, FR-15). Bấm 👁 để xem.
          </p>
        </div>
      )}
    </div>
  );
}

// input/textarea sửa-tại-chỗ: commit khi blur (autosave nháp)
function InlineInput({ defaultValue, onCommit, big, small }: {
  defaultValue: string; onCommit: (v: string) => void; big?: boolean; small?: boolean;
}) {
  const [v, setV] = useState(defaultValue);
  useEffect(() => setV(defaultValue), [defaultValue]);
  return (
    <input value={v} style={big ? { fontSize: 17, fontWeight: 800 } : small ? { fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1 } : undefined}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { if (v !== defaultValue) onCommit(v); }} />
  );
}
function InlineArea({ defaultValue, onCommit }: { defaultValue: string; onCommit: (v: string) => void }) {
  const [v, setV] = useState(defaultValue);
  useEffect(() => setV(defaultValue), [defaultValue]);
  return <textarea value={v} onChange={(e) => setV(e.target.value)} onBlur={() => { if (v !== defaultValue) onCommit(v); }} />;
}
