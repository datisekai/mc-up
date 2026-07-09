# Phát hành McUp lên TestFlight (iOS) — checklist

Bản build đầu **đầy đủ push + IAP Pro**. Phần **code đã xong**; dưới đây là phần **tài khoản** bạn tự làm.
Thứ tự quan trọng: **deploy server có domain HTTPS → điền cấu hình → build → submit**.

---

## 0. Việc code ĐÃ XONG (không cần làm gì)
- ✅ App icon (`assets/icon.png`), adaptive icon, splash, notification icon
- ✅ `eas.json` (profile development/preview/production + submit iOS)
- ✅ Push notification: xin quyền + gửi token (`src/push.ts`), backend lưu & bắn push khi MC nhận xét
- ✅ IAP Pro (RevenueCat): mua/khôi phục (`src/iap.ts`), backend xác minh entitlement + webhook
- ✅ `API_BASE` tự đổi: dev = IP LAN, production = domain HTTPS

---

## 1. Deploy server có domain HTTPS (BẮT BUỘC trước tiên)
iOS **chặn HTTP** → app TestFlight phải gọi `https://`.
1. Deploy backend lên VPS (xem `../DEPLOY.md` — `./deploy.sh` + `nginx.conf`).
2. Trỏ DNS domain (vd `api.mcup.vn`) về IP VPS, chạy `certbot` lấy SSL.
3. Kiểm tra: mở `https://api.mcup.vn/health` thấy `{"status":"ok"}`.
4. **Sửa `src/api.ts`**: đổi `"https://api.mcup.vn"` (nhánh production) thành domain thật của bạn.

## 2. Cài công cụ + tài khoản Expo
```bash
npm i -g eas-cli
cd client
eas login                 # tài khoản expo.dev (tạo free nếu chưa có)
eas init                  # tạo project trên Expo → tự ghi extra.eas.projectId vào app.json
```

## 3. Apple Developer / App Store Connect
1. **appstoreconnect.apple.com** → **Apps → +** → tạo app:
   - Bundle ID: chọn `vn.mcup.app` (nếu chưa có, tạo trong *Certificates, IDs & Profiles → Identifiers*, **bật Push Notifications** + **In-App Purchase**).
   - Ngôn ngữ chính: Tiếng Việt.
2. Lấy 3 giá trị điền vào **`eas.json`** (mục `submit.production.ios`):
   - `appleId` = email Apple ID của bạn
   - `appleTeamId` = Team ID (Membership, dạng `ABCDE12345`)
   - `ascAppId` = App ID trên App Store Connect (App → App Information → *Apple ID*, dãy số)
3. **Privacy Policy URL** (App Store bắt buộc): điền `https://<domain>/privacy` (trang đã có sẵn).

## 4. Tạo gói In-App Purchase (cho IAP Pro)
1. App Store Connect → app → **Monetization → In-App Purchases → +**
   - Loại: **Auto-Renewable Subscription** (gói tháng) — vd product ID `mcup_pro_monthly`, giá 59.000₫.
   - (Điền tên/mô tả; cần ít nhất 1 ảnh review — có thể tạm dùng screenshot.)
2. **RevenueCat** (revenuecat.com, free):
   - Tạo Project → thêm app iOS (bundle `vn.mcup.app`) → dán **App Store Connect API key** (RC hướng dẫn).
   - **Entitlements → +** đặt id `pro`. **Products** thêm `mcup_pro_monthly` → gắn vào entitlement `pro`.
   - **Offerings → Current** thêm package chứa product đó.
   - Lấy **Public SDK Key (Apple, `appl_...`)** → dán vào `app.json` → `extra.revenuecat.iosKey`.
   - Lấy **Secret Key (v1, `sk_...`)** → đặt `REVENUECAT_SECRET_KEY` trong `.env` server.
   - (Tuỳ chọn) **Integrations → Webhooks**: URL `https://<domain>/iap/revenuecat/hook`,
     Authorization header = giá trị bạn đặt ở `REVENUECAT_WEBHOOK_TOKEN` trong `.env`.

## 5. Push notification (APNs)
Khi `eas build`/`eas submit` chạy lần đầu, EAS sẽ hỏi và **tự tạo Push Key (APNs)** trên Apple giúp bạn
— chỉ cần đăng nhập Apple khi được nhắc. Không cần thao tác tay.

## 6. Build & submit
```bash
cd client
eas build --platform ios --profile production      # ~15-25 phút trên cloud EAS
eas submit --platform ios --profile production      # đẩy lên App Store Connect → TestFlight
```
Sau khi Apple xử lý (~5-30 phút), vào **TestFlight** thêm tester (email) → họ cài app **TestFlight** để nhận bản build.

## 7. Test IAP trên TestFlight (không mất tiền thật)
- TestFlight dùng **Sandbox**: mua gói Pro sẽ hiện giá thật nhưng **không trừ tiền**.
- Sau khi mua thử, app gọi `/iap/refresh` → backend xác minh với RevenueCat → bật `is_pro` → năng lượng ⚡∞.

---

### Nếu CHƯA muốn bận tâm IAP/push ngay
App vẫn build & chạy bình thường khi **chưa điền** `extra.revenuecat` / chưa cấu hình APNs:
- Chưa có RC key → nút "Nâng cấp Pro" hiện thông báo "sắp mở", không lỗi.
- Chưa cấp quyền push → app bỏ qua, không crash.

Bạn có thể lên TestFlight trước, bật IAP/push sau bằng cách điền cấu hình rồi build lại.
