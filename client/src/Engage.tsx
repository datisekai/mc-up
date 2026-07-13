// Bộ máy giữ chân (client) — nhiệm vụ ngày · giải đấu tuần · shop · showreel · chứng nhận · ôn bài yếu.
// Đi theo style "Sân khấu ấm 2.0": Btn3D, sticker icon, Misa, nút phím đàn.
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Audio } from "expo-av";
import { C, F, T } from "./theme";
import { Btn3D, ProgressBar } from "./ui";
import { Api } from "./api";
import Misa from "./Misa";
import { Cert, Check, Coin, Dumbbell, Heart, Medal, Pause, Play, Snow, StarSticker, TicketSticker, X } from "./icons";

const LEAGUE_COLORS = ["#C77F00", "#B8BCC4", "#FFC24B", "#7FB5D8", "#8FE0D0"];

// ===== Thẻ NHIỆM VỤ NGÀY (A2) — đặt đầu màn Lộ trình =====
export function QuestsCard({ token, onCoins }: { token: string; onCoins?: (n: number) => void }) {
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  async function load() { try { setData(await Api.quests(token)); } catch {} }
  useEffect(() => { load(); }, []);
  if (!data || data.all_claimed) return null; // xong hết thì ẩn cho gọn
  async function claim(id: string) {
    setBusy(id);
    try { const r = await Api.claimQuest(token, id); if (r.ok) { onCoins?.(r.coins); await load(); } } catch {}
    setBusy(null);
  }
  return (
    <View style={{ backgroundColor: C.raised, borderRadius: 18, padding: 14, marginHorizontal: 16, marginTop: 10, borderWidth: 1, borderColor: C.hair }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Misa mood="covu" size={40} still />
        <Text style={{ fontFamily: F.displayX, fontSize: 17, color: C.ink }}>Nhiệm vụ hôm nay</Text>
      </View>
      {data.quests.map((q: any) => (
        <View key={q.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.semi, fontSize: 14, color: q.claimed ? C.ink2 : C.ink }}>{q.label}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
              <ProgressBar value={q.progress / q.target} height={8} style={{ flex: 1 }} />
              <Text style={{ fontSize: 12, fontFamily: F.med, color: C.ink2 }}>{q.progress}/{q.target}</Text>
            </View>
          </View>
          {q.claimed ? (
            <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: "#E7F6EE", alignItems: "center", justifyContent: "center" }}><Check size={18} color="#2E9668" /></View>
          ) : q.done ? (
            <TouchableOpacity onPress={() => claim(q.id)} disabled={!!busy}
              style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: C.spot, borderRadius: 12, borderBottomWidth: 3, borderBottomColor: "#E09B18", paddingHorizontal: 10, paddingVertical: 6 }}>
              {busy === q.id ? <ActivityIndicator size="small" color="#5a3d00" /> : <Coin size={16} />}
              <Text style={{ fontFamily: F.title, fontSize: 13, color: "#5a3d00" }}>+{q.coins}</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3, opacity: 0.5 }}>
              <Coin size={15} /><Text style={{ fontFamily: F.title, fontSize: 13, color: C.ink2 }}>{q.coins}</Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

// ===== BXH GIẢI ĐẤU TUẦN (A4) — thay bảng tĩnh trong tab Xếp hạng =====
export function LeagueBoard({ token }: { token: string }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { Api.league(token).then(setData).catch(() => {}); }, []);
  if (!data) return <ActivityIndicator color={C.primary} style={{ marginVertical: 20 }} />;
  const col = LEAGUE_COLORS[Math.min(data.tier, 4)];
  return (
    <View>
      <View style={{ alignItems: "center", marginBottom: 8 }}>
        <View style={{ width: 66, height: 66, borderRadius: 33, backgroundColor: col + "33", alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: col }}>
          <Medal size={38} />
        </View>
        <Text style={{ fontFamily: F.displayX, fontSize: 20, color: C.ink, marginTop: 6 }}>Liên đoàn {data.tier_name}</Text>
        <Text style={{ fontFamily: F.med, fontSize: 13, color: C.ink2 }}>Top 5 tuần này lên hạng · reset thứ Hai</Text>
      </View>
      {data.entries.map((e: any, i: number) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 9, paddingHorizontal: 10, borderRadius: 12, marginBottom: 4,
          backgroundColor: e.is_me ? "#FFF3DA" : "transparent", borderWidth: e.is_me ? 1.5 : 0, borderColor: C.spot }}>
          <View style={{ width: 28, alignItems: "center" }}>
            {e.promote ? <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#E7F6EE", alignItems: "center", justifyContent: "center" }}><Text style={{ fontFamily: F.displayX, fontSize: 13, color: "#2E9668" }}>{e.rank}</Text></View>
              : <Text style={{ fontFamily: F.displayX, fontSize: 15, color: C.ink2 }}>{e.rank}</Text>}
          </View>
          <Text style={{ flex: 1, fontFamily: e.is_me ? F.title : F.semi, fontSize: 15, color: C.ink, marginLeft: 8 }} numberOfLines={1}>{e.name}{e.is_me ? " (bạn)" : ""}</Text>
          <StarSticker size={15} /><Text style={{ fontFamily: F.title, fontSize: 14, marginLeft: 3 }}>{e.league_xp}</Text>
        </View>
      ))}
      {data.entries.length <= 1 && <Text style={{ color: C.ink2, textAlign: "center", padding: 12, fontSize: 13 }}>Luyện vài bài để leo hạng cùng mọi người nhé 🏆</Text>}
    </View>
  );
}

