import { Text, View } from "react-native";
import Svg, { Circle, Polyline } from "react-native-svg";
import { C } from "./theme";

// Biểu đồ đường tối giản (react-native-svg) — vd số từ đệm theo thời gian.
export default function MiniChart({ data, label }: { data: number[]; label: string }) {
  if (data.length < 2) {
    return <Text style={{ color: C.ink2, paddingHorizontal: 4 }}>Luyện thêm vài bài để xem biểu đồ tiến bộ nhé!</Text>;
  }
  const W = 300, H = 90, pad = 10;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data.map((v, i) => ({
    x: pad + (i / (data.length - 1)) * (W - pad * 2),
    y: pad + (1 - (v - min) / range) * (H - pad * 2),
  }));
  const poly = pts.map((p) => `${p.x},${p.y}`).join(" ");
  return (
    <View style={{ backgroundColor: C.raised, borderRadius: 16, padding: 12, marginBottom: 10 }}>
      <Text style={{ color: C.ink2, fontSize: 12, fontWeight: "700", marginBottom: 6 }}>{label}</Text>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Polyline points={poly} fill="none" stroke={C.primary} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r={3.5} fill={C.primary} />)}
      </Svg>
    </View>
  );
}
