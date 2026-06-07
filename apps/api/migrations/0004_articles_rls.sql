-- Row Level Security for the articles table.
--
-- The Rust API connects to Postgres as the `postgres` role through the
-- Supabase pooler and sets no JWT claims, so it BYPASSES RLS (superusers are
-- exempt unless FORCE ROW LEVEL SECURITY is set). These policies are therefore
-- a defense-in-depth backstop for any direct browser -> Supabase PostgREST
-- access, satisfying the Supabase Security Advisor "RLS Disabled in Public"
-- check. They do not constrain the API's own queries.
--
-- Enabling RLS with NO policies would deny all PostgREST access; the policies
-- below intentionally mirror the production project: published articles are
-- publicly readable, and authenticated authors manage only their own rows.

ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- Anyone (anon + authenticated) may read published articles via PostgREST.
DROP POLICY IF EXISTS "Published articles are readable" ON articles;
CREATE POLICY "Published articles are readable"
  ON articles
  FOR SELECT
  TO anon, authenticated
  USING (lower(status) = 'published');

-- Authenticated authors may read their own articles (including drafts).
DROP POLICY IF EXISTS "Authors can read own articles" ON articles;
CREATE POLICY "Authors can read own articles"
  ON articles
  FOR SELECT
  TO authenticated
  USING (author_id = auth.uid());

-- Authenticated authors may insert articles attributed to themselves.
DROP POLICY IF EXISTS "Authors can insert own articles" ON articles;
CREATE POLICY "Authors can insert own articles"
  ON articles
  FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid());

-- Authenticated authors may update their own articles.
DROP POLICY IF EXISTS "Authors can update own articles" ON articles;
CREATE POLICY "Authors can update own articles"
  ON articles
  FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- Authenticated authors may delete their own articles.
DROP POLICY IF EXISTS "Authors can delete own articles" ON articles;
CREATE POLICY "Authors can delete own articles"
  ON articles
  FOR DELETE
  TO authenticated
  USING (author_id = auth.uid());
