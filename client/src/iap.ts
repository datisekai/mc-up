// Mua gói McUp Pro qua RevenueCat. Best-effort: chưa cấu hình key (extra.revenuecat) hoặc
// chạy Expo Go / máy ảo → mọi hàm trả giá trị "không có", KHÔNG ném lỗi, app vẫn chạy bình thường.
// appUserID ở RevenueCat = McUp user.id (lấy từ JWT sub) → backend đối chiếu để bật is_pro đúng người.
import Constants from "expo-constants";
import { Platform } from "react-native";
import Purchases from "react-native-purchases";

const rc = ((Constants.expoConfig?.extra as any)?.revenuecat) ?? {};
export const ENTITLEMENT: string = rc.entitlement || "pro";

function apiKey(): string {
  return (Platform.OS === "ios" ? rc.iosKey : rc.androidKey) || "";
}
export function iapConfigured(): boolean {
  return !!apiKey();
}

// Lấy McUp user.id từ payload JWT (không cần verify — id không phải bí mật).
function subFromJwt(token: string): string | undefined {
  try {
    const part = token.split(".")[1];
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(b64);
    const json = decodeURIComponent(
      raw.split("").map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join("")
    );
    return JSON.parse(json).sub;
  } catch {
    return undefined;
  }
}

let configured = false;
export async function configureIAP(jwt: string): Promise<void> {
  const key = apiKey();
  if (!key) return; // chưa bật IAP → im lặng bỏ qua
  const appUserID = subFromJwt(jwt);
  try {
    if (!configured) {
      Purchases.configure({ apiKey: key, appUserID });
      configured = true;
    } else if (appUserID) {
      await Purchases.logIn(appUserID);
    }
  } catch {
    /* cấu hình lỗi — bỏ qua, không chặn app */
  }
}

export async function isProActive(): Promise<boolean> {
  if (!apiKey()) return false;
  try {
    const info = await Purchases.getCustomerInfo();
    return !!info.entitlements.active[ENTITLEMENT];
  } catch {
    return false;
  }
}

// Giá hiển thị trên nút ("59.000₫/tháng" ...) — null nếu chưa có offering.
export async function getProPrice(): Promise<string | null> {
  if (!apiKey()) return null;
  try {
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.availablePackages?.[0];
    return pkg?.product?.priceString ?? null;
  } catch {
    return null;
  }
}

export type BuyResult = "ok" | "cancelled" | "unavailable" | "error";

export async function buyPro(): Promise<BuyResult> {
  if (!apiKey()) return "unavailable";
  try {
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.availablePackages?.[0];
    if (!pkg) return "unavailable";
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo.entitlements.active[ENTITLEMENT] ? "ok" : "error";
  } catch (e: any) {
    if (e?.userCancelled) return "cancelled";
    return "error";
  }
}

export async function restorePro(): Promise<boolean> {
  if (!apiKey()) return false;
  try {
    const info = await Purchases.restorePurchases();
    return !!info.entitlements.active[ENTITLEMENT];
  } catch {
    return false;
  }
}
