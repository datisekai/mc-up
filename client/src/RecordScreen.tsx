// RecordScreen.tsx — màn quay clip "Reels ấm" (P1-man-quay-clip-spec).
// State machine: ready → count(3-2-1) → recording → (parent busy = processing).
// Waveform sống từ metering mic (expo-av) · teleprompter dàn ý · đồng hồ + vòng tiến độ.
// Chỉ báo thu = SAN HÔ + chữ (không đỏ — đỏ chỉ cho lỗi thật).
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo, ActivityIndicator, Alert, Animated, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import { C, F } from "./theme";
import { Mic } from "./icons";

type Brief = { objective: string; context: string; steps: string[]; example: string };
export type RecLesson = {
  id: string; buoi: number; title: string; tip: string; prompt: string;
  brief?: Brief | null; criteria?: string[];
};

const TARGET_SEC = 60;   // mốc gợi ý — quá mốc KHÔNG phạt, chỉ nhắc dịu
const N_BARS = 34;
const STEP_SEC = 4;      // teleprompter tự trôi mỗi 4s (người dùng vẫn tự do nói)

function fmt(s: number) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }

export default function RecordScreen({ lesson, busy, onSubmit, onMock, onBack }: {
  lesson: RecLesson;
  busy: boolean;
  onSubmit: (uri: string, durationSec: number) => void;
  onMock: () => void;
  onBack: () => void;
}) {
  const [mode, setMode] = useState<"ready" | "count" | "rec">("ready");
  const [showEx, setShowEx] = useState(false);
  const [showFull, setShowFull] = useState(false); // giảm nhiễu: mặc định chỉ Đề + Dàn ý
  const [count, setCount] = useState(3);
  const [sec, setSec] = useState(0);
  const [teleIdx, setTeleIdx] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array(N_BARS).fill(0.12));
  const [reduced, setReduced] = useState(false);

  const recRef = useRef<Audio.Recording | null>(null);
  const startAt = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const breath = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(1)).current;

  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setReduced); }, []);

  // vòng "thở" mời gọi quanh nút ghi (ready)
  useEffect(() => {
    if (mode !== "ready" || reduced) return;
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(breath, { toValue: 1, duration: 1400, useNativeDriver: true }),
      Animated.timing(breath, { toValue: 0, duration: 1400, useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, [mode, reduced]);

  // chấm ĐANG THU nhấp nháy (san hô)
  useEffect(() => {
    if (mode !== "rec" || reduced) return;
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(blink, { toValue: 0.25, duration: 550, useNativeDriver: true }),
      Animated.timing(blink, { toValue: 1, duration: 550, useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, [mode, reduced]);

  function clearTimers() { timers.current.forEach(clearTimeout); timers.current = []; }
  useEffect(() => () => { clearTimers(); recRef.current?.stopAndUnloadAsync().catch(() => {}); }, []);

  function startCountdown() {
    setMode("count"); setCount(3);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const tick = (n: number) => {
      timers.current.push(setTimeout(() => {
        if (n > 1) {
          setCount(n - 1);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          tick(n - 1);
        } else startRecording();
      }, 700));
    };
    tick(3);
  }

  function cancelCountdown() { clearTimers(); setMode("ready"); }

  async function startRecording() {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        { ...Audio.RecordingOptionsPresets.HIGH_QUALITY, isMeteringEnabled: true },
        (status) => {
          // metering: dBFS (âm) → mức 0..1 cho waveform "app đang nghe bạn"
          if (status.isRecording && typeof status.metering === "number") {
            const level = Math.max(0.08, Math.min(1, (status.metering + 60) / 60));
            setLevels((prev) => [...prev.slice(1), level]);
          }
        },
        120,
      );
      recRef.current = recording;
      startAt.current = Date.now();
      setSec(0); setTeleIdx(0); setMode("rec");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const loop = () => {
        timers.current.push(setTimeout(() => {
          const s = Math.floor((Date.now() - startAt.current) / 1000);
          setSec(s);
          setTeleIdx(Math.floor(s / STEP_SEC));
          loop();
        }, 500));
      };
      loop();
    } catch {
      // mic không vào được → đường lui giả lập, giọng dịu (không đổ lỗi)
      Alert.alert("Micro", "Không vào được micro — nộp giả lập nhé.");
      setMode("ready");
      onMock();
    }
  }

  async function stopAndSubmit() {
    const rec = recRef.current;
    if (!rec) return;
    clearTimers();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    await rec.stopAndUnloadAsync();
    const uri = rec.getURI();
    recRef.current = null;
    const dur = Math.max(1, Math.round((Date.now() - startAt.current) / 1000));
    setMode("ready");
    if (uri) onSubmit(uri, dur);
  }

  const steps = lesson.brief?.steps ?? [];
  const over = sec >= TARGET_SEC;
  const progress = Math.min(1, sec / TARGET_SEC);

  // ===== recording =====
  if (mode === "rec") {
    const cur = steps.length ? Math.min(teleIdx, steps.length - 1) : -1;
    return (
      <View>
        <View style={st.recHead}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Animated.View style={[st.recDot, { opacity: reduced ? 1 : blink }]} />
            <Text style={st.recLabel}>ĐANG THU</Text>
          </View>
          <Text style={st.clock} accessibilityLabel={`Đang thu, ${fmt(sec)}`}>{fmt(sec)}</Text>
        </View>
        <View style={st.progTrack}>
          <View style={[st.progFill, { width: `${progress * 100}%` }, over && { backgroundColor: C.spot }]} />
        </View>
        <Text style={[st.progHint, over && { color: "#B07A00" }]}>
          {over ? "Đủ dài rồi — có thể dừng bất cứ lúc nào" : `Mốc gợi ý ~${TARGET_SEC} giây`}
        </Text>

        {steps.length > 0 && (
          <View style={st.tele}>
            <Text style={st.teleLabel}>ĐANG DẪN TỚI</Text>
            {steps.map((s, i) => (
              <Text key={i} style={[st.teleStep, i === cur && st.teleCur, i < cur && st.teleDone]} numberOfLines={2}>
                {i < cur ? "✓  " : i === cur ? "›  " : "   "}{s}
              </Text>
            ))}
          </View>
        )}

        <View style={st.wave} accessibilityLabel="Sóng âm — app đang nghe bạn">
          {levels.map((lv, i) => (
            <View key={i} style={[st.bar, { height: reduced ? 14 : 6 + lv * 46 }]} />
          ))}
        </View>

        <View style={{ alignItems: "center", marginTop: 12 }}>
          <TouchableOpacity style={st.stopBtn} onPress={stopAndSubmit} accessibilityLabel="Dừng và nộp">
            <View style={st.stopSquare} />
          </TouchableOpacity>
          <Text style={st.underBtn}>Dừng &amp; nộp</Text>
        </View>
      </View>
    );
  }

  // ===== ready (+ overlay count / processing) =====
  return (
    <View>
      <View style={st.card}>
        {lesson.tip ? <View style={st.tipBox}><Text style={st.tipT}>{lesson.tip}</Text></View> : null}
        <Text style={st.taskLabel}>Đề bài</Text>
        <Text style={st.taskPrompt}>{lesson.prompt}</Text>
        {steps.length ? (<><Text style={st.taskLabel}>Gợi ý dàn ý</Text>{steps.map((s, i) => <Text key={i} style={st.taskBullet}>{i + 1}.  {s}</Text>)}</>) : null}
        {showFull ? (
          <>
            {lesson.brief?.objective ? (<><Text style={st.taskLabel}>Mục tiêu</Text><Text style={st.taskText}>{lesson.brief.objective}</Text></>) : null}
            {lesson.brief?.context ? (<><Text style={st.taskLabel}>Tình huống</Text><Text style={st.taskText}>{lesson.brief.context}</Text></>) : null}
            {lesson.criteria?.length ? (<><Text style={st.taskLabel}>Tiêu chí đạt</Text>{lesson.criteria.map((c, i) => (
              <View key={i} style={st.critRow}><View style={st.critDot} /><Text style={st.taskText}>{c}</Text></View>
            ))}</>) : null}
          </>
        ) : (lesson.brief?.objective || lesson.criteria?.length) ? (
          <TouchableOpacity onPress={() => setShowFull(true)} accessibilityLabel="Xem đủ đề bài">
            <Text style={st.moreLink}>Xem đủ đề bài (mục tiêu · tình huống · tiêu chí)</Text>
          </TouchableOpacity>
        ) : null}
        {lesson.brief?.example ? (showEx ? (
          <View style={st.exampleBox}>
            <Text style={st.exampleLabel}>VÍ DỤ MẪU · tham khảo cách làm, đừng đọc nguyên văn</Text>
            <Text style={st.exampleText}>“{lesson.brief.example}”</Text>
          </View>
        ) : (
          <TouchableOpacity style={st.ghostBtn} onPress={() => setShowEx(true)}>
            <Text style={st.ghostT}>Bí quá? Xem gợi ý mẫu</Text>
          </TouchableOpacity>
        )) : null}

        <View style={{ alignItems: "center", marginTop: 18 }}>
          <View style={{ width: 96, height: 96, alignItems: "center", justifyContent: "center" }}>
            {!reduced && (
              <Animated.View style={[st.breathRing, {
                opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.1] }),
                transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.25] }) }],
              }]} />
            )}
            <TouchableOpacity style={st.micBtn} onPress={startCountdown} accessibilityLabel="Nút ghi — chạm để bắt đầu">
              <Mic size={34} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={st.underBtn}>Chạm để bắt đầu</Text>
          <Text style={st.calm}>Hít thở nhẹ — cứ nói như đang kể cho một người bạn.{"\n"}Luyện không có sai đâu.</Text>
          <TouchableOpacity onPress={onMock}><Text style={st.skipT}>Bỏ qua — nộp giả lập</Text></TouchableOpacity>
        </View>
        <TouchableOpacity style={st.ghostBtn} onPress={onBack}>
          <Text style={st.ghostT}>Quay lại lộ trình</Text>
        </TouchableOpacity>
      </View>

      {mode === "count" && (
        <TouchableOpacity style={st.countOverlay} activeOpacity={1} onPress={cancelCountdown}
          accessibilityLabel={`Đếm ngược ${count} — chạm để huỷ`}>
          <Text style={st.countNum}>{count}</Text>
          <Text style={st.countSub}>Chuẩn bị nào…</Text>
          <Text style={st.countCancel}>Chạm bất kỳ đâu để huỷ</Text>
        </TouchableOpacity>
      )}

      {busy && (
        <View style={st.procOverlay}>
          <ActivityIndicator color={C.spot} size="large" />
          <Text style={st.procT}>Đang nghe bạn dẫn…</Text>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: C.raised, borderRadius: 16, padding: 14, marginBottom: 10 },
  tipBox: { backgroundColor: C.sunken, borderRadius: 12, padding: 11 },
  tipT: { color: C.ink, fontSize: 13.5 },
  taskLabel: { fontWeight: "800", color: C.ink2, fontSize: 11, letterSpacing: 0.6, marginTop: 14, marginBottom: 4 },
  taskPrompt: { fontFamily: F.title, fontSize: 16, color: C.ink, lineHeight: 22 },
  taskText: { color: C.ink, fontSize: 14, lineHeight: 20, flex: 1 },
  taskBullet: { color: C.ink, fontSize: 14, lineHeight: 22 },
  critRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 2 },
  critDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#3DBE7A", marginTop: 6 },
  exampleBox: { backgroundColor: C.sunken, borderRadius: 14, padding: 14, marginTop: 12, borderLeftWidth: 3, borderLeftColor: C.primary },
  exampleLabel: { fontWeight: "800", fontSize: 10, color: C.ink2, marginBottom: 6, letterSpacing: 0.4 },
  exampleText: { color: C.ink, fontSize: 14, lineHeight: 21, fontStyle: "italic" },
  ghostBtn: { backgroundColor: C.sunken, borderRadius: 999, padding: 13, alignItems: "center", marginTop: 10 },
  ghostT: { color: C.ink, fontWeight: "800" },
  moreLink: { color: C.ink2, fontSize: 12.5, fontFamily: F.semi, textDecorationLine: "underline", marginTop: 12 },

  breathRing: { position: "absolute", width: 92, height: 92, borderRadius: 46, backgroundColor: C.primary },
  micBtn: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: C.primary,
    alignItems: "center", justifyContent: "center",
    shadowColor: C.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
  },
  underBtn: { fontSize: 13, fontWeight: "800", color: C.ink, marginTop: 10 },
  calm: { fontSize: 12, color: C.ink2, textAlign: "center", marginTop: 6, lineHeight: 18 },
  skipT: { fontSize: 12, color: "#BFB4C4", marginTop: 12, textDecorationLine: "underline" },

  recHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  recDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.primary },
  recLabel: { fontSize: 12, fontFamily: F.title, letterSpacing: 1, color: C.primary },
  clock: { fontSize: 17, fontFamily: F.display, color: C.ink },
  progTrack: { height: 5, backgroundColor: "#F0E6D8", borderRadius: 999, marginTop: 8, overflow: "hidden" },
  progFill: { height: "100%", backgroundColor: C.primary, borderRadius: 999 },
  progHint: { fontSize: 10.5, color: "#BFB4C4", marginTop: 5 },

  tele: { backgroundColor: C.raised, borderRadius: 14, padding: 13, marginTop: 16 },
  teleLabel: { fontWeight: "800", color: C.ink2, fontSize: 10, letterSpacing: 1, marginBottom: 6 },
  teleStep: { fontSize: 14, lineHeight: 24, color: "#BFB4C4", fontWeight: "500" },
  teleCur: { color: C.primary, fontWeight: "800" },
  teleDone: { color: "#B7ADBE" },

  wave: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, height: 60, marginTop: 18 },
  bar: { width: 4, borderRadius: 2, backgroundColor: C.primary },

  stopBtn: {
    width: 68, height: 68, borderRadius: 34, backgroundColor: "#fff",
    borderWidth: 3, borderColor: C.primary, alignItems: "center", justifyContent: "center",
  },
  stopSquare: { width: 24, height: 24, borderRadius: 7, backgroundColor: C.primary },

  countOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,248,240,0.95)",
    alignItems: "center", justifyContent: "center", zIndex: 30, borderRadius: 16,
  },
  countNum: { fontSize: 96, fontFamily: F.displayX, color: C.primary, lineHeight: 112 },
  countSub: { fontSize: 14, color: C.ink2, marginTop: 8 },
  countCancel: { fontSize: 12, color: "#BFB4C4", marginTop: 18 },

  procOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(59,42,74,0.5)",
    alignItems: "center", justifyContent: "center", zIndex: 30, borderRadius: 16,
  },
  procT: { fontSize: 16, fontWeight: "800", color: "#FFF8F0", marginTop: 14 },
});
