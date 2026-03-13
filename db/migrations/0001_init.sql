CREATE TABLE IF NOT EXISTS minute_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  bucket_minute TEXT NOT NULL,
  collected_at TEXT NOT NULL,
  live_count INTEGER NOT NULL,
  total_viewers INTEGER NOT NULL,
  covered_pages INTEGER NOT NULL,
  has_more INTEGER NOT NULL DEFAULT 0,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(provider, bucket_minute)
);

CREATE TABLE IF NOT EXISTS collector_status (
  provider TEXT PRIMARY KEY,
  last_attempt_at TEXT NOT NULL,
  last_success_at TEXT,
  last_failure_at TEXT,
  last_error TEXT,
  covered_pages INTEGER,
  has_more INTEGER,
  last_live_count INTEGER,
  last_total_viewers INTEGER,
  updated_at TEXT NOT NULL
);
