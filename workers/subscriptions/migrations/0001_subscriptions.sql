CREATE TABLE IF NOT EXISTS subscribers (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE,
 status TEXT NOT NULL CHECK(status IN ('pending','active','unsubscribed','suppressed')),
 created_at INTEGER NOT NULL, requested_at INTEGER NOT NULL DEFAULT 0,
 generation TEXT, confirmation_expires INTEGER, confirmed_at INTEGER, unsubscribed_at INTEGER
);
CREATE TABLE IF NOT EXISTS posts (
 guid TEXT PRIMARY KEY, payload TEXT NOT NULL, discovered_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS jobs (
 id TEXT PRIMARY KEY, subscriber_id TEXT NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('confirmation','post')), payload TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','sending','sent','failed','uncertain','cancelled')),
 created_at INTEGER NOT NULL, next_attempt_at INTEGER NOT NULL DEFAULT 0,
 attempts INTEGER NOT NULL DEFAULT 0, first_attempt_at INTEGER, lease_until INTEGER NOT NULL DEFAULT 0,
 message_id TEXT UNIQUE, delivered_at INTEGER, last_error TEXT
);
CREATE INDEX IF NOT EXISTS jobs_due ON jobs(state,next_attempt_at,created_at);
CREATE TABLE IF NOT EXISTS send_attempts (id TEXT PRIMARY KEY, at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS attempts_time ON send_attempts(at);
CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS locks (name TEXT PRIMARY KEY, owner TEXT NOT NULL, lease_until INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS signup_limits (key TEXT NOT NULL, window INTEGER NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(key,window));
CREATE TABLE IF NOT EXISTS suppressions (address_hash TEXT PRIMARY KEY, created_at INTEGER NOT NULL);
