# McUp — App (React Native + Expo)

Các màn thật: lộ trình · quay clip (ghi âm) · chấm phần Xác · streak/XP/Vé Vàng · chế độ MC · Thẻ bảo chứng.

## Chạy để test 1 lần

**1) Bật backend** (terminal 1):
```bash
cd ../api && ./run.sh      # nghe ở 0.0.0.0:8000
```

**2) Trỏ app tới backend** — sửa `src/api.ts`, dòng `API_BASE`:
- iOS simulator: `http://localhost:8000`
- Android emulator: `http://10.0.2.2:8000`
- **Điện thoại thật (Expo Go):** `http://192.168.1.17:8000` (IP LAN máy bạn — máy & điện thoại cùng Wi-Fi)

**3) Chạy app** (terminal 2):
```bash
npm install        # đã cài sẵn
npx expo start
```
- Bấm `i` (iOS simulator) / `a` (Android emulator), hoặc quét QR bằng **Expo Go** trên điện thoại.

## Thử gì
- Chạm bài → **"🔴 Bắt đầu quay"** → nói vào mic → **"⏹ Dừng & nộp"** → xem điểm phần Xác (giả lập tới khi cắm ASR key).
- Bấm **"Gửi cho MC thật"** → sang tab **Chế độ MC** (MC Hạnh) → gửi nhận xét → về tab Học viên xem **Thẻ bảo chứng**.

## Ghi chú
- ASR thật: thêm key vào `../api/.env` (xem `../ENV-SETUP.md`).
- Font Be Vietnam Pro / Baloo 2 chưa nhúng (dùng font hệ thống) — thêm qua `expo-font` sau.
- Muốn xem nhanh không cần simulator: bản web ở `http://localhost:8000/app`.
