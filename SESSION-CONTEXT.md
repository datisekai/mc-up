# McUp — Context phiên làm việc (cập nhật 2026-07-06 · phiên 2)

> Tài liệu bàn giao / nối phiên. Ghi lại toàn bộ bối cảnh dự án McUp, trạng thái
> build, các quyết định thiết kế, cách chạy/test, và việc còn lại. Đọc file này
> là đủ để tiếp tục mà không cần lịch sử chat.

---

## 1. McUp là gì

App mobile **luyện MC / kỹ năng nói game-hoá kiểu Duolingo** cho thị trường Việt Nam.
Startup của **Finn** — có sẵn mạng lưới MC thật (đây là *moat*).

- **Vòng lặp lõi:** học viên chọn bài → quay clip nói vào mic → **AI chấm phần "Xác"** (âm lượng, tốc độ, từ đệm) tức thì → nhận gợi ý → giữ streak/XP.
- **"Vé Vàng":** học viên tiêu vé để gửi clip cho **MC thật nhận xét bằng giọng** (phần "Hồn") → nhận **Thẻ MC bảo chứng** chia sẻ được.
- **Định vị:** "ELSA cho tiếng Việt & nghề MC".
- **Bản đồ leo "sân khấu"** (concept-b-stage-climb): lộ trình dạng map Duolingo, không phải list.

**Repo:** `git@github.com:datisekai/mc-up.git` (nhánh `main`). Thư mục code: `mcup/`.
Thư mục kế hoạch BMad: `_bmad-output/planning-artifacts/`.

---

## 2. Kiến trúc & stack

- **Paradigm:** Hexagonal (ports & adapters) + **async pipeline** chấm điểm. Xem `_bmad-output/planning-artifacts/architecture/architecture-mc-training-2026-07-03/ARCHITECTURE-SPINE.md` (AD-1 → AD-12).
- **Backend:** FastAPI + SQLAlchemy async. Dev dùng **SQLite** (`mcup_dev.db`, aiosqlite); prod dùng Postgres (asyncpg). Chạy từ thư mục `mcup/` với module `api.app.main:app`.
- **Client:** React Native + **Expo SDK 54** (RN 0.81, React 19.1). expo-av (thu âm), react-native-svg (icon tự vẽ), AsyncStorage (lưu phiên).
- **ASR (chấm giọng):** OpenAI **Whisper** thật (đằng sau `AsrPort`); có adapter Google STT + Viettel STT sẵn (chờ key). Chọn provider qua factory.
- **AI-split (AI thứ 2):** OpenAI `gpt-4o-mini` JSON mode chia giáo trình thô → cây nội dung nháp (đằng sau `ContentSplitPort`).
- **Auth:** JWT (pyjwt) + pbkdf2 hashing; vai trò `hoc_vien` | `mc` | `admin`.
- **Deploy:** 1 lệnh Docker (`docker-compose.prod.yml`: api + postgres + redis + minio).
- **Design tokens "Sân khấu ấm":** kem sữa `#FFF8F0`, san hô `#FF6B5B`, vàng đèn `#FFC24B`, mận sâu `#3B2A4A`. **KHÔNG dùng emoji trong UI học viên** — icon tuyến tự vẽ.

**Mô hình dữ liệu nội dung phân tầng (AD-9):**
`Genre (Thể loại) → LearningPath (Lộ trình) → Level (Cấp độ) → ContentSession (Buổi) → ContentLesson (Bài)`.
Mỗi tầng có `status`: `draft | published | archived` (AD-12). Publish là cascade cả cây.

---

## 3. Trạng thái build (đã xong & verify đầu-cuối, đã push)

### v1 — MVP
Lộ trình nói/thuyết trình (10 buổi), quay clip + AI chấm async, streak/XP, Vé Vàng (SLA 72h), Thẻ bảo chứng, giải đấu (hạng Đồng→Kim cương), leaderboard, huy hiệu thành tựu, biểu đồ tiến bộ từ đệm, voice review (MC ghi âm giọng thật), đăng nhập/đăng ký thật + phân màn theo vai.

### v2 — Pha A (Niềm tin: chấm thật)
- **Âm lượng RMS thật** (`scoring._rms_volume`): ffmpeg decode → PCM → RMS → dBFS → nhãn.
- **Tốc độ (wpm) theo thời gian nói thực** (`scoring._wpm`): span timestamp Whisper, trừ im lặng đầu/cuối.

