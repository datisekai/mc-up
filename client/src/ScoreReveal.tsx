// ScoreReveal.tsx — màn điểm "diễn" (P0-cam-xuc-spec §2).
// 3 dòng đổ vào stagger 140ms · wpm count-up · chip so sánh lần trước · tip từ pool.
// KHÔNG hiển thị "(giả lập)" cho học viên (§2.5). KHÔNG đỏ khi luyện.
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from "react-native";
import { C } from "./theme";
import { COMPARE_WORSE, pick, tipFor } from "./variety";

export type ScoreData = { volume_label: string; speed_wpm: number; filler_count: number; tip: string; is_mock: boolean };
export type PrevPoint = { speed_wpm: number; filler_count: number } | null;

function RowIn({ delay, reduced, children }: { delay: number; reduced: boolean; children: React.ReactNode }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(a, { toValue: 1, damping: 14, delay: reduced ? 0 : delay, useNativeDriver: true }).start();
  }, []);
  const style = reduced
    ? { opacity: a }
    : { opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] };
  return <Animated.View style={style}>{children}</Animated.View>;
}

function CountUp({ to, delay, style }: { to: number; delay: number; style: any }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf: ReturnType<typeof setInterval>;
    const t = setTimeout(() => {
      const start = Date.now();
      raf = setInterval(() => {
        const p = Math.min(1, (Date.now() - start) / 500);
        setVal(Math.round(to * (0.15 + 0.85 * p * (2 - p)) * 10) / 10);
        if (p >= 1) { setVal(to); clearInterval(raf); }
      }, 40);
    }, delay);
    return () => { clearTimeout(t); clearInterval(raf); };
  }, [to]);
  return <Text style={style}>{val}</Text>;
}

export default function ScoreReveal({ score, prev }: { score: ScoreData; prev: PrevPoint }) {
  const [reduced, setReduced] = useState(false);
  const [tip] = useState(() => tipFor(score));
  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setReduced); }, []);

  const volOk = score.volume_label === "tốt";
  const delta = prev ? score.filler_count - prev.filler_count : null;
  const better = delta !== null && delta < 0;
  const worse = delta !== null && delta > 0;
  const [worseMsg] = useState(() => pick(COMPARE_WORSE, "worse"));

  return (
    <View>
      <View style={st.card}>
        <RowIn delay={0} reduced={reduced}>
          <View style={st.row}>
            <Text style={st.k}>Âm lượng</Text>
            <View style={[st.pill, volOk ? st.pillOk : st.pillMid]}>
              <Text style={[st.pillT, { color: volOk ? "#1f8f63" : "#9a6b00" }]}>{score.volume_label}</Text>
            </View>
          </View>
        </RowIn>
        <RowIn delay={140} reduced={reduced}>
          <View style={st.row}>
            <Text style={st.k}>Tốc độ</Text>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
              <CountUp to={score.speed_wpm} delay={reduced ? 0 : 170} style={st.big} />
              <Text style={st.unit}>chữ/phút</Text>
            </View>
          </View>
        </RowIn>
        <RowIn delay={280} reduced={reduced}>
          <View style={[st.row, { borderBottomWidth: 0 }]}>
            <Text style={st.k}>Từ đệm 'ừm/à'</Text>
            <Text style={st.big}>{score.filler_count} <Text style={st.unit}>lần</Text></Text>
          </View>
        </RowIn>

        {better && (
          <RowIn delay={560} reduced={reduced}>
            <View style={st.compareOk}>
              <Text style={st.compareOkT}>−{Math.abs(delta!)} lần 'ừm' so với lần trước 👏</Text>
            </View>
          </RowIn>
        )}
        {worse && (
          <RowIn delay={560} reduced={reduced}>
            <View style={st.compareMid}>
              <Text style={st.compareMidT}>{worseMsg}</Text>
            </View>
          </RowIn>
        )}

        <RowIn delay={720} reduced={reduced}>
          <View style={st.tip}><Text style={st.tipT}>{tip}</Text></View>
        </RowIn>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: C.raised, borderRadius: 16, padding: 14, marginBottom: 10 },
  row: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.hair,
  },
  k: { color: C.ink, fontSize: 14 },
  big: { fontWeight: "900", fontSize: 17, color: C.ink },
  unit: { fontWeight: "600", fontSize: 12, color: C.ink2 },
  pill: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999 },
  pillOk: { backgroundColor: "#E6F7EF" },
  pillMid: { backgroundColor: "#FFF3DA" },
  pillT: { fontWeight: "800", fontSize: 12 },
  compareOk: { backgroundColor: "#E6F7EF", borderRadius: 10, padding: 10, marginTop: 10 },
  compareOkT: { color: "#1f8f63", fontWeight: "700", fontSize: 12.5 },
  compareMid: { backgroundColor: C.sunken, borderRadius: 10, padding: 10, marginTop: 10 },
  compareMidT: { color: C.ink2, fontWeight: "600", fontSize: 12.5 },
  tip: { backgroundColor: C.sunken, borderRadius: 12, padding: 12, marginTop: 10 },
  tipT: { color: C.ink, fontSize: 13.5, lineHeight: 19 },
});
