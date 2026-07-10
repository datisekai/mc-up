// Misa — mascot McUp: cái MICRO SỐNG (DESIGN.md V2 §Mascot).
// 6 cảm xúc theo bảng nhịp trong EXPERIENCE.md; tối đa 1 Misa/màn,
// KHÔNG hiện khi user đang nói (không giành sân khấu).
import Svg, { Circle, Ellipse, G, Line, Path, Polygon, Rect, Text as SvgText } from "react-native-svg";

export type MisaMood = "chao" | "covu" | "anmung" | "lo" | "ngu" | "tambiet";

const CORAL = "#FF6B5B";
const CORAL_D = "#C7462F";
const PLUM = "#3B2A4A";
const GOLD = "#FFC24B";

export default function Misa({ mood = "chao", size = 96 }: { mood?: MisaMood; size?: number }) {
  return (
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
      <Path d="M29 29 q21 -10 42 0 M26 39 h48 M29 49 q21 10 42 0" stroke="#E85445" strokeWidth={2.6} fill="none" />

      {/* mặt theo mood */}
      {mood === "anmung" ? (
        <>
          {/* mắt sao */}
          <Polygon points="41,30 43,34.5 48,35 44.5,38.5 45.5,43.5 41,40.8 36.5,43.5 37.5,38.5 34,35 39,34.5" fill="#fff" />
          <Polygon points="59,30 61,34.5 66,35 62.5,38.5 63.5,43.5 59,40.8 54.5,43.5 55.5,38.5 52,35 57,34.5" fill="#fff" />
          <Ellipse cx="50" cy="50" rx="7" ry="7.5" fill={PLUM} />
          <Ellipse cx="50" cy="53" rx="4" ry="3" fill="#FF9C90" />
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
          <SvgText x="72" y="16" fontSize="14" fontWeight="bold" fill="#7A6E82">z</SvgText>
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
          <Ellipse cx="33" cy="45" rx="3.6" ry="2.4" fill="#FF9C90" />
          <Ellipse cx="67" cy="45" rx="3.6" ry="2.4" fill="#FF9C90" />
        </>
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
  );
}