### v2 — Pha B (Cỗ máy nội dung)
- Mô hình nội dung phân tầng (Genre→…→ContentLesson) + trạng thái draft/published.
- **Trang admin** (`/admin-web`, `admin.html`): admin đăng nhập → dán giáo trình thô → AI-split → **duyệt cây** → publish. (FR-16/17)
- **AI-split** (FR-18): `content_split_openai` / `content_split_mock` / `content_split_factory`. Luôn ra **draft**, bắt buộc human review trước publish.

### v2 — FR-19 (Học viên tiêu thụ nội dung published)
- API `/content/paths` (chỉ published) + `/content/paths/{id}/lessons`.
- Luyện bài nội dung qua `content_lesson_id` (submit + submit-audio), xp=10.
- App: **hàng pill chọn lộ trình** trên bản đồ leo — mặc định "Kỹ năng nói" (v1) + mỗi lộ trình published 1 pill.

### v2 — FR-15 (Rubric chấm theo thể loại)
- `rubrics.py`: rubric **lõi (CORE) + module theo Genre** (đám cưới chậm-ấm ≤150 wpm, sự kiện năng lượng ≤170, livestream bắt tai ≤185).
- `run_scoring` lần cây nội dung → Genre → rubric của bài → `score_clip` đặt ngưỡng tốc độ + gợi ý **sát nghề**.
- Verify: cùng wpm 152.1 → mỗi thể loại ra lời khuyên khác nhau.

### v2 — FR-12 (Giữ & đếm từ đệm chuẩn hơn — KHÔNG cần key mới)
- Whisper: bias `prompt` để **giữ** "ừm/à/ờ" thay vì làm sạch.
- Đếm từ đệm **bền**: chuẩn hoá co giãn `ừmmm→ừm` + bỏ dấu câu (`scoring._norm_word`), mở rộng từ điển.
- Factory `auto` **ưu tiên giữ-filler**: Viettel > Google > Whisper > Mock (thêm key là tự nâng cấp).

### v2 — Pha C (Mở rộng thể loại)
- `seed_genres()`: bơm nội dung thật **published sẵn** cho 3 thể loại (đám cưới/sự kiện/livestream), idempotent theo tên.
- `genres_meta.py`: màu nhấn + tagline theo thể loại → `/content/paths` trả kèm; app pill mỗi thể loại 1 màu + hiện tagline.

### Thẻ nhiệm vụ (feature mới nhất — phân tích của Mary, commit `1d82e45`)
**Vấn đề Finn nêu:** phần "nhiệm vụ/đề" quá sơ sài (1 dòng đề), học viên chưa hiểu phải làm gì.
**Giải pháp:**
- Model: thêm cột JSON **`brief`** vào `Lesson` + `ContentLesson` = `{objective (mục tiêu), context (tình huống), steps (dàn ý), example (ví dụ mẫu)}`.
- **Tiêu chí đạt SINH từ rubric** (`rubrics.criteria_for`) — 1 nguồn sự thật, luôn khớp bộ chấm (FR-15). Không lưu cứng.
- Seed lại **25 bài** (11 v1 + 14 thể loại) với Thẻ nhiệm vụ đầy đủ, kịch bản mẫu cụ thể.
- App: màn luyện render Thẻ nhiệm vụ (Đề → Mục tiêu → Tình huống → Dàn ý → Tiêu chí đạt), **ẩn Ví dụ mẫu sau nút "Bí quá? Xem gợi ý"** (chống học vẹt — quyết định của Finn).
- AI-split nâng cấp: prompt OpenAI + mock **xuất `brief`**; persist brief; **admin review hiện brief** để duyệt.

### Gói UX Gen Z (phiên 2 — specs của Sally, build bởi Amelia)
Bộ spec: `_bmad-output/planning-artifacts/ux-designs/ux-mc-training-2026-07-03/P0-cam-xuc-spec.md`
+ `P1-the-bao-chung-spec.md` + `P1-man-quay-clip-spec.md` + `P2-onboarding-spec.md`.

- **P0 Cảm xúc:** `src/variety.ts` (pool lời khen/tiêu đề ngẫu nhiên, chống lặp 2 lần liên tiếp),
  `src/Confetti.tsx` (3 biến thể A/B/C), `src/Celebration.tsx` (overlay thưởng: spotlight +
  confetti + haptic + ting.wav, auto-dismiss 2.6s, tôn trọng Giảm chuyển động),
  `src/ScoreReveal.tsx` (màn điểm "diễn": stagger 140ms, wpm count-up, chip so sánh lần trước
  từ `/me/scores`, ĐÃ BỎ nhãn "(giả lập)"). Trigger celebration trong `pollScore`:
  tier đổi > streak mốc (3/7/14/30/50/100) > XP mốc 50 > vé đầu tiên (giữ vàng "đắt").
