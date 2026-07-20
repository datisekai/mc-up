import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Animated, Dimensions, Linking, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Audio } from "expo-av";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Baloo2_700Bold, Baloo2_800ExtraBold, useFonts } from "@expo-google-fonts/baloo-2";
import {
  BeVietnamPro_400Regular, BeVietnamPro_500Medium, BeVietnamPro_600SemiBold, BeVietnamPro_700Bold,
} from "@expo-google-fonts/be-vietnam-pro";
import { C, F, T } from "./src/theme";
import { Api, API_BASE, ApiError, submitAudio, submitMcVoice } from "./src/api";
import StageMap from "./src/StageMap";
import MiniChart from "./src/MiniChart";
import { BoltSticker, Cert, ChevronUp, Coin, Dumbbell, FireSticker, Mail, MapIcon, Medal, Mic, Play, Refresh, SoundOff, SoundOn, StarSticker, TicketSticker, Trophy, TrophySticker, User } from "./src/icons";
import { Btn3D, ProgressBar } from "./src/ui";
import Misa, { MisaHead, setMisaSkin } from "./src/Misa";
import Onboarding, { OnboardPrefs } from "./src/Onboarding";
import RecordScreen from "./src/RecordScreen";
import ScoreReveal from "./src/ScoreReveal";
import Celebration, { CelebKind } from "./src/Celebration";
import BadgeCardView from "./src/BadgeCardView";
import ReelsPager, { ReelsLesson } from "./src/ReelsPager";
import Mentors from "./src/Mentors";
import { initSound, setMusicScene, setSoundEnabled, sfx, soundEnabled } from "./src/sound";
import { STREAK_GREET, fill, pick } from "./src/variety";
import { registerForPush } from "./src/push";
import { updateWidget } from "./src/widget";
import { Certificates, ChallengeScreen, LeagueBoard, QuestsCard, RouteOverview, ShopScreen, Showreel, WeakChip } from "./src/Engage";
import { McMarketPanel, MarketScreen } from "./src/Market";
import { ReferralSheet } from "./src/Engage";
import { buyPro, configureIAP, getProPrice, iapConfigured, restorePro } from "./src/iap";

const WIN_W = Dimensions.get("window").width;
const TAB_KEYS = ["hv", "bxh", "shop", "mc", "hs"] as const;

