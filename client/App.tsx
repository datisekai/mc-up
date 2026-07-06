import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Audio } from "expo-av";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { C } from "./src/theme";
import { Api, API_BASE, submitAudio, submitMcVoice } from "./src/api";
import StageMap from "./src/StageMap";
import MiniChart from "./src/MiniChart";
import { Fire, MapIcon, Star, Ticket, Trophy, User } from "./src/icons";

type Brief = { objective: string; context: string; steps: string[]; example: string };
type Lesson = { id: string; buoi: number; order_index: number; title: string; tip: string; prompt: string; brief?: Brief | null; criteria?: string[]; unlocked: boolean; done: boolean };
type Score = { volume_label: string; speed_wpm: number; filler_count: number; tip: string; is_mock: boolean };

export default function App() {
  const [booting, setBooting] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<string>("hoc_vien");

  // form đăng nhập / đăng ký
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [name, setName] = useState("");
  const [regRole, setRegRole] = useState<"hoc_vien" | "mc">("hoc_vien");
  const [authErr, setAuthErr] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  const [tab, setTab] = useState<"hv" | "hs">("hv");
  const [prog, setProg] = useState<{ xp: number; streak: number; tickets: number; tier?: string; practiced_today?: boolean }>({ xp: 0, streak: 0, tickets: 0 });
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [board, setBoard] = useState<any[]>([]);
  const [achs, setAchs] = useState<any[]>([]);
  const [scores, setScores] = useState<any[]>([]);
  const [paths, setPaths] = useState<any[]>([]);
  const [selPath, setSelPath] = useState<string | null>(null);
  const [screen, setScreen] = useState<"feed" | "practice" | "score">("feed");
  const [curLesson, setCur] = useState<Lesson | null>(null);
  const [showEx, setShowEx] = useState(false);  // ẩn/hiện Ví dụ mẫu (thử trước đã)
  const [score, setScore] = useState<Score | null>(null);
  const [lastClip, setLastClip] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recStart, setRecStart] = useState(0);
  const [queue, setQueue] = useState<any[]>([]);

  useEffect(() => { restore(); }, []);

  async function restore() {
    try {
      const t = await AsyncStorage.getItem("token");
      const r = (await AsyncStorage.getItem("role")) || "hoc_vien";
      if (t) { setToken(t); setRole(r); await loadFor(t, r); }
    } catch { await AsyncStorage.multiRemove(["token", "role"]); setToken(null); }
    setBooting(false);
  }
  async function loadFor(t: string, r: string) {
    if (r === "mc") setQueue(await Api.mcQueue(t));
    else await refresh(t);
  }
  async function doAuth() {
    setAuthBusy(true); setAuthErr(null);
    try {
      const res = authMode === "login"
        ? await Api.login(email.trim().toLowerCase(), pw)
        : await Api.register(email.trim().toLowerCase(), pw, name.trim() || "Học viên", regRole);
      await AsyncStorage.setItem("token", res.access_token);
      await AsyncStorage.setItem("role", res.role);
      setToken(res.access_token); setRole(res.role); setTab("hv"); setScreen("feed");
      await loadFor(res.access_token, res.role);
    } catch (e: any) { setAuthErr(e.message); }
    setAuthBusy(false);
  }
  async function logout() {
    await AsyncStorage.multiRemove(["token", "role"]);
    setToken(null); setRole("hoc_vien"); setTab("hv"); setScreen("feed");
    setEmail(""); setPw(""); setName("");
  }

  async function refresh(t = token!) {
    setProg(await Api.progress(t));
    setPaths(await Api.contentPaths(t));
    setLessons(selPath ? await Api.contentLessons(t, selPath) : await Api.lessons(t));
    setReviews(await Api.myReviews(t));
    setBoard(await Api.leaderboard(t));
    setAchs(await Api.achievements(t));
    setScores(await Api.scores(t));
    setScreen("feed");
  }
  async function pickPath(pid: string | null) {
    setSelPath(pid);
    setLessons(pid ? await Api.contentLessons(token!, pid) : await Api.lessons(token!));
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
      const clip = await submitAudio(token!, curLesson.id, uri!, dur, selPath ? curLesson.id : undefined);
      await pollScore(clip.id);
    } catch (e: any) { Alert.alert("Lỗi", e.message); setBusy(false); }
  }
  async function doSubmitMock() {
    if (!curLesson) return;
    setBusy(true);
    const clip = selPath ? await Api.submitMockContent(token!, curLesson.id, 30) : await Api.submitMock(token!, curLesson.id, 30);
    await pollScore(clip.id);
  }
  async function pollScore(clipId: string) {
    let s: any = null;
    for (let i = 0; i < 15; i++) {
      const c = await Api.clip(token!, clipId);
      if (c.status === "done") { s = c; break; }
      await new Promise((r) => setTimeout(r, 400));
    }
    setLastClip(clipId); setScore(s.score); setProg(await Api.progress(token!));
    setBusy(false); setScreen("score");
  }
  async function sendVeVang() {
    try { await Api.sendTicket(token!, lastClip!); Alert.alert("Đã gửi", "Chờ MC nhận xét"); await refresh(); }
    catch (e: any) { Alert.alert("Lỗi", e.message); }
  }
  async function loadQueue() { setQueue(await Api.mcQueue(token!)); }
  async function doReview(reqId: string, note: string) {
    await Api.mcReview(token!, reqId, note || "Giọng em có màu, giữ nhịp tốt!");
    Alert.alert("Đã gửi", "Thẻ bảo chứng đã tạo"); await loadQueue();
  }
  async function doReviewVoice(reqId: string, uri: string, note: string) {
    try {
      await submitMcVoice(token!, reqId, uri, note);
      Alert.alert("Đã gửi", "Giọng nhận xét đã gửi tới học viên"); await loadQueue();
    } catch (e: any) { Alert.alert("Lỗi", e.message); }
  }

  if (booting) return <View style={s.center}><ActivityIndicator color={C.primary} size="large" /><Text style={{ marginTop: 10, color: C.ink2 }}>Đang mở McUp…</Text></View>;

  // ---- Chưa đăng nhập → màn Auth ----
  if (!token) {
    return (
      <View style={s.center}>
        <Text style={{ fontSize: 34, fontWeight: "800", color: C.primary, letterSpacing: -0.5 }}>McUp</Text>
        <Text style={{ color: C.ink2, marginTop: 4, marginBottom: 26 }}>Luyện MC mỗi ngày</Text>
        <View style={{ width: "100%", maxWidth: 340 }}>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
            <Tab on={authMode === "login"} label="Đăng nhập" onPress={() => { setAuthMode("login"); setAuthErr(null); }} />
            <Tab on={authMode === "register"} label="Đăng ký" onPress={() => { setAuthMode("register"); setAuthErr(null); }} />
          </View>
          {authMode === "register" && (
            <TextInput style={s.field} placeholder="Tên hiển thị" placeholderTextColor="#BFB4C4" value={name} onChangeText={setName} />
          )}
          <TextInput style={s.field} placeholder="Email" placeholderTextColor="#BFB4C4" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
          <TextInput style={s.field} placeholder="Mật khẩu" placeholderTextColor="#BFB4C4" secureTextEntry value={pw} onChangeText={setPw} />
          {authMode === "register" && (
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
              <Tab on={regRole === "hoc_vien"} label="Là học viên" onPress={() => setRegRole("hoc_vien")} />
              <Tab on={regRole === "mc"} label="Là MC" onPress={() => setRegRole("mc")} />
            </View>
          )}
          {authErr && <Text style={{ color: C.primary, marginBottom: 8, fontWeight: "600" }}>{authErr}</Text>}
          {authBusy ? <ActivityIndicator color={C.primary} style={{ marginTop: 8 }} />
            : <Btn label={authMode === "login" ? "Đăng nhập" : "Tạo tài khoản"} onPress={doAuth} />}
          <Text style={{ color: C.ink2, fontSize: 12, textAlign: "center", marginTop: 16 }}>Tài khoản MC demo: mc@test.vn / 123456</Text>
        </View>
      </View>
    );
  }

  // ---- Đăng nhập với vai MC → màn nhận xét ----
  if (role === "mc") {
    return (
      <View style={s.app}>
        <StatusBar style="dark" />
        <View style={s.header}>
          <Text style={s.brand}>McUp · MC</Text>
          <TouchableOpacity onPress={logout}><Text style={{ color: C.primary, fontWeight: "800" }}>Đăng xuất</Text></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <MCView queue={queue} onReview={doReview} onReviewVoice={doReviewVoice} onReload={loadQueue} />
        </ScrollView>
      </View>
    );
  }

  // ---- Học viên ----
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
      </View>

      {tab === "hv" && screen === "feed" ? (
        <View style={{ flex: 1 }}>
          {paths.length > 0 && (
            <View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 48 }} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 6, gap: 8, alignItems: "center" }}>
                <PathPill active={!selPath} label="Kỹ năng nói" color={C.primary} onPress={() => pickPath(null)} />
                {paths.map((p) => <PathPill key={p.id} active={selPath === p.id} label={p.genre} color={p.color} onPress={() => pickPath(p.id)} />)}
              </ScrollView>
              {(() => { const tag = selPath ? (paths.find((p) => p.id === selPath)?.tagline || "") : "Nền tảng nói tự tin"; return tag ? <Text style={s.pathTagline}>{tag}</Text> : null; })()}
            </View>
          )}
          {prog.practiced_today === false && (
            <View style={s.reminder}>
              <Fire size={18} color="#F5A623" />
              <Text style={{ flex: 1, fontWeight: "700", color: C.ink, fontSize: 13 }}>Hôm nay chưa luyện — giữ chuỗi {prog.streak} ngày nào!</Text>
            </View>
          )}
          <StageMap lessons={lessons} onPick={(l) => { const full = lessons.find((x) => x.id === l.id); if (full) { setCur(full); setShowEx(false); setScreen("practice"); } }} />
        </View>
      ) : (
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {tab === "hv" && screen === "practice" && curLesson && (
          <View>
            <Kicker>Buổi {curLesson.buoi} · {curLesson.title}</Kicker>
            <View style={s.card}>
              {curLesson.tip ? <View style={s.tip}><Text>{curLesson.tip}</Text></View> : null}

              <Text style={s.taskLabel}>Đề bài</Text>
              <Text style={s.taskPrompt}>{curLesson.prompt}</Text>

              {curLesson.brief?.objective ? (<><Text style={s.taskLabel}>Mục tiêu</Text><Text style={s.taskText}>{curLesson.brief.objective}</Text></>) : null}
              {curLesson.brief?.context ? (<><Text style={s.taskLabel}>Tình huống</Text><Text style={s.taskText}>{curLesson.brief.context}</Text></>) : null}
              {curLesson.brief?.steps?.length ? (<><Text style={s.taskLabel}>Gợi ý dàn ý</Text>{curLesson.brief.steps.map((st, i) => <Text key={i} style={s.taskBullet}>{i + 1}.  {st}</Text>)}</>) : null}
              {curLesson.criteria?.length ? (<><Text style={s.taskLabel}>Tiêu chí đạt</Text>{curLesson.criteria.map((c, i) => <View key={i} style={s.critRow}><View style={s.critDot} /><Text style={s.taskText}>{c}</Text></View>)}</>) : null}

              {curLesson.brief?.example ? (showEx ? (
                <View style={s.exampleBox}>
                  <Text style={s.exampleLabel}>VÍ DỤ MẪU · tham khảo cách làm, đừng đọc nguyên văn</Text>
                  <Text style={s.exampleText}>“{curLesson.brief.example}”</Text>
                </View>
              ) : (
                <Btn ghost label="Bí quá? Xem gợi ý mẫu" onPress={() => setShowEx(true)} />
              )) : null}

              <View style={{ height: 6 }} />
              {busy ? <ActivityIndicator color={C.primary} /> : recording ? (
                <Btn label="Dừng & nộp" onPress={stopRec} />
              ) : (
                <>
                  <Btn label="Bắt đầu quay (nói vào mic)" onPress={startRec} />
                  <Btn ghost label="Bỏ qua — nộp giả lập" onPress={doSubmitMock} />
                </>
              )}
              <Btn ghost label="Quay lại lộ trình" onPress={() => refresh()} />
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
              <View style={[s.tip, { marginTop: 10 }]}><Text>{score.tip}</Text></View>
            </View>
            <Btn gold label="Gửi cho MC thật (Vé Vàng)" onPress={sendVeVang} />
            <Btn ghost label="Tiếp tục lộ trình" onPress={() => refresh()} />
          </View>
        )}
        {tab === "hs" && <ProfileView prog={prog} reviews={reviews} board={board} achs={achs} scores={scores} onLogout={logout} />}
      </ScrollView>
      )}
    </View>
  );
}

