-- Scheduled publishing (ADR-0009 addendum). A scheduled post is an ordinary
-- draft carrying the instant it should go live; the cron trigger publishes
-- due rows through publishPost, which stamps published_at with this value
-- (the author's chosen moment, not the tick that executed it).
ALTER TABLE posts ADD COLUMN scheduled_at TEXT;

CREATE INDEX posts_scheduled ON posts (scheduled_at)
  WHERE scheduled_at IS NOT NULL;
