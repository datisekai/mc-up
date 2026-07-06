// variety.ts — module ngẫu nhiên chống lặp (P0-cam-xuc-spec §3).
// Ghi nhớ lựa chọn trước theo key để KHÔNG lặp y hệt 2 lần liên tiếp.

const _last: Record<string, number> = {};

export function pick(pool: string[], key = "_"): string {
  if (pool.length === 0) return "";
  if (pool.length === 1) return pool[0];
  let i: number;
  do {
    i = Math.floor(Math.random() * pool.length);
  } while (i === _last[key]);
  _last[key] = i;
  return pool[i];
}

export type ConfettiVariant = "A" | "B" | "C";
export function pickVariant(): ConfettiVariant {
  return pick(["A", "B", "C"], "confetti") as ConfettiVariant;
}

export function fill(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

// ===== POOLS (P0 §3.2–3.7) — tông Gen Z, ấm, không phán xét =====

export const TIP_GOOD = [
  "Mượt như MC thứ thiệt luôn á 🔥",
  "Chuẩn cái chất đó, tới luôn!",
  "Nghe là thấy tự tin hơn hẳn rồi 👏",
  "Ổn áp! Giọng bạn đang lên tay thật sự",
  "Đỉnh — câu dẫn gọn mà có lửa",
  "Giữ nhịp ngon nghẻ ghê, tiếp nào!",
  "Cuốn thật sự đó nha, giữ phong độ!",
  "Perfect nhịp luôn, bạn đang bay đó",
];

export const TIP_FAST = [
  "Hơi vội xíu — thả chậm một nhịp ở câu mở nha",
  "Năng lượng ngon rồi, ghìm lại tí cho người nghe kịp bắt",
  "Nhanh gọn đó! Chỉ cần chậm ở đoạn quan trọng thôi",
  "Gần rồi — hít một hơi, chậm lại nửa nhịp là chuẩn",
];

export const TIP_SLOW = [
  "Thêm chút lửa cho cuốn hơn nha!",
  "Đẩy nhịp nhanh hơn xíu, người nghe sẽ mê hơn",
  "Nhấn nhá tốt — tăng tốc một nhịp là bắt tai liền",
];

export const TIP_FILLER = [
  "Bạn đang tiến bộ — để ý bớt 'ừm/à' xíu nha",
  "Sắp mượt rồi! Bỏ vài tiếng đệm là câu dẫn trọn vẹn",
  "Ngon rồi đó — thử nuốt bớt 'ừm' cho gọn nào",
];

export const CELEB_TICKET = [
  "Bạn có 1 Vé Vàng! 🎟️",
  "Vé Vàng về tay!",
  "Xịn! 1 Vé Vàng cho bạn",
];
export const CELEB_TIER = [
  "Lên hạng {tier}! 🏆",
  "Chào mừng hạng {tier}!",
  "Bạn vừa lên {tier}!",
];
export const CELEB_STREAK = [
  "Chuỗi {n} ngày! 🔥",
  "{n} ngày liên tục, đỉnh!",
  "Giữ lửa {n} ngày rồi đó!",
];
export const CELEB_XP = [
  "{xp} XP! Bạn chăm ghê",
  "Cột mốc {xp} XP 🌟",
  "{xp} XP — đang bay!",
];

export const CELEB_SUB: Record<string, string[]> = {
  ticket: [
    "Tiêu vé để MC thật nghe bạn dẫn",
    "Gửi clip cho MC thật nhận xét nhé",
    "Một tấm vé — một lời khuyên từ nghề",
  ],
  tier: ["Giải đấu đang gọi tên bạn", "Phong độ này giữ là lên nữa"],
  streak: ["Thói quen nhỏ, sân khấu lớn", "Đều tay là lên tay"],
  xp: ["Từng bài một, chắc từng bước", "Chăm thế này MC thật cũng nể"],
};

export const STREAK_GREET = [
  "Chuỗi {n} ngày đang chờ bạn tối nay 🔥",
  "Ngày thứ {n} rồi — giữ lửa nào!",
  "Đừng để chuỗi {n} ngày nguội nha",
];

// Chip so sánh khi TỆ hơn lần trước — trung tính, không chê (P0 §2.2)
export const COMPARE_WORSE = [
  "Nhiều 'ừm' hơn xíu — bình thường thôi, thử lại nhé",
  "Hôm nay hơi khớp nhịp — lần sau bạn gỡ lại được",
];

// Chọn tip theo kết quả chấm (thay chuỗi cố định server trả về khi muốn đa dạng)
export function tipFor(score: { speed_wpm: number; filler_count: number; tip: string }): string {
  const t = score.tip || "";
  // server đã chọn đúng tình huống theo rubric thể loại — chỉ đa dạng hoá câu chữ
  if (/chậm lại|ghìm|vội|nhanh/i.test(t) && !/tăng|đẩy/i.test(t)) return pick(TIP_FAST, "tip");
  if (/tăng nhịp|đẩy nhịp|nhanh hơn|cuốn hơn|tăng tốc/i.test(t)) return pick(TIP_SLOW, "tip");
  if (/ừm|từ đệm|tiếng đệm/i.test(t)) return pick(TIP_FILLER, "tip");
  return pick(TIP_GOOD, "tip");
}
