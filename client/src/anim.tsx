// Primitive hoạt hoạ dùng chung (V6 UI polish) — skeleton, fade-in, count-up.
// Chạy native driver khi có thể; tôn trọng Giảm chuyển động.
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, View, ViewStyle } from "react-native";
import { C, shadow } from "./theme";

// ===== Skeleton: khung xám nhấp nháy đúng hình dạng nội dung (thay spinner) =====
export function Skeleton({ w = "100%", h = 16, r = 8, style }: { w?: number | string; h?: number; r?: number; style?: ViewStyle }) {
  const o = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(o, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(o, { toValue: 0.4, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return <Animated.View style={[{ width: w as any, height: h, borderRadius: r, backgroundColor: C.sunken, opacity: o }, style]} />;
}

// Khối skeleton dạng "thẻ danh sách" — dùng cho BXH, shop, showreel, market...
export function SkeletonList({ rows = 5, avatar = true }: { rows?: number; avatar?: boolean }) {
  return (
    <View style={{ paddingTop: 8 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.raised, borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: C.hair, ...shadow.soft }}>
          {avatar && <Skeleton w={40} h={40} r={20} />}
          <View style={{ flex: 1, gap: 7 }}>
            <Skeleton w={"62%"} h={13} />
            <Skeleton w={"38%"} h={11} />
          </View>
          <Skeleton w={44} h={22} r={11} />
        </View>
      ))}
    </View>
  );
}

// ===== FadeInUp: xuất hiện mượt (opacity + trượt lên nhẹ), có độ trễ theo index =====
export function FadeInUp({ children, delay = 0, dy = 12, style }: { children: any; delay?: number; dy?: number; style?: ViewStyle }) {
  const v = useRef(new Animated.Value(0)).current;
  const [reduced, setReduced] = useState(false);
  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setReduced); }, []);
  useEffect(() => {
    if (reduced) { v.setValue(1); return; }
    const a = Animated.timing(v, { toValue: 1, duration: 340, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [reduced]);
  return (
    <Animated.View style={[{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [dy, 0] }) }] }, style]}>
      {children}
    </Animated.View>
  );
}

// ===== CountUp: số chạy tăng dần (khoảnh khắc thưởng) =====
export function useCountUp(target: number, duration = 800): number {
  const [n, setN] = useState(target);
  const raf = useRef<any>(null);
  useEffect(() => {
    const from = 0, start = Date.now();
    function tick() {
      const p = Math.min(1, (Date.now() - start) / duration);
      setN(Math.round(from + (target - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    }
    tick();
    return () => raf.current && cancelAnimationFrame(raf.current);
  }, [target]);
  return n;
}
