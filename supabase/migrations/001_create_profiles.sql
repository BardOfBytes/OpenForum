-- ============================================================
-- OpenForum — Supabase Migration: Create profiles table
-- ============================================================
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- or via the Supabase CLI: supabase db push
--
-- This table extends Supabase auth.users with application-specific
-- profile data. The `id` column references auth.users.id and is
-- automatically populated via the OAuth callback route.
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. Create the profiles table
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  -- Primary key — same as auth.users.id (1:1 relationship)
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identity fields (populated from OAuth metadata)
  email       TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url  TEXT,

  -- Student-specific metadata (filled in by the user post-sign-up)
  roll_number TEXT,          -- e.g., "21CS001"
  branch      TEXT,          -- e.g., "Computer Science & Engineering"
  year        SMALLINT,      -- e.g., 1, 2, 3, 4

  -- Platform role: controls access to features
  -- 'reader' = browse + comment | 'writer' = can publish articles
  -- 'editor' = can moderate    | 'admin'  = full access
  role        TEXT NOT NULL DEFAULT 'reader'
              CHECK (role IN ('reader', 'writer', 'editor', 'admin')),

  -- Bio (displayed on public profile)
  bio         TEXT DEFAULT '',

  -- Timestamps
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for email lookups (auth flows)
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Index for role-based queries (e.g., "list all writers")
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);


-- ──────────────────────────────────────────────────────────────
-- 2. Row Level Security (RLS)
-- ──────────────────────────────────────────────────────────────
-- Enable RLS so that the table is locked down by default.
-- Access is granted only through explicit policies below.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read profiles (public author pages, article bylines)
CREATE POLICY "Profiles are publicly readable"
  ON public.profiles
  FOR SELECT
  USING (true);

-- Users can only update their own profile
CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users can insert their own profile (first sign-in via callback)
CREATE POLICY "Users can insert their own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users cannot delete profiles (admin-only operation via service key)
-- No DELETE policy = denied by default with RLS enabled.


-- ──────────────────────────────────────────────────────────────
-- 3. Auto-update `updated_at` timestamp on every UPDATE
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();


-- ──────────────────────────────────────────────────────────────
-- 4. Domain restriction trigger (defense-in-depth)
-- ──────────────────────────────────────────────────────────────
-- This is a SECOND layer of protection beyond the application-level
-- check in the OAuth callback. Even if someone bypasses the
-- callback, the database will reject non-@csvtu.ac.in users.

CREATE OR REPLACE FUNCTION public.restrict_email_domain()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IS NOT NULL AND NEW.email NOT LIKE '%@csvtu.ac.in' THEN
    RAISE EXCEPTION 'Access restricted to @csvtu.ac.in emails only. Got: %', NEW.email;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER enforce_csvtu_domain
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.restrict_email_domain();


-- ──────────────────────────────────────────────────────────────
-- 5. Optional: Restrict auth.users domain (strongest protection)
-- ──────────────────────────────────────────────────────────────
-- Uncomment the block below to prevent non-@csvtu.ac.in users
-- from even being created in Supabase auth. This is the most
-- secure option but may interfere with Supabase internal flows.
--
-- CREATE OR REPLACE FUNCTION public.restrict_auth_domain()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   IF NEW.email NOT LIKE '%@csvtu.ac.in' THEN
--     RAISE EXCEPTION 'Registration restricted to @csvtu.ac.in emails.';
--   END IF;
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;
--
-- CREATE TRIGGER enforce_auth_domain
--   BEFORE INSERT ON auth.users
--   FOR EACH ROW
--   EXECUTE FUNCTION public.restrict_auth_domain();


-- ──────────────────────────────────────────────────────────────
-- 6. Grant access to the authenticated and anon roles
-- ──────────────────────────────────────────────────────────────

GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
