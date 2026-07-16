// Bộ SCENE minh hoạ theo thể loại (P1-3 feedback "bài học toàn chữ") — SVG phẳng
// kiểu sticker V2, suy từ TÊN THỂ LOẠI phía client (không cần backend/admin).
// Dùng ở đầu thẻ đề bài màn thu — cho bài học "có không khí" của tình huống thật.
import Svg, { Circle, Ellipse, Line, Path, Polygon, Rect } from "react-native-svg";

const PLUM = "#2E2239";
const CORAL = "#F2503C";
const GOLD = "#FFC24B";
const CREAM = "#FFEFC9";
const WARM = "#F2D9C4";      // be ấm trung tính (thay hồng/lam/xanh lạ)
const CORALSOFT = "#FFD9D0"; // san hô nhạt

// Sân khấu đám cưới: cổng hoa + đôi nhẫn
const Wedding = ({ w }: { w: number }) => (
  <Svg width={w} height={w * 0.42} viewBox="0 0 300 126">
    <Rect x="0" y="98" width="300" height="28" fill="#EADCC8" />
    <Path d="M60 110 V52 a90 62 0 0 1 180 0 V110" fill="none" stroke={CORALSOFT} strokeWidth="14" />
    <Circle cx="60" cy="58" r="9" fill={CORAL} /><Circle cx="240" cy="58" r="9" fill={CORAL} />
    <Circle cx="86" cy="26" r="8" fill={CORALSOFT} /><Circle cx="214" cy="26" r="8" fill={CORALSOFT} />
    <Circle cx="150" cy="12" r="9" fill={CORAL} />
    <Circle cx="138" cy="74" r="15" fill="none" stroke={GOLD} strokeWidth="5.5" />
    <Circle cx="163" cy="74" r="15" fill="none" stroke={GOLD} strokeWidth="5.5" />
    <Polygon points="150,50 155,58 145,58" fill={GOLD} />
  </Svg>
);

// Sân khấu sự kiện/gala: bục + đèn rọi + hoa giấy
const Event = ({ w }: { w: number }) => (
  <Svg width={w} height={w * 0.42} viewBox="0 0 300 126">
    <Rect x="0" y="98" width="300" height="28" fill="#EADCC8" />
    <Polygon points="70,0 40,98 130,98" fill={GOLD} opacity="0.28" />
    <Polygon points="230,0 170,98 260,98" fill={GOLD} opacity="0.28" />
    <Rect x="110" y="62" width="80" height="40" rx="8" fill={PLUM} />
    <Rect x="138" y="34" width="24" height="34" rx="6" fill={CORAL} />
    <Circle cx="150" cy="26" r="12" fill={CORAL} stroke={PLUM} strokeWidth="3" />
    <Circle cx="56" cy="30" r="5" fill={CORAL} /><Rect x="242" y="20" width="9" height="9" rx="2" fill={GOLD} />
    <Circle cx="270" cy="52" r="4" fill={WARM} /><Rect x="30" y="60" width="8" height="8" rx="2" fill={CORALSOFT} />
  </Svg>
);

// Livestream: điện thoại + tim bay + nút LIVE
const Live = ({ w }: { w: number }) => (
  <Svg width={w} height={w * 0.42} viewBox="0 0 300 126">
    <Rect x="0" y="98" width="300" height="28" fill="#EADCC8" />
    <Rect x="112" y="8" width="76" height="112" rx="14" fill={PLUM} />
    <Rect x="120" y="18" width="60" height="86" rx="8" fill={CREAM} />
    <Circle cx="150" cy="52" r="14" fill={CORAL} />
    <Rect x="143" y="66" width="14" height="20" rx="6" fill={CORAL} />
    <Rect x="126" y="24" width="26" height="12" rx="6" fill={CORAL} />
    <Path d="M210 84 c8 -10 22 -2 12 10 l-12 10 l-12 -10 c-10 -12 4 -20 12 -10z" fill={CORAL} />
    <Path d="M236 48 c6 -8 17 -1 9 8 l-9 8 l-9 -8 c-8 -9 3 -16 9 -8z" fill={CORALSOFT} />
    <Path d="M74 62 c6 -8 17 -1 9 8 l-9 8 l-9 -8 c-8 -9 3 -16 9 -8z" fill={GOLD} />
  </Svg>
);

// Kỹ năng nói / mặc định: bục phát biểu + mic + khán giả
const Stage = ({ w }: { w: number }) => (
  <Svg width={w} height={w * 0.42} viewBox="0 0 300 126">
    <Rect x="0" y="98" width="300" height="28" fill="#EADCC8" />
    <Path d="M150 6 L96 98 h108 Z" fill={GOLD} opacity="0.25" />
    <Rect x="126" y="58" width="48" height="44" rx="7" fill={PLUM} />
    <Rect x="146" y="34" width="8" height="26" rx="4" fill={PLUM} />
    <Rect x="139" y="20" width="22" height="20" rx="10" fill={CORAL} stroke={PLUM} strokeWidth="3" />
    <Circle cx="52" cy="108" r="10" fill={WARM} /><Circle cx="86" cy="112" r="10" fill={CORALSOFT} />
    <Circle cx="216" cy="112" r="10" fill={WARM} /><Circle cx="250" cy="108" r="10" fill={CORALSOFT} />
    <Line x1="126" y1="70" x2="174" y2="70" stroke={GOLD} strokeWidth="4" />
  </Svg>
);

// Suy scene từ tên thể loại — thêm genre mới chỉ cần thêm keyword
export default function GenreScene({ genre = "", width = 300 }: { genre?: string; width?: number }) {
  const g = genre.toLowerCase();
  if (g.includes("cưới")) return <Wedding w={width} />;
  if (g.includes("sự kiện") || g.includes("gala")) return <Event w={width} />;
  if (g.includes("livestream") || g.includes("live")) return <Live w={width} />;
  return <Stage w={width} />;
}