type Brief = { objective: string; context: string; steps: string[]; example: string };
type Lesson = { id: string; buoi: number; order_index: number; title: string; tip: string; prompt: string; brief?: Brief | null; criteria?: string[]; unlocked: boolean; done: boolean };
type Score = {
  volume_label: string; speed_wpm: number; filler_count: number; tip: string; is_mock: boolean;
  transcript?: string | null; unclear?: boolean; passed?: boolean; fail_reason?: string | null;
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
  const [refInput, setRefInput] = useState("");
  const [showReferral, setShowReferral] = useState(false);

  const [tab, setTab] = useState<"hv" | "bxh" | "shop" | "mc" | "hs">("hv");
  const [prog, setProg] = useState<{ xp: number; streak: number; tickets: number; tier?: string; practiced_today?: boolean; energy?: number; energy_max?: number; energy_cost?: number; energy_secs_to_next?: number; is_pro?: boolean; coins?: number; streak_freezes?: number; league_name?: string; misa_color?: string; misa_outfit?: string | null }>({ xp: 0, streak: 0, tickets: 0 });
  const [showEnergy, setShowEnergy] = useState(false);
  const [showChallenge, setShowChallenge] = useState(false);
  const [showMarket, setShowMarket] = useState(false);
  const [showOverview, setShowOverview] = useState(false);  // màn "hết năng lượng"
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
  const [proBusy, setProBusy] = useState(false);
  const [proPrice, setProPrice] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }

  // pager NGANG cho 3 tab (Lộ trình · MC · Hồ sơ) — trang bám theo ngón tay,
  // thay cho PanResponder cũ (thả tay mới nhảy bụp, không animation).
  const pagerRef = useRef<ScrollView>(null);
  const pagerX = useRef(new Animated.Value(0)).current;
  function goTab(t: "hv" | "bxh" | "shop" | "mc" | "hs") {
    setTab(t);
    pagerRef.current?.scrollTo({ x: TAB_KEYS.indexOf(t) * WIN_W, animated: true });
  }

  // dạy cử chỉ đúng 1 lần (discoverability — không ai đoán được gesture vô hình)
  useEffect(() => {
    if (!token || role !== "hoc_vien") return;
    AsyncStorage.getItem("hint_swipe").then((v) => {
      if (v) return;
      AsyncStorage.setItem("hint_swipe", "1");
      setTimeout(() => showToast("Mẹo: vuốt ngang để đổi tab"), 1200);
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
    // Đăng ký thông báo đẩy (không chờ, không chặn màn chính nếu quyền bị từ chối)
    registerForPush()
      .then((pt) => { if (pt) return Api.setPushToken(t, pt); })
      .catch(() => {});
    // Cấu hình RevenueCat với đúng McUp user (im lặng nếu chưa bật IAP), rồi lấy giá hiển thị
    configureIAP(t)
      .then(() => getProPrice())
      .then((p) => { if (p) setProPrice(p); })
      .catch(() => {});
  }
  // ===== Mua / khôi phục McUp Pro (IAP) =====
  async function upgradeToPro() {
    if (!iapConfigured()) { showToast("Tính năng mua gói sắp mở — cảm ơn bạn đã quan tâm! ✨"); return; }
    if (!token || proBusy) return;
    setProBusy(true);
    try {
      const r = await buyPro();
      if (r === "ok") {
        await Api.iapRefresh(token).catch(() => {});
        await Api.progress(token).then(setProg).catch(() => {});
        sfx("success");
        showToast("Đã kích hoạt McUp Pro — học không giới hạn nhé! ⚡∞");
        setShowEnergy(false);
      } else if (r === "unavailable") {
        showToast("Chưa có gói để mua — thử lại sau nhé.");
      } else if (r === "error") {
        showToast("Mua chưa thành công — bạn chưa bị trừ tiền đâu.");
      } // "cancelled": im lặng
    } finally { setProBusy(false); }
  }
  async function restorePurchases() {
    if (!iapConfigured()) { showToast("Tính năng mua gói sắp mở ✨"); return; }
    if (!token || proBusy) return;
    setProBusy(true);
    try {
      const ok = await restorePro();
      if (ok) {
        await Api.iapRefresh(token).catch(() => {});
        await Api.progress(token).then(setProg).catch(() => {});
        showToast("Đã khôi phục McUp Pro ✨");
      } else showToast("Không tìm thấy gói đã mua trên tài khoản này.");
    } finally { setProBusy(false); }
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
        : await Api.register(email.trim().toLowerCase(), pw, name.trim() || "Học viên", regRole, refInput.trim() || undefined);
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
      const res = await Api.guest(refInput.trim() || undefined);
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

  // Set tiến độ + đồng bộ widget màn hình chính (iOS, best-effort)
  function applyProg(p: any, scoreList?: any[]) {
    setProg(p);
    setMisaSkin(p.misa_color, p.misa_outfit); // Misa mặc đồ user đang chọn ở mọi nơi
    // các ngày từng luyện (giờ máy) — widget vẽ 7 chấm tuần (V4-4)
    const days = (scoreList ?? scores).map((x: any) => {
      const t = new Date(x.created_at);
      return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
    });
    updateWidget({ streak: p.streak ?? 0, practicedToday: !!p.practiced_today,
                   energy: p.energy ?? 0, energyMax: p.energy_max ?? 30,
                   xp: p.xp ?? 0, isPro: !!p.is_pro,
                   practicedDays: [...new Set(days)].slice(-14) });
  }
  async function refresh(t = token!, goal = "") {
    const [progR, ps] = await Promise.all([Api.progress(t), Api.contentPaths(t)]);
    applyProg(progR); setPaths(ps);
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
    applyProg(progR, sc);  // đồng bộ lại widget với lịch sử luyện mới nhất
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
  // Về bản đồ TỨC THÌ rồi mới tải lại nền — nút không bao giờ "đơ" (P0-1 feedback #5)
  function backToMap() {
    setScreen("feed");
    safeRefresh();
  }
  // Kéo-để-tải-lại + nút "Thử lại" dùng chung: an toàn, không ném lỗi ra ngoài
  async function safeRefresh() {
    setRefreshing(true);
    try { await refresh(); setLoadError(false); }
    catch (e) { await handleApiError(e); }
    setRefreshing(false);
  }
  async function pickPath(pid: string | null) {
    setSelPath(pid); setScreen("feed"); setRefreshing(true);
    try { setLessons(pid ? await Api.contentLessons(token!, pid) : await Api.lessons(token!)); }
    catch (e) { await handleApiError(e); }
    setRefreshing(false);
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
    applyProg(np);
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
  const [veBusy, setVeBusy] = useState(false);
  async function sendVeVang() {
    if (veBusy) return;
    setVeBusy(true);
    try {
      await Api.sendTicket(token!, lastClip!);
      showToast("Đã gửi cho MC thật 🎤 — chờ nhận xét nhé!");
      await refresh();
    } catch (e: any) { Alert.alert("Lỗi", e.message); }
    setVeBusy(false);
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

  if (booting || !fontsLoaded) return <BootScreen />;

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
          {authMode !== "login" && (
            <TextInput value={refInput} onChangeText={(v) => setRefInput(v.toUpperCase())} placeholder="Mã mời (nếu có) — nhận xu ngay" placeholderTextColor={C.ink2} autoCapitalize="characters"
              style={{ backgroundColor: C.raised, borderRadius: 12, borderWidth: 1, borderColor: C.hair, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: C.ink, marginBottom: 8, letterSpacing: 2 }} />
          )}
          {authBusy ? <ActivityIndicator color={C.primary} style={{ marginTop: 8 }} />
            : (
              <>
                <Btn label={authMode === "login" ? "Đăng nhập" : "Tạo tài khoản"} onPress={doAuth} />
                <Btn ghost label="Thử ngay — không cần tài khoản" onPress={doGuest} />
              </>
            )}
          <Text style={{ color: C.ink2, fontSize: 12.5, textAlign: "center", marginTop: 16, lineHeight: 17 }}>
            Bằng việc tiếp tục, bạn đồng ý với{" "}
            <Text style={{ textDecorationLine: "underline" }} onPress={() => Linking.openURL(API_BASE + "/terms").catch(() => {})}>Điều khoản</Text>
            {" "}và{" "}
            <Text style={{ textDecorationLine: "underline" }} onPress={() => Linking.openURL(API_BASE + "/privacy").catch(() => {})}>Chính sách bảo mật</Text>
            {" "}(gồm việc thu & xử lý giọng nói để chấm điểm).
          </Text>
          <Text style={{ color: C.ink2, fontSize: 12.5, textAlign: "center", marginTop: 8 }}>Tài khoản MC demo: mc@test.vn / 123456</Text>
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
          <Text style={s.brand}>Mc</Text><MisaHead size={21} /><Text style={[s.brand, { color: C.primary }]}>p</Text>
          <Text style={[s.brand, { marginLeft: 6 }]}>· MC</Text>
        </View>
          <TouchableOpacity onPress={logout}><Text style={{ color: C.primary, fontWeight: "800" }}>Đăng xuất</Text></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadQueue(); setRefreshing(false); }} tintColor={C.primary} colors={[C.primary]} />}>
          <MCView queue={queue} onReview={doReview} onReviewVoice={doReviewVoice} onReload={loadQueue} onClaim={doClaim} onRelease={doRelease} />
          <View style={{ height: 1, backgroundColor: C.hair, marginVertical: 18 }} />
          <Text style={{ fontFamily: F.displayX, fontSize: T.title, color: C.ink, marginBottom: 4 }}>Dạy 1:1 kiếm thu nhập</Text>
          <McMarketPanel token={token!} />
        </ScrollView>
        {toast && <View style={s.toast}><Text style={s.toastT}>{toast}</Text></View>}
      </View>
    );
  }

  // ---- Học viên ----
  // Minimal UI: header 1 dòng (logo + 1 cụm chip) · KHÔNG tab trên đầu ·
  // tab bar icon ở ĐÁY (chuẩn native, EXPERIENCE.md IA) · vuốt ngang đổi tab từ mọi màn
  // (trừ đang luyện/Reels để không vuốt nhầm).
  // Thanh năng lượng (hồi theo thời gian): đủ để học thêm bài không?
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
        <View style={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
          <Text style={s.brand}>Mc</Text><MisaHead size={21} /><Text style={[s.brand, { color: C.primary }]}>p</Text>
        </View>
        <View style={s.chipCluster}>
          {!prog.is_pro
            ? (<TouchableOpacity onPress={() => setShowEnergy(true)} style={{ flexDirection: "row", alignItems: "center", gap: 2 }}><BoltSticker size={17} /><Text style={[s.chipT, { color: hasEnergy ? C.ink : C.primary }]}>{energy}</Text></TouchableOpacity>)
            : (<View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}><BoltSticker size={17} /><Text style={[s.chipT, { color: C.spot }]}>∞</Text></View>)}
          <View style={s.chipDiv} />
          <TouchableOpacity onPress={() => goTab("shop")} style={{ flexDirection: "row", alignItems: "center", gap: 2 }}><Coin size={16} /><Text style={s.chipT}>{prog.coins ?? 0}</Text></TouchableOpacity>
          <View style={s.chipDiv} />
          <FireSticker size={17} /><Text style={s.chipT}>{prog.streak}</Text>
          <View style={s.chipDiv} />
          <StarSticker size={16} /><Text style={s.chipT}>{prog.xp}</Text>
          <View style={s.chipDiv} />
          <TicketSticker size={17} /><Text style={s.chipT}>{prog.tickets}</Text>
        </View>
      </View>

      {tab === "hv" && screen === "reels" ? (
        <ReelsPager
          lessons={lessons as ReelsLesson[]}
          startIndex={Math.max(0, lessons.findIndex((l) => l.unlocked && !l.done))}
          streak={prog.streak}
          onRun={runReelsLesson}
          onExit={backToMap}
        />
      ) : (
      <Animated.ScrollView
        ref={pagerRef as any}
        horizontal
        pagingEnabled
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        // chỉ vuốt ngang ở màn bản đồ — màn thu/điểm ưu tiên TAP không bị pan ngang nuốt (V4-1)
        scrollEnabled={screen === "feed"}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: pagerX } } }], { useNativeDriver: true })}
        onMomentumScrollEnd={(e) => {
          const t = TAB_KEYS[Math.round(e.nativeEvent.contentOffset.x / WIN_W)];
          if (t && t !== tab) { setTab(t); sfx("pop"); if (t === "hs") setNewBadge(false); }
        }}
        style={{ flex: 1, marginBottom: 62 }}
      >
      {/* ── Trang 1: Lộ trình (feed / luyện / điểm) ── */}
      <View style={{ width: WIN_W, flex: 1 }}>
        {screen === "feed" ? (
          <View style={{ flex: 1 }}>
            {/* Thanh thể loại + nút toàn cảnh */}
            {paths.length > 0 && (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 46 }} contentContainerStyle={{ paddingLeft: 16, paddingRight: 8, paddingVertical: 6, gap: 8, alignItems: "center" }}>
                  {paths.map((p) => <PathPill key={p.id} active={selPath === p.id} label={p.genre} color={p.color} onPress={() => pickPath(p.id)} />)}
                </ScrollView>
                <TouchableOpacity onPress={() => setShowOverview(true)} accessibilityLabel="Xem toàn cảnh lộ trình"
                  style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.sunken, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                  <MapIcon size={20} color={C.ink2} />
                </TouchableOpacity>
              </View>
            )}
            {/* MỘT hàng gọn: nhiệm vụ (flex) + ôn tập (nút icon) — không chiếm nhiều chỗ */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginTop: 8 }}>
              <QuestsCard token={token!} noMargin onCoins={(n) => setProg((p) => ({ ...p, coins: n }))} />
              <WeakChip token={token!} compact onPick={(lid) => { const full = lessons.find((x: any) => x.id === lid); if (full) tryEnterLesson(() => { setCur(full); setScreen("practice"); }); }} />
            </View>
            {/* mạng/máy chủ lỗi → banner giữ phiên + thử lại (không đá ra) */}
            {loadError && (
              <TouchableOpacity style={s.errorBanner} onPress={safeRefresh} accessibilityLabel="Thử tải lại">
                <Text style={{ flex: 1, color: "#8a3d33", fontWeight: "700", fontSize: 13 }}>Chưa tải được dữ liệu — chạm để thử lại</Text>
                <Refresh size={16} color="#8a3d33" />
              </TouchableOpacity>
            )}
            {lessons.length === 0 && !loadError ? (
              <View style={s.emptyFeed}>
                <Misa mood="chao" size={100} />
                <Text style={s.emptyTitle}>Lộ trình đang được chuẩn bị</Text>
                <Text style={s.emptySub}>Kéo xuống để tải lại nhé.</Text>
              </View>
            ) : (
              <StageMap lessons={lessons} refreshing={refreshing} onRefresh={safeRefresh}
                energyCost={prog.is_pro ? 0 : energyCost} canAfford={hasEnergy}
                onPick={(l) => { const full = lessons.find((x) => x.id === l.id); if (full) tryEnterLesson(() => { setCur(full); setScreen("practice"); }); }} />
            )}
            {/* điểm vào Practice Reels — bản đồ = duyệt, Reels = làm */}
            <TouchableOpacity style={s.reelsFab} onPress={() => tryEnterLesson(() => setScreen("reels"))} accessibilityLabel="Luyện liên tục — vuốt dọc qua các bài">
              <ChevronUp size={15} color="#fff" /><Text style={s.reelsFabT}>Luyện liên tục</Text>
            </TouchableOpacity>
          </View>
        ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16 }}
          onScrollEndDrag={(e) => {
            // cử chỉ: kéo xuống ở màn điểm → về bản đồ (nút vẫn còn — gesture chỉ là đường tắt)
            if (screen === "score" && e.nativeEvent.contentOffset.y < -70) backToMap();
          }}
        >
          {screen === "practice" && curLesson && (
            <View>
              <Kicker>Buổi {curLesson.buoi} · {curLesson.title}</Kicker>
              <RecordScreen
                lesson={curLesson}
                busy={busy}
                doneCount={scores.length}
                genre={paths.find((p: any) => p.id === selPath)?.genre || ""}
                energyCost={prog.is_pro ? 0 : energyCost}
                onSubmit={submitReal}
                onMock={doSubmitMock}
                onBack={backToMap}
              />
            </View>
          )}
          {screen === "score" && score && (
            <View>
              <Kicker>{score.unclear || score.passed === false ? "Chưa đạt — thử lại nhé" : "Kết quả của bạn"}</Kicker>
              <ScoreReveal score={score} prev={scores.length ? scores[scores.length - 1] : null} />
              {(score.unclear || score.passed === false) ? (
                // RỚT → mời thu lại ngay, KHÔNG mời gửi MC (phí vé vô ích)
                <Btn icon={<Mic size={16} color="#fff" />} label="Thử lại ngay" onPress={() => setScreen("practice")} />
              ) : (
                <Btn gold loading={veBusy} label={veBusy ? "Đang gửi cho MC…" : "Gửi cho MC thật (Vé Vàng)"} onPress={sendVeVang} />
              )}
              <Btn ghost label="Tiếp tục lộ trình" onPress={backToMap} />
              <Text style={s.pullHint}>kéo xuống để về bản đồ</Text>
            </View>
          )}
        </ScrollView>
        )}
      </View>

      {/* ── Trang 2: Xếp hạng (V4-5) ── */}
      <View style={{ width: WIN_W, flex: 1 }}>
        <RankView token={token!} achs={achs} onOpenChallenge={() => setShowChallenge(true)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={safeRefresh} tintColor={C.primary} colors={[C.primary]} />} />
      </View>

      {/* ── Trang 3: Shop (B1) ── */}
      <View style={{ width: WIN_W, flex: 1 }}>
        <ShopScreen token={token!} coins={prog.coins ?? 0} onCoins={(n) => setProg((p) => ({ ...p, coins: n }))}
          misaColor={prog.misa_color} misaOutfit={prog.misa_outfit}
          onEquip={(color, outfit) => setProg((p) => ({ ...p, misa_color: color ?? p.misa_color, misa_outfit: outfit === undefined ? p.misa_outfit : outfit }))}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={safeRefresh} tintColor={C.primary} colors={[C.primary]} />} />
      </View>

      {/* ── Trang 4: MC (mạng lưới + học 1:1) ── */}
      <View style={{ width: WIN_W, flex: 1 }}>
        <TouchableOpacity onPress={() => setShowMarket(true)} style={s.marketBanner}>
          <Misa mood="covu" size={52} accessory="bowtie" still />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.title, fontSize: 15.5, color: "#fff" }}>Học 1:1 với MC thật</Text>
            <Text style={{ fontFamily: F.med, fontSize: 12.5, color: "#FFE3DE" }}>Đặt buổi coaching · nhận xét clip riêng cho bạn</Text>
          </View>
          <Text style={{ color: "#fff", fontFamily: F.title, fontSize: 20 }}>›</Text>
        </TouchableOpacity>
        <Mentors mentors={mentors}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={safeRefresh} tintColor={C.primary} colors={[C.primary]} />} />
      </View>

      {/* ── Trang 5: Hồ sơ ── */}
      <View style={{ width: WIN_W, flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={safeRefresh} tintColor={C.primary} colors={[C.primary]} />}
        >
          <ProfileView token={token!} onReferral={() => setShowReferral(true)} prog={prog} reviews={reviews} board={board} achs={achs} scores={scores} isGuest={isGuest} onUpgrade={doUpgrade} onBuyPro={upgradeToPro} onRestorePro={restorePurchases} proPrice={proPrice} proBusy={proBusy} soundOn={soundOn} onToggleSound={toggleSound} onLogout={logout} />
        </ScrollView>
      </View>
      </Animated.ScrollView>
      )}

      {/* tab bar đáy — icon, chuẩn native (3 tab: Lộ trình · MC · Hồ sơ) */}
      {screen !== "reels" && (
        <View style={s.bottomBar}>
          {/* vạch chỉ tab TRƯỢT theo ngón tay khi vuốt ngang (native driver) */}
          <Animated.View style={[s.tabIndicator, { transform: [{ translateX: pagerX.interpolate({
            inputRange: [0, WIN_W * 4], outputRange: [0, (WIN_W * 4) / 5], extrapolate: "clamp" }) }] }]} />
          <TouchableOpacity style={s.bTab} onPress={() => { sfx("pop"); goTab("hv"); if (screen !== "feed" && screen !== "practice" && screen !== "score") setScreen("feed"); }}
            accessibilityLabel="Tab Lộ trình">
            <MapIcon size={26} color={tab === "hv" ? C.primary : C.ink2} />
            <Text style={[s.bTabT, tab === "hv" && { color: C.primary }]}>Lộ trình</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.bTab} onPress={() => { sfx("pop"); goTab("bxh"); }} accessibilityLabel="Tab Xếp hạng">
            <Trophy size={26} color={tab === "bxh" ? C.primary : C.ink2} />
            <Text style={[s.bTabT, tab === "bxh" && { color: C.primary }]}>Xếp hạng</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.bTab} onPress={() => { sfx("pop"); goTab("shop"); }} accessibilityLabel="Tab Cửa hàng">
            <Coin size={26} />
            <Text style={[s.bTabT, tab === "shop" && { color: C.primary }]}>Cửa hàng</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.bTab} onPress={() => { sfx("pop"); goTab("mc"); }} accessibilityLabel="Tab MC">
            <Mic size={26} color={tab === "mc" ? C.primary : C.ink2} />
            <Text style={[s.bTabT, tab === "mc" && { color: C.primary }]}>MC</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.bTab} onPress={() => { sfx("pop"); goTab("hs"); setNewBadge(false); }} accessibilityLabel="Tab Hồ sơ">
            <View>
              <User size={26} color={tab === "hs" ? C.primary : C.ink2} />
              {newBadge && <View style={s.tabDot} />}
            </View>
            <Text style={[s.bTabT, tab === "hs" && { color: C.primary }]}>Hồ sơ</Text>
          </TouchableOpacity>
        </View>
      )}

      {celeb && <Celebration kind={celeb.kind} value={celeb.value} onClose={() => setCeleb(null)} />}
      {showChallenge && <ChallengeScreen token={token!} onClose={() => setShowChallenge(false)} />}
      {showMarket && <MarketScreen token={token!} onClose={() => setShowMarket(false)} />}
      {showOverview && <RouteOverview lessons={lessons} onClose={() => setShowOverview(false)} onPick={(lid) => { const full = lessons.find((x:any) => x.id === lid); if (full) tryEnterLesson(() => { setCur(full); setScreen("practice"); }); }} />}
      {showReferral && <ReferralSheet token={token!} onClose={() => setShowReferral(false)} />}
      {showEnergy && <EnergyModal energy={energy} energyMax={energyMax} energyCost={energyCost}
        secs={prog.energy_secs_to_next ?? 0} onClose={() => setShowEnergy(false)}
        price={proPrice} busy={proBusy} onUpgrade={upgradeToPro}
        onRefresh={async () => { await safeRefresh(); setShowEnergy(false); }} />}
      {toast && <View style={s.toast}><Text style={s.toastT}>{toast}</Text></View>}
    </View>
  );
}

