// RecordScreen.tsx — màn quay clip "Reels ấm" (P1-man-quay-clip-spec).
// State machine: ready → count(3-2-1) → recording → (parent busy = processing).
// Waveform sống từ metering mic (expo-av) · teleprompter dàn ý · đồng hồ + vòng tiến độ.
// Chỉ báo thu = SAN HÔ + chữ (không đỏ — đỏ chỉ cho lỗi thật).
import { useEffect, useRef, useState } from "react";
import { Dimensions } from "react-native";
import {
  AccessibilityInfo, ActivityIndicator, Alert, Animated, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { C, F, T } from "./theme";
import { Bolt, Check, ListIcon, Mic, Pause, Pin, Play, Target } from "./icons";
import Misa from "./Misa";
import GenreScene from "./scenes";
import { setRecording, sfx } from "./sound";

type Brief = { objective: string; context: string; steps: string[]; example: string };
export type RecLesson = {
  sample_voice_url?: string | null;  // giọng MC mẫu (P1-4) — nghe rồi đọc theo
  id: string; buoi: number; title: string; tip: string; prompt: string;
  brief?: Brief | null; criteria?: string[];
};

const TARGET_SEC = 60;   // mốc gợi ý — quá mốc KHÔNG phạt, chỉ nhắc dịu
const N_BARS = 34;
const STEP_SEC = 4;      // teleprompter tự trôi mỗi 4s (người dùng vẫn tự do nói)

function fmt(s: number) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }

