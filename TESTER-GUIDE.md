# McUp — Hướng dẫn cho người test (bản Expo, tháng 7/2026)

> Gửi nguyên phần "DÀNH CHO NGƯỜI TEST" cho tester. Phần "DÀNH CHO FINN" là checklist vận hành.

---

## DÀNH CHO NGƯỜI TEST

### Cài & vào app (2 phút)
1. Tải app **Expo Go** trên App Store / Google Play (miễn phí).
2. Kết nối **đúng Wi-Fi mà Finn chỉ định** (app chạy qua mạng nội bộ trong đợt test này).
3. Quét mã QR Finn gửi → McUp mở lên trong Expo Go.
4. Chọn mục tiêu bạn thích → bấm **"Thử ngay — không cần tài khoản"** là luyện được liền
   (muốn giữ tiến độ lâu dài thì vào tab Hồ sơ → "Giữ tiến độ của tôi").

### Thử gì? (hành trình gợi ý ~10 phút)
- Đi hết phần chào hỏi đầu app, chọn một mục tiêu (vd MC đám cưới).
- Vào một bài trên bản đồ → bấm mic → **nói thật vào điện thoại** 30–60 giây → xem AI chấm.
- Luyện thêm 1–2 bài nữa (thử nút **"▲ Luyện liên tục"** — vuốt dọc như Reels).
- Xem điểm xong bấm **"Gửi cho MC thật (Vé Vàng)"** — trong đợt test sẽ có MC thật nghe và
  nhận xét bằng giọng (có thể mất tới 1 ngày).
- Khi có nhận xét: vào Hồ sơ → xem **Thẻ bảo chứng**, thử đổi màu thẻ, bấm Chia sẻ.
- Vuốt ngang để đổi tab, để ý nhạc nền/hiệu ứng (tắt được trong Hồ sơ).

### Vài điều nên biết
- Đây là **bản thử nghiệm**: chạy trong Expo Go nên có thể thấy thanh dev của Expo — bình thường.
- App **chỉ ghi âm khi bạn bấm mic** và tự tắt khi bạn bấm dừng. Clip chỉ dùng để chấm điểm
  và (nếu bạn gửi Vé Vàng) cho MC nghe nhận xét.
- Máy iPhone gạt **im lặng** thì hiệu ứng/nhạc không kêu — muốn nghe giọng MC thì bấm nút nghe
  (nút nghe phát được cả khi đang im lặng).
- Có giới hạn 30 lượt chấm/ngày (đủ xài thoải mái).

### Góp ý = món quà 🎁
Trong app: Hồ sơ → **"Góp ý cho McUp 💌"**. Hoặc nhắn thẳng Finn.
3 câu Finn mong bạn trả lời nhất:
1. Chỗ nào làm bạn **khựng lại / không hiểu phải làm gì**?
2. Bạn có **ngại bấm mic** không? Vì sao?
3. Nếu nhận xét từ MC thật giá 20–50k/lần — bạn có trả không?

---

## DÀNH CHO FINN — checklist vận hành mỗi buổi test

Trước buổi test:
- [ ] Mac bật, cùng Wi-Fi với tester.
- [ ] Backend chạy: `cd mcup && api/.venv/bin/python -m uvicorn api.app.main:app --host 0.0.0.0 --port 8000 --reload`
- [ ] Metro chạy: `cd mcup/client && npx expo start` → chụp QR gửi tester.
- [ ] **IP LAN đổi thì sửa `client/src/api.ts` (API_BASE)** — kiểm bằng `ipconfig getifaddr en0`.
- [ ] MC trực Vé Vàng: đăng nhập `mc@test.vn` (hoặc tài khoản MC bạn tạo trong /admin-web).

Theo dõi trong lúc test (mở `http://localhost:8000/admin-web` → 📈 Số liệu):
- clip/ngày · % ASR thật vs giả lập · vé đã gửi · review đúng hạn.

Sau buổi test:
- [ ] Trả lời hết Vé Vàng trong ngày (trải nghiệm "MC thật" là moat — đừng để nguội).
- [ ] Ghi lại 3 khoảnh khắc tester khựng (quan sát quý hơn lời khen).

Giới hạn của đợt test Expo (nói trước với tester để khỏi mang tiếng):
- Cần cùng Wi-Fi + Mac của bạn bật — không phải app "cài về xài mãi".
- Đóng Expo Go lâu ngày có thể phải quét QR lại.
- Bước kế tiếp (đã chuẩn bị xong phía server): deploy VPS + build APK Android → tester xài
  không cần Wi-Fi của bạn. Xem `DEPLOY.md`.
