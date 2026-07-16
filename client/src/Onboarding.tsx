// Onboarding.tsx — onboarding "ấm" 5 bước (P2-onboarding-spec + toa thị giác Sally 06/07).
// Lớp thịt: minh hoạ sân khấu SVG · avatar social proof · chuyển bước trượt ·
// chip mục tiêu màu theo genre + CTA đổi màu (app "phản ứng với mình").
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo, Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";
import { Audio } from "expo-av";
import { C, F } from "./theme";
import { ChevronLeft, Fire, MapIcon, Mic, Star, Trophy } from "./icons";
import Misa from "./Misa";

export type OnboardPrefs = {
  goal: string;          // keyword khớp Genre: "" | "đám cưới" | "sự kiện" | "livestream" | "nhí"
  goalLabel: string;
  minsPerDay: number;
  remindSlot: string;    // Sáng | Trưa | Tối
  micGranted: boolean;
};

const GOALS = [
  { k: "", l: "Nói tự tin (nền tảng)", color: "#F2503C" },
  { k: "đám cưới", l: "MC đám cưới", color: "#E8697D" },
  { k: "sự kiện", l: "MC sự kiện", color: "#F0872E" },
  { k: "livestream", l: "MC livestream", color: "#7C5CBF" },
  { k: "nhí", l: "MC nhí", color: "#3FB984" },
];
const MINS = [3, 5, 10];
const SLOTS = ["Sáng", "Trưa", "Tối"];
const TOTAL = 5;
const AVATARS = [
  { i: "L", c: "#E8697D" }, { i: "Q", c: "#7C5CBF" }, { i: "H", c: "#F0872E" },
  { i: "M", c: "#3FB984" }, { i: "T", c: "#F2503C" },
];

// Minh hoạ "sân khấu ấm": bục + quầng đèn + mic đứng — SVG tuyến, đúng bộ icon tự vẽ
function StageIllustration({ accent }: { accent: string }) {
  return (
    <Svg width={240} height={170} viewBox="0 0 240 170">
      <Path d="M120 6 L58 96 L182 96 Z" fill="rgba(255,194,75,0.30)" />
      <Ellipse cx={120} cy={100} rx={72} ry={13} fill="rgba(255,194,75,0.45)" />
      <Rect x={44} y={108} width={152} height={22} rx={9} fill="#F2E1C4" />
      <Rect x={58} y={130} width={124} height={16} rx={7} fill="#E7D2AC" />
      <Rect x={116} y={62} width={8} height={44} rx={4} fill="#2E2239" />
      <Rect x={104} y={102} width={32} height={7} rx={3.5} fill="#2E2239" />
      <Circle cx={120} cy={50} r={15} fill={accent} />
      <Path d="M120 36 a15 15 0 0 1 0 29" fill="rgba(255,255,255,0.25)" />
      <Circle cx={78} cy={30} r={3.2} fill="#FFC24B" opacity={0.85} />
      <Circle cx={168} cy={44} r={2.6} fill="#FFC24B" opacity={0.7} />
      <Circle cx={186} cy={20} r={2.2} fill="#F2503C" opacity={0.55} />
      <Circle cx={52} cy={58} r={2.4} fill="#F2503C" opacity={0.5} />
    </Svg>
  );
}

// Minh hoạ sóng giọng cho màn xin mic
function WaveIllustration({ accent }: { accent: string }) {
  const bars = [10, 22, 34, 46, 30, 52, 38, 24, 44, 30, 18, 12];
  return (
    <Svg width={200} height={64} viewBox="0 0 200 64">
      {bars.map((h, i) => (
        <Rect key={i} x={8 + i * 16} y={(64 - h) / 2} width={7} height={h} rx={3.5}
          fill={i % 3 === 1 ? "#FFC24B" : accent} opacity={0.35 + (h / 52) * 0.65} />
      ))}
    </Svg>
  );
}