// ===== SHOP (B1) — mở từ chip xu =====
const SHOP_ICON: Record<string, any> = { freeze: <Snow size={26} />, bolt: <StarSticker size={26} />, skin: <Misa mood="anmung" size={40} still /> };
export function ShopModal({ token, coins, onClose, onCoins }: { token: string; coins: number; onClose: () => void; onCoins: (n: number) => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [bal, setBal] = useState(coins);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { Api.shop(token).then((d) => { setItems(d.items); setBal(d.coins); }).catch(() => {}); }, []);
  async function buy(id: string) {
    setBusy(id);
    try { const r = await Api.buyItem(token, id); setBal(r.coins); onCoins(r.coins); }
    catch (e: any) { /* thiếu xu — nút tự khoá theo bal */ }
    setBusy(null);
  }
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(59,42,74,0.4)", justifyContent: "flex-end" }}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} />
        <View style={{ backgroundColor: C.base, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 34 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <Text style={{ fontFamily: F.displayX, fontSize: 22, color: C.ink }}>Cửa hàng</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#FFF3DA", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
              <Coin size={20} /><Text style={{ fontFamily: F.displayX, fontSize: 17, color: "#8a5a13" }}>{bal}</Text>
            </View>
          </View>
          {items.map((it) => (
            <View key={it.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.raised, borderRadius: 16, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: C.hair }}>
              <View style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}>{SHOP_ICON[it.icon] ?? <Coin size={26} />}</View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: F.title, fontSize: 15, color: C.ink }}>{it.label}</Text>
                <Text style={{ fontFamily: F.body, fontSize: 12.5, color: C.ink2, marginTop: 1 }}>{it.desc}</Text>
              </View>
              <TouchableOpacity onPress={() => buy(it.id)} disabled={busy === it.id || bal < it.cost}
                style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: bal < it.cost ? C.sunken : C.spot, borderRadius: 12, borderBottomWidth: bal < it.cost ? 0 : 3, borderBottomColor: "#E09B18", paddingHorizontal: 12, paddingVertical: 8 }}>
                {busy === it.id ? <ActivityIndicator size="small" color="#5a3d00" /> : <Coin size={15} />}
                <Text style={{ fontFamily: F.title, fontSize: 14, color: bal < it.cost ? C.ink2 : "#5a3d00" }}>{it.cost}</Text>
              </TouchableOpacity>
            </View>
          ))}
          <Btn3D kind="white" label="Đóng" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

