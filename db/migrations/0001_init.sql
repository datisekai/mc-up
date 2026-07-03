-- McUp — migration khởi tạo (Story 1.1)
-- Conventions: id = UUID, thời gian UTC (timestamptz).

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()

-- Vai người dùng: học viên | mc (AD-7: một hệ danh tính, hai vai)
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('hoc_vien', 'mc');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS app_user (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text UNIQUE,
  phone       text UNIQUE,
  role        user_role NOT NULL DEFAULT 'hoc_vien',
  display_name text,
  mc_title    text,                 -- chức danh hiển thị (chỉ với MC)
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Bảng version/health tối thiểu để xác nhận migration chạy
CREATE TABLE IF NOT EXISTS schema_meta (
  key   text PRIMARY KEY,
  value text NOT NULL
);
INSERT INTO schema_meta (key, value) VALUES ('version', '0001')
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Các bảng khác (Lesson, Clip, Score, GoldenTicket, ReviewRequest, MCReview,
-- BadgeCard, Entitlement) sẽ được thêm ở migration của story tương ứng —
-- KHÔNG tạo dồn hết ở đây (nguyên tắc: tạo bảng khi story cần).