- **P1 Màn quay "Reels ấm":** `src/RecordScreen.tsx` — ready (vòng thở + microcopy trấn an)
  → đếm 3-2-1 (huỷ được) → thu (waveform sống từ metering expo-av, đồng hồ + vòng tiến độ 60s,
  teleprompter dàn ý từ `brief.steps` tự trôi 4s/bước) → processing "Đang nghe bạn dẫn…".
  Chỉ báo thu = SAN HÔ + chữ (không đỏ). Haptic Light/Medium theo spec.
- **P2 Onboarding ấm:** `src/Onboarding.tsx` — 5 bước (trấn an → giá trị → mục tiêu → thói quen
  → priming mic). Gate ở App: chưa có token + chưa `onboarded` → hiện. Mục tiêu lưu AsyncStorage
  `goal` → sau đăng nhập `refresh()` tự chọn lộ trình khớp genre (trả công cá nhân hoá).
- **P1 Thẻ bảo chứng khoe được:** `src/BadgeCardView.tsx` — 3 skin (cream/night/coral), con dấu
  ĐÃ XÁC THỰC, waveform giọng MC (phát qua expo-av), nút Chia sẻ = `react-native-view-shot`
  chụp thẻ → `expo-sharing` share-sheet. Suy biến duyên dáng khi thiếu dữ liệu.
- **Khác:** `pollScore` tăng 25×500ms (~12.5s) + không crash khi chậm (toast dịu, không mất bài);
  Alert thành công → toast in-app; câu nhắc streak lấy từ pool. Deps mới: `expo-haptics`,
  `expo-sharing`, `react-native-view-shot`. Asset mới: `client/assets/ting.wav` (chuông sinh bằng script).
- Verify: `npx tsc --noEmit` sạch + `npx expo export --platform ios` bundle OK (730 modules).

---

## 4. Bản đồ code (file & vai trò)

### Backend `mcup/api/app/`
| File | Vai trò |
|---|---|
| `main.py` | FastAPI app, lifespan seed (lessons/genres/mc/admin), include routers, serve `/app` + `/admin-web` |
| `models.py` | SQLAlchemy models. Content tree + `brief` JSON trên Lesson/ContentLesson. Clip có `lesson_id` **hoặc** `content_lesson_id` (đều nullable) |
| `scoring.py` | Chấm phần Xác: `_rms_volume`, `_wpm`, `_norm_word` (đếm từ đệm), `score_clip(rubric=)` |
| `rubrics.py` | `CORE` + `MODULES` theo Genre; `get_rubric()`, `criteria_for()` |
| `genres_meta.py` | Màu + tagline hiển thị theo thể loại (Pha C) |
| `services.py` | Tầng nghiệp vụ: `run_scoring`, `_rubric_for_clip`, `send_golden_ticket`, `submit_mc_review`, `tier_of`, `ai_split_and_persist`, `get_path_tree`, `list_paths`, `publish_path`, `get_content_lessons_for_user` |
| `seed.py` | `_LESSONS` (v1, có brief) + `_GENRES` (3 thể loại, có brief) + `seed_lessons/seed_genres/seed_mc/seed_admin` |
| `schemas.py` | Pydantic. `LessonOut` có `brief` + `criteria`; `SubmitClipIn` có cả `lesson_id`/`content_lesson_id` |
| `routers/` | `auth, lessons, practice, content, admin, mc, vevang, leaderboard, stats, media` |
| `web/index.html` | Prototype web học viên (`/app`) |
| `web/admin.html` | SPA admin (`/admin-web`): AI-split → duyệt (hiện brief) → publish |

### Adapters `mcup/adapters/`
`asr_whisper` (bias prompt giữ filler), `asr_google`, `asr_viettel`, `asr_mock`, `asr_factory` (auto ưu tiên giữ-filler);
`content_split_openai` (prompt xuất brief), `content_split_mock`, `content_split_factory`; `media_local`.