export default function RecordScreen({ lesson, busy, energyCost = 0, doneCount = 99, genre = "", onSubmit, onMock, onBack }: {
  lesson: RecLesson;
  busy: boolean;
  energyCost?: number;   // năng lượng bài này tốn (0 = Pro/ẩn)
  doneCount?: number;    // số bài user đã hoàn thành — <3 thì BÀI MẪU mặc định mở (V2 prompter)
  genre?: string;        // tên thể loại — chọn SCENE minh hoạ đầu thẻ (P1-3)
  onSubmit: (uri: string, durationSec: number) => void;
  onMock: () => void;
  onBack: () => void;
}) {
  const [mode, setMode] = useState<"ready" | "count" | "rec">("ready");
  // Nghe giọng MC MẪU (P1-4) — người mới nghe 1 lần rồi đọc theo prompter
  const [playingSample, setPlayingSample] = useState(false);
  const sampleRef = useRef<Audio.Sound | null>(null);
  useEffect(() => () => { sampleRef.current?.unloadAsync().catch(() => {}); }, []);
  async function toggleSample() {
    try {
      if (playingSample) {
        await sampleRef.current?.stopAsync();
        setPlayingSample(false);
        return;
      }
      if (!lesson.sample_voice_url) return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      if (!sampleRef.current) {
        const { sound } = await Audio.Sound.createAsync({ uri: lesson.sample_voice_url });
        sound.setOnPlaybackStatusUpdate((st: any) => { if (st.didJustFinish) setPlayingSample(false); });
        sampleRef.current = sound;
      }
      await sampleRef.current.replayAsync();
      setPlayingSample(true);
    } catch { setPlayingSample(false); }
  }
  const [showEx, setShowEx] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem("prompter_open").then((v) => {
      if (v !== null) setShowEx(v === "1");
      else setShowEx(doneCount < 3); // người mới: bài mẫu mở sẵn để đọc theo
    });
  }, []);
  function togglePrompter(open: boolean) {
    setShowEx(open);
    AsyncStorage.setItem("prompter_open", open ? "1" : "0").catch(() => {});
  }
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
  useEffect(() => () => { clearTimers(); setRecording(false); recRef.current?.stopAndUnloadAsync().catch(() => {}); }, []);

  function startCountdown() {
    setMode("count"); setCount(3);
    setRecording(true);  // chặn nhạc nền TRƯỚC khi mic mở (cue kêu lúc đếm, không lọt vào clip)
    sfx("start");
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

  function cancelCountdown() { clearTimers(); setRecording(false); setMode("ready"); }

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
      setRecording(false);
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
    setRecording(false);  // mic đã đóng → nhạc/SFX được phép trở lại
    sfx("stop");
    const uri = rec.getURI();
    recRef.current = null;
    const dur = Math.max(1, Math.round((Date.now() - startAt.current) / 1000));
    setMode("ready");
    if (uri) onSubmit(uri, dur);
  }

  const steps = lesson.brief?.steps ?? [];
  // nhãn section = icon + chữ (V4-3: bớt chữ, thêm hình)
  const L = ({ icon, t }: { icon: any; t: string }) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14, marginBottom: 5 }}>
      {icon}<Text style={st.taskLabel2}>{t}</Text>
    </View>
  );
  const over = sec >= TARGET_SEC;
  const progress = Math.min(1, sec / TARGET_SEC);

  // ===== recording =====
  const cur = steps.length ? Math.min(teleIdx, steps.length - 1) : -1;
  // ===== SÂN KHẤU THU (V5): toàn màn trong Modal — đồng hồ ghim đỉnh, dàn ý cuộn giữa,
  // nút Dừng GHIM ĐÁY luôn thấy (hết cảnh overlay absolute bị cuộn trôi) =====
  const recUI = (
    <View style={{ flex: 1 }}>
      <View style={st.stageHead}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Animated.View style={[st.recDot, { opacity: reduced ? 1 : blink }]} />
          <Text style={st.recLabel}>ĐANG THU</Text>
        </View>
        <Text style={st.clock} accessibilityLabel={`Đang thu, ${fmt(sec)}`}>{fmt(sec)}</Text>
      </View>
      <View style={{ paddingHorizontal: 20 }}>
        <View style={st.progTrack}>
          <View style={[st.progFill, { width: `${progress * 100}%` }, over && { backgroundColor: C.spot }]} />
        </View>
        <Text style={[st.progHint, over && { color: "#B07A00" }]}>
          {over ? "Đủ dài rồi — có thể dừng bất cứ lúc nào" : `Mốc gợi ý ~${TARGET_SEC} giây`}
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
        {showEx && lesson.brief?.example ? (
          <View style={[st.prompter, { marginTop: 10 }]}>
            <Text style={st.prompterLabel}>BÀI MẪU</Text>
            <Text style={[st.prompterText, { fontSize: 19, lineHeight: 30 }]}>“{lesson.brief.example}”</Text>
          </View>
        ) : null}
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
      </ScrollView>

      <View style={st.stageFoot}>
        <View style={st.wave} accessibilityLabel="Sóng âm — app đang nghe bạn">
          {levels.map((lv, i) => (
            <View key={i} style={[st.bar, { height: reduced ? 14 : 6 + lv * 46 }]} />
          ))}
        </View>
        <TouchableOpacity style={st.stopBtn} onPress={stopAndSubmit} accessibilityLabel="Dừng và nộp">
          <View style={st.stopSquare} />
        </TouchableOpacity>
        <Text style={st.underBtn}>Dừng &amp; nộp</Text>
      </View>
    </View>
  );

  // ===== ready (+ overlay count / processing) =====
  return (
    <View>
      <View style={st.card}>
        <View style={{ marginHorizontal: -14, marginTop: -14, marginBottom: 10, borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: "hidden", backgroundColor: "#FFEFE2" }}>
          <GenreScene genre={genre} width={WCARD} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Misa mood="covu" size={54} accessory={genre.toLowerCase().includes("cưới") || genre.toLowerCase().includes("sự kiện") ? "bowtie" : genre.toLowerCase().includes("live") ? "headset" : null} />
          {lesson.tip ? <View style={[st.tipBox, { flex: 1 }]}><Text style={st.tipT}>{lesson.tip}</Text></View>
            : <Text style={[st.tipT, { flex: 1 }]}>Bạn làm được mà — nói như kể cho một người bạn nghe.</Text>}
        </View>
        <L icon={<Mic size={15} color={C.ink2} />} t="Đề bài" />
        <Text style={st.taskPrompt}>{lesson.prompt}</Text>
        {steps.length ? (<><L icon={<ListIcon size={15} color={C.ink2} />} t="Dàn ý" />{steps.map((s, i) => (
          <View key={i} style={st.stepRow}>
            <View style={st.stepNum}><Text style={st.stepNumT}>{i + 1}</Text></View>
            <Text style={st.taskBullet}>{s}</Text>
          </View>
        ))}</>) : null}
        {showFull ? (
          <>
            {lesson.brief?.objective ? (<><L icon={<Target size={15} color={C.ink2} />} t="Mục tiêu" /><Text style={st.taskText}>{lesson.brief.objective}</Text></>) : null}
            {lesson.brief?.context ? (<><L icon={<Pin size={15} color={C.ink2} />} t="Tình huống" /><Text style={st.taskText}>{lesson.brief.context}</Text></>) : null}
            {lesson.criteria?.length ? (<><L icon={<Check size={15} color={C.ink2} />} t="Tiêu chí đạt" />{lesson.criteria.map((c, i) => (
              <View key={i} style={st.critRow}><View style={st.critDot} /><Text style={st.taskText}>{c}</Text></View>
            ))}</>) : null}
          </>
        ) : (lesson.brief?.objective || lesson.criteria?.length) ? (
          <TouchableOpacity onPress={() => setShowFull(true)} accessibilityLabel="Xem đủ đề bài">
            <Text style={st.moreLink}>Xem đủ đề bài (mục tiêu · tình huống · tiêu chí)</Text>
          </TouchableOpacity>
        ) : null}
        {lesson.sample_voice_url ? (
          <TouchableOpacity style={st.sampleBtn} onPress={toggleSample} accessibilityLabel="Nghe giọng MC mẫu">
            {playingSample ? <Pause size={15} color="#fff" /> : <Play size={15} color="#fff" />}
            <Text style={st.sampleBtnT}>{playingSample ? "Dừng giọng mẫu" : "Nghe giọng MC mẫu"}</Text>
          </TouchableOpacity>
        ) : null}
        {lesson.brief?.example ? (showEx ? (
          <View style={st.prompter}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={st.prompterLabel}>BÀI MẪU — mới tập thì cứ đọc theo nhé</Text>
              <TouchableOpacity onPress={() => togglePrompter(false)} accessibilityLabel="Ẩn bài mẫu"><Text style={st.prompterHide}>Ẩn</Text></TouchableOpacity>
            </View>
            <Text style={st.prompterText}>“{lesson.brief.example}”</Text>
          </View>
        ) : (
          <TouchableOpacity style={st.ghostBtn} onPress={() => togglePrompter(true)}>
            <Text style={st.ghostT}>Xem bài mẫu — đọc theo được</Text>
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
              <Mic size={38} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={st.underBtn}>Chạm để bắt đầu</Text>
          {energyCost > 0 && <View style={st.energyTag}><Bolt size={12} color="#8a5a13" /><Text style={st.energyTagT}> Bài này tốn {energyCost} năng lượng</Text></View>}
          <Text style={st.calm}>Cứ nói như kể cho một người bạn nghe 💛</Text>
          <TouchableOpacity onPress={onMock}><Text style={st.skipT}>Bỏ qua — nộp giả lập</Text></TouchableOpacity>
        </View>
        <TouchableOpacity style={st.ghostBtn} onPress={onBack}>
          <Text style={st.ghostT}>Quay lại lộ trình</Text>
        </TouchableOpacity>
      </View>

      {/* SÂN KHẤU (V5): đếm ngược + thu + chấm là MODAL toàn màn — không dính scroll trang */}
      <Modal visible={mode !== "ready" || busy} animationType="fade" statusBarTranslucent
        onRequestClose={() => { if (mode === "count") cancelCountdown(); }}>
        {mode === "count" ? (
          <TouchableOpacity style={st.countStage} activeOpacity={1} onPress={cancelCountdown}
            accessibilityLabel={`Đếm ngược ${count} — chạm để huỷ`}>
            <View style={st.countSpot} />
            <Text style={st.countNum}>{count}</Text>
            <Text style={st.countSub}>Hít một hơi… sân khấu là của bạn 🎤</Text>
            <Text style={st.countCancel}>Chạm bất kỳ đâu để huỷ</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ flex: 1, backgroundColor: C.base }}>
            {mode === "rec" && recUI}
            {busy && (
              <View style={st.procFull}>
                <Misa mood="covu" size={84} />
                <ActivityIndicator color={C.spot} size="large" style={{ marginTop: 14 }} />
                <Text style={st.procT}>Đang nghe bạn dẫn…</Text>
              </View>
            )}
          </View>
        )}
      </Modal>
    </View>
  );
}

