-- Magic-link auth for organizers.
-- The existing `organizers` table from 001 is unused (the old password-based
-- routes were never wired into the app). It's left in place to avoid touching
-- pre-existing dev databases; new code uses `users` instead.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);

CREATE INDEX users_email_idx ON users (email);

CREATE TABLE magic_links (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE INDEX magic_links_email_idx ON magic_links (email);

CREATE TABLE auth_sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX auth_sessions_user_idx ON auth_sessions (user_id);
