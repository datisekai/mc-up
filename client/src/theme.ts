// Design tokens "Sân khấu ấm 2.0" (DESIGN.md — V2 2026-07-10)
// V5 (feedback: quá nhiều màu → rối): KỶ LUẬT bảng màu = san hô (primary) + vàng (CHỈ thưởng)
// + mận/xám (chữ) + kem/trắng (nền). Xanh dương/tím/hồng đã bị XOÁ; giữ 1 xanh lá muted
// DUY NHẤT cho dấu "đạt". Mọi màu semantic khác quy về primary/vàng/trung tính.
// V7 (feedback: enhance màu/UI — Finn chọn A+B): cắt màu xong app bị PHẲNG & NHẠT
// → bù bằng CHIỀU SÂU + TƯƠNG PHẢN, KHÔNG thêm màu mới.
// V8 (feedback: "nền kem làm buồn ngủ" — Finn nói 2 lần, và Finn ĐÚNG):
//   Nền kem/trắng-ấm = ĐÚNG sắc mà Night Shift dùng để ru người ta ngủ. Không thể
//   vừa phủ warm-tint toàn trường nhìn vừa mong app tỉnh táo. Tăng độ sáng KHÔNG cứu
//   được — thủ phạm là SẮC ÁM, không phải độ sáng.
//   → NGUYÊN TẮC MỚI: "Sân khấu ấm" = cái ấm là ÁNH ĐÈN RỌI, không phải sơn phủ nhà hát.
//     Trung tính (nền/rãnh/viền) đi tông XÁM-MẬN LẠNH — sạch, tỉnh, lùi ra sau.
//     Hơi ấm dồn hết vào NHÂN VẬT: san hô, vàng thưởng, chữ mận, Misa.
//   Hệ chiều sâu GIỮ NGUYÊN (thẻ trắng nổi bằng bóng + hairline, không cần nền kem).
export const C = {
  base: "#FFFFFF",      // TRẮNG THẬT — hết ám vàng (cũ #F4E7D6 → buồn ngủ)
  raised: "#FFFFFF",    // thẻ = trắng, nổi bằng shadow.card + hair (KHÔNG dựa vào nền kem)
  sunken: "#F2F0F5",    // rãnh: xám ám MẬN nhạt (lạnh, hợp chữ mận) — thay kem
  ink: "#2E2239",       // chữ mận đen — hơi ấm nằm ở ĐÂY, không ở nền
  ink2: "#6B5F73",
  ink3: "#9C8FA6",
  primary: "#F2503C",   // san hô — nguồn ấm chính, giờ chói hẳn trên nền trắng
  primarySoft: "#FDE8E3",
  spot: "#FFC24B",      // VÀNG — chỉ dùng cho thưởng (xu/streak/XP/vé). Giữ "đắt".
  spotSoft: "#FFF0CC",  // vàng nhạt — ok vì chỉ dùng mảng NHỎ (chip thưởng), không phủ nền
  success: "#3FB984",   // xanh lá DUY NHẤT — chỉ cho dấu tick "bài đạt"
  successSoft: "#DDF2E7",
  hair: "#E6E2EC",      // hairline trung tính — tách thẻ khỏi nền trắng
  // Khoá/vô hiệu — ĐỦ TƯƠNG PHẢN để đọc (trước bị mờ tàng hình)
  lock: "#EDEAF1",
  lockInk: "#857D8F",
  // Đáy 3D "phím đàn" — tối hơn thân ~18% (V2: cái gì có đáy dày là NHẤN ĐƯỢC)
  primaryDown: "#B33724",
  spotDown: "#E09B18",
  hairDown: "#D6D0DE",  // đáy 3D thẻ trung tính — theo hair mới (lạnh, không tan)
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