// ===== SHOP dạng TAB (B1) — trang riêng, không phải modal =====
export function ShopScreen({ token, coins, onCoins, refreshControl }: { token: string; coins: number; onCoins: (n: number) => void; refreshControl?: any }) {
  const [items, setItems] = useState<any[]>([]);
  const [bal, setBal] = useState(coins);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  async function load() { try { const d = await Api.shop(token); setItems(d.items); setBal(d.coins); onCoins(d.coins); } catch {} }
  useEffect(() => { load(); }, []);
  async function buy(id: string) {
    setBusy(id); setMsg("");
    try { const r = await Api.buyItem(token, id); setBal(r.coins); onCoins(r.coins); setMsg("Đã mua! 🎉"); }
    catch (e: any) { setMsg(e.message || "Chưa mua được"); }
    setBusy(null);
  }
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} refreshControl={refreshControl}>
      <View style={{ alignItems: "center", marginBottom: 8 }}>
        <Misa mood="anmung" size={80} still />
        <Text style={{ fontFamily: F.displayX, fontSize: T.title, color: C.ink, marginTop: 4 }}>Cửa hàng</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FFF3DA", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, marginTop: 8 }}>
          <Coin size={22} /><Text style={{ fontFamily: F.displayX, fontSize: 19, color: "#8a5a13" }}>{bal}</Text>
          <Text style={{ fontFamily: F.med, fontSize: 13, color: "#8a5a13" }}>xu</Text>
        </View>
        <Text style={{ fontFamily: F.med, fontSize: 12.5, color: C.ink2, marginTop: 4 }}>Luyện mỗi bài +5 xu · làm nhiệm vụ nhận thêm</Text>
      </View>
      {!!msg && <Text style={{ textAlign: "center", color: C.primary, fontFamily: F.semi, fontSize: 13, marginBottom: 6 }}>{msg}</Text>}
      {items.map((it) => (
        <View key={it.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.raised, borderRadius: 16, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: C.hair }}>
          <View style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}>{SHOP_ICON[it.icon] ?? <Coin size={26} />}</View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.title, fontSize: 15, color: C.ink }}>{it.label}</Text>
            <Text style={{ fontFamily: F.body, fontSize: 12.5, color: C.ink2, marginTop: 1 }}>{it.desc}</Text>
          </View>
          <TouchableOpacity onPress={() => buy(it.id)} disabled={busy === it.id || bal < it.cost}
            style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: bal < it.cost ? C.sunken : C.spot, borderRadius: 12, borderBottomWidth: bal < it.cost ? 0 : 3, borderBottomColor: "#E09B18", paddingHorizontal: 13, paddingVertical: 9 }}>
            {busy === it.id ? <ActivityIndicator size="small" color="#5a3d00" /> : <Coin size={16} />}
            <Text style={{ fontFamily: F.title, fontSize: 14, color: bal < it.cost ? C.ink2 : "#5a3d00" }}>{it.cost}</Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

// ===== SHOWREEL (C1) — trong Hồ sơ =====
function ClipPlayer({ url, title, meta }: { url: string; title: string; meta: string }) {
  const [playing, setPlaying] = useState(false);
  const ref = useRef<Audio.Sound | null>(null);
  useEffect(() => () => { ref.current?.unloadAsync().catch(() => {}); }, []);
  async function toggle() {
    try {
      if (playing) { await ref.current?.stopAsync(); setPlaying(false); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      if (!ref.current) {
        const { sound } = await Audio.Sound.createAsync({ uri: url });
        sound.setOnPlaybackStatusUpdate((st: any) => { if (st.didJustFinish) setPlaying(false); });
        ref.current = sound;
      }
      await ref.current.replayAsync(); setPlaying(true);
    } catch { setPlaying(false); }
  }
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.raised, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.hair }}>
      <TouchableOpacity onPress={toggle} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: C.primary, alignItems: "center", justifyContent: "center", borderBottomWidth: 3, borderBottomColor: C.primaryDown }}>
        {playing ? <Pause size={16} color="#fff" /> : <Play size={16} color="#fff" />}
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: F.title, fontSize: 14.5, color: C.ink }} numberOfLines={1}>{title}</Text>
        <Text style={{ fontFamily: F.med, fontSize: 12.5, color: C.ink2 }}>{meta}</Text>
      </View>
    </View>
  );
}
export function Showreel({ token }: { token: string }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { Api.showreel(token).then(setData).catch(() => {}); }, []);
  if (!data) return null;
  if (!data.clips.length) return <Text style={{ color: C.ink2, fontSize: 13, paddingHorizontal: 4 }}>Luyện đạt vài bài là clip hay của bạn sẽ vào đây — thành showreel MC để khoe 🎤</Text>;
  return (
    <View>
      <Text style={{ fontFamily: F.med, fontSize: 13, color: C.ink2, marginBottom: 8 }}>{data.total_passed} bài đạt · {data.clips.length} clip gần đây</Text>
      {data.clips.map((c: any) => (
        <ClipPlayer key={c.clip_id} url={c.audio_url} title={c.title}
          meta={`${Math.round(c.wpm)} từ/phút · ${c.fillers} từ đệm`} />
      ))}
    </View>
  );
}

