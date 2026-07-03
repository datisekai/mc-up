import { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Audio } from "expo-av";
import { C } from "./src/theme";
import { Api, submitAudio } from "./src/api";
import StageMap from "./src/StageMap";
import { Fire, MapIcon, Mic, Star, Ticket, User } from "./src/icons";

type Lesson = { id: string; buoi: number; order_index: number; title: string; tip: string; prompt: string; unlocked: boolean; done: boolean };
type Score = { volume_label: string; speed_wpm: number; filler_count: number; tip: string; is_mock: boolean };

export default function App() {
  const [booting, setBooting] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [learnerToken, setLT] = useState("");
  const [mcToken, setMT] = useState("");
  const [tab, setTab] = useState<"hv" | "mc" | "hs">("hv");
  const [prog, setProg] = useState({ xp: 0, streak: 0, tickets: 0 });
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [screen, setScreen] = useState<"feed" | "practice" | "score">("feed");
  const [curLesson, setCur] = useState<Lesson | null>(null);
  const [score, setScore] = useState<Score | null>(null);
  const [lastClip, setLastClip] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recStart, setRecStart] = useState(0);
  const [queue, setQueue] = useState<any[]>([]);

  useEffect(() => { boot(); }, []);

  async function boot() {
    try {
      let lt: string;
      try { lt = (await Api.login("linh@demo.vn", "123456")).access_token; }
      catch { lt = (await Api.register("linh@demo.vn", "123456", "Linh")).access_token; }
      const mt = (await Api.login("mc@test.vn", "123456")).access_token;
      setLT(lt); setMT(mt);
      await refresh(lt);
    } catch (e: any) { setErr(e.message); }
    setBooting(false);
  }
  async function refresh(lt = learnerToken) {
    setProg(await Api.progress(lt));
    setLessons(await Api.lessons(lt));
    setReviews(await Api.myReviews(lt));
    setScreen("feed");
  }

  async function startRec() {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(recording); setRecStart(Date.now());
    } catch { Alert.alert("Micro", "Không vào được micro — nộp giả lập nhé."); doSubmitMock(); }
  }
  async function stopRec() {
    if (!recording || !curLesson) return;
    setBusy(true);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI(); const dur = Math.max(1, Math.round((Date.now() - recStart) / 1000));
    setRecording(null);
    try {
      const clip = await submitAudio(learnerToken, curLesson.id, uri!, dur);
      await pollScore(clip.id);
    } catch (e: any) { Alert.alert("Lỗi", e.message); setBusy(false); }
  }
  async function doSubmitMock() {
    if (!curLesson) return;
    setBusy(true);
    const clip = await Api.submitMock(learnerToken, curLesson.id, 30);
    await pollScore(clip.id);
  }
  async function pollScore(clipId: string) {
    let s: any = null;
    for (let i = 0; i < 15; i++) {
      const c = await Api.clip(learnerToken, clipId);
      if (c.status === "done") { s = c; break; }
      await new Promise((r) => setTimeout(r, 400));
    }
    setLastClip(clipId); setScore(s.score); setProg(await Api.progress(learnerToken));
    setBusy(false); setScreen("score");
  }
  async function sendVeVang() {
    try { await Api.sendTicket(learnerToken, lastClip!); Alert.alert("Đã gửi", "Chờ MC nhận xét 🎤"); await refresh(); }
    catch (e: any) { Alert.alert("Lỗi", e.message); }
  }
  async function loadQueue() { setQueue(await Api.mcQueue(mcToken)); }
  async function doReview(reqId: string, note: string) {
    await Api.mcReview(mcToken, reqId, note || "Giọng em có màu, giữ nhịp tốt!");
    Alert.alert("Đã gửi", "Thẻ bảo chứng đã tạo ✨"); await loadQueue(); await refresh();
  }

  if (booting) return <View style={s.center}><ActivityIndicator color={C.primary} size="large" /><Text style={{ marginTop: 10, color: C.ink2 }}>Đang khởi động McUp…</Text></View>;
  if (err) return <View style={s.center}><Text style={{ color: C.ink }}>Lỗi: {err}</Text><Text style={{ color: C.ink2, marginTop: 8, textAlign: "center" }}>Backend đã chạy chưa? Kiểm tra API_BASE trong src/api.ts</Text></View>;

  return (
    <View style={s.app}>
      <StatusBar style="dark" />
      <View style={s.header}>
        <Text style={s.brand}>McUp</Text>
        <View style={{ flexDirection: "row", gap: 6 }}>
          <Chip icon={<Fire size={15} color="#F5A623" />}>{prog.streak}</Chip>
          <Chip icon={<Star size={14} color={C.primary} />}>{prog.xp}</Chip>
          <Chip icon={<Ticket size={15} color="#E0A62F" />}>{prog.tickets}</Chip>
        </View>
      </View>
      <View style={s.tabs}>
        <Tab on={tab === "hv"} icon={<MapIcon size={16} color={tab === "hv" ? "#fff" : C.ink2} />} label="Lộ trình" onPress={() => setTab("hv")} />
        <Tab on={tab === "hs"} icon={<User size={16} color={tab === "hs" ? "#fff" : C.ink2} />} label="Hồ sơ" onPress={() => setTab("hs")} />
        <Tab on={tab === "mc"} icon={<Mic size={16} color={tab === "mc" ? "#fff" : C.ink2} />} label="MC" onPress={() => { setTab("mc"); loadQueue(); }} />
      </View>

      {tab === "hv" && screen === "feed" ? (
        <StageMap lessons={lessons} onPick={(l) => { const full = lessons.find((x) => x.id === l.id); if (full) { setCur(full); setScreen("practice"); } }} />
      ) : (
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {tab === "hv" && screen === "practice" && curLesson && (
          <View>
            <Kicker>Buổi {curLesson.buoi} · {curLesson.title}</Kicker>
            <View style={s.card}>
              <View style={s.tip}><Text>💡 {curLesson.tip}</Text></View>
              <Text style={{ fontWeight: "700", marginVertical: 12 }}>🎬 Đề: {curLesson.prompt}</Text>
              {busy ? <ActivityIndicator color={C.primary} /> : recording ? (
                <Btn label="Dừng & nộp" onPress={stopRec} />
              ) : (
                <>
                  <Btn label="Bắt đầu quay (nói vào mic)" onPress={startRec} />
                  <Btn ghost label="Bỏ qua — nộp giả lập" onPress={doSubmitMock} />
                </>
              )}
              <Btn ghost label="← Quay lại lộ trình" onPress={() => refresh()} />
            </View>
          </View>
        )}
        {tab === "hv" && screen === "score" && score && (
          <View>
            <Kicker>Kết quả · phần Xác {score.is_mock ? "(giả lập)" : "(ASR thật)"}</Kicker>
            <View style={s.card}>
              <Row k="Âm lượng" v={score.volume_label} ok={score.volume_label === "tốt"} />
              <Row k="Tốc độ" v={`${score.speed_wpm} chữ/phút`} />
              <Row k="Từ đệm 'ừm/à'" v={`${score.filler_count} lần`} />
              <View style={[s.tip, { marginTop: 10 }]}><Text>💡 {score.tip}</Text></View>
            </View>
            <Btn gold label="Gửi cho MC thật (Vé Vàng)" onPress={sendVeVang} />
            <Btn ghost label="Tiếp tục lộ trình →" onPress={() => refresh()} />
          </View>
        )}
        {tab === "hs" && <ProfileView prog={prog} reviews={reviews} />}
        {tab === "mc" && <MCView queue={queue} onReview={doReview} onReload={loadQueue} />}
      </ScrollView>
      )}
    </View>
  );
}

