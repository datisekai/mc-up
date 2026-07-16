// Bộ máy giữ chân (client) — nhiệm vụ ngày · giải đấu tuần · shop · showreel · chứng nhận · ôn bài yếu.
// Đi theo style "Sân khấu ấm 2.0": Btn3D, sticker icon, Misa, nút phím đàn.
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Audio } from "expo-av";
import { C, F, T } from "./theme";
import { FadeInUp, Skeleton, SkeletonList, useCountUp } from "./anim";
import { Btn3D, ProgressBar } from "./ui";
import { Api } from "./api";
import Misa, { MisaAccessory, setMisaSkin } from "./Misa";
import { Cert, Check, Coin, Dumbbell, Heart, Medal, Pause, Play, Snow, StarSticker, Target, TicketSticker, X } from "./icons";

const LEAGUE_COLORS = ["#C77F00", "#B4ABA0", "#FFC24B", "#D8CFC0", "#ECD9A6"];  // đồng·bạc·vàng·bạch kim·kim cương — hệ ấm/trung tính (V5)

// ===== NHIỆM VỤ NGÀY (A2) — thanh GỌN 1 dòng, bấm mở bottom-sheet =====
export function QuestsCard({ token, onCoins, noMargin }: { token: string; onCoins?: (n: number) => void; noMargin?: boolean }) {
  const [data, setData] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  async function load() { try { setData(await Api.quests(token)); } catch {} }
  useEffect(() => { load(); }, []);
  if (!data || data.all_claimed) return null; // xong hết thì ẩn cho gọn

  const done = data.quests.filter((q: any) => q.done && q.claimed).length;
  const claimable = data.quests.filter((q: any) => q.done && !q.claimed);
  const claimCoins = claimable.reduce((a: number, q: any) => a + q.coins, 0);

  async function claim(id: string) {
    setBusy(id);
    try { const r = await Api.claimQuest(token, id); if (r.ok) { onCoins?.(r.coins); await load(); } } catch {}
    setBusy(null);
  }

  return (
    <>
      {/* thanh gọn trên bản đồ */}
      <TouchableOpacity onPress={() => setOpen(true)} activeOpacity={0.8}
        style={{ flex: noMargin ? 1 : undefined, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.raised, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, marginHorizontal: noMargin ? 0 : 16, marginTop: noMargin ? 0 : 10, borderWidth: 1, borderColor: claimable.length ? C.spot : C.hair }}>
        <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: "#FFF3DA", alignItems: "center", justifyContent: "center" }}>
          <Target size={17} color="#B8860B" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: F.title, fontSize: 14, color: C.ink }}>Nhiệm vụ hôm nay</Text>
          <Text style={{ fontFamily: F.med, fontSize: 12, color: C.ink2 }}>{done}/{data.quests.length} xong</Text>
        </View>
        {claimable.length ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: C.spot, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
            <Coin size={14} /><Text style={{ fontFamily: F.title, fontSize: 13, color: "#5a3d00" }}>+{claimCoins}</Text>
          </View>
        ) : (
          <Text style={{ color: C.ink2, fontFamily: F.title, fontSize: 18 }}>›</Text>
        )}
      </TouchableOpacity>

      {/* bottom-sheet đầy đủ */}
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(59,42,74,0.4)", justifyContent: "flex-end" }}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setOpen(false)} />
          <View style={{ backgroundColor: C.base, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 34 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <Misa mood="covu" size={46} still />
              <Text style={{ fontFamily: F.displayX, fontSize: 20, color: C.ink }}>Nhiệm vụ hôm nay</Text>
            </View>
            {data.quests.map((q: any) => (
              <View key={q.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: F.semi, fontSize: 14.5, color: q.claimed ? C.ink2 : C.ink }}>{q.label}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <ProgressBar value={q.progress / q.target} height={8} style={{ flex: 1 }} />
                    <Text style={{ fontSize: 12, fontFamily: F.med, color: C.ink2 }}>{q.progress}/{q.target}</Text>
                  </View>
                </View>
                {q.claimed ? (
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#E7F6EE", alignItems: "center", justifyContent: "center" }}><Check size={18} color="#2E9668" /></View>
                ) : q.done ? (
                  <TouchableOpacity onPress={() => claim(q.id)} disabled={!!busy}
                    style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: C.spot, borderRadius: 12, borderBottomWidth: 3, borderBottomColor: "#E09B18", paddingHorizontal: 11, paddingVertical: 7 }}>
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
            <Btn3D kind="white" label="Đóng" onPress={() => setOpen(false)} />
          </View>
        </View>
      </Modal>
    </>
  );
}

// ===== BXH GIẢI ĐẤU TUẦN (A4) — thay bảng tĩnh trong tab Xếp hạng =====
export function LeagueBoard({ token }: { token: string }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { Api.league(token).then(setData).catch(() => {}); }, []);
  if (!data) return <View style={{ paddingTop: 10 }}><Skeleton w={66} h={66} r={33} style={{ alignSelf: "center", marginBottom: 10 }} /><SkeletonList rows={6} /></View>;
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
        <FadeInUp key={i} delay={i * 45}><View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 9, paddingHorizontal: 10, borderRadius: 12, marginBottom: 4,
          backgroundColor: e.is_me ? "#FFF3DA" : "transparent", borderWidth: e.is_me ? 1.5 : 0, borderColor: C.spot }}>
          <View style={{ width: 28, alignItems: "center" }}>
            {e.promote ? <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#E7F6EE", alignItems: "center", justifyContent: "center" }}><Text style={{ fontFamily: F.displayX, fontSize: 13, color: "#2E9668" }}>{e.rank}</Text></View>
              : <Text style={{ fontFamily: F.displayX, fontSize: 15, color: C.ink2 }}>{e.rank}</Text>}
          </View>
          <Text style={{ flex: 1, fontFamily: e.is_me ? F.title : F.semi, fontSize: 15, color: C.ink, marginLeft: 8 }} numberOfLines={1}>{e.name}{e.is_me ? " (bạn)" : ""}</Text>
          <StarSticker size={15} /><Text style={{ fontFamily: F.title, fontSize: 14, marginLeft: 3 }}>{e.league_xp}</Text>
        </View></FadeInUp>
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

