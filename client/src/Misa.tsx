// Misa — mascot McUp: cái MICRO SỐNG (DESIGN.md V2 §Mascot).
// 6 cảm xúc theo bảng nhịp trong EXPERIENCE.md; tối đa 1 Misa/màn,
// KHÔNG hiện khi user đang nói (không giành sân khấu).
//
// V3 (feedback vòng 3): Misa CÓ SỰ SỐNG — thở (bob), chớp mắt, và cử động theo mood:
// chào/tạm biệt = lắc lư nghiêng đầu · ăn mừng = nhảy · lo = run rẩy. Chạy native driver;
// tắt khi máy bật Giảm chuyển động hoặc prop `still`.
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated } from "react-native";
import Svg, { Circle, Ellipse, G, Line, Path, Polygon, Rect, Text as SvgText } from "react-native-svg";

export type MisaMood = "chao" | "covu" | "anmung" | "lo" | "ngu" | "tambiet";

const PLUM = "#2E2239";
const GOLD = "#FFC24B";
// bảng màu thân Misa (shop): [thân, tối, má hồng]
const SKINS: Record<string, [string, string, string]> = {
  coral: ["#F2503C", "#B33724", "#FF9C90"],
  mint: ["#3FB984", "#2E9668", "#8FE0C4"],
  sky: ["#5AA9E6", "#3B7CB8", "#A9D4F5"],
  grape: ["#9B6FD4", "#6E48A8", "#C9AEEB"],
  gold: ["#F5B841", "#C7900B", "#FCE0A0"],
  rose: ["#F48AB0", "#C25E86", "#FBC2D8"],
};
let _skinColor = "coral";
let _skinOutfit: string | null = null;
export function setMisaSkin(color?: string | null, outfit?: string | null) {
  _skinColor = color && SKINS[color] ? color : "coral";
  _skinOutfit = outfit ?? null;
}

export type MisaAccessory = "bowtie" | "headset" | "tophat" | "party" | "crown" | "glasses" | "scarf" | null;

