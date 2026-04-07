CREATE TABLE IF NOT EXISTS kick_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  state TEXT NOT NULL,
  coverage_note TEXT NOT NULL,
  observed_count INTEGER NOT NULL DEFAULT 0,
  platform_total_count INTEGER,
  total_viewers_observed INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS kick_livestream_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  fetched_at TEXT NOT NULL,
  broadcaster_user_id TEXT,
  channel_id TEXT,
  slug TEXT,
  stream_title TEXT,
  viewer_count INTEGER NOT NULL DEFAULT 0,
  started_at TEXT,
  language TEXT,
  category_id TEXT,
  category_name TEXT,
  raw_json TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES kick_runs(id)
);

CREATE INDEX IF NOT EXISTS idx_kick_runs_created_at
  ON kick_runs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_kick_snapshots_run_id
  ON kick_livestream_snapshots(run_id);

CREATE INDEX IF NOT EXISTS idx_kick_snapshots_slug
  ON kick_livestream_snapshots(slug);

CREATE INDEX IF NOT EXISTS idx_kick_snapshots_viewers
  ON kick_livestream_snapshots(viewer_count DESC);