function ProfileView({ prog, reviews, board, achs, scores, onLogout }: { prog: { xp: number; streak: number; tickets: number; tier?: string }; reviews: any[]; board: any[]; achs: any[]; scores: any[]; onLogout: () => void }) {
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
      {prog.tier && <View style={s.tierBadge}><Trophy size={14} color="#5a3d00" /><Text style={{ fontWeight: "800", color: "#5a3d00", fontSize: 13 }}>Hạng {prog.tier}</Text></View>}
      <Kicker>Huy hiệu</Kicker>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {achs.map((a) => (
          <View key={a.code} style={[s.achBadge, !a.earned && { opacity: 0.4 }]}>
            <View style={[s.achIcon, a.earned && { backgroundColor: C.spot }]}><Trophy size={18} color={a.earned ? "#5a3d00" : C.ink2} /></View>
            <Text style={{ fontSize: 11, fontWeight: "800", textAlign: "center", marginTop: 4 }} numberOfLines={2}>{a.title}</Text>
          </View>
        ))}
      </View>
      <Kicker>Tiến bộ từ đệm</Kicker>
      <MiniChart data={scores.map((p: any) => p.filler_count)} label="Số từ đệm mỗi lần luyện (thấp hơn = tốt hơn)" />
      <Kicker>Bảng xếp hạng</Kicker>
      {board.length === 0 && <Text style={{ color: C.ink2, paddingHorizontal: 4 }}>Chưa có dữ liệu.</Text>}
      {board.map((e) => (
        <View key={e.rank} style={[s.rankRow, e.is_me && { borderColor: C.spot, borderWidth: 1.5 }]}>
          <Text style={[s.rankNum, e.rank <= 3 && { color: C.primary }]}>{e.rank}</Text>
          <Text style={{ flex: 1, fontWeight: e.is_me ? "800" : "600", color: C.ink }} numberOfLines={1}>{e.name}{e.is_me ? " (bạn)" : ""}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Fire size={12} color="#F5A623" /><Text style={{ color: C.ink2, fontSize: 12, marginRight: 8 }}>{e.streak}</Text>
            <Star size={13} color={C.primary} /><Text style={{ fontWeight: "800", fontSize: 13 }}>{e.xp}</Text>
          </View>
        </View>
      ))}
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
          {r.badge.audio_url && <PlayButton url={API_BASE + r.badge.audio_url} />}
        </View>
      ))}
      {waiting && <Text style={{ color: C.ink2, paddingHorizontal: 4, marginTop: 4 }}>Có clip đang chờ MC nghe bạn dẫn…</Text>}
      <Btn ghost label="Đăng xuất" onPress={onLogout} />
      <View style={{ height: 20 }} />
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

