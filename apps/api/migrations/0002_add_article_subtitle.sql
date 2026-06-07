-- Add authored subtitle/deck to articles.
-- Falls back to the excerpt at write time when the author leaves it blank.

ALTER TABLE articles ADD COLUMN IF NOT EXISTS subtitle text NOT NULL DEFAULT '';
