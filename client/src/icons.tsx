// Bộ icon tự thiết kế (SVG) — không dùng emoji làm icon UI (DESIGN.md).
// V2 "Sân khấu ấm 2.0": icon STICKER 2 lớp (đáy tối lệch xuống + thân fill + viền đậm)
// cho icon MANG NGHĨA (năng lượng, lửa, vé, sao, cúp); icon THAO TÁC giữ dạng tuyến.
import Svg, { Circle, G, Line, Path, Polygon, Polyline, Rect } from "react-native-svg";

type P = { size?: number; color?: string; fill?: boolean };
const S = (size = 24) => ({ width: size, height: size, viewBox: "0 0 24 24" });
const stroke = (c: string) => ({ stroke: c, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" });

// ===== Sticker icons (V2) — mỗi icon: lớp đáy tối (translate y+1.6) rồi thân fill + viền =====
type PS = { size?: number };

export const BoltSticker = ({ size }: PS) => (
  <Svg {...S(size)}>
    <G transform="translate(0, 1.6)"><Polygon points="13,2 5,13.5 11,13.5 10,22 19,10.5 12.5,10.5" fill="#C77F00" /></G>
    <Polygon points="13,2 5,13.5 11,13.5 10,22 19,10.5 12.5,10.5" fill="#FFC24B" stroke="#C77F00" strokeWidth={1.6} strokeLinejoin="round" />
  </Svg>
);

export const FireSticker = ({ size }: PS) => {
  const d = "M12 2.5c1 4-4.4 5.6-4.4 10a4.4 4.4 0 0 0 8.8 0c0-1.6-.8-3-.8-3s2.9 1.4 2.9 4.4a6.5 6.5 0 1 1-13 0C5.5 7.6 11 6.5 12 2.5z";
  return (
    <Svg {...S(size)}>
      <G transform="translate(0, 1.6)"><Path d={d} fill="#C4620E" /></G>
      <Path d={d} fill="#F5A623" stroke="#C4620E" strokeWidth={1.6} strokeLinejoin="round" />
      <Path d="M12 11c.5 2-1.8 2.8-1.8 4.7a1.9 1.9 0 0 0 3.8 0C14 13.8 12.6 12.6 12 11z" fill="#FFE29B" />
    </Svg>
  );
};

export const StarSticker = ({ size }: PS) => {
  const pts = "12,2 15,8.6 22,9.4 17,14.2 18.3,21.2 12,17.7 5.7,21.2 7,14.2 2,9.4 9,8.6";
  return (
    <Svg {...S(size)}>
      <G transform="translate(0, 1.6)"><Polygon points={pts} fill="#C7462F" /></G>
      <Polygon points={pts} fill="#FF6B5B" stroke="#C7462F" strokeWidth={1.6} strokeLinejoin="round" />
    </Svg>
  );
};

export const TicketSticker = ({ size }: PS) => {
  const d = "M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2.2 2.2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2.2 2.2 0 0 0 0-4V8z";
  return (
    <Svg {...S(size)}>
      <G transform="translate(0, 1.6)"><Path d={d} fill="#B8860B" /></G>
      <Path d={d} fill="#FFC24B" stroke="#B8860B" strokeWidth={1.6} strokeLinejoin="round" />
      <Line x1="14.5" y1="7" x2="14.5" y2="17" stroke="#B8860B" strokeWidth={1.6} strokeDasharray="2.4 2.2" />
    </Svg>
  );
};

export const TrophySticker = ({ size }: PS) => (
  <Svg {...S(size)}>
    <G transform="translate(0, 1.6)">
      <Path d="M7 3.5h10v5.5a5 5 0 0 1-10 0V3.5z" fill="#B8860B" />
      <Rect x="9" y="16.5" width="6" height="4" rx="1" fill="#B8860B" />
    </G>
    <Path d="M7 6H4.2a2.8 2.8 0 0 0 2.9 3.6M17 6h2.8a2.8 2.8 0 0 1-2.9 3.6" fill="none" stroke="#B8860B" strokeWidth={2} strokeLinecap="round" />
    <Path d="M7 3.5h10v5.5a5 5 0 0 1-10 0V3.5z" fill="#FFC24B" stroke="#B8860B" strokeWidth={1.6} strokeLinejoin="round" />
    <Rect x="10.8" y="13.5" width="2.4" height="4" fill="#FFC24B" stroke="#B8860B" strokeWidth={1.2} />
    <Rect x="8.5" y="17" width="7" height="3.5" rx="1" fill="#FFC24B" stroke="#B8860B" strokeWidth={1.4} />
  </Svg>
);

export const MicSticker = ({ size }: PS) => (
  <Svg {...S(size)}>
    <G transform="translate(0, 1.6)">
      <Rect x="8.6" y="2.5" width="6.8" height="11.5" rx="3.4" fill="#C7462F" />
    </G>
    <Rect x="8.6" y="2.5" width="6.8" height="11.5" rx="3.4" fill="#FF6B5B" stroke="#C7462F" strokeWidth={1.6} />
    <Path d="M5.6 10.5a6.4 6.4 0 0 0 12.8 0" fill="none" stroke="#C7462F" strokeWidth={2.2} strokeLinecap="round" />
    <Line x1="12" y1="17" x2="12" y2="20.5" stroke="#C7462F" strokeWidth={2.2} strokeLinecap="round" />
    <Line x1="8.5" y1="20.8" x2="15.5" y2="20.8" stroke="#C7462F" strokeWidth={2.2} strokeLinecap="round" />
  </Svg>
);

export const Target = ({ size, color = "#3B2A4A" }: P) => (
  <Svg {...S(size)}>
    <Circle cx="12" cy="12" r="8.5" {...stroke(color)} />
    <Circle cx="12" cy="12" r="4" {...stroke(color)} />
    <Circle cx="12" cy="12" r="1.2" fill={color} />
  </Svg>
);
export const Pin = ({ size, color = "#3B2A4A" }: P) => (
  <Svg {...S(size)}>
    <Path d="M12 21s-6.5-5.6-6.5-10.5a6.5 6.5 0 1 1 13 0C18.5 15.4 12 21 12 21z" {...stroke(color)} />
    <Circle cx="12" cy="10.5" r="2.4" {...stroke(color)} />
  </Svg>
);
export const ListIcon = ({ size, color = "#3B2A4A" }: P) => (
  <Svg {...S(size)}>
    <Line x1="9" y1="6" x2="20" y2="6" {...stroke(color)} />
    <Line x1="9" y1="12" x2="20" y2="12" {...stroke(color)} />
    <Line x1="9" y1="18" x2="20" y2="18" {...stroke(color)} />
    <Circle cx="4.8" cy="6" r="1.4" fill={color} />
    <Circle cx="4.8" cy="12" r="1.4" fill={color} />
    <Circle cx="4.8" cy="18" r="1.4" fill={color} />
  </Svg>
);

export const Refresh = ({ size, color = "#3B2A4A" }: P) => (
  <Svg {...S(size)}>
    <Path d="M20 11a8 8 0 1 0-2.2 6.3" {...stroke(color)} />
    <Polyline points="20 4 20 11 13 11" {...stroke(color)} />
  </Svg>
);

export const ChevronUp = ({ size, color = "#3B2A4A" }: P) => (
  <Svg {...S(size)}><Polyline points="5 15 12 8 19 15" {...stroke(color)} /></Svg>
);
export const ChevronDown = ({ size, color = "#3B2A4A" }: P) => (
  <Svg {...S(size)}><Polyline points="5 9 12 16 19 9" {...stroke(color)} /></Svg>
);
export const ChevronLeft = ({ size, color = "#3B2A4A" }: P) => (
  <Svg {...S(size)}><Polyline points="15 5 8 12 15 19" {...stroke(color)} /></Svg>
);

export const X = ({ size, color = "#3B2A4A" }: P) => (
  <Svg {...S(size)}>
    <Line x1="6" y1="6" x2="18" y2="18" {...stroke(color)} />
    <Line x1="18" y1="6" x2="6" y2="18" {...stroke(color)} />
  </Svg>
);

export const Play = ({ size, color = "#fff" }: P) => (
  <Svg {...S(size)}><Polygon points="8,5 19,12 8,19" fill={color} stroke={color} strokeWidth={2} strokeLinejoin="round" /></Svg>
);
export const Pause = ({ size, color = "#fff" }: P) => (
  <Svg {...S(size)}>
    <Rect x="6" y="5" width="4" height="14" rx="1.5" fill={color} />
    <Rect x="14" y="5" width="4" height="14" rx="1.5" fill={color} />
  </Svg>
);

export const SoundOn = ({ size, color = "#3B2A4A" }: P) => (
  <Svg {...S(size)}>
    <Path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z" {...stroke(color)} />
    <Path d="M15.5 9a4.2 4.2 0 0 1 0 6" {...stroke(color)} />
    <Path d="M18 6.5a8 8 0 0 1 0 11" {...stroke(color)} />
  </Svg>
);
export const SoundOff = ({ size, color = "#3B2A4A" }: P) => (
  <Svg {...S(size)}>
    <Path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z" {...stroke(color)} />
    <Line x1="15.5" y1="9.5" x2="20.5" y2="14.5" {...stroke(color)} />
    <Line x1="20.5" y1="9.5" x2="15.5" y2="14.5" {...stroke(color)} />
  </Svg>
);

export const Mail = ({ size, color = "#3B2A4A" }: P) => (
  <Svg {...S(size)}>
    <Rect x="3" y="5" width="18" height="14" rx="2.5" {...stroke(color)} />
    <Polyline points="4 7.5 12 13 20 7.5" {...stroke(color)} />
  </Svg>
);

export const Bulb = ({ size, color = "#F5A623" }: P) => (
  <Svg {...S(size)}>
    <Path d="M12 3a6 6 0 0 0-3.6 10.8c.7.55 1.1 1.2 1.1 2.2h5c0-1 .4-1.65 1.1-2.2A6 6 0 0 0 12 3z" {...stroke(color)} />
    <Line x1="9.5" y1="19" x2="14.5" y2="19" {...stroke(color)} />
    <Line x1="10.5" y1="21.5" x2="13.5" y2="21.5" {...stroke(color)} />
  </Svg>
);

export const Bolt = ({ size, color = "#F5A623" }: P) => (
  <Svg {...S(size)}>
    <Polygon points="13,2 5,13.5 11,13.5 10,22 19,10.5 12.5,10.5"
      fill={color} stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
  </Svg>
);

export const Mic = ({ size, color = "#3B2A4A" }: P) => (
  <Svg {...S(size)}>
    <Rect x="9" y="3" width="6" height="11" rx="3" {...stroke(color)} />
    <Path d="M6 11a6 6 0 0 0 12 0" {...stroke(color)} />
    <Line x1="12" y1="17" x2="12" y2="21" {...stroke(color)} />
    <Line x1="8" y1="21" x2="16" y2="21" {...stroke(color)} />
  </Svg>
);
export const Lock = ({ size, color = "#3B2A4A" }: P) => (
  <Svg {...S(size)}>
    <Rect x="5" y="10.5" width="14" height="9.5" rx="2.2" {...stroke(color)} />
    <Path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" {...stroke(color)} />
  </Svg>
);
export const Check = ({ size, color = "#fff" }: P) => (
  <Svg {...S(size)}>
    <Polyline points="5 12.5 10 17.5 19 6.5" {...stroke(color)} strokeWidth={2.6} />
  </Svg>
);
export const Fire = ({ size, color = "#FFC24B" }: P) => (
  <Svg {...S(size)}>
    <Path d="M12.2 2.6c.7 2.5-.8 3.7-2 4.9C8.8 8.9 8 10.3 8 12.5a4 4 0 0 0 8 0c0-1.5-.5-2.5-1.2-3.4.9.3 1.5 1 1.8 1.9C17.2 8.6 15.4 5 12.2 2.6Z" fill={color} />
  </Svg>
);
export const Ticket = ({ size, color = "#E0A62F" }: P) => (
  <Svg {...S(size)}>
    <Path d="M4 8.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2V10a2 2 0 0 0 0 4v1.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V14a2 2 0 0 0 0-4Z" {...stroke(color)} />
    <Line x1="12.5" y1="7" x2="12.5" y2="17" {...stroke(color)} strokeDasharray="1.6 2.2" />
  </Svg>
);
export const Star = ({ size, color = "#FF6B5B", fill }: P) => (
  <Svg {...S(size)}>
    <Polygon points="12 3.2 14.5 9 20.7 9.6 16 13.9 17.5 20 12 16.8 6.5 20 8 13.9 3.3 9.6 9.5 9" {...(fill ? { fill: color } : stroke(color))} />
  </Svg>
);
export const Cap = ({ size, color = "#3B2A4A" }: P) => (
  <Svg {...S(size)}>
    <Path d="M2 9.2 12 5l10 4.2-10 4.2Z" {...stroke(color)} />
    <Path d="M6 11v4.8c0 1.6 2.7 3 6 3s6-1.4 6-3V11" {...stroke(color)} />
    <Line x1="22" y1="9.2" x2="22" y2="14.5" {...stroke(color)} />
  </Svg>
);
export const Flag = ({ size, color = "#C7A86F" }: P) => (
  <Svg {...S(size)}>
    <Line x1="6" y1="21" x2="6" y2="4" {...stroke(color)} />
    <Path d="M6 4h11l-2.5 3.5L17 11H6Z" {...stroke(color)} />
  </Svg>
);
export const Chart = ({ size, color = "#3B2A4A" }: P) => (
  <Svg {...S(size)}>
    <Path d="M4 17l5-5 3 3 7.5-8" {...stroke(color)} />
    <Path d="M20 7v4h-4" {...stroke(color)} />
  </Svg>
);
export const Trophy = ({ size, color = "#3B2A4A" }: P) => (
  <Svg {...S(size)}>
    <Path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" {...stroke(color)} />
    <Path d="M7 6H4a2 2 0 0 0 2 4M17 6h3a2 2 0 0 1-2 4" {...stroke(color)} />
    <Line x1="12" y1="13" x2="12" y2="17" {...stroke(color)} />
    <Path d="M8 20h8M9.5 20v-3h5v3" {...stroke(color)} />
  </Svg>
);
export const User = ({ size, color = "#3B2A4A" }: P) => (
  <Svg {...S(size)}>
    <Circle cx="12" cy="8" r="3.5" {...stroke(color)} />
    <Path d="M5.5 20a6.5 6.5 0 0 1 13 0" {...stroke(color)} />
  </Svg>
);
export const MapIcon = ({ size, color = "#3B2A4A" }: P) => (
  <Svg {...S(size)}>
    <Path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4Z" {...stroke(color)} />
    <Line x1="9" y1="4" x2="9" y2="17" {...stroke(color)} />
    <Line x1="15" y1="6.5" x2="15" y2="19.5" {...stroke(color)} />
  </Svg>
);
