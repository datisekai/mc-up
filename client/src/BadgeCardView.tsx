// BadgeCardView.tsx — Thẻ MC bảo chứng "chụp-để-khoe" (P1-the-bao-chung-spec).
// 3 skin (cream/night/coral) · con dấu ĐÃ XÁC THỰC · waveform giọng MC · nút Chia sẻ
// (view-shot chụp thẻ → share-sheet native). Suy biến duyên dáng khi thiếu dữ liệu.
import { useRef, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Audio } from "expo-av";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";
import QRCode from "react-native-qrcode-svg";
import { C, F } from "./theme";
import { Check, Mic, Pause, Play } from "./icons";

type StatPoint = { speed_wpm: number; filler_count: number };
export type BadgeData = {
  mc_name: string; mc_title?: string | null; note: string; audio_url?: string | null;
  stats?: { before: StatPoint; after: StatPoint } | null;
  transcript?: string | null;  // "Xem bản chữ" — ASR giọng MC (best-effort)
};

const APP_URL = "https://mcup.fun"; // landing/deep-link — đổi khi có domain thật

type Skin = "cream" | "night" | "coral";
const SKINS: Record<Skin, { bg: string; raised: string; text: string; sub: string; quote: string; accent: string; hair: string; ok: string }> = {
  cream: { bg: "#FFF8F0", raised: "#FFFFFF", text: "#3B2A4A", sub: "#7A6E82", quote: "#3B2A4A", accent: "#FF6B5B", hair: "#EDE3D6", ok: "#1f8f63" },
  night: { bg: "#2E2239", raised: "#3A2C48", text: "#F5EEFA", sub: "#C9BBD6", quote: "#FFE9C7", accent: "#FFC24B", hair: "#4A3A5C", ok: "#7FE3B8" },
  coral: { bg: "#FF6B5B", raised: "#FF8073", text: "#FFF3E9", sub: "#FFE0D6", quote: "#FFFFFF", accent: "#FFC24B", hair: "#FF8073", ok: "#FFFFFF" },
};
const SKIN_LABEL: Record<Skin, string> = { cream: "Kem sân khấu", night: "Đèn đêm", coral: "San hô rực" };

// waveform tĩnh — chiều cao ổn định theo nội dung note (không random mỗi render)
function bars(seed: string, n = 36): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0xffff;
  return Array.from({ length: n }, (_, i) => {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    return 6 + (h % 100) / 100 * 20;
  });
}