// Màn "Hết năng lượng" — đếm ngược tới lúc hồi thêm, CTA Pro. Không phán xét.
function EnergyModal({ energy, energyMax, energyCost, secs, onClose, onRefresh, onUpgrade, price, busy }: { energy: number; energyMax: number; energyCost: number; secs: number; onClose: () => void; onRefresh: () => void; onUpgrade: () => void; price: string | null; busy: boolean }) {
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
        <Misa mood="lo" size={86} />
        <Text style={s.energyTitle}>Hết năng lượng rồi!</Text>
        <ProgressBar value={pct} height={16} style={{ marginTop: 14, width: "100%" }} />
        <Text style={s.energyNum}>Thanh đầy = đủ học 1 bài</Text>
        <Text style={s.energySub}>
          {left > 0 ? `Đủ học tiếp sau ${h > 0 ? `${h} giờ ` : ""}${m} phút nữa — nghỉ ngơi một chút nhé 💛` : "Sắp đủ rồi, kéo tải lại xem nhé!"}
        </Text>
        <Btn gold label={busy ? "Đang xử lý…" : `Học không giới hạn với Pro ✨${price ? ` · ${price}` : ""}`} onPress={onUpgrade} />
        <TouchableOpacity onPress={onRefresh}><Text style={s.energyLink}>Tải lại</Text></TouchableOpacity>
        <TouchableOpacity onPress={onClose}><Text style={s.energyLink}>Để sau</Text></TouchableOpacity>
      </View>
    </View>
  );
}