// ===== CHỨNG NHẬN (C3) =====
export function Certificates({ token }: { token: string }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { Api.certificates(token).then(setData).catch(() => {}); }, []);
  if (!data) return null;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {data.certificates.map((c: any) => (
        <View key={c.path_id} style={{ width: "48%", backgroundColor: c.earned ? "#FFF3DA" : C.raised, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: c.earned ? C.spot : C.hair, opacity: c.earned ? 1 : 0.75 }}>
          <Cert size={26} color={c.earned ? "#B8860B" : C.ink2} />
          <Text style={{ fontFamily: F.title, fontSize: 14, color: C.ink, marginTop: 6 }} numberOfLines={1}>{c.genre}</Text>
          <Text style={{ fontFamily: F.med, fontSize: 12, color: C.ink2, marginTop: 2 }}>{c.earned ? "Đã hoàn thành 🎓" : `${c.done}/${c.total} bài`}</Text>
        </View>
      ))}
    </View>
  );
}

// ===== ÔN BÀI YẾU (D1) — chip trên màn Lộ trình =====
export function WeakChip({ token, onPick }: { token: string; onPick: (lessonId: string) => void }) {
  const [weak, setWeak] = useState<any[]>([]);
  useEffect(() => { Api.weak(token).then((d) => setWeak(d.weak)).catch(() => {}); }, []);
  if (!weak.length) return null;
  return (
    <TouchableOpacity onPress={() => onPick(weak[0].lesson_id)}
      style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFF0EC", borderRadius: 14, padding: 12, marginHorizontal: 16, marginTop: 10, borderWidth: 1, borderColor: "#F5D5CC" }}>
      <Dumbbell size={20} color="#C7462F" />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: F.title, fontSize: 14, color: "#8a3d33" }}>Ôn lại điểm yếu</Text>
        <Text style={{ fontFamily: F.med, fontSize: 12.5, color: "#A5685E" }}>{weak.length} bài cần luyện lại · "{weak[0].title}"</Text>
      </View>
      <Text style={{ fontFamily: F.title, color: "#C7462F", fontSize: 18 }}>›</Text>
    </TouchableOpacity>
  );
}

// ===== THỬ THÁCH MC TUẦN (C2) — màn riêng: chủ đề + nộp clip + nghe + tim =====
import { submitChallenge } from "./api";
import * as Haptics from "expo-haptics";
import { setRecording as setRecAudio } from "./sound";