// ===== SHOP dạng TAB (B1) — trợ giúp + trang trí Misa, có preview + trang bị =====
const CAT = [
  { key: "outfits", label: "Trang phục", },
  { key: "colors", label: "Màu Misa", },
  { key: "powerups", label: "Trợ giúp", },
];
export function ShopScreen({ token, coins, onCoins, misaColor, misaOutfit, onEquip, refreshControl }: {
  token: string; coins: number; onCoins: (n: number) => void;
  misaColor?: string; misaOutfit?: string | null; onEquip?: (color?: string, outfit?: string | null) => void; refreshControl?: any;
}) {
  const [data, setData] = useState<any>(null);
  const [bal, setBal] = useState(coins);
  const [cat, setCat] = useState("outfits");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  // preview: Misa mặc đúng thứ đang chọn
  const [prevColor, setPrevColor] = useState(misaColor ?? "coral");
  const [prevOutfit, setPrevOutfit] = useState<string | null>(misaOutfit ?? null);

  async function load() {
    try { const d = await Api.shop(token); setData(d); setBal(d.coins); onCoins(d.coins);
      setPrevColor(d.misa_color); setPrevOutfit(d.misa_outfit); } catch {}
  }
  useEffect(() => { load(); }, []);

  async function act(item: any) {
    setBusy(item.id); setMsg("");
    try {
      if (item.owned || item.cost === 0) {
        // đã có → trang bị
        const kind = item.kind === "color" ? "color" : "outfit";
        const r = await Api.equipItem(token, item.id, kind);
        setPrevColor(r.misa_color); setPrevOutfit(r.misa_outfit);
        setMisaSkin(r.misa_color, r.misa_outfit); onEquip?.(r.misa_color, r.misa_outfit);
      } else {
        const r = await Api.buyItem(token, item.id);
        setBal(r.coins); onCoins(r.coins); setMsg("Đã mua & mặc luôn! 🎉");
        await load();
        if (item.kind === "color") { setPrevColor(item.id); setMisaSkin(item.id, prevOutfit); onEquip?.(item.id, prevOutfit); }
        if (item.kind === "outfit") { setPrevOutfit(item.id); setMisaSkin(prevColor, item.id); onEquip?.(prevColor, item.id); }
      }
    } catch (e: any) { setMsg(e.message || "Chưa được"); }
    setBusy(null);
  }
  async function takeOff() {
    try { const r = await Api.equipItem(token, "", "outfit_off"); setPrevOutfit(null); setMisaSkin(prevColor, null); onEquip?.(prevColor, null); await load(); } catch {}
  }

  if (!data) return <View style={{ padding: 16 }}><Skeleton w={120} h={156} r={20} style={{ alignSelf: "center", marginBottom: 16 }} /><SkeletonList rows={4} avatar={false} /></View>;
  const list = cat === "colors" ? data.colors : cat === "outfits" ? data.outfits : data.powerups;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} refreshControl={refreshControl}>
      {/* preview Misa lớn + số dư */}
      <View style={{ alignItems: "center", backgroundColor: C.raised, borderRadius: 20, paddingVertical: 16, borderWidth: 1, borderColor: C.hair }}>
        <Misa mood="anmung" size={120} still color={prevColor} accessory={(prevOutfit as MisaAccessory) ?? null} />
        {prevOutfit ? <TouchableOpacity onPress={takeOff}><Text style={{ color: C.ink2, fontSize: 12.5, fontFamily: F.semi, textDecorationLine: "underline", marginTop: 2 }}>Cởi phụ kiện</Text></TouchableOpacity> : null}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FFF3DA", borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 }}>
          <Coin size={22} /><Text style={{ fontFamily: F.displayX, fontSize: 19, color: "#8a5a13" }}>{bal}</Text>
          <Text style={{ fontFamily: F.med, fontSize: 13, color: "#8a5a13" }}>xu</Text>
        </View>
      </View>
      {!!msg && <Text style={{ textAlign: "center", color: C.primary, fontFamily: F.semi, fontSize: 13, marginTop: 6 }}>{msg}</Text>}

      {/* chọn nhóm */}
      <View style={{ flexDirection: "row", gap: 8, marginTop: 14, marginBottom: 4 }}>
        {CAT.map((cc) => (
          <TouchableOpacity key={cc.key} onPress={() => setCat(cc.key)}
            style={{ flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 12, backgroundColor: cat === cc.key ? C.ink : C.sunken }}>
            <Text style={{ fontFamily: F.title, fontSize: 13.5, color: cat === cc.key ? "#fff" : C.ink2 }}>{cc.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {cat === "powerups" ? list.map((it: any) => (
        <View key={it.id} style={st_row}>
          <View style={{ width: 46, height: 46, alignItems: "center", justifyContent: "center" }}>{SHOP_ICON[it.icon] ?? <Coin size={26} />}</View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.title, fontSize: 15, color: C.ink }}>{it.label}</Text>
            <Text style={{ fontFamily: F.body, fontSize: 12.5, color: C.ink2 }}>{it.desc}</Text>
          </View>
          <BuyBtn label={String(it.cost)} disabled={busy === it.id || bal < it.cost} busy={busy === it.id} onPress={() => act(it)} />
        </View>
      )) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 6 }}>
          {list.map((it: any) => {
            const equipped = it.equipped;
            const owned = it.owned || it.cost === 0;
            return (
              <View key={it.id} style={{ width: "31%", alignItems: "center", backgroundColor: equipped ? "#FFF3DA" : C.raised, borderRadius: 14, padding: 8, borderWidth: equipped ? 2 : 1, borderColor: equipped ? C.spot : C.hair }}>
                <View style={{ height: 78, justifyContent: "center" }}>
                  {cat === "colors"
                    ? <Misa mood="chao" size={62} still color={it.id} accessory={null} />
                    : <Misa mood="chao" size={62} still color={prevColor} accessory={it.id as MisaAccessory} />}
                </View>
                <Text style={{ fontFamily: F.semi, fontSize: 12, color: C.ink, marginTop: 2 }} numberOfLines={1}>{it.label}</Text>
                <TouchableOpacity onPress={() => act(it)} disabled={busy === it.id || (!owned && bal < it.cost)}
                  style={{ marginTop: 5, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, alignSelf: "stretch",
                    backgroundColor: equipped ? C.sunken : owned ? C.success : (bal < it.cost ? C.sunken : C.spot),
                    borderRadius: 10, borderBottomWidth: equipped ? 0 : 3, borderBottomColor: owned ? C.successDown : "#E09B18", paddingVertical: 6 }}>
                  {busy === it.id ? <ActivityIndicator size="small" color="#5a3d00" />
                    : equipped ? <Text style={{ fontFamily: F.title, fontSize: 12, color: C.ink2 }}>Đang mặc</Text>
                    : owned ? <Text style={{ fontFamily: F.title, fontSize: 12, color: "#fff" }}>Mặc</Text>
                    : (<><Coin size={13} /><Text style={{ fontFamily: F.title, fontSize: 12.5, color: bal < it.cost ? C.ink2 : "#5a3d00" }}>{it.cost}</Text></>)}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
const st_row: any = { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.raised, borderRadius: 16, padding: 12, marginTop: 8, borderWidth: 1, borderColor: C.hair };
function BuyBtn({ label, onPress, disabled, busy }: any) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled}
      style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: disabled && !busy ? C.sunken : C.spot, borderRadius: 12, borderBottomWidth: disabled && !busy ? 0 : 3, borderBottomColor: "#E09B18", paddingHorizontal: 13, paddingVertical: 9 }}>
      {busy ? <ActivityIndicator size="small" color="#5a3d00" /> : <Coin size={15} />}
      <Text style={{ fontFamily: F.title, fontSize: 14, color: disabled && !busy ? C.ink2 : "#5a3d00" }}>{label}</Text>
    </TouchableOpacity>
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

// ===== ÔN BÀI YẾU (D1) — nút GỌN đứng cùng hàng nhiệm vụ =====
export function WeakChip({ token, onPick, compact }: { token: string; onPick: (lessonId: string) => void; compact?: boolean }) {
  const [weak, setWeak] = useState<any[]>([]);
  useEffect(() => { Api.weak(token).then((d) => setWeak(d.weak)).catch(() => {}); }, []);
  if (!weak.length) return null;
  if (compact) {
    return (
      <TouchableOpacity onPress={() => onPick(weak[0].lesson_id)}
        style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: C.primarySoft, borderWidth: 1, borderColor: C.hair, alignItems: "center", justifyContent: "center" }}>
        <Dumbbell size={20} color={C.primary} />
        <View style={{ position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}>
          <Text style={{ color: "#fff", fontFamily: F.title, fontSize: 11 }}>{weak.length}</Text>
        </View>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity onPress={() => onPick(weak[0].lesson_id)}
      style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.primarySoft, borderRadius: 14, padding: 12, marginHorizontal: 16, marginTop: 10, borderWidth: 1, borderColor: C.hair }}>
      <Dumbbell size={20} color={C.primary} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: F.title, fontSize: 14, color: C.ink }}>Ôn lại điểm yếu</Text>
        <Text style={{ fontFamily: F.med, fontSize: 12.5, color: C.ink2 }}>{weak.length} bài cần luyện lại</Text>
      </View>
      <Text style={{ fontFamily: F.title, color: C.primary, fontSize: 18 }}>›</Text>
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
          {!data ? <View><Skeleton w={"100%"} h={120} r={18} style={{ marginBottom: 12 }} /><SkeletonList rows={3} /></View> : (<>
            <View style={{ backgroundColor: C.ink, borderRadius: 18, padding: 16, borderBottomWidth: 5, borderBottomColor: "#241A2E" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Misa mood="covu" size={52} accessory="bowtie" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: F.semi, fontSize: 12.5, color: "#CFC3B0", letterSpacing: 0.5 }}>CHỦ ĐỀ TUẦN NÀY</Text>
                  <Text style={{ fontFamily: F.displayX, fontSize: 19, color: C.spot, marginTop: 1 }}>{data.title}</Text>
                </View>
              </View>
              <Text style={{ fontFamily: F.body, fontSize: 15, color: "#EDE4D2", lineHeight: 23, marginTop: 10 }}>{data.prompt}</Text>
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

// ===== MỜI BẠN (Referral) =====
import { Share } from "react-native";
export function ReferralSheet({ token, onClose }: { token: string; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { Api.referral(token).then(setData).catch(() => {}); }, []);
  async function share() {
    if (!data) return;
    try { await Share.share({ message: `Học làm MC cùng mình trên McUp nhé! Dùng mã ${data.code} khi vào app để cả hai được tặng xu 🎁 ${data.share_url}` }); } catch {}
  }
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(59,42,74,0.4)", justifyContent: "flex-end" }}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} />
        <View style={{ backgroundColor: C.base, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 34, alignItems: "center" }}>
          <Misa mood="anmung" size={92} />
          <Text style={{ fontFamily: F.displayX, fontSize: 21, color: C.ink, marginTop: 2 }}>Mời bạn — nhận xu</Text>
          <Text style={{ fontFamily: F.med, fontSize: 13.5, color: C.ink2, textAlign: "center", marginTop: 4, paddingHorizontal: 16 }}>
            {data ? `Bạn bè đạt bài đầu tiên: bạn +${data.referrer_reward} xu, họ +${data.referee_reward} xu` : "..."}
          </Text>
          {data && (<>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.raised, borderRadius: 14, borderWidth: 2, borderColor: C.spot, borderStyle: "dashed", paddingHorizontal: 20, paddingVertical: 14, marginTop: 16 }}>
              <Text style={{ fontFamily: F.displayX, fontSize: 26, color: C.primary, letterSpacing: 3 }}>{data.code}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 18, marginTop: 14 }}>
              <View style={{ alignItems: "center" }}><Text style={{ fontFamily: F.displayX, fontSize: 20, color: C.ink }}>{data.invited}</Text><Text style={{ fontSize: 12, color: C.ink2 }}>đã mời</Text></View>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 3 }}><Coin size={18} /><Text style={{ fontFamily: F.displayX, fontSize: 20, color: "#8a5a13" }}>{data.coins_earned}</Text></View>
            </View>
            <Btn3D kind="gold" label="Chia sẻ lời mời" onPress={share} style={{ alignSelf: "stretch", marginTop: 16 }} icon={<Heart size={16} color="#5a3d00" fill />} />
          </>)}
          <Btn3D kind="white" label="Đóng" onPress={onClose} style={{ alignSelf: "stretch" }} />
        </View>
      </View>
    </Modal>
  );
}