// Tab XẾP HẠNG (V4-5): thi đua tách khỏi Hồ sơ — BXH + huy hiệu ở một sân riêng
function RankView({ token, achs, refreshControl, onOpenChallenge }: { token: string; achs: any[]; refreshControl: any; onOpenChallenge: () => void }) {
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} refreshControl={refreshControl}>
      <View style={{ alignItems: "center", marginBottom: 4 }}>
        <Misa mood="anmung" size={82} />
        <Text style={{ fontFamily: F.displayX, fontSize: T.title, color: C.ink, marginTop: 4 }}>Đấu trường sân khấu</Text>
      </View>
      <LeagueBoard token={token} />
      <TouchableOpacity onPress={onOpenChallenge} style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.ink, borderRadius: 16, padding: 14, marginTop: 8, borderBottomWidth: 4, borderBottomColor: "#241A2E" }}>
        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: "#FFF3DA", alignItems: "center", justifyContent: "center" }}><TrophySticker size={26} /></View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: F.title, fontSize: 15.5, color: C.spot }}>Thử thách MC tuần</Text>
          <Text style={{ fontFamily: F.med, fontSize: 12.5, color: "#CFC3B0" }}>Nộp clip theo chủ đề — MC tuyên dương top</Text>
        </View>
        <Text style={{ color: C.spot, fontFamily: F.title, fontSize: 18 }}>›</Text>
      </TouchableOpacity>
      <IconKicker icon={<Cert size={17} color="#B8860B" />}>Chứng nhận</IconKicker>
      <Certificates token={token} />
      <IconKicker icon={<TrophySticker size={18} />}>Huy hiệu · {achs.filter((a) => a.earned).length}/{achs.length}</IconKicker>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {achs.map((a) => (
          <View key={a.code} style={[s.achBadge, !a.earned && { opacity: 0.45 }]}>
            <View style={[s.achIcon, a.earned && { backgroundColor: C.spot }]}>{a.earned ? <TrophySticker size={22} /> : <Trophy size={18} color={C.ink2} />}</View>
            <Text style={{ fontSize: 12.5, fontWeight: "800", textAlign: "center", marginTop: 4 }} numberOfLines={2}>{a.title}</Text>
            {!a.earned && a.target > 1 && <Text style={{ fontSize: 12, color: C.ink2, fontFamily: F.med }}>{a.progress}/{a.target}</Text>}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function ProfileView({ token, onReferral, prog, reviews, board, achs, scores, isGuest, onUpgrade, onBuyPro, onRestorePro, proPrice, proBusy, soundOn, onToggleSound, onLogout }: { token: string; onReferral: () => void; prog: { xp: number; streak: number; tickets: number; tier?: string; ai_scores_left?: number; is_pro?: boolean }; reviews: any[]; board: any[]; achs: any[]; scores: any[]; isGuest: boolean; onUpgrade: (email: string, pw: string, name: string) => void; onBuyPro: () => void; onRestorePro: () => void; proPrice: string | null; proBusy: boolean; soundOn: boolean; onToggleSound: () => void; onLogout: () => void }) {
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
          <Btn gold label={proBusy ? "Đang xử lý…" : `Nâng cấp Pro${proPrice ? ` · ${proPrice}` : ""}`} onPress={onBuyPro} />
          <TouchableOpacity onPress={onRestorePro} style={{ alignSelf: "center", marginTop: 8 }}>
            <Text style={s.proRestore}>Khôi phục gói đã mua</Text>
          </TouchableOpacity>
        </View>
      )}
      <IconKicker icon={<Medal size={17} />}>Tiến bộ của bạn</IconKicker>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <StatCard icon={<FireSticker size={24} />} value={prog.streak} label="Ngày streak" />
        <StatCard icon={<StarSticker size={24} />} value={prog.xp} label="XP" />
        <StatCard icon={<TicketSticker size={24} />} value={prog.tickets} label="Vé Vàng" />
      </View>
      {prog.tier && <View style={s.tierBadge}><Trophy size={14} color="#5a3d00" /><Text style={{ fontWeight: "800", color: "#5a3d00", fontSize: 13 }}>Hạng {prog.tier}</Text></View>}
      <TouchableOpacity onPress={onReferral} style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#FFF3DA", borderRadius: 16, padding: 13, marginTop: 12, borderWidth: 1, borderColor: "#F5DFAE" }}>
        <Coin size={26} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: F.title, fontSize: 14.5, color: "#8a5a13" }}>Mời bạn — nhận xu</Text>
          <Text style={{ fontFamily: F.med, fontSize: 12.5, color: "#A5843A" }}>Bạn +50 xu, họ +30 xu khi vào học</Text>
        </View>
        <Text style={{ color: "#8a5a13", fontFamily: F.title, fontSize: 18 }}>›</Text>
      </TouchableOpacity>

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

      <IconKicker icon={<Dumbbell size={17} color={C.primary} />}>Tiến bộ từ đệm</IconKicker>
      {scores.length >= 2 ? (
        <MiniChart data={scores.map((p: any) => p.filler_count)} label="Số từ đệm mỗi lần luyện (thấp hơn = tốt hơn)" />
      ) : (
        <Text style={s.emptyHint}>Luyện thêm vài bài để xem đường tiến bộ từ đệm của bạn nhé</Text>
      )}
      <IconKicker icon={<Play size={16} color={C.primary} />}>Showreel của bạn</IconKicker>
      <Showreel token={token} />
      <IconKicker icon={<TrophySticker size={18} />}>Thẻ MC bảo chứng</IconKicker>
      {badges.length === 0 && !waiting && (
        <Text style={{ color: C.ink2, paddingHorizontal: 4 }}>Chưa có. Luyện xong rồi gửi Vé Vàng cho MC để nhận nhận xét nhé!</Text>
      )}
      {badges.map((r) => (
        <BadgeCardView key={r.id} badge={r.badge} audioBase={API_BASE} />
      ))}
      {waiting && <Text style={{ color: C.ink2, paddingHorizontal: 4, marginTop: 4 }}>Có clip đang chờ MC nghe bạn dẫn…</Text>}
      <Btn ghost icon={soundOn ? <SoundOn size={16} color={C.ink} /> : <SoundOff size={16} color={C.ink} />} label={soundOn ? "Âm thanh: Bật" : "Âm thanh: Tắt"} onPress={onToggleSound} />
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
      <Btn ghost icon={<Mail size={16} color={C.ink} />} label="Góp ý cho McUp" onPress={() =>
        Linking.openURL("mailto:datly030102@gmail.com?subject=" + encodeURIComponent("Góp ý McUp beta")
          + "&body=" + encodeURIComponent("Mình thấy...")).catch(() => {})
      } />
      {/* Credit BẮT BUỘC theo CC-BY 4.0 (assets/CREDITS.md) — giữ khi phát hành */}
      <Text style={{ color: "#BFB4C4", fontSize: 12, textAlign: "center", marginTop: 8 }}>
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
      <Text style={{ color: C.ink2, fontSize: 12.5, fontWeight: "700" }}>{label}</Text>
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
const IconKicker = ({ icon, children }: any) => (
  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14, marginBottom: 4 }}>
    {icon}<Text style={[s.kicker, { marginVertical: 0 }]}>{children}</Text>
  </View>
);
const Tab = ({ on, label, icon, onPress }: any) => <TouchableOpacity style={[s.tab, on && s.tabOn]} onPress={onPress}><View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>{icon}<Text style={{ fontWeight: "700", color: on ? "#fff" : C.ink2 }}>{label}</Text></View></TouchableOpacity>;
const PathPill = ({ active, label, color, onPress }: any) => <TouchableOpacity onPress={() => { sfx("pop"); onPress?.(); }} style={[s.pathPill, active && { backgroundColor: color || C.primary }]}><Text style={{ fontWeight: "800", fontSize: 12, color: active ? "#fff" : C.ink2 }}>{label}</Text></TouchableOpacity>;
// Màn mở app: Misa nhún chào + câu sân khấu ngẫu nhiên + shimmer (feedback #7)
const BOOT_LINES = ["Đang dựng sân khấu…", "Chỉnh mic một chút…", "Kéo màn lên nào…", "Bật đèn sân khấu…", "Khán giả đang vào chỗ…"];
function BootScreen() {
  const [line] = useState(() => BOOT_LINES[Math.floor(Math.random() * BOOT_LINES.length)]);
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const l = Animated.loop(Animated.timing(x, { toValue: 1, duration: 1100, useNativeDriver: true }));
    l.start();
    return () => l.stop();
  }, []);
  return (
    <View style={s.center}>
      <Misa mood="chao" size={116} />
      <Text style={{ marginTop: 14, color: C.ink, fontFamily: F.title, fontSize: 16 }}>{line}</Text>
      <View style={{ width: 150, height: 8, borderRadius: 4, backgroundColor: C.sunken, overflow: "hidden", marginTop: 14 }}>
        <Animated.View style={{ width: 54, height: 8, borderRadius: 4, backgroundColor: C.spot,
          transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-54, 150] }) }] }} />
      </View>
    </View>
  );
}

