// Design tokens "Sân khấu ấm 2.0" (DESIGN.md — V2 2026-07-10)
// V5 (feedback: quá nhiều màu → rối): KỶ LUẬT bảng màu = san hô (primary) + vàng (CHỈ thưởng)
// + mận/xám (chữ) + kem/trắng (nền). Xanh dương/tím/hồng đã bị XOÁ; giữ 1 xanh lá muted
// DUY NHẤT cho dấu "đạt". Mọi màu semantic khác quy về primary/vàng/trung tính.
// V7 (feedback: enhance màu/UI — Finn chọn A+B): cắt màu xong app bị PHẲNG & NHẠT
// → bù bằng CHIỀU SÂU + TƯƠNG PHẢN, KHÔNG thêm màu mới:
//   A· nền kem sâu hơn để thẻ trắng nổi bật + bóng mềm (xem `shadow`) + khoá đọc được
//   B· san hô đậm hơn, chữ đen hơn → app "đanh", nổi khối
export const C = {
  base: "#F4E7D6",      // kem SÂU hơn (cũ #FFF8F0) → thẻ trắng bật hẳn lên
  raised: "#FFFFFF",
  sunken: "#EADCC8",    // rãnh sâu hơn để vẫn tách khỏi base mới
  ink: "#2E2239",       // chữ ĐEN hơn (cũ #3B2A4A)
  ink2: "#6B5F73",      // chữ phụ đậm hơn (cũ #7A6E82)
  ink3: "#9C8FA6",      // chữ mờ nhất — vẫn ĐỌC ĐƯỢC (cũ #B4A8BB quá nhạt)
  primary: "#F2503C",   // san hô ĐẬM hơn (cũ #FF6B5B)
  primarySoft: "#FDE8E3", // nền san hô nhạt — đậm hơn chút để tách nền kem mới
  spot: "#FFC24B",      // VÀNG — chỉ dùng cho thưởng (xu/streak/XP/vé). Giữ "đắt".
  spotSoft: "#FFEFC9",  // vàng nhạt — đậm hơn để tách nền kem mới
  success: "#3FB984",   // xanh lá DUY NHẤT — chỉ cho dấu tick "bài đạt"
  successSoft: "#DDF2E7",
  hair: "#E0D2BC",      // hairline rõ hơn trên nền kem sâu
  // Khoá/vô hiệu — ĐỦ TƯƠNG PHẢN để đọc (trước bị mờ tàng hình)
  lock: "#E4D5C0",
  lockInk: "#8A7A6E",
  // Đáy 3D "phím đàn" — tối hơn thân ~18% (V2: cái gì có đáy dày là NHẤN ĐƯỢC)
  primaryDown: "#B33724",
  spotDown: "#E09B18",
  hairDown: "#D3C3AC",
  successDown: "#2E9668",
  goldInk: "#8a5a13",   // chữ trên nền vàng nhạt
};

// Bóng mềm cho thẻ nổi khỏi nền (A· chiều sâu). Dùng: style={[card, shadow.card]}
export const shadow = {
  card: {
    shadowColor: "#3B2A4A", shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 3,
  },
  soft: {
    shadowColor: "#3B2A4A", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
};

// Thang chữ V2 — "chữ to lên một nấc" (feedback: font quá nhỏ). Sàn tuyệt đối 12.
export const T = {
  display: 30,
  title: 20,
  body: 16,
  meta: 13,
  prompter: 22, // bài mẫu trên màn thu — đọc được từ khoảng cách một cánh tay
};

// Font thương hiệu (DESIGN.md §Typography):
// Display = Baloo 2 (bo tròn, vui) — số streak/XP, tiêu đề thưởng, đếm ngược.
// Title/Body/Meta = Be Vietnam Pro — dấu tiếng Việt xuất sắc, đọc rõ cỡ nhỏ.
export const F = {
  display: "Baloo2_700Bold",
  displayX: "Baloo2_800ExtraBold",
  title: "BeVietnamPro_700Bold",
  semi: "BeVietnamPro_600SemiBold",
  med: "BeVietnamPro_500Medium",
  body: "BeVietnamPro_400Regular",
};
