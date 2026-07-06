// ReelsPager.tsx — chế độ "Practice Reels": luyện nối tiếp vuốt dọc (P2-practice-reels-spec).
// Bản đồ = duyệt, Reels = làm. Vuốt lên bài kế; đang thu thì KHOÁ pager; không bao giờ
// auto-record khi trượt tới; trang Hết hàng là điểm dừng thật (không auto-loop).
import { useRef, useState } from "react";
import {
  AccessibilityInfo, ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import { C, F } from "./theme";
import { Fire, Lock, Mic } from "./icons";
import ScoreReveal, { ScoreData } from "./ScoreReveal";
import { RecLesson } from "./RecordScreen";
import { useEffect } from "react";

export type ReelsLesson = RecLesson & { unlocked: boolean; done: boolean };

// mẹo "nghỉ nhịp" từ MC thật — chèn mỗi 3 bài chống mỏi (spec §1)
const BREATHERS = [
  { tip: "Trước khi cầm mic, mỉm cười trước 2 giây — khán giả nghe thấy nụ cười trong giọng của bạn.", by: "MC Thu Hà · 8 năm dẫn cưới" },
  { tip: "Run là bình thường. MC giỏi không hết run — họ chỉ bắt đầu nói trước khi kịp sợ.", by: "MC Quang Bảo · sự kiện & gala" },
  { tip: "Câu mở đầu học thuộc, phần còn lại chỉ cần dàn ý. Thuộc lòng cả bài là tự đặt bẫy cho mình.", by: "MC Thu Hà · 8 năm dẫn cưới" },
];

type Page =
  | { kind: "lesson"; lesson: ReelsLesson; li: number }
  | { kind: "breather"; b: (typeof BREATHERS)[number] }
  | { kind: "end" };

function buildPages(lessons: ReelsLesson[]): Page[] {
  const pages: Page[] = [];
  lessons.forEach((l, i) => {
    pages.push({ kind: "lesson", lesson: l, li: i });
    if ((i + 1) % 3 === 0 && i < lessons.length - 1) pages.push({ kind: "breather", b: BREATHERS[(i / 3) % BREATHERS.length | 0] });
  });
  pages.push({ kind: "end" });
  return pages;
}

export default function ReelsPager({ lessons, startIndex, streak, onRun, onExit }: {
  lessons: ReelsLesson[];
  startIndex: number;          // index bài đang mở trong lessons
  streak: number;
  onRun: (lesson: ReelsLesson, audio: { uri: string; dur: number } | null) => Promise<ScoreData | null>;
  onExit: () => void;
}) {
  const [pageH, setPageH] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [cur, setCur] = useState(0);
  const [results, setResults] = useState<Record<string, ScoreData>>({});
  const [doneLocal, setDoneLocal] = useState<Set<string>>(new Set());
  // trạng thái thu — chỉ MỘT bài thu tại một thời điểm, giữ ở cấp pager
  const [rec, setRec] = useState<{ id: string; mode: "count" | "rec" | "proc"; n: number; sec: number } | null>(null);
  const recRef = useRef<Audio.Recording | null>(null);
  const startAt = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scroll = useRef<ScrollView>(null);

  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setReduced); }, []);
  useEffect(() => () => { timers.current.forEach(clearTimeout); recRef.current?.stopAndUnloadAsync().catch(() => {}); }, []);

  const pages = buildPages(lessons);
  const startPage = pages.findIndex((p) => p.kind === "lesson" && p.li === startIndex);
  useEffect(() => {
    if (pageH > 0 && startPage > 0) scroll.current?.scrollTo({ y: startPage * pageH, animated: false });
  }, [pageH]);

  function isUnlocked(li: number): boolean {
    const l = lessons[li];
    if (l.unlocked || l.done || doneLocal.has(l.id)) return true;
    const prev = lessons[li - 1];
    return !!prev && (prev.done || doneLocal.has(prev.id)); // xong bài trước (kể cả trong phiên) → mở
  }

  function clearTimers() { timers.current.forEach(clearTimeout); timers.current = []; }

  function startCount(l: ReelsLesson) {
    setRec({ id: l.id, mode: "count", n: 3, sec: 0 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const tick = (n: number) => timers.current.push(setTimeout(() => {
      if (n > 1) { setRec((r) => r && { ...r, n: n - 1 }); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); tick(n - 1); }
      else startRecording(l);
    }, 700));
    tick(3);
  }

  async function startRecording(l: ReelsLesson) {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recRef.current = recording;
      startAt.current = Date.now();
      setRec({ id: l.id, mode: "rec", n: 0, sec: 0 });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const loop = () => timers.current.push(setTimeout(() => {
        setRec((r) => r && r.mode === "rec" ? { ...r, sec: Math.floor((Date.now() - startAt.current) / 1000) } : r);
        loop();
      }, 500));
      loop();
    } catch {
      // mic lỗi → chấm giả lập, không chặn đường
      await finish(l, null);
    }
  }

  async function stopAndSubmit(l: ReelsLesson) {
    const r = recRef.current;
    clearTimers();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    let audio: { uri: string; dur: number } | null = null;
    if (r) {
      await r.stopAndUnloadAsync();
      const uri = r.getURI();
      recRef.current = null;
      if (uri) audio = { uri, dur: Math.max(1, Math.round((Date.now() - startAt.current) / 1000)) };
    }
    await finish(l, audio);
  }

  async function finish(l: ReelsLesson, audio: { uri: string; dur: number } | null) {
    setRec({ id: l.id, mode: "proc", n: 0, sec: 0 });
    const score = await onRun(l, audio); // App lo submit + poll + celebration; null = mạng chậm
    setRec(null);
    setDoneLocal((d) => new Set(d).add(l.id));
    if (score) {
      setResults((m) => ({ ...m, [l.id]: score }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }

  const locked = rec !== null; // đang đếm/thu/chấm → khoá pager (spec §2)

  function goto(i: number) {
    const y = Math.max(0, Math.min(pages.length - 1, i)) * pageH;
    scroll.current?.scrollTo({ y, animated: !reduced });
  }

  return (
    <View style={{ flex: 1 }} onLayout={(e) => setPageH(e.nativeEvent.layout.height)}>
      {pageH > 0 && (
        <ScrollView
          ref={scroll}
          pagingEnabled
          scrollEnabled={!locked && !reduced}
          showsVerticalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const i = Math.round(e.nativeEvent.contentOffset.y / pageH);
            if (i !== cur) { setCur(i); Haptics.selectionAsync().catch(() => {}); }
          }}
        >
          {pages.map((p, pi) => (
            <View key={pi} style={{ height: pageH }}>
              {p.kind === "lesson" && (
                <LessonPage
                  lesson={p.lesson}
                  unlocked={isUnlocked(p.li)}
                  result={results[p.lesson.id]}
                  rec={rec?.id === p.lesson.id ? rec : null}
                  onMic={() => startCount(p.lesson)}
                  onStop={() => stopAndSubmit(p.lesson)}
                  onRetry={() => setResults((m) => { const n = { ...m }; delete n[p.lesson.id]; return n; })}
                />
              )}
              {p.kind === "breather" && (
                <View style={st.centerPage}>
                  <View style={st.bulb}><Text style={{ fontSize: 26 }}>💡</Text></View>
                  <Text style={st.breatherLabel}>MẸO TỪ MC THẬT</Text>
                  <Text style={st.breatherTip}>“{p.b.tip}”</Text>
                  <Text style={st.breatherBy}>— {p.b.by}</Text>
                  <Text style={st.swipeHint}>vuốt lên — luyện tiếp</Text>
                </View>
              )}
              {p.kind === "end" && (
                <View style={st.centerPage}>
                  <View style={st.endGlow}><Fire size={34} color="#F5A623" /></View>
                  <Text style={st.endTitle}>Hôm nay đủ rồi 👏</Text>
                  <Text style={st.endSub}>Chuỗi {streak} ngày vẫn cháy.{"\n"}Mai quay lại leo tiếp sân khấu nhé!</Text>
                  <TouchableOpacity style={st.endBtn} onPress={onExit}>
                    <Text style={st.endBtnT}>Về bản đồ sân khấu</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {/* thoát + vị trí */}
      <TouchableOpacity style={st.exit} onPress={onExit} accessibilityLabel="Thoát chế độ luyện liên tục">
        <Text style={st.exitT}>✕</Text>
      </TouchableOpacity>
      <View style={st.pos} pointerEvents="none">
        <Text style={st.posT}>
          {pages[cur]?.kind === "lesson" ? `Bài ${(pages[cur] as any).li + 1}/${lessons.length}`
            : pages[cur]?.kind === "breather" ? "Nghỉ nhịp" : "Xong 🎉"}
        </Text>
      </View>

      {/* reduced-motion: nút thay vuốt (Accessibility Floor) */}
      {reduced && !locked && (
        <View style={st.rmNav}>
          <TouchableOpacity style={st.rmBtn} onPress={() => { setCur(Math.max(0, cur - 1)); goto(cur - 1); }}>
            <Text style={st.rmT}>▲ Bài trước</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.rmBtn} onPress={() => { setCur(Math.min(pages.length - 1, cur + 1)); goto(cur + 1); }}>
            <Text style={st.rmT}>▼ Bài kế</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function LessonPage({ lesson, unlocked, result, rec, onMic, onStop, onRetry }: {
  lesson: ReelsLesson; unlocked: boolean; result?: ScoreData;
  rec: { mode: "count" | "rec" | "proc"; n: number; sec: number } | null;
  onMic: () => void; onStop: () => void; onRetry: () => void;
}) {
  const steps = (lesson.brief?.steps ?? []).slice(0, 4);

  if (!unlocked) {
    return (
      <View style={st.centerPage}>
        <View style={st.lockCircle}><Lock size={30} color="#A99C8C" /></View>
        <Text style={st.lockT}>Hoàn thành bài trước để mở</Text>
        <Text style={st.swipeHint}>vuốt xuống — quay lại bài đang mở</Text>
      </View>
    );
  }

  if (result) {
    return (
      <View style={st.page}>
        <Text style={st.kicker}>KẾT QUẢ · BUỔI {lesson.buoi}</Text>
        <ScoreReveal score={result} prev={null} />
        <TouchableOpacity style={st.retry} onPress={onRetry}>
          <Text style={st.retryT}>Luyện lại bài này</Text>
        </TouchableOpacity>
        <Text style={[st.swipeHint, { textAlign: "center", marginTop: 14 }]}>vuốt lên — bài kế ngay</Text>
      </View>
    );
  }

  return (
    <View style={st.page}>
      <Text style={st.kicker}>BUỔI {lesson.buoi} · {lesson.title}</Text>
      <Text style={st.prompt}>{lesson.prompt}</Text>
      {steps.length > 0 && (
        <View style={st.stepsCard}>
          {steps.map((s, i) => <Text key={i} style={st.step}><Text style={st.stepN}>{i + 1}.</Text>  {s}</Text>)}
        </View>
      )}
      <View style={{ flex: 1 }} />
      <View style={{ alignItems: "center", paddingBottom: 46 }}>
        {rec?.mode === "count" && <Text style={st.countNum}>{rec.n}</Text>}
        {rec?.mode === "proc" && (
          <View style={{ alignItems: "center" }}>
            <ActivityIndicator color={C.spot} size="large" />
            <Text style={st.procT}>Đang nghe bạn dẫn…</Text>
          </View>
        )}
        {rec?.mode === "rec" && (
          <View style={{ alignItems: "center" }}>
            <Text style={st.recTime}>{Math.floor(rec.sec / 60)}:{String(rec.sec % 60).padStart(2, "0")}</Text>
            <Text style={st.recLabel}>ĐANG THU — vuốt tạm khoá</Text>
            <TouchableOpacity style={st.stopBtn} onPress={onStop} accessibilityLabel="Dừng và nộp">
              <View style={st.stopSquare} />
            </TouchableOpacity>
          </View>
        )}
        {!rec && (
          <>
            <TouchableOpacity style={st.mic} onPress={onMic} accessibilityLabel="Chạm để luyện bài này">
              <Mic size={32} color="#fff" />
            </TouchableOpacity>
            <Text style={st.micLabel}>Chạm để luyện</Text>
          </>
        )}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  page: { flex: 1, paddingTop: 64, paddingHorizontal: 20 },
  centerPage: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  kicker: { fontSize: 10, fontFamily: F.title, letterSpacing: 1, color: C.ink2 },
  prompt: { fontSize: 17, fontFamily: F.title, color: C.ink, lineHeight: 24, marginTop: 6 },
  stepsCard: { backgroundColor: C.raised, borderRadius: 14, padding: 12, marginTop: 14 },
  step: { fontSize: 13.5, color: C.ink, lineHeight: 23 },
  stepN: { color: C.primary, fontFamily: F.title },
  mic: {
    width: 74, height: 74, borderRadius: 37, backgroundColor: C.primary,
    alignItems: "center", justifyContent: "center",
    shadowColor: C.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
  },
  micLabel: { fontSize: 12, fontFamily: F.semi, color: C.ink, marginTop: 8 },
  countNum: { fontSize: 84, fontFamily: F.displayX, color: C.primary, lineHeight: 96 },
  recTime: { fontSize: 22, fontFamily: F.display, color: C.ink },
  recLabel: { fontSize: 11, fontFamily: F.title, letterSpacing: 1, color: C.primary, marginTop: 2, marginBottom: 12 },
  stopBtn: {
    width: 66, height: 66, borderRadius: 33, backgroundColor: "#fff",
    borderWidth: 3, borderColor: C.primary, alignItems: "center", justifyContent: "center",
  },
  stopSquare: { width: 22, height: 22, borderRadius: 6, backgroundColor: C.primary },
  procT: { fontSize: 14, fontFamily: F.semi, color: C.ink2, marginTop: 10 },
  retry: { backgroundColor: C.sunken, borderRadius: 999, padding: 12, alignItems: "center", marginTop: 6 },
  retryT: { color: C.ink, fontFamily: F.title, fontSize: 13 },
  swipeHint: { fontSize: 11.5, color: "#BFB4C4", fontFamily: F.med, marginTop: 10 },

  bulb: { width: 62, height: 62, borderRadius: 31, backgroundColor: C.spot, alignItems: "center", justifyContent: "center" },
  breatherLabel: { fontSize: 10, fontFamily: F.title, letterSpacing: 1.5, color: C.ink2, marginTop: 16 },
  breatherTip: { fontSize: 17, color: C.ink, lineHeight: 27, textAlign: "center", marginTop: 10, fontStyle: "italic", fontFamily: F.body },
  breatherBy: { fontSize: 12, color: C.ink2, marginTop: 10, fontFamily: F.med },

  endGlow: { width: 74, height: 74, borderRadius: 37, backgroundColor: "rgba(255,194,75,.3)", alignItems: "center", justifyContent: "center" },
  endTitle: { fontSize: 22, fontFamily: F.displayX, color: C.ink, marginTop: 16 },
  endSub: { fontSize: 13.5, color: C.ink2, textAlign: "center", lineHeight: 21, marginTop: 8, fontFamily: F.body },
  endBtn: { backgroundColor: C.sunken, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 12, marginTop: 20 },
  endBtnT: { color: C.ink, fontFamily: F.title, fontSize: 13 },

  lockCircle: { width: 68, height: 68, borderRadius: 34, backgroundColor: "#EAE1D3", alignItems: "center", justifyContent: "center" },
  lockT: { fontSize: 14, fontFamily: F.semi, color: C.ink2, marginTop: 14 },

  exit: {
    position: "absolute", top: 54, left: 16, width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(59,42,74,.6)", alignItems: "center", justifyContent: "center",
  },
  exitT: { color: "#FFF8F0", fontSize: 16, fontFamily: F.title },
  pos: {
    position: "absolute", top: 58, right: 16, backgroundColor: "rgba(59,42,74,.6)",
    paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999,
  },
  posT: { color: "#FFF8F0", fontSize: 11, fontFamily: F.semi },

  rmNav: { position: "absolute", bottom: 18, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 10 },
  rmBtn: { backgroundColor: C.sunken, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 },
  rmT: { color: C.ink, fontFamily: F.title, fontSize: 12.5 },
});