export default function BadgeCardView({ badge, audioBase }: { badge: BadgeData; audioBase: string }) {
  const [skin, setSkin] = useState<Skin>("cream");
  const [playing, setPlaying] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const cardRef = useRef<View>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const k = SKINS[skin];
  const wave = bars(badge.note);

  async function togglePlay() {
    if (!badge.audio_url) return;
    try {
      if (playing) { await soundRef.current?.stopAsync(); setPlaying(false); return; }
      // Người dùng CHỦ ĐỘNG bấm nghe → phát được cả khi máy gạt im lặng (chuẩn app nghe audio)
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri: audioBase + badge.audio_url });
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((s: any) => { if (s.didJustFinish) setPlaying(false); });
      await sound.playAsync();
      setPlaying(true);
    } catch (e: any) {
      Alert.alert("Lỗi", "Không phát được: " + e.message);
    }
  }

  async function share() {
    try {
      const uri = await captureRef(cardRef, { format: "png", quality: 1 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Khoe Thẻ bảo chứng" });
      }
    } catch (e: any) {
      Alert.alert("Chia sẻ", "Chưa chia sẻ được: " + e.message);
    }
  }

  const initial = (badge.mc_name || "M").replace(/^MC /, "")[0];

  return (
    <View style={{ marginBottom: 14 }}>
      <View ref={cardRef} collapsable={false} style={[st.card, { backgroundColor: k.bg }]}>
        <View style={st.brandRow}>
          <Text style={[st.brand, { color: k.accent }]}>McUp</Text>
          <Text style={[st.cardLabel, { color: k.sub }]}>THẺ BẢO CHỨNG</Text>
          <View style={{ alignItems: "center" }}>
            <View style={st.seal}><Check size={18} color="#5a3d00" /></View>
            <Text style={[st.sealT, { color: k.sub }]}>ĐÃ XÁC THỰC</Text>
          </View>
        </View>

        <View style={st.mcRow}>
          <View style={st.avatar}><Text style={st.avatarT}>{initial}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={[st.mcName, { color: k.text }]}>{badge.mc_name}</Text>
            {badge.mc_title ? <Text style={[st.mcTitle, { color: k.sub }]}>{badge.mc_title}</Text> : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
              <Mic size={12} color={k.accent} />
              <Text style={[st.heard, { color: k.accent }]}>MC thật đã nghe bạn dẫn</Text>
            </View>
          </View>
        </View>

        <Text style={[st.quote, { color: k.quote }]}>“{badge.note}”</Text>

        {badge.stats?.before && badge.stats?.after ? (
          <View style={[st.statsBox, { backgroundColor: k.raised }]}>
            <Text style={[st.statsLabel, { color: k.sub }]}>TIẾN BỘ SAU KHI LUYỆN</Text>
            <View style={st.statRow}>
              <Text style={[st.statK, { color: k.sub }]}>Tốc độ</Text>
              <Text style={[st.statV, { color: k.text }]}>
                <Text style={{ color: k.sub, textDecorationLine: "line-through" }}>{badge.stats.before.speed_wpm}</Text>
                {"  →  "}
                <Text style={{ color: k.ok, fontFamily: F.title }}>{badge.stats.after.speed_wpm}</Text>
                {" chữ/phút"}
              </Text>
            </View>
            <View style={st.statRow}>
              <Text style={[st.statK, { color: k.sub }]}>Từ đệm 'ừm/à'</Text>
              <Text style={[st.statV, { color: k.text }]}>
                <Text style={{ color: k.sub, textDecorationLine: "line-through" }}>{badge.stats.before.filler_count}</Text>
                {"  →  "}
                <Text style={{ color: k.ok, fontFamily: F.title }}>{badge.stats.after.filler_count}</Text>
                {" lần"}
              </Text>
            </View>
          </View>
        ) : null}

        {badge.audio_url ? (
          <View style={[st.voiceBox, { backgroundColor: k.raised }]}>
            <TouchableOpacity style={[st.playBtn, { backgroundColor: k.accent }]} onPress={togglePlay}
              accessibilityLabel={playing ? "Dừng giọng MC" : "Nghe giọng MC"}>
              {playing ? <Pause size={15} color="#fff" /> : <Play size={15} color="#fff" />}
            </TouchableOpacity>
            <View style={st.waveRow}>
              {wave.map((h, i) => (
                <View key={i} style={[st.waveBar, { height: h, backgroundColor: k.accent, opacity: playing ? 1 : 0.4 }]} />
              ))}
            </View>
          </View>
        ) : null}
        {badge.transcript ? (
          <TouchableOpacity onPress={() => setShowTranscript(!showTranscript)}
            accessibilityLabel={showTranscript ? "Ẩn bản chữ giọng MC" : "Xem bản chữ giọng MC"}>
            <Text style={[st.transcriptLink, { color: k.sub }]}>
              {showTranscript ? "Ẩn bản chữ ▴" : "Xem bản chữ ▾"}
            </Text>
          </TouchableOpacity>
        ) : null}
        {showTranscript && badge.transcript ? (
          <View style={[st.transcriptBox, { backgroundColor: k.raised }]}>
            <Text style={[st.transcriptT, { color: k.text }]}>{badge.transcript}</Text>
          </View>
        ) : null}

        <View style={[st.footer, { borderTopColor: k.hair }]}>
          <Text style={[st.watermark, { color: k.accent }]}>Luyện MC cùng McUp · @mcup</Text>
          <View style={st.qr}>
            <QRCode value={APP_URL} size={32} backgroundColor="#FFFFFF" color="#3B2A4A" />
          </View>
        </View>
      </View>

      <View style={st.skinRow}>
        {(Object.keys(SKINS) as Skin[]).map((s) => (
          <TouchableOpacity key={s} onPress={() => setSkin(s)} style={[st.skinChip, skin === s && st.skinChipOn]}>
            <Text style={[st.skinT, skin === s && { color: "#fff" }]}>{SKIN_LABEL[s]}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={st.shareBtn} onPress={share} accessibilityLabel="Chia sẻ thẻ bảo chứng">
        <Text style={st.shareT}>Khoe thẻ này ✦ Chia sẻ</Text>
      </TouchableOpacity>
    </View>
  );
}

const st = StyleSheet.create({
  card: { borderRadius: 22, padding: 18 },
  brandRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brand: { fontSize: 18, fontFamily: F.displayX, letterSpacing: -0.5 },
  cardLabel: { fontSize: 10, fontFamily: F.title, letterSpacing: 1.5 },
  seal: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#FFC24B", alignItems: "center", justifyContent: "center" },
  sealT: { fontSize: 7.5, fontWeight: "800", letterSpacing: 0.5, marginTop: 2 },
  mcRow: { flexDirection: "row", alignItems: "center", gap: 11, marginTop: 16 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#FFC24B", alignItems: "center", justifyContent: "center" },
  avatarT: { fontSize: 20, fontWeight: "800", color: "#5a3d00" },
  mcName: { fontSize: 16, fontFamily: F.title },
  mcTitle: { fontSize: 12, fontFamily: F.body },
  heard: { fontSize: 11, fontFamily: F.semi },
  quote: { fontSize: 16, lineHeight: 24, fontFamily: F.body, fontStyle: "italic", marginTop: 14 },
  statsBox: { borderRadius: 14, padding: 12, marginTop: 12 },
  statsLabel: { fontSize: 9.5, fontFamily: F.title, letterSpacing: 1, marginBottom: 6 },
  statRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 3 },
  statK: { fontSize: 13, fontFamily: F.body },
  statV: { fontSize: 13, fontFamily: F.med },
  voiceBox: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, padding: 10, marginTop: 12 },
  transcriptLink: { fontSize: 11.5, fontFamily: F.semi, textDecorationLine: "underline", textAlign: "right", marginTop: 6 },
  transcriptBox: { borderRadius: 12, padding: 11, marginTop: 6 },
  transcriptT: { fontSize: 13, fontFamily: F.body, lineHeight: 19 },
  playBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  playT: { color: "#fff", fontSize: 13, fontWeight: "800" },
  waveRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 2, height: 30 },
  waveBar: { flex: 1, borderRadius: 2 },
  footer: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginTop: 15, paddingTop: 12, borderTopWidth: 1,
  },
  watermark: { fontSize: 11, fontFamily: F.semi },
  // QR luôn nền TRẮNG để quét được trên mọi skin
  qr: { width: 42, height: 42, borderRadius: 8, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  skinRow: { flexDirection: "row", gap: 7, marginTop: 10, justifyContent: "center" },
  skinChip: { backgroundColor: C.sunken, paddingHorizontal: 13, paddingVertical: 7, borderRadius: 999 },
  skinChipOn: { backgroundColor: C.primary },
  skinT: { fontSize: 11.5, fontWeight: "800", color: C.ink2 },
  shareBtn: { backgroundColor: C.spot, borderRadius: 999, padding: 13, alignItems: "center", marginTop: 8 },
  shareT: { color: "#5a3d00", fontWeight: "800" },
});
