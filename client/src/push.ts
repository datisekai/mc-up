// Đăng ký thông báo đẩy (Expo). Best-effort: quyền bị từ chối / chạy trên Expo Go / máy ảo
// → trả null, KHÔNG ném lỗi, không ảnh hưởng app. Token gửi lên backend qua Api.setPushToken.
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Foreground: vẫn hiện banner + kêu khi app đang mở (mặc định iOS nuốt thông báo lúc mở app).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPush(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null; // máy ảo không nhận push thật

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Mặc định",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF6B5B",
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== "granted") {
      const asked = await Notifications.requestPermissionsAsync();
      status = asked.status;
    }
    if (status !== "granted") return null;

    // projectId cần cho Expo push token (EAS). Lấy từ app config.
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as any)?.easConfig?.projectId;
    const tokenResp = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return tokenResp.data || null;
  } catch {
    return null; // không chặn trải nghiệm nếu push lỗi
  }
}
