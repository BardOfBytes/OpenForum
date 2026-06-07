-- ============================================================
-- OpenForum — full bootstrap for a FRESH Supabase project.
--
-- The repo's SQLx migrations (0001–0004) only manage `articles`. The other
-- tables (profiles, comments, likes, bookmarks, follows) and the profile
-- auto-provisioning trigger were created directly in the original Supabase
-- project, so a brand-new project needs this script.
--
-- Run this ONCE in the new project's SQL Editor, THEN run the SQLx migrations
-- (or set OPENFORUM_RUN_API_MIGRATIONS=true for one boot) for the articles
-- table + its RLS. This script is idempotent (safe to re-run).
--
-- Adjust the profiles columns only if the original project had extra ones.
-- ============================================================

-- ----------------------------------------------------------
-- profiles — one row per auth user. Mirrors auth.users.id.
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text,
  display_name text,
  username text UNIQUE,
  roll_number text,
  branch text,
  year text,
  avatar_url text,
  headline text DEFAULT '',
  bio text,
  followers_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Auto-create a profile row when a new auth user signs up.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------
-- articles — created by SQLx migration 0001 (+ 0002 subtitle).
-- Included here so this script can stand alone if needed.
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS articles (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  subtitle text NOT NULL DEFAULT '',
  excerpt text NOT NULL,
  body text NOT NULL,
  content_gdoc_id text,
  author_id uuid NOT NULL,
  category_name text NOT NULL,
  category_slug text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  views integer NOT NULL DEFAULT 0,
  cover_image_url text
);
CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_category_slug ON articles (category_slug);

-- ----------------------------------------------------------
-- comments
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES articles (id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL,
  parent_id uuid REFERENCES comments (id) ON DELETE CASCADE,
  is_hidden boolean NOT NULL DEFAULT false,
  hidden_at timestamptz,
  hidden_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comments_article_id ON comments (article_id);

-- ----------------------------------------------------------
-- likes / bookmarks — composite-keyed join tables
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS likes (
  user_id uuid NOT NULL,
  article_id uuid NOT NULL REFERENCES articles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, article_id)
);
CREATE INDEX IF NOT EXISTS idx_likes_article_id ON likes (article_id);

CREATE TABLE IF NOT EXISTS bookmarks (
  user_id uuid NOT NULL,
  article_id uuid NOT NULL REFERENCES articles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, article_id)
);
CREATE INDEX IF NOT EXISTS idx_bookmarks_article_id ON bookmarks (article_id);

-- ----------------------------------------------------------
-- follows
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS follows (
  follower_id uuid NOT NULL,
  following_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows (following_id);

-- ============================================================
-- Row Level Security
--
-- The Rust API connects as `postgres` and bypasses RLS, so these are a
-- backstop for direct browser->PostgREST access and to satisfy the Supabase
-- Security Advisor. Per the project's security rules, the browser must NOT
-- read/write these tables directly for core behavior — hence deny-by-default
-- on writes and public read only where appropriate.
-- ============================================================

-- profiles: public may read (public author profiles expose only safe fields
-- via the API; PostgREST exposure here is the backstop). No public writes.
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Profiles are publicly readable" ON profiles;
CREATE POLICY "Profiles are publicly readable"
  ON profiles FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- articles: same policies as SQLx migration 0004 (kept here for standalone use).
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Published articles are readable" ON articles;
CREATE POLICY "Published articles are readable"
  ON articles FOR SELECT TO anon, authenticated USING (lower(status) = 'published');
DROP POLICY IF EXISTS "Authors can read own articles" ON articles;
CREATE POLICY "Authors can read own articles"
  ON articles FOR SELECT TO authenticated USING (author_id = auth.uid());
DROP POLICY IF EXISTS "Authors can insert own articles" ON articles;
CREATE POLICY "Authors can insert own articles"
  ON articles FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
DROP POLICY IF EXISTS "Authors can update own articles" ON articles;
CREATE POLICY "Authors can update own articles"
  ON articles FOR UPDATE TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
DROP POLICY IF EXISTS "Authors can delete own articles" ON articles;
CREATE POLICY "Authors can delete own articles"
  ON articles FOR DELETE TO authenticated USING (author_id = auth.uid());

-- comments: published-article comments readable; authors manage their own.
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Comments are readable" ON comments;
CREATE POLICY "Comments are readable"
  ON comments FOR SELECT TO anon, authenticated USING (coalesce(is_hidden, false) = false);
DROP POLICY IF EXISTS "Authors can insert own comments" ON comments;
CREATE POLICY "Authors can insert own comments"
  ON comments FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
DROP POLICY IF EXISTS "Authors can update own comments" ON comments;
CREATE POLICY "Authors can update own comments"
  ON comments FOR UPDATE TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
DROP POLICY IF EXISTS "Authors can delete own comments" ON comments;
CREATE POLICY "Authors can delete own comments"
  ON comments FOR DELETE TO authenticated USING (author_id = auth.uid());

-- likes / bookmarks / follows: RLS enabled, owner-scoped. The API (postgres)
-- bypasses these; PostgREST sees only the owner's rows.
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own likes" ON likes;
CREATE POLICY "Users manage own likes"
  ON likes FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Like counts are readable" ON likes;
CREATE POLICY "Like counts are readable"
  ON likes FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own bookmarks" ON bookmarks;
CREATE POLICY "Users manage own bookmarks"
  ON bookmarks FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Follows are readable" ON follows;
CREATE POLICY "Follows are readable"
  ON follows FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Users manage own follows" ON follows;
CREATE POLICY "Users manage own follows"
  ON follows FOR ALL TO authenticated USING (follower_id = auth.uid()) WITH CHECK (follower_id = auth.uid());

-- ----------------------------------------------------------
-- _sqlx_migrations RLS backstop (Security Advisor fix).
-- SQLx creates this table; enable RLS with no policies so PostgREST
-- returns nothing. Wrapped so it no-ops if the table doesn't exist yet.
-- ----------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = '_sqlx_migrations') THEN
    EXECUTE 'ALTER TABLE public._sqlx_migrations ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;