function MCView({ queue, onReview, onReviewVoice, onReload }: { queue: any[]; onReview: (id: string, note: string) => void; onReviewVoice: (id: string, uri: string, note: string) => void; onReload: () => void }) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [recId, setRecId] = useState<string | null>(null);
  const recRef = useRef<Audio.Recording | null>(null);
  async function startVoice(reqId: string) {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recRef.current = recording; setRecId(reqId);
    } catch { Alert.alert("Micro", "Không vào được micro"); }
  }
  async function stopVoice(reqId: string) {
    const r = recRef.current; if (!r) return;
    await r.stopAndUnloadAsync();
    const uri = r.getURI(); recRef.current = null; setRecId(null);
    if (uri) await onReviewVoice(reqId, uri, notes[reqId] ?? "Nhận xét bằng giọng");
  }
  return (
    <View>
      <Kicker>Hàng đợi nhận xét</Kicker>
      {queue.length === 0 && <Text style={{ color: C.ink2, textAlign: "center", padding: 20 }}>Chưa có clip chờ. Học viên luyện rồi bấm "Gửi cho MC thật" là clip vào đây.</Text>}
      {queue.map((it) => (
        <View key={it.request_id} style={s.card}>
          <Text style={{ fontWeight: "700" }}>{it.hoc_vien_name || "Học viên"}</Text>
          <Text style={{ color: C.ink2, fontSize: 12 }}>Tốc độ {it.speed_wpm} chữ/phút · {it.filler_count} từ đệm</Text>
          {recId === it.request_id ? (
            <Btn label="Dừng & gửi giọng" onPress={() => stopVoice(it.request_id)} />
          ) : (
            <Btn gold label="Ghi âm nhận xét (giọng thật)" onPress={() => startVoice(it.request_id)} />
          )}
          <TextInput style={s.input} multiline defaultValue="Giọng em có màu, giữ nhịp tốt!"
            onChangeText={(t) => setNotes((n) => ({ ...n, [it.request_id]: t }))} />
          <Btn ghost label="Hoặc gửi bằng text" onPress={() => onReview(it.request_id, notes[it.request_id] ?? "Giọng em có màu, giữ nhịp tốt!")} />
        </View>
      ))}
      <Btn ghost label="Tải lại hàng đợi" onPress={onReload} />
    </View>
  );
}

