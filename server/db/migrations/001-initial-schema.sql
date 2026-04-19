CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  organizer_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'setup',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE lists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  list_number TEXT NOT NULL,
  label TEXT
);

CREATE TABLE groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  signal_group_link TEXT
);

CREATE TABLE group_lists (
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  list_id INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, list_id)
);

CREATE TABLE canvassers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  phone TEXT,
  minivan_id TEXT,
  group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
  session_token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE organizers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
