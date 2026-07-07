import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Linking, PanResponder, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Audio } from "expo-av";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Baloo2_700Bold, Baloo2_800ExtraBold, useFonts } from "@expo-google-fonts/baloo-2";
import {
  BeVietnamPro_400Regular, BeVietnamPro_500Medium, BeVietnamPro_600SemiBold, BeVietnamPro_700Bold,
} from "@expo-google-fonts/be-vietnam-pro";
import { C, F } from "./src/theme";
import { Api, API_BASE, ApiError, submitAudio, submitMcVoice } from "./src/api";
import StageMap from "./src/StageMap";
import MiniChart from "./src/MiniChart";
import { Fire, MapIcon, Star, Ticket, Trophy, User } from "./src/icons";
import Onboarding, { OnboardPrefs } from "./src/Onboarding";
import RecordScreen from "./src/RecordScreen";
import ScoreReveal from "./src/ScoreReveal";
import Celebration, { CelebKind } from "./src/Celebration";
import BadgeCardView from "./src/BadgeCardView";
import ReelsPager, { ReelsLesson } from "./src/ReelsPager";
import Mentors from "./src/Mentors";
import { initSound, setMusicScene, setSoundEnabled, sfx, soundEnabled } from "./src/sound";
import { STREAK_GREET, fill, pick } from "./src/variety";

type Brief = { objective: string; context: string; steps: string[]; example: string };
type Lesson = { id: string; buoi: number; order_index: number; title: string; tip: string; prompt: string; brief?: Brief | null; criteria?: string[]; unlocked: boolean; done: boolean };
type Score = {
  volume_label: string; speed_wpm: number; filler_count: number; tip: string; is_mock: boolean;
  transcript?: string | null; unclear?: boolean;
  coverage?: { steps: string[]; covered: boolean[] } | null;
  positives?: string[]; improvements?: string[];
};

const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100];

