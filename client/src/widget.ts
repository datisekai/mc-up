// Ghi dữ liệu streak/năng lượng cho WIDGET iOS (targets/widget) qua App Group.
// Best-effort: Expo Go / Android / build chưa có target → try/catch bỏ qua, không ảnh hưởng app.
import { Platform } from "react-native";

const APP_GROUP = "group.vn.mcup.app";

export type WidgetData = {
  streak: number;
  practicedToday: boolean;
  energy: number;
  xp: number;
  isPro: boolean;
};

function localDay(): string {
  // "yyyy-MM-dd" theo GIỜ MÁY (khớp cách widget Swift so sánh ngày)
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

export function updateWidget(data: WidgetData): void {
  if (Platform.OS !== "ios") return;
  try {
    // require trong hàm: Expo Go không có native module → ném lỗi → nuốt
    const { ExtensionStorage } = require("@bacons/apple-targets");
    const storage = new ExtensionStorage(APP_GROUP);
    storage.set("streak", data.streak);
    // Chỉ GHI ngày khi đã luyện — widget so "lastPracticeDay == hôm nay" để vẽ lửa cam/xám
    if (data.practicedToday) storage.set("lastPracticeDay", localDay());
    storage.set("energy", data.energy);
    storage.set("xp", data.xp);
    storage.set("isPro", data.isPro);
    ExtensionStorage.reloadWidget();
  } catch {
    /* môi trường không có widget — bỏ qua */
  }
}
