-- Run this against your D1 database:
--   wrangler d1 execute FLAIR_DB --file=functions/api/schema.sql

CREATE TABLE IF NOT EXISTS boards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Untitled',
  user_id TEXT NOT NULL DEFAULT '',
  is_public INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS pins (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL,
  x REAL NOT NULL DEFAULT 200,
  y REAL NOT NULL DEFAULT 200,
  label TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  url_title TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#cc3333',
  text_color TEXT NOT NULL DEFAULT '#ffffff',
  image_upload TEXT NOT NULL DEFAULT '',
  visitor_id TEXT NOT NULL DEFAULT '',
  created INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL DEFAULT '',
  password TEXT NOT NULL DEFAULT '',
  created INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_pins_board_id ON pins(board_id);
CREATE INDEX IF NOT EXISTS idx_boards_user_id ON boards(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