export default function App() {
  // Font thương hiệu (DESIGN.md): Baloo 2 (display) + Be Vietnam Pro (title/body)
  const [fontsLoaded] = useFonts({
    Baloo2_700Bold, Baloo2_800ExtraBold,
    BeVietnamPro_400Regular, BeVietnamPro_500Medium, BeVietnamPro_600SemiBold, BeVietnamPro_700Bold,
  });
  const [booting, setBooting] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<string>("hoc_vien");
  const [onboarded, setOnboarded] = useState(true);
  const [goalPref, setGoalPref] = useState("");

  // form đăng nhập / đăng ký
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [name, setName] = useState("");
  const [regRole, setRegRole] = useState<"hoc_vien" | "mc">("hoc_vien");
  const [authErr, setAuthErr] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  const [tab, setTab] = useState<"hv" | "mc" | "hs">("hv");
  const [prog, setProg] = useState<{ xp: number; streak: number; tickets: number; tier?: string; practiced_today?: boolean; energy?: number; energy_max?: number; energy_cost?: number; energy_secs_to_next?: number; is_pro?: boolean }>({ xp: 0, streak: 0, tickets: 0 });
  const [showEnergy, setShowEnergy] = useState(false);  // màn "hết năng lượng"
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [board, setBoard] = useState<any[]>([]);
  const [achs, setAchs] = useState<any[]>([]);
  const [scores, setScores] = useState<any[]>([]);
  const [paths, setPaths] = useState<any[]>([]);
  const [mentors, setMentors] = useState<any[]>([]);
  const [newBadge, setNewBadge] = useState(false);  // chấm đỏ trên tab Hồ sơ khi MC vừa nhận xét (#3)
  const [selPath, setSelPath] = useState<string | null>(null);
  const [screen, setScreen] = useState<"feed" | "practice" | "score" | "reels">("feed");
  const [isGuest, setIsGuest] = useState(false);
  const [curLesson, setCur] = useState<Lesson | null>(null);
  const [score, setScore] = useState<Score | null>(null);
  const [lastClip, setLastClip] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [queue, setQueue] = useState<any[]>([]);
  const [loadError, setLoadError] = useState(false);  // mạng/máy chủ lỗi → banner "Thử lại", KHÔNG đá ra
  const [refreshing, setRefreshing] = useState(false);

  // Khoảnh khắc thưởng + toast trong app (P0 — thay Alert hệ thống)
  const [celeb, setCeleb] = useState<{ kind: CelebKind; value?: number | string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }

  // cử chỉ: vuốt ngang đổi tab TỪ MỌI MÀN (accelerator — tab đáy vẫn chạm được).
  // Không capture nên pill ngang/pager Reels vẫn thắng khi chúng là responder.
  const tabSwipe = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 28 && Math.abs(g.dx) > Math.abs(g.dy) * 2.2,
    onPanResponderRelease: (_, g) => {
      if (g.dx < -50) setTab("hs");
      else if (g.dx > 50) setTab("hv");
    },
  })).current;

  // dạy cử chỉ đúng 1 lần (discoverability — không ai đoán được gesture vô hình)
  useEffect(() => {
    if (!token || role !== "hoc_vien") return;
    AsyncStorage.getItem("hint_swipe").then((v) => {
      if (v) return;
      AsyncStorage.setItem("hint_swipe", "1");
      setTimeout(() => showToast("Mẹo: vuốt ngang để đổi Lộ trình ↔ Hồ sơ"), 1200);
    });
  }, [token, role]);

  // câu chào streak lấy từ pool — đổi theo ngày, không lặp mỗi render (P0 §3.7)
  const streakGreet = useMemo(
    () => fill(pick(STREAK_GREET, "greet"), { n: prog.streak }),
    [prog.streak]
  );

  useEffect(() => { restore(); }, []);

  const [soundOn, setSoundOn] = useState(true);
  async function toggleSound() {
    await setSoundEnabled(!soundOn);
    setSoundOn(!soundOn);
  }
  // nhạc nền chỉ ở bản đồ / hồ sơ / màn điểm — KHÔNG ở màn thu (sound.ts còn chặn thêm lớp recording)
  useEffect(() => {
    const wanted = !!token && role === "hoc_vien" && (tab === "hs" || screen === "feed" || screen === "score");
    setMusicScene(wanted);
  }, [token, role, tab, screen]);

  async function restore() {
    await initSound().catch(() => {});
    setSoundOn(soundEnabled());
    let t: string | null = null, r = "hoc_vien", g = "";
    try {
      g = (await AsyncStorage.getItem("goal")) || "";
      t = await AsyncStorage.getItem("token");
      r = (await AsyncStorage.getItem("role")) || "hoc_vien";
      setGoalPref(g);
      setIsGuest((await AsyncStorage.getItem("guest")) === "true");
      setOnboarded((await AsyncStorage.getItem("onboarded")) === "true" || !!t);
    } catch { /* storage lỗi hiếm gặp — bỏ qua, coi như người mới */ }
    if (t) {
      setToken(t); setRole(r); setOnboarded(true);
      await loadFor(t, r, g);  // tự xử lý lỗi bên trong — KHÔNG đá ra khi mạng down
    }
    setBooting(false);
  }
  // Phân loại lỗi API: token hỏng → về đăng nhập (dịu); mạng/máy chủ → giữ phiên, cho thử lại.
  async function handleApiError(e: any): Promise<"auth" | "net"> {
    if (e instanceof ApiError && e.isAuth) {
      await AsyncStorage.multiRemove(["token", "role", "guest"]);
      setToken(null); setIsGuest(false); setTab("hv"); setScreen("feed");
      showToast("Phiên đăng nhập đã hết hạn — vào lại nhé.");
      return "auth";
    }
    setLoadError(true);
    return "net";
  }
  async function loadFor(t: string, r: string, goal = goalPref) {
    try {
      if (r === "mc") setQueue(await Api.mcQueue(t));
      else await refresh(t, goal);
    } catch (e) { await handleApiError(e); }
  }
  async function finishOnboard(prefs: OnboardPrefs) {
    await AsyncStorage.setItem("onboarded", "true");
    if (prefs.goal) await AsyncStorage.setItem("goal", prefs.goal);
    await AsyncStorage.setItem("habit", JSON.stringify({ mins: prefs.minsPerDay, remind: prefs.remindSlot }));
    setGoalPref(prefs.goal);
    setOnboarded(true);
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
    await AsyncStorage.multiRemove(["token", "role", "guest"]);
    setToken(null); setRole("hoc_vien"); setTab("hv"); setScreen("feed"); setIsGuest(false);
    setEmail(""); setPw(""); setName("");
  }
  // Khách trước, đăng ký sau — giá trị trước cam kết (phân tích Mary)
  async function doGuest() {
    setAuthBusy(true); setAuthErr(null);
    try {
      const res = await Api.guest();
      await AsyncStorage.setItem("token", res.access_token);
      await AsyncStorage.setItem("role", res.role);
      await AsyncStorage.setItem("guest", "true");
      setToken(res.access_token); setRole(res.role); setIsGuest(true); setTab("hv"); setScreen("feed");
      await loadFor(res.access_token, res.role);
    } catch (e: any) { setAuthErr(e.message); }
    setAuthBusy(false);
  }
  // Nâng cấp khách → tài khoản thật: GIỮ NGUYÊN streak/XP/clip (server giữ user_id)
  async function doUpgrade(em: string, p: string, nm: string) {
    try {
      const res = await Api.upgrade(token!, em.trim().toLowerCase(), p, nm.trim() || undefined);
      await AsyncStorage.setItem("token", res.access_token);
      await AsyncStorage.removeItem("guest");
      setToken(res.access_token); setIsGuest(false);
      showToast("Xong! Tiến độ của bạn đã được giữ an toàn 🎉");
    } catch (e: any) { Alert.alert("Lỗi", e.message); }
  }

  async function refresh(t = token!, goal = "") {
    const [progR, ps] = await Promise.all([Api.progress(t), Api.contentPaths(t)]);
    setProg(progR); setPaths(ps);
    // Onboarding "trả công": tự chọn lộ trình khớp mục tiêu đã chọn (P2 §B3)
    let pid = selPath;
    if (!pid && goal) {
      const match = ps.find((p: any) => (p.genre || "").toLowerCase().includes(goal));
      if (match) { pid = match.id; setSelPath(match.id); setGoalPref(""); await AsyncStorage.removeItem("goal"); }
    }
    // Pha B: bài v1 đã nằm trong cây — mặc định là lộ trình "Kỹ năng nói" (admin sửa được)
    if (!pid) {
      const kn = ps.find((p: any) => (p.genre || "").toLowerCase().includes("kỹ năng nói")) || ps[0];
      if (kn) { pid = kn.id; setSelPath(kn.id); }
    }
    const [lessR, rv, bd, ac, sc, mt] = await Promise.all([
      pid ? Api.contentLessons(t, pid) : Api.lessons(t),
      Api.myReviews(t), Api.leaderboard(t), Api.achievements(t), Api.scores(t), Api.mentors(t),
    ]);
    setLessons(lessR); setReviews(rv); setBoard(bd); setAchs(ac); setScores(sc); setMentors(mt);
    // Thông báo trong app (#3): MC vừa nhận xét → chấm đỏ tab Hồ sơ + toast
    const badgeCount = rv.filter((r: any) => r.badge).length;
    const seen = parseInt((await AsyncStorage.getItem("seen_badges")) || "0", 10);
    if (badgeCount > seen) {
      setNewBadge(true);
      if (seen > 0 || badgeCount > 0) showToast("MC đã nhận xét bạn rồi 🎤 — mở Hồ sơ xem nhé!");
      await AsyncStorage.setItem("seen_badges", String(badgeCount));
    }
    setLoadError(false); setScreen("feed");
  }
  // Kéo-để-tải-lại + nút "Thử lại" dùng chung: an toàn, không ném lỗi ra ngoài
  async function safeRefresh() {
    setRefreshing(true);
    try { await refresh(); setLoadError(false); }
    catch (e) { await handleApiError(e); }
    setRefreshing(false);
  }
  async function pickPath(pid: string | null) {
    setSelPath(pid);
    setLessons(pid ? await Api.contentLessons(token!, pid) : await Api.lessons(token!));
    setScreen("feed");
  }

  async function submitReal(uri: string, dur: number) {
    if (!curLesson) return;
    setBusy(true);
    try {
      const clip = await submitAudio(token!, curLesson.id, uri, dur, selPath ? curLesson.id : undefined);
      await pollScore(clip.id);
    } catch (e: any) {
      setBusy(false);
      if (e instanceof ApiError && e.status === 402) { setScreen("feed"); setShowEnergy(true); }
      else Alert.alert("Lỗi", e.message);
    }
  }
  async function doSubmitMock() {
    if (!curLesson) return;
    setBusy(true);
    try {
      const clip = selPath ? await Api.submitMockContent(token!, curLesson.id, 30) : await Api.submitMock(token!, curLesson.id, 30);
      await pollScore(clip.id);
    } catch (e: any) {
      setBusy(false);
      if (e instanceof ApiError && e.status === 402) { setScreen("feed"); setShowEnergy(true); }
      else Alert.alert("Lỗi", e.message);
    }
  }
  // Chờ chấm xong + cập nhật tiến độ + bắn khoảnh khắc thưởng. Trả score (null = chậm).
  async function settleScore(clipId: string): Promise<Score | null> {
    let s: any = null;
    for (let i = 0; i < 25; i++) {  // ~12.5s — ASR thật có lúc chậm hơn 6s
      const c = await Api.clip(token!, clipId);
      if (c.status === "done") { s = c; break; }
      await new Promise((r) => setTimeout(r, 500));
    }
    const prev = prog;
    const np = await Api.progress(token!);
    setProg(np);
    // Khoảnh khắc thưởng — chỉ ở MỐC, giữ vàng đèn "đắt" (P0 §1.1)
    if (np.tier && prev.tier && np.tier !== prev.tier) setCeleb({ kind: "tier", value: np.tier });
    else if (np.streak !== prev.streak && STREAK_MILESTONES.includes(np.streak)) setCeleb({ kind: "streak", value: np.streak });
    else if (Math.floor(np.xp / 50) > Math.floor(prev.xp / 50)) setCeleb({ kind: "xp", value: Math.floor(np.xp / 50) * 50 });
    else if (prev.tickets === 0 && np.tickets > 0) setCeleb({ kind: "ticket" });
    return s?.score ?? null;
  }
  async function pollScore(clipId: string) {
    const sc = await settleScore(clipId);
    setBusy(false);
    if (!sc) {
      // mạng/chấm chậm — không vỡ, không mất bài (EXPERIENCE.md State Patterns)
      showToast("Mạng hơi chậm — điểm sẽ hiện sau, bài của bạn không mất đâu.");
      setScreen("feed");
      return;
    }
    setLastClip(clipId); setScore(sc); setScreen("score");
  }
  // Practice Reels: nộp + chờ chấm, trả score cho trang kết quả inline (P2-practice-reels-spec)
  async function runReelsLesson(lesson: ReelsLesson, audio: { uri: string; dur: number } | null): Promise<Score | null> {
    try {
      const clip = audio
        ? await submitAudio(token!, lesson.id, audio.uri, audio.dur, selPath ? lesson.id : undefined)
        : selPath ? await Api.submitMockContent(token!, lesson.id, 30) : await Api.submitMock(token!, lesson.id, 30);
      const sc = await settleScore(clip.id);
      if (!sc) showToast("Mạng hơi chậm — điểm sẽ hiện sau, bài của bạn không mất đâu.");
      setLastClip(clip.id);
      return sc;
    } catch (e: any) {
      // hết năng lượng giữa chừng Reels → thoát ra màn hết năng lượng
      if (e instanceof ApiError && e.status === 402) { setScreen("feed"); setShowEnergy(true); }
      else showToast("Lỗi: " + e.message);
      return null;
    }
  }
  async function sendVeVang() {
    try {
      await Api.sendTicket(token!, lastClip!);
      showToast("Đã gửi cho MC thật 🎤 — chờ nhận xét nhé!");
      await refresh();
    } catch (e: any) { Alert.alert("Lỗi", e.message); }
  }
  async function loadQueue() { try { setQueue(await Api.mcQueue(token!)); } catch (e) { await handleApiError(e); } }
  // MC nhận/nhả vé (feedback #4) — không giành trùng
  async function doClaim(reqId: string) {
    try { await Api.mcClaim(token!, reqId); await loadQueue(); }
    catch (e: any) { showToast(e.message); await loadQueue(); }
  }
  async function doRelease(reqId: string) {
    try { await Api.mcRelease(token!, reqId); await loadQueue(); } catch { /* ignore */ }
  }
  async function doReview(reqId: string, note: string) {
    try {
      await Api.mcReview(token!, reqId, note || "Giọng em có màu, giữ nhịp tốt!");
      showToast("Đã gửi — Thẻ bảo chứng đã tạo cho học viên.");
      await loadQueue();
    } catch (e: any) { showToast(e.message); await loadQueue(); }
  }
  async function doReviewVoice(reqId: string, uri: string, note: string) {
    try {
      await submitMcVoice(token!, reqId, uri, note);
      showToast("Giọng nhận xét đã gửi tới học viên.");
      await loadQueue();
    } catch (e: any) { Alert.alert("Lỗi", e.message); await loadQueue(); }
  }

  if (booting || !fontsLoaded) return <View style={s.center}><ActivityIndicator color={C.primary} size="large" /><Text style={{ marginTop: 10, color: C.ink2 }}>Đang mở McUp…</Text></View>;

  // ---- Người mới → onboarding ấm (P2) ----
  if (!token && !onboarded) return <Onboarding onDone={finishOnboard} />;

  // ---- Chưa đăng nhập → màn Auth ----
  if (!token) {
    return (
      <View style={s.center}>
        <Text style={{ fontSize: 34, fontFamily: F.displayX, color: C.primary, letterSpacing: -0.5 }}>McUp</Text>
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
            : (
              <>
                <Btn label={authMode === "login" ? "Đăng nhập" : "Tạo tài khoản"} onPress={doAuth} />
                <Btn ghost label="Thử ngay — không cần tài khoản" onPress={doGuest} />
              </>
            )}
          <Text style={{ color: C.ink2, fontSize: 11.5, textAlign: "center", marginTop: 16, lineHeight: 17 }}>
            Bằng việc tiếp tục, bạn đồng ý với{" "}
            <Text style={{ textDecorationLine: "underline" }} onPress={() => Linking.openURL(API_BASE + "/terms").catch(() => {})}>Điều khoản</Text>
            {" "}và{" "}
            <Text style={{ textDecorationLine: "underline" }} onPress={() => Linking.openURL(API_BASE + "/privacy").catch(() => {})}>Chính sách bảo mật</Text>
            {" "}(gồm việc thu & xử lý giọng nói để chấm điểm).
          </Text>
          <Text style={{ color: C.ink2, fontSize: 11.5, textAlign: "center", marginTop: 8 }}>Tài khoản MC demo: mc@test.vn / 123456</Text>
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
        <ScrollView contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadQueue(); setRefreshing(false); }} tintColor={C.primary} colors={[C.primary]} />}>
          <MCView queue={queue} onReview={doReview} onReviewVoice={doReviewVoice} onReload={loadQueue} onClaim={doClaim} onRelease={doRelease} />
        </ScrollView>
        {toast && <View style={s.toast}><Text style={s.toastT}>{toast}</Text></View>}
      </View>
    );
  }

  // ---- Học viên ----
  // Minimal UI: header 1 dòng (logo + 1 cụm chip) · KHÔNG tab trên đầu ·
  // tab bar icon ở ĐÁY (chuẩn native, EXPERIENCE.md IA) · vuốt ngang đổi tab từ mọi màn
  // (trừ đang luyện/Reels để không vuốt nhầm).
  const swipeEnabled = (screen === "feed" || screen === "score" || tab === "hs" || tab === "mc");
  // Thanh năng lượng (Duolingo-style): đủ để học thêm bài không?
  const energy = prog.energy ?? prog.energy_max ?? 30;
  const energyMax = prog.energy_max ?? 30;
  const energyCost = prog.energy_cost ?? 10;
  const hasEnergy = !!prog.is_pro || energy >= energyCost;
  // Cửa vào bài: đủ năng lượng thì vào, không thì hiện màn hết năng lượng
  function tryEnterLesson(fn: () => void) {
    if (hasEnergy) fn();
    else setShowEnergy(true);
  }
  return (
    <View style={s.app}>
      <StatusBar style="dark" />
      <View style={s.header}>
        <Text style={s.brand}>McUp</Text>
        <View style={s.chipCluster}>
          {!prog.is_pro
            ? (<TouchableOpacity onPress={() => setShowEnergy(true)} style={{ flexDirection: "row", alignItems: "center" }}><Text style={{ fontSize: 13 }}>⚡</Text><Text style={[s.chipT, { color: hasEnergy ? C.ink : C.primary }]}>{Math.floor(energy / energyCost)}</Text></TouchableOpacity>)
            : (<Text style={[s.chipT, { color: C.spot }]}>⚡∞</Text>)}
          <View style={s.chipDiv} />
          <Fire size={14} color="#F5A623" /><Text style={s.chipT}>{prog.streak}</Text>
          <View style={s.chipDiv} />
          <Star size={13} color={C.primary} /><Text style={s.chipT}>{prog.xp}</Text>
          <View style={s.chipDiv} />
          <Ticket size={14} color="#E0A62F" /><Text style={s.chipT}>{prog.tickets}</Text>
        </View>
      </View>

      {tab === "mc" ? (
        <Mentors mentors={mentors}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={safeRefresh} tintColor={C.primary} colors={[C.primary]} />} />
      ) : tab === "hv" && screen === "reels" ? (
        <ReelsPager
          lessons={lessons as ReelsLesson[]}
          startIndex={Math.max(0, lessons.findIndex((l) => l.unlocked && !l.done))}
          streak={prog.streak}
          onRun={runReelsLesson}
          onExit={() => safeRefresh()}
        />
      ) : (
      <View style={{ flex: 1, marginBottom: 62 }} {...(swipeEnabled ? tabSwipe.panHandlers : {})}>
        {tab === "hv" && screen === "feed" ? (
          <View style={{ flex: 1 }}>
            {paths.length > 0 && (
              <View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 48 }} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 6, gap: 8, alignItems: "center" }}>
                  {paths.map((p) => <PathPill key={p.id} active={selPath === p.id} label={p.genre} color={p.color} onPress={() => pickPath(p.id)} />)}
                </ScrollView>
                {/* giảm nhiễu: tagline chỉ hiện khi đã chọn thể loại */}
                {(() => { const tag = selPath ? (paths.find((p) => p.id === selPath)?.tagline || "") : ""; return tag ? <Text style={s.pathTagline}>{tag}</Text> : null; })()}
              </View>
            )}
            {/* mạng/máy chủ lỗi → banner giữ phiên + thử lại (không đá ra) */}
            {loadError && (
              <TouchableOpacity style={s.errorBanner} onPress={safeRefresh} accessibilityLabel="Thử tải lại">
                <Text style={{ flex: 1, color: "#8a3d33", fontWeight: "700", fontSize: 13 }}>Chưa tải được dữ liệu — chạm để thử lại</Text>
                <Text style={{ color: "#8a3d33", fontWeight: "800" }}>↻</Text>
              </TouchableOpacity>
            )}
            {/* giảm nhiễu: nhắc streak chỉ hiện sau 17h — lúc thật sự cần cứu chuỗi */}
            {prog.practiced_today === false && new Date().getHours() >= 17 && (
              <View style={s.reminder}>
                <Fire size={18} color="#F5A623" />
                <Text style={{ flex: 1, fontWeight: "700", color: C.ink, fontSize: 13 }}>{streakGreet}</Text>
              </View>
            )}
            {lessons.length === 0 && !loadError ? (
              <View style={s.emptyFeed}>
                <MapIcon size={40} color="#D8C8BE" />
                <Text style={s.emptyTitle}>Lộ trình đang được chuẩn bị</Text>
                <Text style={s.emptySub}>Kéo xuống để tải lại, hoặc thử chọn thể loại khác ở trên nhé.</Text>
              </View>
            ) : (
              <StageMap lessons={lessons} refreshing={refreshing} onRefresh={safeRefresh}
                energyCost={prog.is_pro ? 0 : energyCost} canAfford={hasEnergy}
                onPick={(l) => { const full = lessons.find((x) => x.id === l.id); if (full) tryEnterLesson(() => { setCur(full); setScreen("practice"); }); }} />
            )}
            {/* điểm vào Practice Reels — bản đồ = duyệt, Reels = làm */}
            <TouchableOpacity style={s.reelsFab} onPress={() => tryEnterLesson(() => setScreen("reels"))} accessibilityLabel="Luyện liên tục — vuốt dọc qua các bài">
              <Text style={s.reelsFabT}>▲ Luyện liên tục</Text>
            </TouchableOpacity>
          </View>
        ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16 }}
          refreshControl={tab === "hs" ? <RefreshControl refreshing={refreshing} onRefresh={safeRefresh} tintColor={C.primary} colors={[C.primary]} /> : undefined}
          onScrollEndDrag={(e) => {
            // cử chỉ: kéo xuống ở màn điểm → về bản đồ (nút vẫn còn — gesture chỉ là đường tắt)
            if (screen === "score" && e.nativeEvent.contentOffset.y < -70) safeRefresh();
          }}
        >
          {tab === "hv" && screen === "practice" && curLesson && (
            <View>
              <Kicker>Buổi {curLesson.buoi} · {curLesson.title}</Kicker>
              <RecordScreen
                lesson={curLesson}
                busy={busy}
                energyCost={prog.is_pro ? 0 : energyCost}
                onSubmit={submitReal}
                onMock={doSubmitMock}
                onBack={() => safeRefresh()}
              />
            </View>
          )}
          {tab === "hv" && screen === "score" && score && (
            <View>
              <Kicker>{score.unclear ? "Chưa chấm được" : "Kết quả của bạn"}</Kicker>
              <ScoreReveal score={score} prev={scores.length ? scores[scores.length - 1] : null} />
              {score.unclear ? (
                // không nghe được → mời thu lại ngay, KHÔNG mời gửi MC (phí vé vô ích)
                <Btn label="Thử lại ngay 🎙" onPress={() => setScreen("practice")} />
              ) : (
                <Btn gold label="Gửi cho MC thật (Vé Vàng)" onPress={sendVeVang} />
              )}
              <Btn ghost label="Tiếp tục lộ trình" onPress={() => safeRefresh()} />
              <Text style={s.pullHint}>kéo xuống để về bản đồ</Text>
            </View>
          )}
          {tab === "hs" && <ProfileView prog={prog} reviews={reviews} board={board} achs={achs} scores={scores} isGuest={isGuest} onUpgrade={doUpgrade} soundOn={soundOn} onToggleSound={toggleSound} onLogout={logout} />}
        </ScrollView>
        )}
      </View>
      )}

      {/* tab bar đáy — icon, chuẩn native (3 tab: Lộ trình · MC · Hồ sơ) */}
      {screen !== "reels" && (
        <View style={s.bottomBar}>
          <TouchableOpacity style={s.bTab} onPress={() => { sfx("pop"); setTab("hv"); if (screen !== "feed" && screen !== "practice" && screen !== "score") setScreen("feed"); }}
            accessibilityLabel="Tab Lộ trình">
            <MapIcon size={22} color={tab === "hv" ? C.primary : C.ink2} />
            <Text style={[s.bTabT, tab === "hv" && { color: C.primary }]}>Lộ trình</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.bTab} onPress={() => { sfx("pop"); setTab("mc"); }} accessibilityLabel="Tab MC">
            <Trophy size={22} color={tab === "mc" ? C.primary : C.ink2} />
            <Text style={[s.bTabT, tab === "mc" && { color: C.primary }]}>MC</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.bTab} onPress={() => { sfx("pop"); setTab("hs"); setNewBadge(false); }} accessibilityLabel="Tab Hồ sơ">
            <View>
              <User size={22} color={tab === "hs" ? C.primary : C.ink2} />
              {newBadge && <View style={s.tabDot} />}
            </View>
            <Text style={[s.bTabT, tab === "hs" && { color: C.primary }]}>Hồ sơ</Text>
          </TouchableOpacity>
        </View>
      )}

      {celeb && <Celebration kind={celeb.kind} value={celeb.value} onClose={() => setCeleb(null)} />}
      {showEnergy && <EnergyModal energy={energy} energyMax={energyMax} energyCost={energyCost}
        secs={prog.energy_secs_to_next ?? 0} onClose={() => setShowEnergy(false)}
        onRefresh={async () => { await safeRefresh(); setShowEnergy(false); }} />}
      {toast && <View style={s.toast}><Text style={s.toastT}>{toast}</Text></View>}
    </View>
  );
}