export default function Misa({ mood = "chao", size = 96, still = false, accessory, color }: {
  mood?: MisaMood; size?: number; still?: boolean; accessory?: MisaAccessory; color?: string;
}) {
  // nếu không truyền → dùng skin user đang mặc (đặt qua setMisaSkin)
  const skinId = color ?? _skinColor;
  const [CORAL, CORAL_D, CHEEK] = SKINS[skinId] ?? SKINS.coral;
  const outfit: MisaAccessory = accessory !== undefined ? accessory : (_skinOutfit as MisaAccessory);
  const [reduced, setReduced] = useState(false);
  const bob = useRef(new Animated.Value(0)).current;   // thở — mọi mood
  const aux = useRef(new Animated.Value(0)).current;   // cử động riêng theo mood
  const blink = useRef(new Animated.Value(0)).current; // chớp mắt

  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setReduced); }, []);

  const canBlink = mood === "chao" || mood === "covu" || mood === "tambiet" || mood === "lo";

  useEffect(() => {
    if (still || reduced) return;
    const loops: Animated.CompositeAnimation[] = [];
    // thở: nhấp nhô nhẹ liên tục
    loops.push(Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 1150, useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 1150, useNativeDriver: true }),
    ])));
    if (mood === "anmung") {
      // nhảy tưng tưng
      loops.push(Animated.loop(Animated.sequence([
        Animated.timing(aux, { toValue: 1, duration: 240, useNativeDriver: true }),
        Animated.spring(aux, { toValue: 0, damping: 5, useNativeDriver: true }),
        Animated.delay(520),
      ])));
    } else if (mood === "lo") {
      // run rẩy khe khẽ
      loops.push(Animated.loop(Animated.sequence([
        Animated.timing(aux, { toValue: 1, duration: 80, useNativeDriver: true }),
        Animated.timing(aux, { toValue: -1, duration: 160, useNativeDriver: true }),
        Animated.timing(aux, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.timing(aux, { toValue: 0, duration: 80, useNativeDriver: true }),
        Animated.delay(1100),
      ])));
    } else if (mood === "chao" || mood === "tambiet") {
      // lắc lư nghiêng người chào
      loops.push(Animated.loop(Animated.sequence([
        Animated.timing(aux, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.timing(aux, { toValue: -1, duration: 760, useNativeDriver: true }),
        Animated.timing(aux, { toValue: 0, duration: 380, useNativeDriver: true }),
        Animated.delay(1500),
      ])));
    }
    if (canBlink) {
      loops.push(Animated.loop(Animated.sequence([
        Animated.delay(2400 + Math.random() * 2000),
        Animated.timing(blink, { toValue: 1, duration: 70, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 0, duration: 110, useNativeDriver: true }),
      ])));
    }
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [mood, still, reduced]);

  const k = size / 100; // viewBox 100x130 → px
  const transform: any[] = [
    { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -0.035 * size] }) },
  ];
  if (mood === "anmung") transform.push({ translateY: aux.interpolate({ inputRange: [0, 1], outputRange: [0, -0.13 * size] }) });
  if (mood === "lo") transform.push({ translateX: aux.interpolate({ inputRange: [-1, 1], outputRange: [-0.025 * size, 0.025 * size] }) });
  if (mood === "chao" || mood === "tambiet") transform.push({ rotate: aux.interpolate({ inputRange: [-1, 1], outputRange: ["-5deg", "5deg"] }) });

  return (
    <Animated.View style={{ width: size, height: size * 1.3, transform }}>
      <Svg width={size} height={size * 1.3} viewBox="0 0 100 130">
        {/* thân/chân đế mic */}
        <Rect x="41" y="61" width="18" height="34" rx="8" fill={PLUM} />
        <Rect x="33" y="96" width="34" height="8" rx="4" fill={PLUM} />

        {/* tay — theo mood */}
        {(mood === "covu" || mood === "anmung") ? (
          <>
            <Path d="M28 58 q-14 -13 -7 -25" stroke={PLUM} strokeWidth={5.5} fill="none" strokeLinecap="round" />
            <Path d="M72 58 q14 -13 7 -25" stroke={PLUM} strokeWidth={5.5} fill="none" strokeLinecap="round" />
          </>
        ) : mood === "chao" || mood === "tambiet" ? (
          <>
            <Path d="M30 76 q-13 -3 -11 -13" stroke={PLUM} strokeWidth={5.5} fill="none" strokeLinecap="round" />
            <Path d="M71 62 q13 -10 8 -22" stroke={PLUM} strokeWidth={5.5} fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <Path d="M30 78 q-12 -3 -10 -13" stroke={PLUM} strokeWidth={5.5} fill="none" strokeLinecap="round" />
            <Path d="M70 78 q12 -3 10 -13" stroke={PLUM} strokeWidth={5.5} fill="none" strokeLinecap="round" />
          </>
        )}

        {/* đầu mic */}
        <Circle cx="50" cy="37" r="27" fill={CORAL} stroke={PLUM} strokeWidth={4.5} />
        {/* lưới mic mờ */}
        <Path d="M29 29 q21 -10 42 0 M26 39 h48 M29 49 q21 10 42 0" stroke={CORAL_D} strokeWidth={2.6} fill="none" />

        {/* mặt theo mood */}
        {mood === "anmung" ? (
          <>
            <Polygon points="41,30 43,34.5 48,35 44.5,38.5 45.5,43.5 41,40.8 36.5,43.5 37.5,38.5 34,35 39,34.5" fill="#fff" />
            <Polygon points="59,30 61,34.5 66,35 62.5,38.5 63.5,43.5 59,40.8 54.5,43.5 55.5,38.5 52,35 57,34.5" fill="#fff" />
            <Ellipse cx="50" cy="50" rx="7" ry="7.5" fill={PLUM} />
            <Ellipse cx="50" cy="53" rx="4" ry="3" fill={CHEEK} />
          </>
        ) : mood === "covu" ? (
          <>
            <Circle cx="41" cy="35" r="6" fill="#fff" /><Circle cx="42.5" cy="36" r="3.2" fill={PLUM} />
            <Circle cx="59" cy="35" r="6" fill="#fff" /><Circle cx="60.5" cy="36" r="3.2" fill={PLUM} />
            <Ellipse cx="50" cy="49" rx="6.5" ry="7" fill={PLUM} />
          </>
        ) : mood === "lo" ? (
          <>
            <Path d="M35 28 l10 4 M65 28 l-10 4" stroke={PLUM} strokeWidth={3.2} strokeLinecap="round" />
            <Circle cx="41" cy="37" r="5.5" fill="#fff" /><Circle cx="41.8" cy="38" r="2.8" fill={PLUM} />
            <Circle cx="59" cy="37" r="5.5" fill="#fff" /><Circle cx="58.2" cy="38" r="2.8" fill={PLUM} />
            <Path d="M43 51 q7 -4.5 14 0" stroke={PLUM} strokeWidth={3.4} fill="none" strokeLinecap="round" />
            <Path d="M73 24 q4 5 0 9 q-4 -4 0 -9" fill="#8FD3F4" />
          </>
        ) : mood === "ngu" ? (
          <>
            <Path d="M36 38 q5 -4 10 0 M54 38 q5 -4 10 0" stroke={PLUM} strokeWidth={3.4} fill="none" strokeLinecap="round" />
            <Ellipse cx="50" cy="51" rx="4.5" ry="3.6" fill={PLUM} />
            <SvgText x="72" y="16" fontSize="14" fontWeight="bold" fill="#6B5F73">z</SvgText>
            <SvgText x="81" y="9" fontSize="11" fontWeight="bold" fill="#9A8EA5">z</SvgText>
          </>
        ) : mood === "tambiet" ? (
          <>
            <Circle cx="41" cy="36" r="5.5" fill="#fff" /><Circle cx="42" cy="37" r="2.9" fill={PLUM} />
            <Circle cx="59" cy="36" r="5.5" fill="#fff" /><Circle cx="60" cy="37" r="2.9" fill={PLUM} />
            <Path d="M44 49 q6 4 12 0" stroke={PLUM} strokeWidth={3.4} fill="none" strokeLinecap="round" />
          </>
        ) : (
          /* chao — mặc định */
          <>
            <Circle cx="41" cy="35" r="6" fill="#fff" /><Circle cx="42.5" cy="36" r="3.2" fill={PLUM} />
            <Circle cx="59" cy="35" r="6" fill="#fff" /><Circle cx="60.5" cy="36" r="3.2" fill={PLUM} />
            <Path d="M42 47 q8 7 16 0" stroke={PLUM} strokeWidth={3.6} fill="none" strokeLinecap="round" />
            <Ellipse cx="33" cy="45" rx="3.6" ry="2.4" fill={CHEEK} />
            <Ellipse cx="67" cy="45" rx="3.6" ry="2.4" fill={CHEEK} />
          </>
        )}

        {/* phụ kiện theo ngữ cảnh bài (P2) */}
        {outfit === "bowtie" && (
          <G>
            <Polygon points="50,62 38,55 38,69" fill={CORAL_D} />
            <Polygon points="50,62 62,55 62,69" fill={CORAL_D} />
            <Circle cx="50" cy="62" r="4.5" fill={GOLD} />
          </G>
        )}
        {outfit === "headset" && (
          <G>
            <Path d="M25 34 a25 25 0 0 1 50 0" stroke={PLUM} strokeWidth={5} fill="none" />
            <Rect x="20" y="32" width="9" height="14" rx="4.5" fill={PLUM} />
            <Rect x="71" y="32" width="9" height="14" rx="4.5" fill={PLUM} />
            <Path d="M76 46 q2 10 -8 12" stroke={PLUM} strokeWidth={3.5} fill="none" />
          </G>
        )}
        {outfit === "tophat" && (
          <G>
            <Rect x="26" y="15" width="48" height="6" rx="3" fill={PLUM} />
            <Rect x="34" y="-4" width="32" height="22" rx="3" fill={PLUM} />
            <Rect x="34" y="10" width="32" height="5" fill={GOLD} />
          </G>
        )}
        {outfit === "party" && (
          <G>
            <Polygon points="50,-6 40,16 60,16" fill={CORAL} stroke={PLUM} strokeWidth={2} />
            <Circle cx="50" cy="-6" r="4" fill={GOLD} />
            <Circle cx="46" cy="8" r="2" fill="#fff" /><Circle cx="54" cy="4" r="2" fill={GOLD} /><Circle cx="50" cy="12" r="2" fill="#fff" />
          </G>
        )}
        {outfit === "crown" && (
          <G>
            <Path d="M30 14 L34 0 L42 10 L50 -4 L58 10 L66 0 L70 14 Z" fill={GOLD} stroke="#C7900B" strokeWidth={2} strokeLinejoin="round" />
            <Circle cx="42" cy="8" r="2.4" fill={CORAL} /><Circle cx="50" cy="4" r="2.6" fill="#E24B4A" /><Circle cx="58" cy="8" r="2.4" fill={CORAL} />
          </G>
        )}
        {outfit === "glasses" && (
          <G>
            <Rect x="30" y="30" width="16" height="11" rx="4" fill="#2A2036" opacity={0.9} />
            <Rect x="54" y="30" width="16" height="11" rx="4" fill="#2A2036" opacity={0.9} />
            <Line x1="46" y1="34" x2="54" y2="34" stroke={PLUM} strokeWidth={3} />
          </G>
        )}
        {outfit === "scarf" && (
          <G>
            <Path d="M28 60 q22 12 44 0 l0 8 q-22 10 -44 0 Z" fill="#E24B4A" stroke={PLUM} strokeWidth={2} />
            <Path d="M60 66 l8 20 l-7 2 l-6 -18 Z" fill="#C7382F" stroke={PLUM} strokeWidth={2} />
          </G>
        )}

        {/* sao ăn mừng */}
        {mood === "anmung" && (
          <G>
            <Polygon points="18,14 20.5,20 27,20.8 22.5,25 23.5,31.5 18,28 12.5,31.5 13.5,25 9,20.8 15.5,20" fill={GOLD} />
            <Polygon points="83,8 84.8,12.5 89.5,13 86,16.2 86.8,21 83,18.5 79.2,21 80,16.2 76.5,13 81.2,12.5" fill={GOLD} />
            <Circle cx="88" cy="34" r="3" fill={GOLD} />
          </G>
        )}
      </Svg>

      {/* mí mắt chớp — phủ đúng vùng 2 mắt, cùng màu đầu mic */}
      {canBlink && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute", opacity: blink,
            left: 32 * k, top: (mood === "lo" ? 30 : 28) * k,
            width: 36 * k, height: 14 * k, borderRadius: 7 * k,
            backgroundColor: CORAL, flexDirection: "row",
            justifyContent: "space-around", alignItems: "center", paddingHorizontal: 3 * k,
          }}
        >
          <Animated.View style={{ width: 10 * k, height: 2.6 * k, borderRadius: 2 * k, backgroundColor: PLUM }} />
          <Animated.View style={{ width: 10 * k, height: 2.6 * k, borderRadius: 2 * k, backgroundColor: PLUM }} />
        </Animated.View>
      )}
    </Animated.View>
  );
}


// Logo wordmark phương án 2 (Finn chốt 2026-07-10): đầu Misa THAY chữ "U".
// Dùng ở header app; landing/app-icon có bản SVG/PNG riêng cùng ngôn ngữ.
export function MisaHead({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Circle cx="24" cy="24" r="21" fill="#F2503C" stroke={PLUM} strokeWidth={4} />
      <Circle cx="17" cy="22" r="4.6" fill="#fff" /><Circle cx="18.2" cy="23" r="2.5" fill={PLUM} />
      <Circle cx="31" cy="22" r="4.6" fill="#fff" /><Circle cx="32.2" cy="23" r="2.5" fill={PLUM} />
      <Path d="M17.5 31 q6.5 5.5 13 0" stroke={PLUM} strokeWidth={3} fill="none" strokeLinecap="round" />
    </Svg>
  );
}
