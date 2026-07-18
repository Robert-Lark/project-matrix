-- Blog plane schema (ADR-0009 §2). Markdown is the source of truth
-- (body_md); body_html is a cache column recomputed on save by the same
-- pipeline that renders the public page. Times are ISO-8601 UTC strings.

CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'essay'
    CHECK (kind IN ('essay', 'photo', 'note', 'link')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published')),
  title TEXT NOT NULL DEFAULT '',
  dek TEXT NOT NULL DEFAULT '',
  body_md TEXT NOT NULL DEFAULT '',
  body_html TEXT NOT NULL DEFAULT '',
  link_url TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  series TEXT,
  series_part INTEGER,
  accent TEXT,
  header_style TEXT NOT NULL DEFAULT 'standard',
  mood TEXT NOT NULL DEFAULT 'default',
  cover_media_id TEXT,
  preview_token TEXT UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT,
  -- Display date distinct from published_at, so a post can carry the date
  -- it was really written (and future scheduling stays representable).
  original_date TEXT,
  -- Editor re-entry state (drafts-over-days): cursor, scroll, pane sizes.
  editor_state TEXT
);
CREATE INDEX posts_published ON posts (status, published_at DESC);
CREATE INDEX posts_updated ON posts (updated_at DESC);
CREATE INDEX posts_series ON posts (series, series_part);

-- Normalized tag rows for contents-page filtering; posts.tags stays the
-- authoring-side JSON the editor round-trips.
CREATE TABLE post_tags (
  post_id TEXT NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY (post_id, tag)
);
CREATE INDEX post_tags_tag ON post_tags (tag);

-- Crash-safe history: every autosave that changes content lands here;
-- 'snapshot' rows are deliberate save-points (publish writes one).
CREATE TABLE revisions (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'autosave'
    CHECK (kind IN ('autosave', 'snapshot')),
  title TEXT NOT NULL DEFAULT '',
  body_md TEXT NOT NULL,
  saved_at TEXT NOT NULL
);
CREATE INDEX revisions_post ON revisions (post_id, saved_at DESC);

CREATE TABLE media (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL DEFAULT '',
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  alt TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

-- Server-side sessions (ADR-0009 §5): the cookie carries a 256-bit id, only
-- its SHA-256 lands here; rows are revocable and expire (30-day rolling).
CREATE TABLE sessions (
  id_hash TEXT PRIMARY KEY,
  csrf_token TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  ua TEXT NOT NULL DEFAULT ''
);

-- Login rate limiting (ADR-0009 §5): per-IP failure window with lockout.
CREATE TABLE login_attempts (
  bucket TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL,
  locked_until TEXT
);

-- Published slug changes leave a 301 behind — URLs never break (ADR-0009 §6).
CREATE TABLE redirects (
  from_slug TEXT PRIMARY KEY,
  to_slug TEXT NOT NULL,
  created_at TEXT NOT NULL
);
