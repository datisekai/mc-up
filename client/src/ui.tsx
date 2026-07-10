// UI V2 "Sân khấu ấm 2.0" — nút 3D "phím đàn" + thanh tiến độ dày (DESIGN.md V2).
// Quy tắc affordance: có ĐÁY dày = nhấn được; nhấn = lún (đáy 0 + tụt xuống).
import { ReactNode } from "react";
import { Pressable, Text, View, ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { C, F, T } from "./theme";
import { sfx } from "./sound";

const DEPTH = 5; // độ dày đáy 3D

type Kind = "primary" | "gold" | "white" | "success";
const FACE: Record<Kind, string> = { primary: C.primary, gold: C.spot, white: C.raised, success: C.success };
const DOWN: Record<Kind, string> = { primary: C.primaryDown, gold: C.spotDown, white: C.hairDown, success: C.successDown };
const INK: Record<Kind, string> = { primary: "#fff", gold: "#5a3d00", white: C.ink, success: "#fff" };

export function Btn3D({ label, onPress, kind = "primary", icon, small, disabled, style }: {
  label: string;
  onPress?: () => void;
  kind?: Kind;
  icon?: ReactNode;
  small?: boolean;      // biến thể gọn cho hàng nút phụ
  disabled?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={() => { sfx("tap"); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onPress?.(); }}
      style={({ pressed }) => [{
        backgroundColor: disabled ? C.sunken : FACE[kind],
        borderRadius: 16,
        borderWidth: kind === "white" ? 2 : 0,
        borderColor: C.hair,
        borderBottomWidth: pressed || disabled ? (kind === "white" ? 2 : 0) : DEPTH,
        borderBottomColor: disabled ? C.hair : DOWN[kind],
        transform: [{ translateY: pressed ? DEPTH - 1 : 0 }],
        paddingVertical: small ? 10 : 14,
        paddingHorizontal: small ? 16 : 22,
        marginTop: 8,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }, style]}
    >
      {icon}
      <Text style={{
        color: disabled ? C.ink2 : INK[kind],
        fontFamily: F.title,
        fontSize: small ? 15 : 17,
      }}>{label}</Text>
    </Pressable>
  );
}

// Thanh tiến độ dày kiểu Duolingo — track 14px bo tròn, fill có "mặt bóng" mảnh phía trên
export function ProgressBar({ value, color = C.spot, height = 14, style }: {
  value: number;               // 0..1
  color?: string;
  height?: number;
  style?: ViewStyle;
}) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={[{ height, borderRadius: height / 2, backgroundColor: C.sunken, overflow: "hidden" }, style]}>
      <View style={{ width: `${pct * 100}%`, height: "100%", borderRadius: height / 2, backgroundColor: color }}>
        <View style={{ height: Math.max(3, height * 0.28), marginTop: 2.5, marginHorizontal: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.35)" }} />
      </View>
    </View>
  );
}