function PlayButton({ url }: { url: string }) {
  const [playing, setPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  async function toggle() {
    try {
      if (playing) { await soundRef.current?.stopAsync(); setPlaying(false); return; }
      const { sound } = await Audio.Sound.createAsync({ uri: url });
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((st: any) => { if (st.didJustFinish) setPlaying(false); });
      await sound.playAsync(); setPlaying(true);
    } catch (e: any) { Alert.alert("Lỗi", "Không phát được: " + e.message); }
  }
  return <Btn gold label={playing ? "Đang phát... (chạm để dừng)" : "Nghe giọng MC"} onPress={toggle} />;
}

const Chip = ({ icon, children }: any) => <View style={s.chip}>{icon}<Text style={{ color: C.ink, fontWeight: "800", fontSize: 13 }}>{children}</Text></View>;
const Kicker = ({ children }: any) => <Text style={s.kicker}>{children}</Text>;
const Tab = ({ on, label, icon, onPress }: any) => <TouchableOpacity style={[s.tab, on && s.tabOn]} onPress={onPress}><View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>{icon}<Text style={{ fontWeight: "700", color: on ? "#fff" : C.ink2 }}>{label}</Text></View></TouchableOpacity>;
const PathPill = ({ active, label, color, onPress }: any) => <TouchableOpacity onPress={onPress} style={[s.pathPill, active && { backgroundColor: color || C.primary }]}><Text style={{ fontWeight: "800", fontSize: 12, color: active ? "#fff" : C.ink2 }}>{label}</Text></TouchableOpacity>;
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
  field: { borderWidth: 1, borderColor: C.hair, borderRadius: 12, padding: 12, marginBottom: 10, fontSize: 15, backgroundColor: C.raised, color: C.ink },
  kicker: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: C.ink2, fontWeight: "800", marginVertical: 10 },
  card: { backgroundColor: C.raised, borderRadius: 16, padding: 14, marginBottom: 10 },
  btn: { backgroundColor: C.primary, borderRadius: 999, padding: 14, alignItems: "center", marginTop: 8 },
  btnGhost: { backgroundColor: C.sunken }, btnGold: { backgroundColor: C.spot },
  tip: { backgroundColor: C.sunken, borderRadius: 12, padding: 11 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.hair },
  pill: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999 },
  pillOk: { backgroundColor: "#E6F7EF" }, pillMid: { backgroundColor: "#FFF3DA" },
  input: { borderWidth: 1, borderColor: C.hair, borderRadius: 12, padding: 10, marginTop: 10, minHeight: 60 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.primary, alignItems: "center", justifyContent: "center" },
  rankRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.raised, borderRadius: 12, padding: 12, marginBottom: 6 },
  rankNum: { width: 22, textAlign: "center", fontWeight: "900", color: C.ink2, fontSize: 15 },
  achBadge: { width: 96, alignItems: "center", marginBottom: 6 },
  achIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.sunken, alignItems: "center", justifyContent: "center" },
  reminder: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFF3DA", marginHorizontal: 16, marginTop: 4, marginBottom: 2, padding: 12, borderRadius: 14 },
  tierBadge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: C.spot, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginTop: 10 },
  pathPill: { backgroundColor: C.sunken, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  pathTagline: { paddingHorizontal: 18, paddingBottom: 4, color: C.ink2, fontSize: 12, fontWeight: "600" },
  taskLabel: { fontWeight: "800", color: C.ink2, fontSize: 11, letterSpacing: 0.6, marginTop: 14, marginBottom: 4 },
  taskPrompt: { fontWeight: "800", fontSize: 16, color: C.ink, lineHeight: 22 },
  taskText: { color: C.ink, fontSize: 14, lineHeight: 20, flex: 1 },
  taskBullet: { color: C.ink, fontSize: 14, lineHeight: 22 },
  critRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 2 },
  critDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#3DBE7A", marginTop: 6 },
  exampleBox: { backgroundColor: C.sunken, borderRadius: 14, padding: 14, marginTop: 12, borderLeftWidth: 3, borderLeftColor: C.primary },
  exampleLabel: { fontWeight: "800", fontSize: 10, color: C.ink2, marginBottom: 6, letterSpacing: 0.4 },
  exampleText: { color: C.ink, fontSize: 14, lineHeight: 21, fontStyle: "italic" },
});
