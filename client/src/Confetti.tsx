// Confetti.tsx — 3 biến thể confetti tự vẽ (P0-cam-xuc-spec §1.4), không lib nặng.
// A "Giấy sân khấu" · B "Sao lấp lánh" · C "Ruy-băng". Xoay ngẫu nhiên qua pickVariant().
import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from "react-native";
import Svg, { Path } from "react-native-svg";
import { ConfettiVariant } from "./variety";

const COLORS = ["#F2503C", "#FFC24B", "#F5A623", "#FFB4A6", "#FFFFFF"];

type Piece = {
  x: number; y: number; fall: number; rot: string; delay: number;
  size: number; color: string; anim: Animated.Value;
};

function makePieces(n: number, spread: number): Piece[] {
  return Array.from({ length: n }, (_, i) => {
    const ang = Math.random() * Math.PI * 2;
    const dist = 50 + Math.random() * spread;
    return {
      x: Math.cos(ang) * dist,
      y: Math.sin(ang) * dist * 0.7 - 40,
      fall: 150 + Math.random() * 170,
      rot: `${Math.round(Math.random() * 720 - 360)}deg`,
      delay: Math.random() * 120,
      size: 7 + Math.random() * 7,
      color: COLORS[i % COLORS.length],
      anim: new Animated.Value(0),
    };
  });
}

function Star({ size, color }: { size: number; color: string }) {
  const s = size / 2;
  return (
    <Svg width={size} height={size} viewBox="-10 -10 20 20">
      <Path d="M0 -9 L2.2 -2.2 L9 0 L2.2 2.2 L0 9 L-2.2 2.2 L-9 0 L-2.2 -2.2 Z" fill={color} />
    </Svg>
  );
}

export default function Confetti({ variant, count = 36, onDone }: {
  variant: ConfettiVariant; count?: number; onDone?: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const pieces = useRef(makePieces(variant === "B" ? Math.round(count * 0.8) : count, width * 0.42)).current;

  useEffect(() => {
    const anims = pieces.map((p) =>
      Animated.timing(p.anim, {
        toValue: 1,
        duration: 1500 + Math.random() * 500,
        delay: p.delay,
        easing: Easing.bezier(0.15, 0.6, 0.4, 1),
        useNativeDriver: true,
      })
    );
    Animated.parallel(anims).start(() => onDone?.());
  }, []);

  const cx = width / 2;
  const cy = height * 0.42;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((p, i) => {
        const tx = p.anim.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, p.x, p.x] });
        // B "sao" bay lơ lửng (ít trọng lực); A/C rơi
        const gravity = variant === "B" ? p.fall * 0.35 : p.fall;
        const ty = p.anim.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, p.y, p.y + gravity] });
        const rot = p.anim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", p.rot] });
        const op = p.anim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] });
        return (
          <Animated.View
            key={i}
            style={{
              position: "absolute", left: cx, top: cy, opacity: op,
              transform: [{ translateX: tx }, { translateY: ty }, { rotate: rot }],
            }}
          >
            {variant === "B" ? (
              <Star size={p.size + 6} color={p.color} />
            ) : variant === "C" ? (
              <View style={{ width: 5, height: p.size + 12, borderRadius: 3, backgroundColor: p.color }} />
            ) : (
              <View style={{ width: p.size, height: p.size + 3, borderRadius: 2, backgroundColor: p.color }} />
            )}
          </Animated.View>
        );
      })}
    </View>
  );
}