function ProfileView({ prog, reviews }: { prog: { xp: number; streak: number; tickets: number }; reviews: any[] }) {
  const badges = reviews.filter((r) => r.badge);
  const waiting = reviews.some((r) => !r.badge);
  return (
    <View>
      <Kicker>Tiến bộ của bạn</Kicker>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <StatCard icon={<Fire size={22} color="#F5A623" />} value={prog.streak} label="Ngày streak" />
        <StatCard icon={<Star size={22} color={C.primary} />} value={prog.xp} label="XP" />
        <StatCard icon={<Ticket size={22} color="#E0A62F" />} value={prog.tickets} label="Vé Vàng" />
      </View>
      <Kicker>Thẻ MC bảo chứng</Kicker>
      {badges.length === 0 && !waiting && (
        <Text style={{ color: C.ink2, paddingHorizontal: 4 }}>Chưa có. Luyện xong rồi gửi Vé Vàng cho MC để nhận nhận xét nhé!</Text>
      )}
      {badges.map((r) => (
        <View key={r.id} style={[s.card, { borderWidth: 1, borderColor: "#F3E4CE" }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={s.avatar}><Text style={{ color: "#fff", fontWeight: "800", fontSize: 18 }}>{(r.badge.mc_name || "M").replace(/^MC /, "")[0]}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "800", fontSize: 15 }}>{r.badge.mc_name}</Text>
              <Text style={{ color: C.ink2, fontSize: 12 }}>{r.badge.mc_title}</Text>
            </View>
          </View>
          <Text style={{ fontStyle: "italic", marginTop: 10, lineHeight: 20 }}>"{r.badge.note}"</Text>
        </View>
      ))}
      {waiting && <Text style={{ color: C.ink2, paddingHorizontal: 4, marginTop: 4 }}>Có clip đang chờ MC nghe bạn dẫn…</Text>}
    </View>
  );
}
function StatCard({ icon, value, label }: any) {
  return (
    <View style={[s.card, { flex: 1, alignItems: "center", marginBottom: 0 }]}>
      {icon}
      <Text style={{ fontWeight: "900", fontSize: 22, color: C.ink, marginTop: 4 }}>{value}</Text>
      <Text style={{ color: C.ink2, fontSize: 11, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

function MCView({ queue, onReview, onReload }: { queue: any[]; onReview: (id: string, note: string) => void; onReload: () => void }) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  return (
    <View>
      <Kicker>Hàng đợi nhận xét (MC Hạnh)</Kicker>
      {queue.length === 0 && <Text style={{ color: C.ink2, textAlign: "center", padding: 20 }}>Chưa có clip chờ. Sang tab Học viên, luyện rồi bấm "Gửi cho MC thật".</Text>}
      {queue.map((it) => (
        <View key={it.request_id} style={s.card}>
          <Text style={{ fontWeight: "700" }}>{it.hoc_vien_name || "Học viên"}</Text>
          <Text style={{ color: C.ink2, fontSize: 12 }}>Tốc độ {it.speed_wpm} chữ/phút · {it.filler_count} từ đệm</Text>
          <TextInput style={s.input} multiline defaultValue="Giọng em có màu, giữ nhịp tốt!"
            onChangeText={(t) => setNotes((n) => ({ ...n, [it.request_id]: t }))} />
          <Btn label="Gửi nhận xét" onPress={() => onReview(it.request_id, notes[it.request_id] ?? "Giọng em có màu, giữ nhịp tốt!")} />
        </View>
      ))}
      <Btn ghost label="↻ Tải lại hàng đợi" onPress={onReload} />
    </View>
  );
}

const Chip = ({ icon, children }: any) => <View style={s.chip}>{icon}<Text style={{ color: C.ink, fontWeight: "800", fontSize: 13 }}>{children}</Text></View>;
const Kicker = ({ children }: any) => <Text style={s.kicker}>{children}</Text>;
const Tab = ({ on, label, icon, onPress }: any) => <TouchableOpacity style={[s.tab, on && s.tabOn]} onPress={onPress}><View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>{icon}<Text style={{ fontWeight: "700", color: on ? "#fff" : C.ink2 }}>{label}</Text></View></TouchableOpacity>;
const Btn = ({ label, onPress, ghost, gold }: any) => <TouchableOpacity onPress={onPress} style={[s.btn, ghost && s.btnGhost, gold && s.btnGold]}><Text style={{ color: ghost ? C.ink : gold ? "#5a3d00" : "#fff", fontWeight: "800" }}>{label}</Text></TouchableOpacity>;
const Row = ({ k, v, ok }: any) => <View style={s.row}><Text>{k}</Text><View style={[s.pill, ok ? s.pillOk : s.pillMid]}><Text style={{ fontWeight: "800", fontSize: 12, color: ok ? "#1f8f63" : "#9a6b00" }}>{v}</Text></View></View>;

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.base },
  center: { flex: 1, backgroundColor: C.base, alignItems: "center", justifyContent: "center", padding: 24 },
  header: { paddingTop: 54, paddingHorizontal: 18, paddingBottom: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brand: { fontSize: 24, fontWeight: "800", color: C.primary, letterSpacing: -0.5 },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.sunken, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  tabs: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 999, backgroundColor: C.sunken },
  tabOn: { backgroundColor: C.primary },
  kicker: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: C.ink2, fontWeight: "800", marginVertical: 10 },
  card: { backgroundColor: C.raised, borderRadius: 16, padding: 14, marginBottom: 10 },
  lesson: { flexDirection: "row", alignItems: "center", gap: 12 },
  bub: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  bubNow: { backgroundColor: C.primary }, bubDone: { backgroundColor: "#E6F7EF" }, bubLock: { backgroundColor: C.sunken },
  btn: { backgroundColor: C.primary, borderRadius: 999, padding: 14, alignItems: "center", marginTop: 8 },
  btnGhost: { backgroundColor: C.sunken }, btnGold: { backgroundColor: C.spot },
  tip: { backgroundColor: C.sunken, borderRadius: 12, padding: 11 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.hair },
  pill: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999 },
  pillOk: { backgroundColor: "#E6F7EF" }, pillMid: { backgroundColor: "#FFF3DA" },
  input: { borderWidth: 1, borderColor: C.hair, borderRadius: 12, padding: 10, marginTop: 10, minHeight: 60 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.primary, alignItems: "center", justifyContent: "center" },
});
