-- Create articles table for Neon/Postgres backend.

CREATE TABLE IF NOT EXISTS articles (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
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
