// Design tokens "Sân khấu ấm 2.0" (DESIGN.md — V2 2026-07-10)
export const C = {
  base: "#FFF8F0",
  raised: "#FFFFFF",
  sunken: "#F6EDE2",
  ink: "#3B2A4A",
  ink2: "#7A6E82",
  primary: "#FF6B5B",
  spot: "#FFC24B",
  success: "#3FB984",
  hair: "#EDE3D6",
  // Đáy 3D "phím đàn" — tối hơn thân ~18% (V2: cái gì có đáy dày là NHẤN ĐƯỢC)
  primaryDown: "#D14B3D",
  spotDown: "#E09B18",
  hairDown: "#E0D4C4",
  successDown: "#2E9668",
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
