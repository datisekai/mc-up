// Onboarding.tsx — onboarding "ấm" 5 bước (P2-onboarding-spec).
// B1 trấn an → B2 giá trị → B3 mục tiêu (trả công = lộ trình đúng) → B4 thói quen
// → B5 priming mic (giải thích ấm TRƯỚC dialog hệ thống). Bỏ qua/Quay lại luôn có.
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Audio } from "expo-av";
import { C } from "./theme";
import { Fire, MapIcon, Mic, Star, Trophy } from "./icons";

export type OnboardPrefs = {
  goal: string;          // keyword khớp Genre: "" | "đám cưới" | "sự kiện" | "livestream" | "nhí"
  goalLabel: string;
  minsPerDay: number;
  remindSlot: string;    // Sáng | Trưa | Tối
  micGranted: boolean;
};

const GOALS = [
  { k: "", l: "Nói tự tin (nền tảng)" },
  { k: "đám cưới", l: "MC đám cưới" },
  { k: "sự kiện", l: "MC sự kiện" },
  { k: "livestream", l: "MC livestream" },
  { k: "nhí", l: "MC nhí" },
];
const MINS = [3, 5, 10];
const SLOTS = ["Sáng", "Trưa", "Tối"];
const TOTAL = 5;

export default function Onboarding({ onDone }: { onDone: (prefs: OnboardPrefs) => void }) {
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState<string | null>(null);
  const [goalLabel, setGoalLabel] = useState("");
  const [mins, setMins] = useState<number | null>(null);
  const [slot, setSlot] = useState<string | null>(null);

  const valid = step === 3 ? goal !== null : step === 4 ? mins !== null && slot !== null : true;

  function finish(micGranted: boolean) {
    onDone({
      goal: goal ?? "", goalLabel: goalLabel || "Nói tự tin",
      minsPerDay: mins ?? 5, remindSlot: slot ?? "Tối", micGranted,
    });
  }

  async function askMic() {
    // priming đã hiện (B5) → giờ mới bung dialog hệ thống
    try {
      const res = await Audio.requestPermissionsAsync();
      finish(res.granted);
    } catch {
      finish(false);
    }
  }

  function next() {
    if (!valid) return;
    if (step === 5) { askMic(); return; }
    setStep(step + 1);
  }

  return (
    <View style={st.wrap}>
      <View style={st.top}>
        <TouchableOpacity onPress={() => step > 1 && setStep(step - 1)} style={{ width: 40 }}>
          {step > 1 && <Text style={st.back}>‹</Text>}
        </TouchableOpacity>
        <View style={st.dots} accessibilityLabel={`Bước ${step}/${TOTAL}`}>
          {Array.from({ length: TOTAL }).map((_, i) => (
            <View key={i} style={[st.dot, i < step && st.dotOn]} />
          ))}
        </View>
        <TouchableOpacity onPress={() => finish(false)} style={{ width: 40, alignItems: "flex-end" }}>
          <Text style={st.skip}>Bỏ qua</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 22 }}>
        {step === 1 && (
          <View style={st.center}>
            <View style={st.heroGlow}>
              <View style={st.heroMic}><Mic size={30} color="#fff" /></View>
            </View>
            <Text style={st.h1}>Ai cũng từng run{"\n"}khi cầm mic.</Text>
            <Text style={st.sub}>Mình luyện cùng bạn, từng chút một —{"\n"}ở đây không ai chấm điểm bạn.</Text>
            <View style={st.proof}>
              <Fire size={14} color={C.primary} />
              <Text style={st.proofT}>12.480 người đang luyện</Text>
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={{ paddingTop: 16 }}>
            <Text style={st.h2}>McUp giúp gì cho bạn?</Text>
            <View style={st.valRow}>
              <Star size={22} color={C.primary} />
              <Text style={st.valT}><Text style={st.bold}>AI chấm tức thì</Text> — âm lượng, tốc độ, từ đệm ngay khi bạn nói xong.</Text>
            </View>
            <View style={st.valRow}>
              <Trophy size={22} color="#F5A623" />
              <Text style={st.valT}><Text style={st.bold}>MC thật nhận xét</Text> bằng giọng → Thẻ bảo chứng để khoe.</Text>
            </View>
            <View style={st.valRow}>
              <MapIcon size={22} color={C.success} />
              <Text style={st.valT}><Text style={st.bold}>Leo bản đồ sân khấu</Text>, giữ streak mỗi ngày.</Text>
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={{ paddingTop: 16 }}>
            <Text style={st.h2}>Bạn muốn luyện để làm gì?</Text>
            <Text style={st.hint}>Chọn một — bản đồ sẽ hiện đúng thứ bạn cần.</Text>
            <View style={st.chips}>
              {GOALS.map((g) => (
                <TouchableOpacity key={g.l} onPress={() => { setGoal(g.k); setGoalLabel(g.l); }}
                  style={[st.chip, goal === g.k && st.chipOn]}>
                  <Text style={[st.chipT, goal === g.k && st.chipTOn]}>{g.l}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {step === 4 && (
          <View style={{ paddingTop: 16 }}>
            <Text style={st.h2}>Tạo thói quen nhé</Text>
            <Text style={st.groupLabel}>Luyện mấy phút mỗi ngày?</Text>
            <View style={st.chips}>
              {MINS.map((m) => (
                <TouchableOpacity key={m} onPress={() => setMins(m)} style={[st.chip, mins === m && st.chipOn]}>
                  <Text style={[st.chipT, mins === m && st.chipTOn]}>{m} phút</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={st.groupLabel}>Nhắc mình lúc nào?</Text>
            <View style={st.chips}>
              {SLOTS.map((s) => (
                <TouchableOpacity key={s} onPress={() => setSlot(s)} style={[st.chip, slot === s && st.chipOn]}>
                  <Text style={[st.chipT, slot === s && st.chipTOn]}>{s}</Text>
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
            <View style={st.micRing}><Mic size={32} color={C.primary} /></View>
            <Text style={st.h2c}>Sẵn sàng thử bài đầu?</Text>
            <Text style={st.sub}>Để chấm giọng, McUp cần nghe bạn nói —{"\n"}<Text style={st.bold}>chỉ khi luyện</Text>, và clip là của riêng bạn.</Text>
            <Text style={st.privacy}>Riêng tư — bạn kiểm soát mọi clip</Text>
          </View>
        )}
      </ScrollView>

      <View style={{ padding: 20 }}>
        <TouchableOpacity onPress={next} style={[st.cta, !valid && { opacity: 0.45 }]} disabled={!valid}>
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
  skip: { fontSize: 12, color: "#BFB4C4" },
  dots: { flexDirection: "row", gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#E7DBC8" },
  dotOn: { backgroundColor: C.primary },
  center: { flex: 1, alignItems: "center", paddingTop: 40 },
  heroGlow: {
    width: 100, height: 100, borderRadius: 50, backgroundColor: "rgba(255,194,75,0.28)",
    alignItems: "center", justifyContent: "center",
  },
  heroMic: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.primary, alignItems: "center", justifyContent: "center" },
  h1: { fontSize: 24, fontWeight: "900", color: C.ink, textAlign: "center", marginTop: 24, lineHeight: 32 },
  h2: { fontSize: 21, fontWeight: "900", color: C.ink, marginBottom: 6 },
  h2c: { fontSize: 21, fontWeight: "900", color: C.ink, marginTop: 20, textAlign: "center" },
  sub: { fontSize: 14, color: C.ink2, textAlign: "center", marginTop: 12, lineHeight: 21 },
  bold: { fontWeight: "800", color: C.ink },
  proof: {
    flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.sunken,
    paddingHorizontal: 13, paddingVertical: 7, borderRadius: 999, marginTop: 22,
  },
  proofT: { fontSize: 12, color: C.ink2, fontWeight: "600" },
  valRow: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginTop: 16 },
  valT: { flex: 1, fontSize: 14.5, color: C.ink, lineHeight: 21 },
  hint: { fontSize: 13, color: C.ink2, marginBottom: 14 },
  groupLabel: { fontSize: 13, fontWeight: "700", color: C.ink2, marginTop: 16, marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  chip: { backgroundColor: C.sunken, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 999 },
  chipOn: { backgroundColor: C.primary },
  chipT: { fontSize: 13, fontWeight: "700", color: C.ink },
  chipTOn: { color: "#fff" },
  note: {
    flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#FFF3DA",
    borderRadius: 12, padding: 11, marginTop: 24,
  },
  noteT: { fontSize: 12.5, color: C.ink, flex: 1 },
  micRing: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: C.sunken,
    alignItems: "center", justifyContent: "center",
  },
  privacy: { fontSize: 12, color: C.success, fontWeight: "700", marginTop: 14 },
  cta: { backgroundColor: C.primary, borderRadius: 999, padding: 15, alignItems: "center" },
  ctaT: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
