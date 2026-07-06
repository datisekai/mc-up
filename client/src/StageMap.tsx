import { useEffect, useRef } from "react";
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { C, F } from "./theme";
import { Cap, Check, Flag, Lock, Mic, Ticket } from "./icons";

export type Lesson = { id: string; buoi: number; order_index: number; title: string; unlocked: boolean; done: boolean };

// một mục trên bản đồ: bài học hoặc mốc thưởng Vé Vàng
type Item =
  | { kind: "lesson"; lesson: Lesson; state: "done" | "open" | "locked" }
  | { kind: "reward"; buoi: number; earned: boolean };

const R = 34;          // bán kính node bài
const RR = 30;         // bán kính node thưởng
const GAP = 184;       // khoảng cách dọc giữa các mục (giãn để nhãn dài không tràn)
const STAGE_H = 172;   // chiều cao sân khấu (đỉnh)
const GROUND_H = 116;  // chiều cao mặt đất (đáy)
const AMP = 52;        // biên độ zig-zag (rộng hơn để nhãn 2 node cạnh nhau tách ra)

// địa danh theo buổi (chất "phiêu lưu nghề MC" — concept C) cho mốc Vé Vàng
const LANDMARK: Record<number, string> = {
  1: "Lớp học nhỏ", 2: "Góc luyện thanh", 3: "Quán cafe", 4: "Câu lạc bộ",
  5: "Tiệc sinh nhật", 6: "Toạ đàm", 7: "Phỏng vấn", 8: "Tiệc cưới", 9: "Gala", 10: "Hội trường lớn",
};

function buildItems(lessons: Lesson[]): Item[] {
  const firstOpenIdx = lessons.findIndex((l) => l.unlocked && !l.done);
  const ordered: Item[] = [];
  lessons.forEach((l, i) => {
    const state: "done" | "open" | "locked" = l.done ? "done" : i === firstOpenIdx ? "open" : l.unlocked ? "open" : "locked";
    ordered.push({ kind: "lesson", lesson: l, state });
    const next = lessons[i + 1];
    if (next && next.buoi !== l.buoi) ordered.push({ kind: "reward", buoi: l.buoi, earned: l.done });
  });
  return ordered;
}

