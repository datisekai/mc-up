// ScoreReveal.tsx — màn điểm "diễn" (P0-cam-xuc-spec §2).
// 3 dòng đổ vào stagger 140ms · wpm count-up · chip so sánh lần trước · tip từ pool.
// KHÔNG hiển thị "(giả lập)" cho học viên (§2.5). KHÔNG đỏ khi luyện.
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { C, F } from "./theme";
import { Mic } from "./icons";
import Misa from "./Misa";
import { sfx } from "./sound";
import { COMPARE_WORSE, pick, tipFor } from "./variety";

export type Coverage = { steps: string[]; covered: boolean[] };
export type ScoreData = {
  volume_label: string; speed_wpm: number; filler_count: number; tip: string; is_mock: boolean;
  transcript?: string | null;  // lời user nói — CHỈ có khi ASR thật
  unclear?: boolean;           // ASR thật nhưng không nghe được → trạng thái riêng, không hiện số
  coverage?: Coverage | null;  // "đủ ý chưa" — đối chiếu dàn ý đề bài
  positives?: string[];        // "Đã tốt" — tổng hợp từ server
  improvements?: string[];     // "Cần cải thiện" — tổng hợp từ server
};
export type PrevPoint = { speed_wpm: number; filler_count: number } | null;

// Từ đệm — khớp bộ đếm backend (scoring.FILLERS + _norm_word: bỏ dấu câu, co ký tự lặp)
const FILLERS = new Set(["ừm", "à", "ờ", "ơ", "ừ", "ừa", "hử", "hửm", "ậm", "ầy"]);
const PUNCT = /^[.,!?;:…“”"'`()\[\]\-–—]+|[.,!?;:…“”"'`()\[\]\-–—]+$/g;
const normWord = (w: string) => w.toLowerCase().replace(PUNCT, "").replace(/(.)\1{2,}/g, "$1");

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
  // tip đã được server rút NGẪU NHIÊN từ pool 20 biến thể theo thể loại (feedback #2);
  // fallback pool client nếu server rỗng (vd mock cũ)
  const [tip] = useState(() => score.tip || tipFor(score));
  const positives = score.positives ?? [];
  const improvements = score.improvements ?? [];
  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setReduced); }, []);
  useEffect(() => { sfx("success"); }, []);  // âm "điểm đổ về" — khớp nhịp reveal

  const [showTranscript, setShowTranscript] = useState(false);
  const volOk = score.volume_label === "tốt";

  // "Chưa nghe rõ" = trạng thái riêng — hiện số 0 như một bảng điểm là chấm bừa
  if (score.unclear) {
    return (
      <View style={st.card}>
        <View style={st.unclearWrap}>
          <Misa mood="lo" size={84} />
          <Text style={st.unclearTitle}>Mình chưa nghe rõ giọng bạn</Text>
          <Text style={st.unclearSub}>
            Có thể mic hơi xa hoặc tiếng hơi nhỏ.{"\n"}
            Thử lại gần mic hơn, nói to rõ một chút nhé — lần này chưa tính điểm đâu.
          </Text>
        </View>
      </View>
    );
  }
  const delta = prev ? score.filler_count - prev.filler_count : null;
  const better = delta !== null && delta < 0;
  const worse = delta !== null && delta > 0;
  const [worseMsg] = useState(() => pick(COMPARE_WORSE, "worse"));

  return (
    <View>
      {/* Nhận xét RÕ RÀNG lên đầu: đã làm được gì / chưa làm được gì (feedback #1) */}
      {(positives.length > 0 || improvements.length > 0) && (
        <RowIn delay={0} reduced={reduced}>
          <View style={st.summaryCard}>
            <View style={{ alignItems: "center", marginBottom: 6 }}>
              <Misa mood={improvements.length === 0 ? "anmung" : "covu"} size={62} />
            </View>
            {positives.length > 0 && (
              <View style={{ marginBottom: improvements.length ? 10 : 0 }}>
                <Text style={st.sumHead}>ĐÃ TỐT</Text>
                {positives.map((p, i) => (
                  <View key={i} style={st.sumRow}><Text style={st.sumOk}>✓</Text><Text style={st.sumText}>{p}</Text></View>
                ))}
              </View>
            )}
            {improvements.length > 0 && (
              <View>
                <Text style={st.sumHead}>LẦN SAU THỬ</Text>
                {improvements.map((m, i) => (
                  <View key={i} style={st.sumRow}><Text style={st.sumArrow}>→</Text><Text style={st.sumText}>{m}</Text></View>
                ))}
              </View>
            )}
          </View>
        </RowIn>
      )}

      <View style={st.card}>
        <RowIn delay={improvements.length || positives.length ? 140 : 0} reduced={reduced}>
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

        {/* "Đủ ý chưa" — đối chiếu lời nói với dàn ý đề bài (✓ đạt / ○ thiếu, KHÔNG đỏ) */}
        {score.coverage && score.coverage.steps.length > 0 ? (() => {
          const cov = score.coverage!;
          const done = cov.covered.filter(Boolean).length;
          const all = done === cov.steps.length;
          return (
            <RowIn delay={720} reduced={reduced}>
              <View style={st.covBox}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <Text style={st.covLabel}>ĐỦ Ý CHƯA</Text>
                  <Text style={[st.covCount, all && { color: "#1f8f63" }]}>{done}/{cov.steps.length} ý</Text>
                </View>
                {cov.steps.map((stp, i) => (
                  <View key={i} style={st.covRow}>
                    <Text style={[st.covMark, cov.covered[i] ? st.covOk : st.covMiss]}>{cov.covered[i] ? "✓" : "○"}</Text>
                    <Text style={[st.covText, !cov.covered[i] && { color: C.ink2 }]}>{stp}</Text>
                  </View>
                ))}
                <Text style={st.covHint}>{all ? "Đủ ý rồi, xịn! 👏" : "Còn thiếu vài ý — không sao, lần sau thêm vào nhé."}</Text>
              </View>
            </RowIn>
          );
        })() : null}

        <RowIn delay={score.coverage ? 860 : 720} reduced={reduced}>
          <View style={st.tip}><Text style={st.tipT}>{tip}</Text></View>
        </RowIn>

        {/* "Xem lại lời bạn nói" — bằng chứng cho số từ đệm. Gấp mặc định (không phán xét),
            tô vàng ấm (không đỏ), chỉ có khi ASR thật (mock = null → ẩn hẳn). */}
        {score.transcript ? (
          <RowIn delay={score.coverage ? 1000 : 860} reduced={reduced}>
            {showTranscript ? (
              <View style={st.transcriptBox}>
                <Text style={st.transcriptLabel}>LỜI BẠN NÓI · từ đệm được đánh dấu</Text>
                <Text style={st.transcriptT}>
                  {score.transcript.split(/(\s+)/).map((w, i) =>
                    FILLERS.has(normWord(w))
                      ? <Text key={i} style={st.fillerHi}>{w}</Text>
                      : <Text key={i}>{w}</Text>
                  )}
                </Text>
                <TouchableOpacity onPress={() => setShowTranscript(false)} accessibilityLabel="Ẩn lời bạn nói">
                  <Text style={st.transcriptLink}>Ẩn đi ▴</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={() => setShowTranscript(true)}
                accessibilityLabel="Xem lại lời bạn vừa nói, từ đệm được đánh dấu">
                <Text style={st.transcriptLink}>Xem lại lời bạn nói ▾</Text>
              </TouchableOpacity>
            )}
          </RowIn>
        ) : null}
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
  big: { fontFamily: F.display, fontSize: 17, color: C.ink },
  unit: { fontFamily: F.semi, fontSize: 12, color: C.ink2 },
  pill: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999 },
  pillOk: { backgroundColor: "#E6F7EF" },
  pillMid: { backgroundColor: "#FFF3DA" },
  pillT: { fontWeight: "800", fontSize: 14 },
  compareOk: { backgroundColor: "#E6F7EF", borderRadius: 10, padding: 10, marginTop: 10 },
  compareOkT: { color: "#1f8f63", fontWeight: "700", fontSize: 12.5 },
  compareMid: { backgroundColor: C.sunken, borderRadius: 10, padding: 10, marginTop: 10 },
  compareMidT: { color: C.ink2, fontWeight: "600", fontSize: 12.5 },
  tip: { backgroundColor: C.sunken, borderRadius: 12, padding: 12, marginTop: 10 },
  tipT: { color: C.ink, fontSize: 13.5, lineHeight: 19 },
  transcriptLink: { color: C.ink2, fontSize: 12.5, fontFamily: F.semi, textDecorationLine: "underline", textAlign: "center", marginTop: 12 },
  transcriptBox: { backgroundColor: C.raised, borderRadius: 12, padding: 12, marginTop: 12, borderWidth: 1, borderColor: C.hair },
  transcriptLabel: { fontFamily: F.title, fontSize: 12, color: C.ink2, letterSpacing: 0.6, marginBottom: 6 },
  transcriptT: { color: C.ink, fontSize: 14, lineHeight: 22, fontFamily: F.body },
  // tô VÀNG ẤM — đánh dấu để học, không phải bôi lỗi (không đỏ)
  fillerHi: { backgroundColor: "#FFE9C0", color: "#8a5a13", fontFamily: F.title, borderRadius: 4 },
  summaryCard: { backgroundColor: C.raised, borderRadius: 16, padding: 14, marginBottom: 10 },
  sumHead: { fontFamily: F.title, fontSize: 12.5, color: C.ink2, letterSpacing: 0.8, marginBottom: 6 },
  sumRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 4 },
  sumOk: { color: "#3FB984", fontFamily: F.title, fontSize: 15, width: 16, lineHeight: 21 },
  sumArrow: { color: C.primary, fontFamily: F.title, fontSize: 15, width: 16, lineHeight: 21 },
  sumText: { flex: 1, fontSize: 14, color: C.ink, lineHeight: 21 },
  covBox: { backgroundColor: C.raised, borderRadius: 12, padding: 12, marginTop: 10, borderWidth: 1, borderColor: C.hair },
  covLabel: { fontFamily: F.title, fontSize: 12, color: C.ink2, letterSpacing: 0.6 },
  covCount: { fontFamily: F.display, fontSize: 13, color: C.ink2 },
  covRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 3 },
  covMark: { fontSize: 14, fontFamily: F.title, width: 16, textAlign: "center", lineHeight: 20 },
  covOk: { color: "#3FB984" },
  covMiss: { color: "#C9B79E" },
  covText: { flex: 1, fontSize: 13.5, color: C.ink, lineHeight: 20 },
  covHint: { fontSize: 12, color: C.ink2, fontFamily: F.med, marginTop: 6 },
  unclearWrap: { alignItems: "center", paddingVertical: 18 },
  unclearIcon: { fontSize: 40 },
  unclearTitle: { fontFamily: F.display, fontSize: 18, color: C.ink, marginTop: 10 },
  unclearSub: { fontFamily: F.body, fontSize: 13.5, color: C.ink2, textAlign: "center", lineHeight: 20, marginTop: 8 },
});