export function ChallengeScreen({ token, onClose }: { token: string; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [rec, setRec] = useState(false);
  const [busy, setBusy] = useState(false);
  const recRef = useRef<Audio.Recording | null>(null);
  async function load() { try { setData(await Api.challenge(token)); } catch {} }
  useEffect(() => { load(); }, []);
  useEffect(() => () => { setRecAudio(false); recRef.current?.stopAndUnloadAsync().catch(() => {}); }, []);

  async function startRec() {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      setRecAudio(true);
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recRef.current = recording; setRec(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } catch { setRecAudio(false); }
  }
  async function stopSubmit() {
    const r = recRef.current; if (!r) return;
    setRec(false); setBusy(true);
    try {
      await r.stopAndUnloadAsync(); setRecAudio(false);
      const uri = r.getURI(); recRef.current = null;
      if (uri) { await submitChallenge(token, uri); await load(); }
    } catch {}
    setBusy(false);
  }
  async function like(id: string) {
    try { await Api.likeEntry(token, id); await load(); Haptics.selectionAsync().catch(() => {}); } catch {}
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.base }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingTop: 56, paddingHorizontal: 16, paddingBottom: 8 }}>
          <TouchableOpacity onPress={onClose} style={{ padding: 4 }}><X size={22} color={C.ink} /></TouchableOpacity>
          <Text style={{ flex: 1, textAlign: "center", fontFamily: F.displayX, fontSize: 19, color: C.ink, marginRight: 26 }}>Thử thách MC tuần</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {!data ? <ActivityIndicator color={C.primary} style={{ marginTop: 30 }} /> : (<>
            <View style={{ backgroundColor: C.ink, borderRadius: 18, padding: 16, borderBottomWidth: 5, borderBottomColor: "#241A2E" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Misa mood="covu" size={52} accessory="bowtie" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: F.semi, fontSize: 12.5, color: "#C9B8D6", letterSpacing: 0.5 }}>CHỦ ĐỀ TUẦN NÀY</Text>
                  <Text style={{ fontFamily: F.displayX, fontSize: 19, color: C.spot, marginTop: 1 }}>{data.title}</Text>
                </View>
              </View>
              <Text style={{ fontFamily: F.body, fontSize: 15, color: "#E9DFF2", lineHeight: 23, marginTop: 10 }}>{data.prompt}</Text>
            </View>

            {rec ? (
              <Btn3D kind="primary" label="Dừng & nộp bài dự thi" onPress={stopSubmit} icon={<View style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: "#fff" }} />} />
            ) : (
              <Btn3D kind="gold" loading={busy} label={data.my_entry ? "Thu lại bài dự thi" : "Ghi & nộp bài dự thi"} onPress={startRec} />
            )}
            {data.my_entry && !rec && <Text style={{ textAlign: "center", color: "#2E9668", fontFamily: F.semi, fontSize: 13, marginTop: 6 }}>✓ Bạn đã có bài dự thi tuần này</Text>}

            <Text style={{ fontFamily: F.displayX, fontSize: 17, color: C.ink, marginTop: 20, marginBottom: 8 }}>Bài dự thi ({data.entries.length})</Text>
            {data.entries.length === 0 && <Text style={{ color: C.ink2, fontSize: 13 }}>Chưa ai nộp — hãy là người mở màn nhé! 🎤</Text>}
            {data.entries.map((e: any) => (
              <ChallengeEntryRow key={e.id} entry={e} onLike={() => like(e.id)} />
            ))}
          </>)}
        </ScrollView>
      </View>
    </Modal>
  );
}

function ChallengeEntryRow({ entry, onLike }: { entry: any; onLike: () => void }) {
  const [playing, setPlaying] = useState(false);
  const ref = useRef<Audio.Sound | null>(null);
  useEffect(() => () => { ref.current?.unloadAsync().catch(() => {}); }, []);
  async function toggle() {
    try {
      if (playing) { await ref.current?.stopAsync(); setPlaying(false); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      if (!ref.current) {
        const { sound } = await Audio.Sound.createAsync({ uri: entry.audio_url });
        sound.setOnPlaybackStatusUpdate((st: any) => { if (st.didJustFinish) setPlaying(false); });
        ref.current = sound;
      }
      await ref.current.replayAsync(); setPlaying(true);
    } catch { setPlaying(false); }
  }
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: entry.award ? "#FFF3DA" : C.raised, borderRadius: 14, padding: 11, marginBottom: 8, borderWidth: 1, borderColor: entry.award ? C.spot : C.hair }}>
      <TouchableOpacity onPress={toggle} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.primary, alignItems: "center", justifyContent: "center", borderBottomWidth: 3, borderBottomColor: C.primaryDown }}>
        {playing ? <Pause size={15} color="#fff" /> : <Play size={15} color="#fff" />}
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: F.title, fontSize: 14.5, color: C.ink }} numberOfLines={1}>{entry.name}{entry.is_me ? " (bạn)" : ""}</Text>
        {entry.award === "top" && <Text style={{ fontFamily: F.semi, fontSize: 12, color: "#B8860B" }}>🏆 MC tuyên dương</Text>}
      </View>
      <TouchableOpacity onPress={onLike} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 4 }}>
        <Heart size={20} color="#FF6B5B" fill={entry.likes > 0} />
        <Text style={{ fontFamily: F.title, fontSize: 14, color: C.ink2 }}>{entry.likes}</Text>
      </TouchableOpacity>
    </View>
  );
}