### Client `mcup/client/`
| File | Vai trò |
|---|---|
| `App.tsx` | App chính. Onboarding gate → Auth → phân màn theo vai. Tab Lộ trình (pill + StageMap), màn luyện = `RecordScreen`, màn kết quả = `ScoreReveal`, overlay `Celebration` + toast in-app |
| `src/variety.ts` | Pool ngẫu nhiên chống lặp: lời khen/nhắc, tiêu đề thưởng, câu chào streak (P0) |
| `src/Celebration.tsx` `src/Confetti.tsx` | Overlay khoảnh khắc thưởng + 3 kiểu confetti + haptic + ting (P0) |
| `src/ScoreReveal.tsx` | Màn điểm "diễn": stagger, count-up, chip so sánh, bỏ "(giả lập)" (P0) |
| `src/RecordScreen.tsx` | Màn quay "Reels ấm": 3-2-1, waveform metering, teleprompter, processing (P1) |
| `src/Onboarding.tsx` | Onboarding ấm 5 bước, priming mic, prefs → AsyncStorage (P2) |
| `src/BadgeCardView.tsx` | Thẻ bảo chứng 3 skin + share ảnh view-shot (P1) |
| `src/StageMap.tsx` | Bản đồ leo "sân khấu" (Duolingo-style) |
| `src/api.ts` | API client. `API_BASE` = IP LAN (hiện `http://192.168.1.215:8000`). `submitMock/submitMockContent/contentPaths/contentLessons`, `submitAudio(...,content_lesson_id?)` |
| `src/theme.ts`, `src/icons.tsx`, `src/MiniChart.tsx` | Tokens, icon SVG tự vẽ, biểu đồ |

---

## 5. Cách chạy & test

### Backend (từ thư mục `mcup/`)
```bash
# venv có sẵn: api/.venv
api/.venv/bin/python -m uvicorn api.app.main:app --host 0.0.0.0 --port 8000 --reload
```
- Đọc `.env` (ở `mcup/.env`) — có `OPENAI_API_KEY`, `ASR_PROVIDER=auto`. **KHÔNG in key ra**; chỉ kiểm `bool(settings.openai_api_key)`.
- DB dev: `mcup_dev.db` (SQLite). **Đổi model → xoá file này để tạo lại schema + reseed** (không có Alembic migration).
- Health: `GET http://localhost:8000/health`. Log: `/tmp/mcup-api.log`.

### Tài khoản seed
- MC: `mc@test.vn` / `123456`
- Admin: `admin@test.vn` / `123456` (dùng ở `/admin-web`)
- Học viên: tự đăng ký trong app.

### App trên iPhone (Expo Go)
- Metro: `cd mcup/client && npx expo start` (cổng 8081). iPhone cùng Wi-Fi.
- QR: `exp://<IP-LAN>:8081` (hiện `192.168.1.215`). **IP LAN đổi thì phải sửa `API_BASE` trong `src/api.ts`** rồi tạo lại QR.
- Đổi App.tsx → Fast Refresh tự áp; hoặc lắc máy → Reload.
- Có watchman (fix EMFILE của Metro).

### Type-check client
```bash
cd mcup/client && npx tsc --noEmit
```

---

## 6. Quyết định thiết kế quan trọng (đừng phá)

1. **Rubric là "data" (registry theo Genre)** — chưa lưu DB để tránh migration; Pha sau admin CRUD sẽ ghi xuống DB mà **không đổi hợp đồng hàm chấm**. `score_clip(rubric=)` là điểm cắm.
2. **Tiêu chí đạt sinh từ rubric** (`criteria_for`) — 1 nguồn sự thật. Đổi ngưỡng rubric là tiêu chí học viên thấy + điểm AI chấm tự đồng bộ.
3. **`brief` là cột JSON** — không phá schema cũ; `prompt`/`tip` giữ làm fallback. AI-split cũng xuất brief nên content mới tự có Thẻ nhiệm vụ.
4. **Ví dụ mẫu ẩn sau nút "Xem gợi ý"** — chống học vẹt, giữ tính thử thách (Finn chọn).
5. **`auto` ASR ưu tiên giữ-filler** (Viettel > Google > Whisper) — thêm key STT tiếng Việt là tự nâng cấp độ chuẩn đếm từ đệm.
6. **AI-split luôn ra draft + human review bắt buộc** (AD-12) — AI chia sẽ sai, người phải duyệt.
7. **Streak/tiến độ server-owned** (AD-3), pipeline chấm **async** (AD-1), envelope lỗi `{"error":{"code","message"}}` + traceId.

---

## 7. Việc còn lại / TODO

- **FR-12 cắm STT thật:** cả 3 adapter (Whisper/Google/Viettel) đã là code thật, **chỉ chờ key**. Finn đưa `GOOGLE_STT_API_KEY` hoặc `VIETTEL_STT_TOKEN` vào `mcup/.env` → `auto` tự dùng → test luồng audio thật giữ-filler.
- **Pha C mở rộng thêm:** MC nhí (UX riêng), host talkshow… — chờ khảo sát cầu (khảo sát định lượng đã khởi tạo ở `_bmad-output/planning-artifacts/research/`).
- **Pha D (hoãn):** multi-tenant tự phục vụ cho trung tâm MC — ghi ở Deferred của Architecture/PRD.
- **Cân nhắc:** rubric editor trong admin (ghi rubric xuống DB); versioning nội dung; đưa brief cho v1 lessons vào trang admin để sửa.