// ===== TOÀN CẢNH LỘ TRÌNH (V5-2) — xem bao quát các chặng, khỏi kéo map =====
import { Lock, MicSticker } from "./icons";
const SHOW_NAMES = ["MC lớp học", "Tiệc cưới & sự kiện", "Gala · Truyền hình"];
export function RouteOverview({ lessons, onPick, onClose }: { lessons: any[]; onPick: (lessonId: string) => void; onClose: () => void }) {
  // gom theo cấp độ (level) → chặng
  const chapters: { level: string; items: any[] }[] = [];
  lessons.forEach((l) => {
    const last = chapters[chapters.length - 1];
    if (!last || last.level !== l.level) chapters.push({ level: l.level, items: [l] });
    else last.items.push(l);
  });
  const firstOpen = lessons.find((l: any) => l.unlocked && !l.done);
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.base }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingTop: 56, paddingHorizontal: 16, paddingBottom: 8 }}>
          <TouchableOpacity onPress={onClose} style={{ padding: 4 }}><X size={22} color={C.ink} /></TouchableOpacity>
          <Text style={{ flex: 1, textAlign: "center", fontFamily: F.displayX, fontSize: 19, color: C.ink, marginRight: 26 }}>Toàn cảnh lộ trình</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {chapters.map((ch, ci) => {
            const done = ch.items.filter((l) => l.done).length;
            const started = ch.items.some((l) => l.unlocked || l.done);
            return (
              <View key={ci} style={{ backgroundColor: started ? C.raised : C.sunken, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.hair }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.spotSoft, alignItems: "center", justifyContent: "center" }}>
                    {started ? <MicSticker size={24} /> : <Lock size={20} color={C.ink3} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: F.semi, fontSize: 12, color: C.ink2 }}>CHẶNG {ci + 1} · SHOW</Text>
                    <Text style={{ fontFamily: F.displayX, fontSize: 16, color: started ? C.ink : C.ink3 }}>{SHOW_NAMES[ci] ?? ch.level}</Text>
                  </View>
                  <Text style={{ fontFamily: F.title, fontSize: 13, color: C.ink2 }}>{done}/{ch.items.length}</Text>
                </View>
                <ProgressBar value={done / ch.items.length} height={8} color={C.primary} />
                {/* các bài trong chặng — nút gọn, bấm vào bài mở được */}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {ch.items.map((l) => {
                    const open = l.unlocked && !l.done;
                    const isCurrent = firstOpen && l.id === firstOpen.id;
                    return (
                      <TouchableOpacity key={l.id} disabled={!l.unlocked && !l.done}
                        onPress={() => { onClose(); onPick(l.id); }}
                        style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center",
                          backgroundColor: l.done ? C.success : open ? "#fff" : "#EAE1D3",
                          borderWidth: isCurrent ? 2.5 : 0, borderColor: C.primary }}>
                        {l.done ? <Check size={16} color="#fff" /> : <Text style={{ fontFamily: F.title, fontSize: 12, color: open ? C.ink : C.ink3 }}>{l.buoi}</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })}
          {lessons.length === 0 && <Text style={{ color: C.ink2, textAlign: "center", padding: 20 }}>Chưa có bài — chọn thể loại khác nhé!</Text>}
        </ScrollView>
      </View>
    </Modal>
  );
}