export default function StageMap({ lessons, onPick }: { lessons: Lesson[]; onPick: (l: Lesson) => void }) {
  const { width, height } = useWindowDimensions();
  const cx = width / 2;
  const scroll = useRef<ScrollView>(null);

  // spotlight "thở" cho node đang mở
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 1200, useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, [pulse]);
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1.14] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.8] });

  const ordered = buildItems(lessons);
  const display = [...ordered].reverse(); // đỉnh (bài cuối) ở trên, đáy (bài đầu) ở dưới
  const n = display.length;

  // toạ độ tâm mỗi mục
  const pts = display.map((_, i) => ({ x: cx + Math.round(AMP * Math.sin(i * 0.85)), y: STAGE_H + i * GAP + R }));
  const totalH = STAGE_H + n * GAP + GROUND_H;

  // vị trí node đang mở (để auto-scroll tới)
  const openIdx = display.findIndex((it) => it.kind === "lesson" && it.state === "open");

  useEffect(() => {
    if (openIdx >= 0) {
      const y = Math.max(0, pts[openIdx].y - height * 0.42);
      const t = setTimeout(() => scroll.current?.scrollTo({ y, animated: false }), 120);
      return () => clearTimeout(t);
    }
  }, [openIdx, height]);

  // đường trail: phần ĐÃ LEO (từ node đang mở xuống đáy) tô đặc xanh; phần SẮP TỚI (lên sân khấu) gạch đứt
  const toPath = (arr: { x: number; y: number }[]) => arr.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const climbedStart = openIdx < 0 ? 0 : openIdx;
  const dashed = toPath(pts.slice(0, climbedStart + 1));
  const solid = toPath(pts.slice(climbedStart));

  return (
    <ScrollView ref={scroll} showsVerticalScrollIndicator={false}>
      <View style={{ height: totalH }}>
        {/* trail */}
        <Svg width={width} height={totalH} style={StyleSheet.absoluteFill}>
          <Path d={dashed} stroke="#E7DBC8" strokeWidth={7} strokeLinecap="round" strokeDasharray="2 14" fill="none" />
          <Path d={solid} stroke="#7FD3AD" strokeWidth={7} strokeLinecap="round" fill="none" />
        </Svg>

        {/* ĐỈNH: sân khấu tốt nghiệp */}
        <View style={[st.stage, { left: cx - 142, width: 284 }]}>
          <View style={st.cap}><Cap size={26} color={C.ink} /></View>
          <Text style={st.stageTitle}>TỐT NGHIỆP</Text>
          <Text style={st.stageSub}>Buổi 10 · Thuyết trình tốt nghiệp</Text>
          <View style={st.stageTag}><Text style={st.stageTagT}>SÂN KHẤU LỚN · MỤC TIÊU CUỐI</Text></View>
        </View>

        {/* các node */}
        {display.map((it, i) => {
          const p = pts[i];
          const isReward = it.kind === "reward";
          const r = isReward ? RR : R;
          const open = it.kind === "lesson" && it.state === "open";
          return (
            <View key={i}>
              {/* spotlight cho node đang mở */}
              {open && <Animated.View style={[st.glow, { left: p.x - 120, top: p.y - 120, opacity: glowOpacity, transform: [{ scale: glowScale }] }]} pointerEvents="none" />}
              {open && (
                <View style={[st.cta, { left: p.x - 60, top: p.y - R - 34 }]}>
                  <Text style={st.ctaT}>TỚI LƯỢT BẠN</Text>
                </View>
              )}

              <TouchableOpacity
                activeOpacity={0.85}
                disabled={!(it.kind === "lesson" && (it.state === "open" || it.state === "done"))}
                onPress={() => it.kind === "lesson" && onPick(it.lesson)}
                style={[st.node, { left: p.x - r, top: p.y - r, width: r * 2, height: r * 2, borderRadius: r },
                  it.kind === "lesson" && it.state === "done" && st.nDone,
                  open && st.nOpen,
                  it.kind === "lesson" && it.state === "locked" && st.nLock,
                  isReward && (it.earned ? st.nReward : st.nRewardLock),
                ]}
              >
                {it.kind === "lesson" && it.state === "done" && <Check size={30} color="#fff" />}
                {open && <Mic size={30} color={C.primary} />}
                {it.kind === "lesson" && it.state === "locked" && <Lock size={26} color="#A99C8C" />}
                {isReward && <Ticket size={24} color={it.earned ? "#8a5a13" : "#C9AE77"} />}
              </TouchableOpacity>

              {/* nhãn dưới node */}
              <View style={[st.label, { left: p.x - 66, top: p.y + r + 6 }]}>
                <Text style={[st.lt, ((it.kind === "lesson" && it.state === "locked") || (isReward && !it.earned)) && st.muted]} numberOfLines={2}>
                  {it.kind === "lesson" ? it.lesson.title : "Vé Vàng"}
                </Text>
                <Text style={[st.ls, open && st.hot]}>
                  {it.kind === "reward"
                    ? it.earned ? `Đã nhận · ${LANDMARK[it.buoi] ?? "Sân khấu nhỏ"}` : `${LANDMARK[it.buoi] ?? "Sân khấu nhỏ"} · Buổi ${it.buoi}`
                    : it.state === "done" ? `Buổi ${it.lesson.buoi} · Hoàn thành`
                    : it.state === "open" ? `Buổi ${it.lesson.buoi} · Bắt đầu`
                    : `Buổi ${it.lesson.buoi} · Đang khoá`}
                </Text>
              </View>
            </View>
          );
        })}

        {/* ĐÁY: mặt đất — bắt đầu */}
        <View style={[st.ground, { left: cx - 132, top: STAGE_H + n * GAP + 8, width: 264 }]}>
          <Flag size={22} color="#C7A86F" />
          <Text style={st.groundT}>MẶT ĐẤT</Text>
          <Text style={st.groundS}>Bắt đầu hành trình leo lên sân khấu</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const shadow = { shadowColor: "#3B2A4A", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.16, shadowRadius: 8, elevation: 4 };

const st = StyleSheet.create({
  stage: { position: "absolute", top: 12, height: STAGE_H - 24, alignItems: "center", paddingTop: 22,
    backgroundColor: "#FFF4DA", borderRadius: 20, borderWidth: 1, borderColor: "#F2E1C4", ...shadow },
  cap: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#FFE1A6", alignItems: "center", justifyContent: "center",
    borderWidth: 4, borderColor: "rgba(255,194,75,.4)" },
  stageTitle: { marginTop: 8, fontSize: 19, fontFamily: F.displayX, letterSpacing: 1.5, color: C.ink },
  stageSub: { marginTop: 2, fontSize: 11, fontWeight: "700", color: "#6b4f2a" },
  stageTag: { marginTop: 6, backgroundColor: "rgba(255,255,255,.7)", borderWidth: 1, borderColor: "rgba(224,166,47,.5)",
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  stageTagT: { fontSize: 9.5, fontWeight: "800", letterSpacing: 0.4, color: "#8a5a13" },

  node: { position: "absolute", alignItems: "center", justifyContent: "center", backgroundColor: "#EAE1D3", zIndex: 3 },
  nDone: { backgroundColor: C.success, ...shadow },
  nOpen: { backgroundColor: "#fff", borderWidth: 3, borderColor: C.primary, ...shadow, shadowColor: C.primary, shadowOpacity: 0.4 },
  nLock: { backgroundColor: "#EAE1D3" },
  nReward: { backgroundColor: C.spot, ...shadow, shadowColor: C.spot },
  nRewardLock: { backgroundColor: "#F4E8CE" },

  glow: { position: "absolute", width: 240, height: 240, borderRadius: 120, backgroundColor: "rgba(255,194,75,0.28)", zIndex: 1 },
  cta: { position: "absolute", width: 120, alignItems: "center", zIndex: 5 },
  ctaT: { backgroundColor: C.primary, color: "#fff", fontWeight: "900", fontSize: 11, letterSpacing: 0.4,
    paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20, overflow: "hidden" },

  label: { position: "absolute", width: 132, alignItems: "center", zIndex: 2 },
  lt: { fontSize: 12.5, fontWeight: "800", color: C.ink, textAlign: "center", lineHeight: 15 },
  ls: { fontSize: 10, fontWeight: "700", color: C.ink2, marginTop: 2, textAlign: "center" },
  muted: { color: "#96897a" },
  hot: { color: C.primary },

  ground: { position: "absolute", height: GROUND_H - 20, alignItems: "center", justifyContent: "center",
    backgroundColor: "#F1E7D8", borderRadius: 16, borderWidth: 1, borderColor: "#E7DBC8", gap: 2 },
  groundT: { fontSize: 11, fontWeight: "900", letterSpacing: 1, color: "#8a7a68" },
  groundS: { fontSize: 9.5, fontWeight: "700", color: "#A99C8C", textAlign: "center" },
});
