CREATE TABLE mentions (
 source TEXT NOT NULL, target TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('pending','approved','rejected')),
 name TEXT NOT NULL DEFAULT '', author TEXT NOT NULL DEFAULT '', published TEXT,
 fingerprint TEXT NOT NULL, verified_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 PRIMARY KEY(source,target)
);
CREATE INDEX mentions_public ON mentions(target,state,verified_at);
CREATE TABLE limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