const WCARD = Dimensions.get("window").width - 32; // thẻ padding 16 hai bên

const st = StyleSheet.create({
  card: { backgroundColor: C.raised, borderRadius: 16, padding: 14, marginBottom: 10 },
  tipBox: { backgroundColor: C.sunken, borderRadius: 12, padding: 11 },
  tipT: { color: C.ink, fontSize: 15 },
  taskLabel: { fontWeight: "800", color: C.ink2, fontSize: 12.5, letterSpacing: 0.6, marginTop: 14, marginBottom: 4 },
  taskLabel2: { fontWeight: "800", color: C.ink2, fontSize: 13, letterSpacing: 0.5 },
  taskPrompt: { fontFamily: F.title, fontSize: T.title, color: C.ink, lineHeight: 28 },
  taskText: { color: C.ink, fontSize: T.body, lineHeight: 23, flex: 1 },
  taskBullet: { color: C.ink, fontSize: T.body, lineHeight: 25 },
  critRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 2 },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 7 },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#FFE3DE", alignItems: "center", justifyContent: "center", borderBottomWidth: 2.5, borderBottomColor: "#F5C2BA", marginTop: 1 },
  stepNumT: { fontFamily: F.displayX, fontSize: 13, color: C.primary },
  critDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#3DBE7A", marginTop: 6 },
  sampleBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.ink, borderRadius: 14, borderBottomWidth: 4, borderBottomColor: "#241A2E", paddingVertical: 11, marginTop: 12 },
  sampleBtnT: { color: "#FFC24B", fontFamily: F.title, fontSize: 15 },
  prompter: { backgroundColor: "#FFF3DA", borderRadius: 16, padding: 16, marginTop: 12, borderWidth: 2, borderColor: "#F5DFAE" },
  prompterLabel: { fontWeight: "800", fontSize: 12, color: "#8a5a13", letterSpacing: 0.4 },
  prompterHide: { color: "#8a5a13", fontWeight: "800", fontSize: 13, textDecorationLine: "underline" },
  prompterText: { color: C.ink, fontSize: T.prompter, lineHeight: 34, marginTop: 8, fontFamily: F.med },
  ghostBtn: { backgroundColor: C.sunken, borderRadius: 999, padding: 13, alignItems: "center", marginTop: 10 },
  ghostT: { color: C.ink, fontWeight: "800" },
  moreLink: { color: C.ink2, fontSize: 12.5, fontFamily: F.semi, textDecorationLine: "underline", marginTop: 12 },

  breathRing: { position: "absolute", width: 92, height: 92, borderRadius: 46, backgroundColor: C.primary },
  micBtn: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: C.primary,
    alignItems: "center", justifyContent: "center",
    borderBottomWidth: 6, borderBottomColor: C.primaryDown,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
  },
  underBtn: { fontSize: 15, fontWeight: "800", color: C.ink, marginTop: 10 },
  energyTag: { backgroundColor: "#FFF3DA", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, marginTop: 8, flexDirection: "row", alignItems: "center" },
  energyTagT: { fontSize: 12, fontFamily: F.semi, color: "#8a5a13" },
  calm: { fontSize: 13.5, color: C.ink2, textAlign: "center", marginTop: 6, lineHeight: 20 },
  skipT: { fontSize: 12, color: "#BFB4C4", marginTop: 12, textDecorationLine: "underline" },

  recHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  recDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.primary },
  recLabel: { fontSize: 12, fontFamily: F.title, letterSpacing: 1, color: C.primary },
  clock: { fontSize: 17, fontFamily: F.display, color: C.ink },
  progTrack: { height: 5, backgroundColor: "#F0E6D8", borderRadius: 999, marginTop: 8, overflow: "hidden" },
  progFill: { height: "100%", backgroundColor: C.primary, borderRadius: 999 },
  progHint: { fontSize: 12, color: "#BFB4C4", marginTop: 5 },

  tele: { backgroundColor: C.raised, borderRadius: 14, padding: 13, marginTop: 16 },
  teleLabel: { fontWeight: "800", color: C.ink2, fontSize: 12, letterSpacing: 1, marginBottom: 6 },
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

  // đếm ngược = hậu trường tắt đèn: nền mận tối, số vàng đèn, quầng spotlight
  countStage: { flex: 1, backgroundColor: "#241A2E", alignItems: "center", justifyContent: "center" },
  countSpot: { position: "absolute", width: 340, height: 340, borderRadius: 170, backgroundColor: "rgba(255,194,75,0.14)" },
  countNum: { fontSize: 110, fontFamily: F.displayX, color: C.spot, lineHeight: 128 },
  countSub: { fontSize: 16, color: "#EDE4D2", marginTop: 8, fontFamily: F.semi },
  countCancel: { fontSize: 13, color: "#9A8EA5", marginTop: 22 },

  stageHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 58, paddingHorizontal: 20, paddingBottom: 4 },
  stageFoot: { alignItems: "center", paddingBottom: 34, paddingTop: 6, paddingHorizontal: 20, backgroundColor: C.base, borderTopWidth: 1, borderTopColor: C.hair },
  procFull: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,248,240,0.96)", alignItems: "center", justifyContent: "center" },
  procT: { fontSize: 17, fontWeight: "800", color: C.ink, marginTop: 12 },
});