---

## 8. Nhật ký phiên này (2026-07-03 → 07-06)

Phiên nối tiếp từ tóm tắt trước (đã dựng xong v1 + v2 Pha A/B, đang dở FR-19).
Trình tự phiên này:

1. **Hoàn tất FR-19** (client): thêm pill chọn lộ trình + luyện qua `content_lesson_id`. Verify đầu-cuối (học viên thấy "MC đám cưới" → luyện → chấm). Commit `cb1b824`.
2. **"làm hết" → FR-15** rubric theo thể loại. Commit `fd50cf1`.
3. **"làm đi" → FR-12** giữ/đếm từ đệm (không cần key) + auto ưu tiên STT giữ-filler. Commit `cc753b6`.
4. **"c đi" → Pha C** seed 3 thể loại published + meta màu/tagline. Commit `08fa54c`.
5. **Finn:** "phần nhiệm vụ chưa đủ chi tiết…" → gọi **`/bmad-agent-analyst` (Mary)** phân tích → đề xuất **Thẻ nhiệm vụ**. Finn chốt: *ẩn ví dụ sau "Xem gợi ý"* + *làm hết + nâng AI-split*. → Build xong, verify đầu-cuối, commit `1d82e45`.
6. Finn: "ghi hết context phiên thành 1 file md" → chính file này.
7. **Phiên 2 (06/07):** Finn yêu cầu enhance UX/UI cho Gen Z → **Mary** phân tích khoảng cách
   spec-vs-code (spec hứa spotlight/confetti/haptic nhưng code chỉ có Alert) → **Sally** viết
   4 spec (P0 cảm xúc · P1 thẻ khoe · P1 màn quay · P2 onboarding) + demo tương tác →
   Finn: "làm hết luôn" → **Amelia** build cả 4 gói (7 file mới + App.tsx tích hợp, xem §3).

**Lịch sử commit (mới → cũ):**
```
1d82e45 Thẻ nhiệm vụ: mô tả chi tiết + ví dụ mẫu cho mỗi bài (phân tích Mary)
08fa54c v2 Pha C: mở rộng thể loại (đám cưới/sự kiện/livestream)
cc753b6 v2 FR-12: giữ & đếm từ đệm chuẩn hơn (không cần key mới)
fd50cf1 v2 FR-15: rubric chấm theo thể loại (lõi + module)
cb1b824 v2 FR-19: học viên học nội dung đã xuất bản (chọn lộ trình + luyện bài)
0beca81 v2 Pha B: mô hình nội dung phân tầng + admin duyệt/publish (FR-16/17)
e7750b0 v2 Pha A: âm lượng RMS thật + wpm theo thời gian nói
b6f9a4d v2 Pha B: AI chia giáo trình (AI-split, FR-18)
0ce1921 Đăng nhập/đăng ký thật + lưu phiên + phân màn theo vai
1902c40 Giải đấu (hạng Đồng→Kim cương) + nhắc streak trong app
f2e61ed Voice review: MC ghi âm giọng thật, học viên nghe lại (crown jewel)
4d84224 Huy hiệu thành tựu + biểu đồ tiến bộ từ đệm
c0c1b2d Tính năng Bảng xếp hạng (leaderboard)
dfb007e Refactor backend: gỡ sys.path hack + tách tầng service
c4cae16 UI polish: animation spotlight, tab Hồ sơ, địa danh, gọn CTA
b469ba7 Nâng Expo SDK 54 + lộ trình bản đồ "leo sân khấu" (Duolingo-style)
08d13f0 McUp MVP: backend FastAPI + app RN + web prototype + Docker deploy
```

---

## 9. Artifact BMad (kế hoạch)

`_bmad-output/planning-artifacts/`
- `prds/prd-mc-training-2026-07-03/prd.md` — PRD (v1 + v2, FR-1 → FR-22)
- `architecture/architecture-mc-training-2026-07-03/ARCHITECTURE-SPINE.md` — AD-1 → AD-12
- `research/` — market research + khảo sát cầu thể loại
- `ux-designs/ux-mc-training-2026-07-03/` — DESIGN.md "Sân khấu ấm" + EXPERIENCE.md
- `epics.md`, `briefs/`, `brainstorming/`
