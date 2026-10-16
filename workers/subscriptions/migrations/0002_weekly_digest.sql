-- Preserve known post identities: changing delivery mode never re-mails history.
ALTER TABLE posts ADD COLUMN included_at INTEGER;
ALTER TABLE posts ADD COLUMN available INTEGER NOT NULL DEFAULT 1;
UPDATE posts SET included_at=discovered_at;
CREATE TABLE digests (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, post_count INTEGER NOT NULL);
CREATE INDEX posts_pending_digest ON posts(included_at,available,discovered_at);
