-- ============================================================================
-- BOLAJONTUBE — SUPABASE SQL EDITOR UCHUN MUKAMMAL POSTGRESQL SXEMASI (v3.0)
-- ============================================================================
-- Ushbu skriptni Supabase Dashboard -> SQL Editor oynasiga to'liq nusxalab,
-- "Run" tugmasini bosing. U quyidagilarni avtomatik yaratadi:
--   1. Kengaytmalar (uuid-ossp, pgcrypto)
--   2. Barcha jadvallar (users, videos, comments, reports, user_activity)
--   3. Tezkor qidiruv va filtrlash indekslari (Indexes)
--   4. Avtomatik vaqt yangilash va xavfsizlik triggerlari (Triggers & Functions)
--   5. Row Level Security (RLS) qoidalari va Storage bucketlar
--   6. Kod orqali Bosh Admin (admin@bolajontube.uz), Creator va Demo ma'lumotlarni kiritish
-- ============================================================================

BEGIN;

-- 1. KERAKLI KENGAYTMALAR (EXTENSIONS)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 2. JADVALLAR (TABLES)
-- ============================================================================

-- 2.1. FOYDALANUVCHILAR JADVALI (users)
-- Qoida: Hamma oddiy 'Foydalanuvchi' bo'lib ro'yxatdan o'tadi.
-- 'Creator' faqat Admin tomonidan tayinlanadi, 'Admin' esa shu SQL kod orqali kiritiladi.
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(120) NOT NULL CHECK (char_length(trim(name)) >= 2),
  email VARCHAR(160) UNIQUE NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'Foydalanuvchi'
    CHECK (role IN ('Foydalanuvchi', 'Creator', 'Admin')),
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'blocked')),
  age_group VARCHAR(15) NOT NULL DEFAULT 'all'
    CHECK (age_group IN ('all', '3-5', '6-8', '9-12')),
  avatar VARCHAR(16) NOT NULL DEFAULT '🦊',
  creator_requested BOOLEAN NOT NULL DEFAULT FALSE,
  parental_pin VARCHAR(10) NOT NULL DEFAULT '1234',
  daily_limit_mins INTEGER NOT NULL DEFAULT 45 CHECK (daily_limit_mins BETWEEN 5 AND 360),
  watched_minutes_today INTEGER NOT NULL DEFAULT 0 CHECK (watched_minutes_today >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.2. VIDEOLAR JADVALI (videos)
CREATE TABLE IF NOT EXISTS public.videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(200) NOT NULL CHECK (char_length(trim(title)) >= 3),
  channel VARCHAR(120) NOT NULL,
  channel_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  category VARCHAR(50) NOT NULL
    CHECK (category IN ('Multfilmlar', 'Ta''lim', 'Qo''shiqlar', 'Ertaklar', 'Matematika', 'Hunarmandchilik')),
  age_group VARCHAR(15) NOT NULL DEFAULT '3-5'
    CHECK (age_group IN ('3-5', '6-8', '9-12')),
  duration VARCHAR(20) NOT NULL DEFAULT '05:00',
  views INTEGER NOT NULL DEFAULT 0 CHECK (views >= 0),
  likes INTEGER NOT NULL DEFAULT 0 CHECK (likes >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  thumb_url TEXT NOT NULL,
  video_url TEXT DEFAULT '',
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.3. XAVFSIZ IZOHLAR JADVALI (comments)
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  author VARCHAR(120) NOT NULL,
  text TEXT NOT NULL CHECK (char_length(trim(text)) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.4. SHIKOYATLAR JADVALI (reports)
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reporter_name VARCHAR(120) NOT NULL,
  reason TEXT NOT NULL CHECK (char_length(trim(reason)) >= 3),
  status VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- 2.5. FOYDALANUVCHI FAOLLIGI VA KO'RISH TARIXI (user_activity)
CREATE TABLE IF NOT EXISTS public.user_activity (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  liked_video_ids UUID[] NOT NULL DEFAULT '{}',
  saved_video_ids UUID[] NOT NULL DEFAULT '{}',
  subscribed_channels TEXT[] NOT NULL DEFAULT '{}',
  history_video_ids UUID[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. TEZKOR QIDIRUV INDEKSLARI (INDEXES)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_role_status ON public.users (role, status);
CREATE INDEX IF NOT EXISTS idx_users_creator_req ON public.users (creator_requested) WHERE creator_requested = TRUE;

CREATE INDEX IF NOT EXISTS idx_videos_status_created ON public.videos (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_category_age ON public.videos (category, age_group) WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS idx_videos_channel_id ON public.videos (channel_id);

CREATE INDEX IF NOT EXISTS idx_comments_video_id ON public.comments (video_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports (status, created_at DESC);

-- ============================================================================
-- 4. FUNKSIYALAR VA TRIGGERLAR (FUNCTIONS & TRIGGERS)
-- ============================================================================

-- 4.1. updated_at ustunini avtomatik yangilash funksiyasi
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_videos_updated_at ON public.videos;
CREATE TRIGGER trg_videos_updated_at
  BEFORE UPDATE ON public.videos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_user_activity_updated_at ON public.user_activity;
CREATE TRIGGER trg_user_activity_updated_at
  BEFORE UPDATE ON public.user_activity
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4.2. Yangi foydalanuvchi qo'shilganda avtomatik user_activity qatorini ochish
CREATE OR REPLACE FUNCTION public.handle_new_user_activity()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_activity (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_create_user_activity ON public.users;
CREATE TRIGGER trg_create_user_activity
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_activity();

-- 4.3. Bolalar xavfsizligi: Izohlarda taqiqlangan so'zlarni avtomatik bloklash triggeri
CREATE OR REPLACE FUNCTION public.check_kid_safe_comment()
RETURNS TRIGGER AS $$
DECLARE
  bad_word TEXT;
  forbidden_words TEXT[] := ARRAY['yomon', 'ahmoq', 'jinni', 'urush', 'spam', 'haqorat'];
BEGIN
  FOREACH bad_word IN ARRAY forbidden_words LOOP
    IF LOWER(NEW.text) LIKE '%' || bad_word || '%' THEN
      RAISE EXCEPTION 'Bolalar xavfsizligi filtri: Izohda taqiqlangan so''z (%) mavjud!', bad_word;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_kid_safe_comment ON public.comments;
CREATE TRIGGER trg_check_kid_safe_comment
  BEFORE INSERT OR UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.check_kid_safe_comment();

-- 4.4. Video ko'rishlar sonini +1 oshirish uchun RPC funksiya
CREATE OR REPLACE FUNCTION public.increment_video_views(target_video_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.videos
  SET views = views + 1
  WHERE id = target_video_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS) SIYOSATLARI VA STORAGE BUCKETLAR
-- ============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

-- Tasdiqlangan videolarni hamma ko'ra oladi
DROP POLICY IF EXISTS "Approved videos are public" ON public.videos;
CREATE POLICY "Approved videos are public"
  ON public.videos FOR SELECT
  USING (status = 'approved');

-- Izohlarni hamma o'qiy oladi
DROP POLICY IF EXISTS "Comments are public" ON public.comments;
CREATE POLICY "Comments are public"
  ON public.comments FOR SELECT
  USING (TRUE);

-- Service Role (Node.js Backend) barcha jadvallarga to'liq huquqqa ega
DROP POLICY IF EXISTS "Service role full access users" ON public.users;
CREATE POLICY "Service role full access users"
  ON public.users FOR ALL
  USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Service role full access videos" ON public.videos;
CREATE POLICY "Service role full access videos"
  ON public.videos FOR ALL
  USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Service role full access comments" ON public.comments;
CREATE POLICY "Service role full access comments"
  ON public.comments FOR ALL
  USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Service role full access reports" ON public.reports;
CREATE POLICY "Service role full access reports"
  ON public.reports FOR ALL
  USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Service role full access activity" ON public.user_activity;
CREATE POLICY "Service role full access activity"
  ON public.user_activity FOR ALL
  USING (TRUE) WITH CHECK (TRUE);

-- Supabase Storage Bucketlar (videolar va muqova rasmlar uchun)
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('bolajon-videos', 'bolajon-videos', TRUE),
  ('bolajon-thumbs', 'bolajon-thumbs', TRUE)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 6. KOD ORQALI BOSH ADMIN, CREATOR VA DEMO VIDEOLARNI KIRITISH (SEED DATA)
-- ============================================================================
-- Eslatma: Parollar pgcrypto crypt(..., gen_salt('bf', 10)) (bcrypt) orqali xeshlangan.
-- Standart parol barcha tayyor hisoblar uchun: 1234
-- Bosh Admin: admin@bolajontube.uz (Parol: 1234)

INSERT INTO public.users (id, name, email, password_hash, role, status, age_group, avatar, creator_requested, parental_pin, daily_limit_mins)
VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'Bosh Moderator',
    'admin@bolajontube.uz',
    crypt('1234', gen_salt('bf', 10)),
    'Admin',
    'active',
    'all',
    '🛡️',
    FALSE,
    '1234',
    120
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'Alisher Studio',
    'alisher@creator.uz',
    crypt('1234', gen_salt('bf', 10)),
    'Creator',
    'active',
    'all',
    '🎥',
    FALSE,
    '1234',
    60
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'Bolajon Multfilm',
    'multfilm@creator.uz',
    crypt('1234', gen_salt('bf', 10)),
    'Creator',
    'active',
    'all',
    '🦊',
    FALSE,
    '1234',
    60
  ),
  (
    '00000000-0000-0000-0000-000000000004',
    'Dilnoza Karimova',
    'dilnoza@bolajontube.uz',
    crypt('1234', gen_salt('bf', 10)),
    'Foydalanuvchi',
    'active',
    '6-8',
    '🐰',
    TRUE,
    '1234',
    45
  )
ON CONFLICT (email) DO UPDATE SET
  role = EXCLUDED.role,
  status = EXCLUDED.status;

-- Boshlang'ich bolalar videolari
INSERT INTO public.videos (id, title, channel, channel_id, category, age_group, duration, views, likes, status, thumb_url, description)
VALUES
  (
    '10000000-0000-0000-0000-000000000001',
    'O''rmon do''stlari: Tulkicha va Quyonchaning sarguzashtlari',
    'Bolajon Multfilm',
    '00000000-0000-0000-0000-000000000003',
    'Multfilmlar',
    '3-5',
    '06:40',
    124500,
    8420,
    'approved',
    '/uploads/fox_bunny.jpg',
    'Kichkintoylar uchun do''stlik va tabiatni asrash haqida rang-barang 3D multfilm.'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'Koinotga sayohat: Sayyoralar nega aylanadi?',
    'Alisher Studio',
    '00000000-0000-0000-0000-000000000002',
    'Ta''lim',
    '6-8',
    '08:15',
    89300,
    6150,
    'approved',
    '/uploads/space_kid.jpg',
    'Quyosh tizimi, sayyoralar va yulduzlar haqida bolalar tilida sodda va qiziqarli tushuntirish.'
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    'Yangi Creator: Ranglarni o''rganamiz (Kutilmoqda)',
    'Alisher Studio',
    '00000000-0000-0000-0000-000000000002',
    'Ta''lim',
    '3-5',
    '04:10',
    0,
    0,
    'pending',
    '/uploads/diy_art.jpg',
    'Kichik yoshdagi bolajonlar uchun asosiy ranglarni tez yodlash darsi.'
  )
ON CONFLICT (id) DO NOTHING;

-- Boshlang'ich xavfsiz izohlar
INSERT INTO public.comments (video_id, user_id, author, text)
VALUES
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000004',
    'Dilnoza Karimova',
    'Qizimga juda yoqdi, rahmat! 🌟'
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 7. ADMIN PANEL STATISTIKASI UCHUN VIEW (ixtiyoriy qulaylik)
-- ============================================================================
CREATE OR REPLACE VIEW public.admin_dashboard_stats AS
SELECT
  (SELECT COUNT(*) FROM public.videos WHERE status = 'approved') AS approved_videos_count,
  (SELECT COUNT(*) FROM public.videos WHERE status = 'pending') AS pending_videos_count,
  (SELECT COUNT(*) FROM public.users) AS total_users_count,
  (SELECT COUNT(*) FROM public.users WHERE role = 'Creator') AS creators_count,
  (SELECT COUNT(*) FROM public.users WHERE creator_requested = TRUE AND role = 'Foydalanuvchi') AS pending_creator_requests,
  (SELECT COUNT(*) FROM public.reports WHERE status = 'open') AS open_reports_count;

COMMIT;