const Btn = ({ label, onPress, ghost, gold, icon, loading }: any) =>
  <Btn3D label={label} onPress={onPress} icon={icon} loading={loading} kind={gold ? "gold" : ghost ? "white" : "primary"} />;

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
  chipT: { color: C.ink, fontFamily: F.display, fontSize: 15 },
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
  tabIndicator: {
    position: "absolute", top: -1, left: 0, width: WIN_W / 5, height: 3,
    borderRadius: 2, backgroundColor: C.primary,
  },
  bTab: { flex: 1, alignItems: "center", gap: 2 },
  bTabT: { fontSize: 12, fontFamily: F.semi, color: C.ink2 },
  tabDot: { position: "absolute", top: -2, right: -4, width: 9, height: 9, borderRadius: 5, backgroundColor: C.primary, borderWidth: 1.5, borderColor: C.raised },
  stateChip: { backgroundColor: C.sunken, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  stateChipT: { fontSize: 12, fontFamily: F.semi, color: C.ink2 },
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
  proLine: { fontSize: 12.5, color: "#EDE4D2", fontFamily: F.body, marginTop: 3, lineHeight: 18 },
  proRestore: { color: "#CFC3B0", fontSize: 12.5, fontFamily: F.med, textDecorationLine: "underline" },
  pullHint: { textAlign: "center", color: "#BFB4C4", fontSize: 12.5, fontFamily: F.med, marginTop: 12 },
  field: { borderWidth: 1, borderColor: C.hair, borderRadius: 12, padding: 12, marginBottom: 10, fontSize: 15, backgroundColor: C.raised, color: C.ink },
  field2: { borderWidth: 1, borderColor: C.hair, borderRadius: 12, padding: 11, marginTop: 10, fontSize: 14, backgroundColor: C.base, color: C.ink },
  marketBanner: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.primary, borderRadius: 18, padding: 14, marginHorizontal: 16, marginTop: 12, borderBottomWidth: 5, borderBottomColor: C.primaryDown },
  reelsFab: {
    position: "absolute", bottom: 22, alignSelf: "center", backgroundColor: C.primary,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999,
    flexDirection: "row", alignItems: "center", gap: 5,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8,
  },
  reelsFabT: { color: "#fff", fontFamily: F.title, fontSize: 13.5 },
  kicker: { fontSize: 12.5, textTransform: "uppercase", letterSpacing: 1, color: C.ink2, fontFamily: F.title, marginVertical: 10 },
  card: { backgroundColor: C.raised, borderRadius: 16, padding: 14, marginBottom: 10 },
  btn: { backgroundColor: C.primary, borderRadius: 999, padding: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7, marginTop: 8 },
  btnGhost: { backgroundColor: C.sunken }, btnGold: { backgroundColor: C.spot },
  input: { borderWidth: 1, borderColor: C.hair, borderRadius: 12, padding: 10, marginTop: 10, minHeight: 60 },
  rankRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.raised, borderRadius: 12, padding: 12, marginBottom: 6 },
  rankMedal: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.sunken, alignItems: "center", justifyContent: "center", marginRight: 10 },
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