// Màn "Hết năng lượng" (Duolingo-style) — đếm ngược tới lúc hồi thêm, CTA Pro. Không phán xét.
function EnergyModal({ energy, energyMax, energyCost, secs, onClose, onRefresh }: { energy: number; energyMax: number; energyCost: number; secs: number; onClose: () => void; onRefresh: () => void }) {
  const [left, setLeft] = useState(secs);
  useEffect(() => {
    const t = setInterval(() => setLeft((x) => Math.max(0, x - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  const h = Math.floor(left / 3600), m = Math.floor((left % 3600) / 60);
  // thanh hiện TIẾN ĐỘ tới bài kế (đầy = đủ học 1 bài), không phải tổng năng lượng
  const pct = Math.max(0, Math.min(1, energy / Math.max(1, energyCost)));
  return (
    <View style={s.energyBg}>
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      <View style={s.energyCard}>
        <Text style={{ fontSize: 40 }}>💛</Text>
        <Text style={s.energyTitle}>Hết năng lượng rồi!</Text>
        <View style={s.energyTrack}><View style={[s.energyFill, { width: `${pct * 100}%` }]} /></View>
        <Text style={s.energyNum}>Thanh đầy = đủ học 1 bài</Text>
        <Text style={s.energySub}>
          {left > 0 ? `Đủ học tiếp sau ${h > 0 ? `${h} giờ ` : ""}${m} phút nữa — nghỉ ngơi một chút nhé 💛` : "Sắp đủ rồi, kéo tải lại xem nhé!"}
        </Text>
        <Btn gold label="Học không giới hạn với Pro ✨" onPress={onClose} />
        <TouchableOpacity onPress={onRefresh}><Text style={s.energyLink}>Tải lại</Text></TouchableOpacity>
        <TouchableOpacity onPress={onClose}><Text style={s.energyLink}>Để sau</Text></TouchableOpacity>
      </View>
    </View>
  );
}

function ProfileView({ prog, reviews, board, achs, scores, isGuest, onUpgrade, soundOn, onToggleSound, onLogout }: { prog: { xp: number; streak: number; tickets: number; tier?: string; ai_scores_left?: number; is_pro?: boolean }; reviews: any[]; board: any[]; achs: any[]; scores: any[]; isGuest: boolean; onUpgrade: (email: string, pw: string, name: string) => void; soundOn: boolean; onToggleSound: () => void; onLogout: () => void }) {
  const badges = reviews.filter((r) => r.badge);
  const waiting = reviews.some((r) => !r.badge);
  const [upEmail, setUpEmail] = useState("");
  const [upPw, setUpPw] = useState("");
  const [upName, setUpName] = useState("");
  return (
    <View>
      {isGuest && (
        <View style={[s.card, { borderWidth: 1.5, borderColor: C.spot }]}>
          <Text style={{ fontFamily: F.title, fontSize: 15, color: C.ink }}>Bạn đang luyện với tư cách Khách</Text>
          <Text style={{ color: C.ink2, fontSize: 12.5, marginTop: 4, lineHeight: 18 }}>
            Tạo tài khoản 10 giây để giữ streak {prog.streak} ngày và {prog.xp} XP — đổi máy không mất.
          </Text>
          <TextInput style={s.field2} placeholder="Email" placeholderTextColor="#BFB4C4" autoCapitalize="none" keyboardType="email-address" value={upEmail} onChangeText={setUpEmail} />
          <TextInput style={s.field2} placeholder="Mật khẩu" placeholderTextColor="#BFB4C4" secureTextEntry value={upPw} onChangeText={setUpPw} />
          <TextInput style={s.field2} placeholder="Tên hiển thị (tuỳ chọn)" placeholderTextColor="#BFB4C4" value={upName} onChangeText={setUpName} />
          <Btn gold label="Giữ tiến độ của tôi" onPress={() => onUpgrade(upEmail, upPw, upName)} />
        </View>
      )}
      {/* McUp Pro (feedback #7) — hiển thị giá trị; nút mua nối RevenueCat khi có dev build */}
      {!prog.is_pro && (
        <View style={s.proCard}>
          <Text style={s.proTitle}>McUp Pro ✨</Text>
          <Text style={s.proLine}>• ⚡ Năng lượng KHÔNG GIỚI HẠN — học bao nhiêu bài tuỳ thích</Text>
          <Text style={s.proLine}>• Mở toàn bộ khoá nâng cao + thêm Vé Vàng mỗi tháng</Text>
          <Text style={s.proLine}>• Mở khoá skin thẻ khoe (Đèn đêm, San hô)</Text>
          <Btn gold label="Nâng cấp Pro · sắp có" onPress={() => {}} />
        </View>
      )}
      <Kicker>Tiến bộ của bạn</Kicker>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <StatCard icon={<Fire size={22} color="#F5A623" />} value={prog.streak} label="Ngày streak" />
        <StatCard icon={<Star size={22} color={C.primary} />} value={prog.xp} label="XP" />
        <StatCard icon={<Ticket size={22} color="#E0A62F" />} value={prog.tickets} label="Vé Vàng" />
      </View>
      {prog.tier && <View style={s.tierBadge}><Trophy size={14} color="#5a3d00" /><Text style={{ fontWeight: "800", color: "#5a3d00", fontSize: 13 }}>Hạng {prog.tier}</Text></View>}

      {/* "Sắp mở khoá" — huy hiệu gần nhất chưa đạt, hiện tiến độ để tạo động lực (Gen Z collectible) */}
      {(() => {
        const next = achs.filter((a) => !a.earned).sort((a, b) => (b.progress / b.target) - (a.progress / a.target))[0];
        if (!next) return null;
        const pct = Math.min(1, (next.progress ?? 0) / (next.target || 1));
        return (
          <>
            <Kicker>Sắp mở khoá</Kicker>
            <View style={s.card}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={s.achIcon}><Trophy size={18} color={C.ink2} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: F.title, fontSize: 14, color: C.ink }}>{next.title}</Text>
                  <Text style={{ color: C.ink2, fontSize: 12 }}>{next.desc} · còn {Math.max(0, (next.target ?? 0) - (next.progress ?? 0))}</Text>
                </View>
                <Text style={{ fontFamily: F.display, color: C.primary }}>{next.progress}/{next.target}</Text>
              </View>
              <View style={s.achTrack}><View style={[s.achFill, { width: `${pct * 100}%` }]} /></View>
            </View>
          </>
        );
      })()}

      <Kicker>Huy hiệu · {achs.filter((a) => a.earned).length}/{achs.length}</Kicker>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {achs.map((a) => (
          <View key={a.code} style={[s.achBadge, !a.earned && { opacity: 0.45 }]}>
            <View style={[s.achIcon, a.earned && { backgroundColor: C.spot }]}><Trophy size={18} color={a.earned ? "#5a3d00" : C.ink2} /></View>
            <Text style={{ fontSize: 11, fontWeight: "800", textAlign: "center", marginTop: 4 }} numberOfLines={2}>{a.title}</Text>
            {!a.earned && a.target > 1 && <Text style={{ fontSize: 9.5, color: C.ink2, fontFamily: F.med }}>{a.progress}/{a.target}</Text>}
          </View>
        ))}
      </View>

      <Kicker>Tiến bộ từ đệm</Kicker>
      {scores.length >= 2 ? (
        <MiniChart data={scores.map((p: any) => p.filler_count)} label="Số từ đệm mỗi lần luyện (thấp hơn = tốt hơn)" />
      ) : (
        <Text style={s.emptyHint}>Luyện thêm vài bài để xem đường tiến bộ từ đệm của bạn nhé 📉</Text>
      )}
      <Kicker>Bảng xếp hạng</Kicker>
      {board.length === 0 && <Text style={s.emptyHint}>Chưa có ai trên bảng — luyện một bài là bạn có tên ngay 🏆</Text>}
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
        <BadgeCardView key={r.id} badge={r.badge} audioBase={API_BASE} />
      ))}
      {waiting && <Text style={{ color: C.ink2, paddingHorizontal: 4, marginTop: 4 }}>Có clip đang chờ MC nghe bạn dẫn…</Text>}
      <Btn ghost label={soundOn ? "Âm thanh: Bật 🔊" : "Âm thanh: Tắt 🔇"} onPress={onToggleSound} />
      {/* Điều khoản & Chính sách bảo mật (mở trang web) */}
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 14, marginBottom: 2 }}>
        <TouchableOpacity onPress={() => Linking.openURL(API_BASE + "/terms").catch(() => {})}>
          <Text style={{ color: C.ink2, fontSize: 12, textDecorationLine: "underline" }}>Điều khoản</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => Linking.openURL(API_BASE + "/privacy").catch(() => {})}>
          <Text style={{ color: C.ink2, fontSize: 12, textDecorationLine: "underline" }}>Chính sách bảo mật</Text>
        </TouchableOpacity>
      </View>
      {/* kênh góp ý cho bản test — mở mail có sẵn tiêu đề */}
      <Btn ghost label="Góp ý cho McUp 💌" onPress={() =>
        Linking.openURL("mailto:datly3494@gmail.com?subject=" + encodeURIComponent("Góp ý McUp beta")
          + "&body=" + encodeURIComponent("Mình thấy...")).catch(() => {})
      } />
      {/* Credit BẮT BUỘC theo CC-BY 4.0 (assets/CREDITS.md) — giữ khi phát hành */}
      <Text style={{ color: "#BFB4C4", fontSize: 10.5, textAlign: "center", marginTop: 8 }}>
        Nhạc: "Wholesome" — Kevin MacLeod (incompetech.com) · CC BY 4.0
      </Text>
      <Btn ghost label="Đăng xuất" onPress={onLogout} />
      <View style={{ height: 20 }} />
    </View>
  );
}
function StatCard({ icon, value, label }: any) {
  return (
    <View style={[s.card, { flex: 1, alignItems: "center", marginBottom: 0 }]}>
      {icon}
      <Text style={{ fontFamily: F.displayX, fontSize: 22, color: C.ink, marginTop: 4 }}>{value}</Text>
      <Text style={{ color: C.ink2, fontSize: 11, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

function MCView({ queue, onReview, onReviewVoice, onReload, onClaim, onRelease }: { queue: any[]; onReview: (id: string, note: string) => void; onReviewVoice: (id: string, uri: string, note: string) => void; onReload: () => void; onClaim: (id: string) => void; onRelease: (id: string) => void }) {
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
  const waiting = queue.filter((it) => it.state !== "taken").length;
  return (
    <View>
      <Kicker>Hàng đợi nhận xét{waiting ? ` · ${waiting} chờ bạn` : ""}</Kicker>
      {queue.length === 0 && <Text style={{ color: C.ink2, textAlign: "center", padding: 20 }}>Chưa có clip chờ. Học viên luyện rồi bấm "Gửi cho MC thật" là clip vào đây.</Text>}
      {queue.map((it) => {
        const taken = it.state === "taken";   // MC khác đang giữ
        const mine = it.state === "mine";      // mình đang giữ
        return (
          <View key={it.request_id} style={[s.card, taken && { opacity: 0.5 }, mine && { borderWidth: 1.5, borderColor: C.spot }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontFamily: F.title, color: C.ink }}>{it.hoc_vien_name || "Học viên"}</Text>
              {taken && <View style={s.stateChip}><Text style={s.stateChipT}>{it.claimer_name || "MC khác"} đang xét</Text></View>}
              {mine && <View style={[s.stateChip, { backgroundColor: C.spot }]}><Text style={[s.stateChipT, { color: "#5a3d00" }]}>Bạn đang xét</Text></View>}
            </View>
            <Text style={{ color: C.ink2, fontSize: 12, marginTop: 2 }}>Tốc độ {it.speed_wpm ?? "?"} chữ/phút · {it.filler_count ?? "?"} từ đệm</Text>

            {taken ? (
              <Text style={{ color: C.ink2, fontSize: 12, marginTop: 8, fontStyle: "italic" }}>Vé này đang có MC khác nhận xét.</Text>
            ) : !mine ? (
              // chưa nhận → phải nhận vé trước khi xét (chống 2 MC làm trùng)
              <Btn label="Nhận vé này để xét" onPress={() => onClaim(it.request_id)} />
            ) : (
              <>
                {recId === it.request_id ? (
                  <Btn label="Dừng & gửi giọng" onPress={() => stopVoice(it.request_id)} />
                ) : (
                  <Btn gold label="Ghi âm nhận xét (giọng thật)" onPress={() => startVoice(it.request_id)} />
                )}
                <TextInput style={s.input} multiline defaultValue="Giọng em có màu, giữ nhịp tốt!"
                  onChangeText={(t) => setNotes((n) => ({ ...n, [it.request_id]: t }))} />
                <Btn ghost label="Hoặc gửi bằng text" onPress={() => onReview(it.request_id, notes[it.request_id] ?? "Giọng em có màu, giữ nhịp tốt!")} />
                <Btn ghost label="Nhả vé (để MC khác xét)" onPress={() => onRelease(it.request_id)} />
              </>
            )}
          </View>
        );
      })}
      <Btn ghost label="Tải lại hàng đợi" onPress={onReload} />
    </View>
  );
}

const Chip = ({ icon, children }: any) => <View style={s.chip}>{icon}<Text style={{ color: C.ink, fontFamily: F.display, fontSize: 13 }}>{children}</Text></View>;
const Kicker = ({ children }: any) => <Text style={s.kicker}>{children}</Text>;
const Tab = ({ on, label, icon, onPress }: any) => <TouchableOpacity style={[s.tab, on && s.tabOn]} onPress={onPress}><View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>{icon}<Text style={{ fontWeight: "700", color: on ? "#fff" : C.ink2 }}>{label}</Text></View></TouchableOpacity>;
const PathPill = ({ active, label, color, onPress }: any) => <TouchableOpacity onPress={() => { sfx("pop"); onPress?.(); }} style={[s.pathPill, active && { backgroundColor: color || C.primary }]}><Text style={{ fontWeight: "800", fontSize: 12, color: active ? "#fff" : C.ink2 }}>{label}</Text></TouchableOpacity>;
const Btn = ({ label, onPress, ghost, gold }: any) => <TouchableOpacity onPress={() => { sfx("tap"); onPress?.(); }} style={[s.btn, ghost && s.btnGhost, gold && s.btnGold]}><Text style={{ color: ghost ? C.ink : gold ? "#5a3d00" : "#fff", fontFamily: F.title }}>{label}</Text></TouchableOpacity>;

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.base },
  center: { flex: 1, backgroundColor: C.base, alignItems: "center", justifyContent: "center", padding: 24 },
  header: { paddingTop: 54, paddingHorizontal: 18, paddingBottom: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brand: { fontSize: 24, fontFamily: F.displayX, color: C.primary, letterSpacing: -0.5 },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.sunken, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  // header gọn: 3 chỉ số trong MỘT cụm (giảm nhiễu thị giác)
  chipCluster: {
    flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.sunken,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
  },
  chipT: { color: C.ink, fontFamily: F.display, fontSize: 13 },
  chipDiv: { width: 1, height: 12, backgroundColor: C.hair, marginHorizontal: 3 },
  tabs: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 999, backgroundColor: C.sunken },
  tabOn: { backgroundColor: C.primary },
  // tab bar đáy — chuẩn native (EXPERIENCE.md IA)
  bottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row",
    backgroundColor: C.raised, borderTopWidth: 1, borderTopColor: C.hair,
    paddingTop: 8, paddingBottom: 26,
  },
  bTab: { flex: 1, alignItems: "center", gap: 2 },
  bTabT: { fontSize: 10.5, fontFamily: F.semi, color: C.ink2 },
  tabDot: { position: "absolute", top: -2, right: -4, width: 9, height: 9, borderRadius: 5, backgroundColor: C.primary, borderWidth: 1.5, borderColor: C.raised },
  stateChip: { backgroundColor: C.sunken, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  stateChipT: { fontSize: 10.5, fontFamily: F.semi, color: C.ink2 },
  energyBg: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(59,42,74,0.55)", alignItems: "center", justifyContent: "center", zIndex: 99, padding: 30 },
  energyCard: { backgroundColor: C.raised, borderRadius: 22, padding: 22, alignItems: "center", width: "100%", maxWidth: 340 },
  energyTitle: { fontFamily: F.displayX, fontSize: 20, color: C.ink, marginTop: 8 },
  energyTrack: { height: 12, backgroundColor: C.sunken, borderRadius: 999, marginTop: 14, width: "100%", overflow: "hidden" },
  energyFill: { height: "100%", backgroundColor: "#FFC24B", borderRadius: 999 },
  energyNum: { fontFamily: F.semi, fontSize: 12.5, color: C.ink2, marginTop: 6 },
  energySub: { fontFamily: F.body, fontSize: 13.5, color: C.ink2, textAlign: "center", marginTop: 10, lineHeight: 20 },
  energyLink: { fontFamily: F.semi, fontSize: 13, color: C.ink2, textDecorationLine: "underline", marginTop: 12 },
  proCard: { backgroundColor: "#2E2239", borderRadius: 16, padding: 16, marginBottom: 4 },
  proTitle: { fontFamily: F.displayX, fontSize: 16, color: "#FFC24B" },
  proLine: { fontSize: 12.5, color: "#E9DFF2", fontFamily: F.body, marginTop: 3, lineHeight: 18 },
  pullHint: { textAlign: "center", color: "#BFB4C4", fontSize: 11.5, fontFamily: F.med, marginTop: 12 },
  field: { borderWidth: 1, borderColor: C.hair, borderRadius: 12, padding: 12, marginBottom: 10, fontSize: 15, backgroundColor: C.raised, color: C.ink },
  field2: { borderWidth: 1, borderColor: C.hair, borderRadius: 12, padding: 11, marginTop: 10, fontSize: 14, backgroundColor: C.base, color: C.ink },
  reelsFab: {
    position: "absolute", bottom: 22, alignSelf: "center", backgroundColor: C.primary,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8,
  },
  reelsFabT: { color: "#fff", fontFamily: F.title, fontSize: 13.5 },
  kicker: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: C.ink2, fontFamily: F.title, marginVertical: 10 },
  card: { backgroundColor: C.raised, borderRadius: 16, padding: 14, marginBottom: 10 },
  btn: { backgroundColor: C.primary, borderRadius: 999, padding: 14, alignItems: "center", marginTop: 8 },
  btnGhost: { backgroundColor: C.sunken }, btnGold: { backgroundColor: C.spot },
  input: { borderWidth: 1, borderColor: C.hair, borderRadius: 12, padding: 10, marginTop: 10, minHeight: 60 },
  rankRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.raised, borderRadius: 12, padding: 12, marginBottom: 6 },
  rankNum: { width: 22, textAlign: "center", fontWeight: "900", color: C.ink2, fontSize: 15 },
  achBadge: { width: 96, alignItems: "center", marginBottom: 6 },
  achIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.sunken, alignItems: "center", justifyContent: "center" },
  achTrack: { height: 6, backgroundColor: C.sunken, borderRadius: 999, marginTop: 10, overflow: "hidden" },
  achFill: { height: "100%", backgroundColor: C.spot, borderRadius: 999 },
  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FBE3DE", marginHorizontal: 16, marginTop: 6, padding: 12, borderRadius: 14 },
  emptyFeed: { alignItems: "center", paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: { fontFamily: F.display, fontSize: 16, color: C.ink, marginTop: 12 },
  emptySub: { fontFamily: F.body, fontSize: 13, color: C.ink2, textAlign: "center", marginTop: 6, lineHeight: 19 },
  emptyHint: { color: C.ink2, fontSize: 12.5, paddingHorizontal: 4, lineHeight: 18 },
  reminder: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFF3DA", marginHorizontal: 16, marginTop: 4, marginBottom: 2, padding: 12, borderRadius: 14 },
  tierBadge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: C.spot, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginTop: 10 },
  pathPill: { backgroundColor: C.sunken, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  pathTagline: { paddingHorizontal: 18, paddingBottom: 4, color: C.ink2, fontSize: 12, fontWeight: "600" },
  toast: {
    position: "absolute", left: 20, right: 20, bottom: 86, backgroundColor: "#3B2A4A",
    borderRadius: 14, padding: 14, alignItems: "center", zIndex: 98,
    shadowColor: "#3B2A4A", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8,
  },
  toastT: { color: "#FFF8F0", fontFamily: F.semi, fontSize: 13, textAlign: "center" },
});
