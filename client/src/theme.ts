// Design tokens "Sân khấu ấm 2.0" (DESIGN.md — V2 2026-07-10)
// V5 (feedback: quá nhiều màu → rối): KỶ LUẬT bảng màu = san hô (primary) + vàng (CHỈ thưởng)
// + mận/xám (chữ) + kem/trắng (nền). Xanh dương/tím/hồng đã bị XOÁ; giữ 1 xanh lá muted
// DUY NHẤT cho dấu "đạt". Mọi màu semantic khác quy về primary/vàng/trung tính.
export const C = {
  base: "#FFF8F0",
  raised: "#FFFFFF",
  sunken: "#F6EDE2",
  ink: "#3B2A4A",
  ink2: "#7A6E82",
  ink3: "#B4A8BB",   // chữ mờ nhất (khoá/phụ)
  primary: "#FF6B5B",
  primarySoft: "#FFF0EC", // nền san hô rất nhạt cho vùng highlight (thay các nền màu lạ)
  spot: "#FFC24B",   // VÀNG — chỉ dùng cho thưởng (xu/streak/XP/vé). Giữ "đắt".
  spotSoft: "#FFF3DA",
  success: "#3FB984", // xanh lá DUY NHẤT — chỉ cho dấu tick "bài đạt"
  successSoft: "#E7F6EE",
  hair: "#EDE3D6",
  // Đáy 3D "phím đàn" — tối hơn thân ~18% (V2: cái gì có đáy dày là NHẤN ĐƯỢC)
  primaryDown: "#D14B3D",
  spotDown: "#E09B18",
  hairDown: "#E0D4C4",
  successDown: "#2E9668",
  goldInk: "#8a5a13", // chữ trên nền vàng nhạt
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