export default function Onboarding({ onDone }: { onDone: (prefs: OnboardPrefs) => void }) {
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState<string | null>(null);
  const [goalLabel, setGoalLabel] = useState("");
  const [mins, setMins] = useState<number | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [reduced, setReduced] = useState(false);

  const slide = useRef(new Animated.Value(1)).current;
  const dir = useRef(1);
  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setReduced); }, []);
  useEffect(() => {
    slide.setValue(0);
    Animated.spring(slide, { toValue: 1, damping: 16, useNativeDriver: true }).start();
  }, [step]);

  const accent = GOALS.find((g) => g.k === (goal ?? "__"))?.color ?? C.primary;
  const valid = step === 3 ? goal !== null : step === 4 ? mins !== null && slot !== null : true;

  function finish(micGranted: boolean) {
    onDone({
      goal: goal ?? "", goalLabel: goalLabel || "Nói tự tin",
      minsPerDay: mins ?? 5, remindSlot: slot ?? "Tối", micGranted,
    });
  }
  async function askMic() {
    try { const res = await Audio.requestPermissionsAsync(); finish(res.granted); }
    catch { finish(false); }
  }
  function next() {
    if (!valid) return;
    if (step === 5) { askMic(); return; }
    dir.current = 1; setStep(step + 1);
  }
  function back() { if (step > 1) { dir.current = -1; setStep(step - 1); } }

  const slideStyle = reduced
    ? { opacity: slide }
    : { opacity: slide, transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [dir.current * 46, 0] }) }] };

  return (
    <View style={st.wrap}>
      <View style={st.top}>
        <TouchableOpacity onPress={back} style={{ width: 40 }}>
          {step > 1 && <ChevronLeft size={26} color="#2E2239" />}
        </TouchableOpacity>
        <View style={st.dots} accessibilityLabel={`Bước ${step}/${TOTAL}`}>
          {Array.from({ length: TOTAL }).map((_, i) => (
            <View key={i} style={[st.dot, i < step && { backgroundColor: accent, width: i === step - 1 ? 18 : 7 }]} />
          ))}
        </View>
        <TouchableOpacity onPress={() => finish(false)} style={{ width: 40, alignItems: "flex-end" }}>
          <Text style={st.skip}>Bỏ qua</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 22 }}>
        <Animated.View style={[{ flex: 1 }, slideStyle]}>
          {step === 1 && (
            <View style={st.center}>
              <Misa mood="chao" size={132} />
              <Text style={st.h1}>Ai cũng từng run{"\n"}khi cầm mic.</Text>
              <Text style={st.sub}>Mình luyện cùng bạn, từng chút một —{"\n"}ở đây không ai chấm điểm bạn.</Text>
              <View style={st.proof}>
                <View style={{ flexDirection: "row" }}>
                  {AVATARS.map((a, i) => (
                    <View key={i} style={[st.avatar, { backgroundColor: a.c, marginLeft: i === 0 ? 0 : -9 }]}>
                      <Text style={st.avatarT}>{a.i}</Text>
                    </View>
                  ))}
                </View>
                <Text style={st.proofT}>12.480 người đang luyện</Text>
              </View>
            </View>
          )}

          {step === 2 && (
            <View style={{ paddingTop: 12 }}>
              <Text style={st.h2}>McUp giúp gì cho bạn?</Text>
              <View style={st.valCard}>
                <View style={[st.valIcon, { backgroundColor: "#FFE3DE" }]}><Star size={22} color={C.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={st.valTitle}>AI chấm tức thì</Text>
                  <Text style={st.valSub}>Âm lượng, tốc độ, từ đệm — ngay khi bạn nói xong.</Text>
                </View>
              </View>
              <View style={st.valCard}>
                <View style={[st.valIcon, { backgroundColor: "#FFF0D2" }]}><Trophy size={22} color="#F5A623" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={st.valTitle}>MC thật nhận xét bằng giọng</Text>
                  <Text style={st.valSub}>Nhận Thẻ bảo chứng có dấu xác thực — khoe được.</Text>
                </View>
              </View>
              <View style={st.valCard}>
                <View style={[st.valIcon, { backgroundColor: "#DFF5EA" }]}><MapIcon size={22} color={C.success} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={st.valTitle}>Leo bản đồ sân khấu</Text>
                  <Text style={st.valSub}>Mỗi ngày một bậc, giữ streak cháy 🔥</Text>
                </View>
              </View>
            </View>
          )}

          {step === 3 && (
            <View style={{ paddingTop: 12 }}>
              <Text style={st.h2}>Bạn muốn luyện để làm gì?</Text>
              <Text style={st.hint}>Chọn một — bản đồ sẽ hiện đúng thứ bạn cần.</Text>
              <View style={st.chips}>
                {GOALS.map((g) => (
                  <TouchableOpacity key={g.l} onPress={() => { setGoal(g.k); setGoalLabel(g.l); }}
                    style={[st.chip, goal === g.k && { backgroundColor: g.color }]}>
                    <Text style={[st.chipT, goal === g.k && { color: "#fff" }]}>{g.l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {goal !== null && (
                <View style={[st.previewCard, { borderColor: accent }]}>
                  <View style={[st.previewDot, { backgroundColor: accent }]} />
                  <Text style={st.previewT}>Lộ trình <Text style={{ fontFamily: F.title, color: accent }}>{goalLabel}</Text> sẽ chờ sẵn trên bản đồ của bạn.</Text>
                </View>
              )}
            </View>
          )}

          {step === 4 && (
            <View style={{ paddingTop: 12 }}>
              <Text style={st.h2}>Tạo thói quen nhé</Text>
              <Text style={st.groupLabel}>Luyện mấy phút mỗi ngày?</Text>
              <View style={st.chips}>
                {MINS.map((m) => (
                  <TouchableOpacity key={m} onPress={() => setMins(m)} style={[st.chip, mins === m && { backgroundColor: accent }]}>
                    <Text style={[st.chipT, mins === m && { color: "#fff" }]}>{m} phút</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={st.groupLabel}>Nhắc mình lúc nào?</Text>
              <View style={st.chips}>
                {SLOTS.map((s) => (
                  <TouchableOpacity key={s} onPress={() => setSlot(s)} style={[st.chip, slot === s && { backgroundColor: accent }]}>
                    <Text style={[st.chipT, slot === s && { color: "#fff" }]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={st.note}>
                <Fire size={16} color="#F5A623" />
                <Text style={st.noteT}>Mình nhắc dịu thôi, không hù dọa nhé.</Text>
              </View>
            </View>
          )}

          {step === 5 && (
            <View style={st.center}>
              <View style={[st.micRing, { backgroundColor: "rgba(255,194,75,0.25)" }]}>
                <View style={st.micInner}><Mic size={30} color={accent} /></View>
              </View>
              <WaveIllustration accent={accent} />
              <Text style={st.h2c}>Sẵn sàng thử bài đầu?</Text>
              <Text style={st.sub}>Để chấm giọng, McUp cần nghe bạn nói —{"\n"}<Text style={st.bold}>chỉ khi luyện</Text>, và clip là của riêng bạn.</Text>
              <Text style={st.privacy}>Riêng tư — bạn kiểm soát mọi clip</Text>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      <View style={{ padding: 20 }}>
        <TouchableOpacity onPress={next} style={[st.cta, { backgroundColor: accent }, !valid && { opacity: 0.45 }]} disabled={!valid}>
          <Text style={st.ctaT}>
            {step === 1 ? "Bắt đầu" : step === 5 ? "Cho phép mic & bắt đầu" : "Tiếp tục"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.base },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 56, paddingHorizontal: 18 },
  back: { fontSize: 26, color: C.ink2 },
  skip: { fontSize: 12, color: "#9C8FA6", fontFamily: F.med },
  dots: { flexDirection: "row", gap: 6, alignItems: "center" },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#E7DBC8" },
  center: { flex: 1, alignItems: "center", paddingTop: 28 },
  h1: { fontSize: 24, fontFamily: F.displayX, color: C.ink, textAlign: "center", marginTop: 18, lineHeight: 34 },
  h2: { fontSize: 21, fontFamily: F.displayX, color: C.ink, marginBottom: 6 },
  h2c: { fontSize: 21, fontFamily: F.displayX, color: C.ink, marginTop: 18, textAlign: "center" },
  sub: { fontSize: 14, fontFamily: F.body, color: C.ink2, textAlign: "center", marginTop: 12, lineHeight: 21 },
  bold: { fontFamily: F.title, color: C.ink },
  proof: { alignItems: "center", gap: 8, marginTop: 22 },
  avatar: {
    width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: C.base,
  },
  avatarT: { color: "#fff", fontSize: 13, fontFamily: F.title },
  proofT: { fontSize: 12, color: C.ink2, fontFamily: F.semi },
  valCard: {
    flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: C.raised,
    borderRadius: 16, padding: 14, marginTop: 12,
  },
  valIcon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  valTitle: { fontSize: 14.5, fontFamily: F.title, color: C.ink },
  valSub: { fontSize: 12.5, fontFamily: F.body, color: C.ink2, marginTop: 2, lineHeight: 18 },
  hint: { fontSize: 13, color: C.ink2, marginBottom: 14, fontFamily: F.body },
  groupLabel: { fontSize: 13, fontFamily: F.semi, color: C.ink2, marginTop: 16, marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  chip: { backgroundColor: C.sunken, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 999 },
  chipT: { fontSize: 13, fontFamily: F.semi, color: C.ink },
  previewCard: {
    flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: C.raised,
    borderRadius: 14, borderWidth: 1.5, padding: 13, marginTop: 18,
  },
  previewDot: { width: 10, height: 10, borderRadius: 5 },
  previewT: { flex: 1, fontSize: 13, fontFamily: F.body, color: C.ink, lineHeight: 19 },
  note: {
    flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#FFEFC9",
    borderRadius: 12, padding: 11, marginTop: 24,
  },
  noteT: { fontSize: 12.5, color: C.ink, flex: 1, fontFamily: F.body },
  micRing: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  micInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: C.raised, alignItems: "center", justifyContent: "center" },
  privacy: { fontSize: 12, color: C.success, fontFamily: F.semi, marginTop: 14 },
  cta: { borderRadius: 999, padding: 15, alignItems: "center" },
  ctaT: { color: "#fff", fontFamily: F.title, fontSize: 15 },
});
