CREATE TABLE IF NOT EXISTS collector_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  run_at TEXT NOT NULL,
  status TEXT NOT NULL,
  error_code TEXT,
  error_message TEXT,
  live_count INTEGER,
  total_viewers INTEGER,
  covered_pages INTEGER,
  has_more INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_collector_runs_provider_run_at_desc
  ON collector_runs(provider, run_at DESC);

CREATE TABLE IF NOT EXISTS dayflow_bands_5m (
  day TEXT NOT NULL,
  bucket_time TEXT NOT NULL,
  top_scope TEXT NOT NULL,
  streamer_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  is_others INTEGER NOT NULL DEFAULT 0,
  avg_viewers REAL NOT NULL,
  viewer_minutes REAL NOT NULL,
  share REAL NOT NULL,
  peak_viewers INTEGER NOT NULL,
  first_seen_at TEXT,
  last_seen_at TEXT,
  momentum_delta REAL,
  activity_state TEXT,
  activity_level INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (day, bucket_time, top_scope, streamer_id)
);

CREATE INDEX IF NOT EXISTS idx_dayflow_bands_5m_day_bucket
  ON dayflow_bands_5m(day, bucket_time);
CREATE INDEX IF NOT EXISTS idx_dayflow_bands_5m_day_streamer
  ON dayflow_bands_5m(day, streamer_id);

CREATE TABLE IF NOT EXISTS dayflow_bands_10m (
  day TEXT NOT NULL,
  bucket_time TEXT NOT NULL,
  top_scope TEXT NOT NULL,
  streamer_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  is_others INTEGER NOT NULL DEFAULT 0,
  avg_viewers REAL NOT NULL,
  viewer_minutes REAL NOT NULL,
  share REAL NOT NULL,
  peak_viewers INTEGER NOT NULL,
  first_seen_at TEXT,
  last_seen_at TEXT,
  momentum_delta REAL,
  activity_state TEXT,
  activity_level INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (day, bucket_time, top_scope, streamer_id)
);

CREATE INDEX IF NOT EXISTS idx_dayflow_bands_10m_day_bucket
  ON dayflow_bands_10m(day, bucket_time);
CREATE INDEX IF NOT EXISTS idx_dayflow_bands_10m_day_streamer
  ON dayflow_bands_10m(day, streamer_id);

CREATE TABLE IF NOT EXISTS battlelines_series_5m (
  day TEXT NOT NULL,
  bucket_time TEXT NOT NULL,
  streamer_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  viewers INTEGER NOT NULL,
  indexed_base_peak REAL,
  viewer_delta REAL,
  momentum_delta REAL,
  activity_state TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (day, bucket_time, streamer_id)
);

CREATE INDEX IF NOT EXISTS idx_battlelines_series_5m_day_bucket
  ON battlelines_series_5m(day, bucket_time);
CREATE INDEX IF NOT EXISTS idx_battlelines_series_5m_day_streamer
  ON battlelines_series_5m(day, streamer_id);

CREATE TABLE IF NOT EXISTS battlelines_series_10m (
  day TEXT NOT NULL,
  bucket_time TEXT NOT NULL,
  streamer_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  viewers INTEGER NOT NULL,
  indexed_base_peak REAL,
  viewer_delta REAL,
  momentum_delta REAL,
  activity_state TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (day, bucket_time, streamer_id)
);

CREATE INDEX IF NOT EXISTS idx_battlelines_series_10m_day_bucket
  ON battlelines_series_10m(day, bucket_time);
CREATE INDEX IF NOT EXISTS idx_battlelines_series_10m_day_streamer
  ON battlelines_series_10m(day, streamer_id);

CREATE TABLE IF NOT EXISTS battle_reversal_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL,
  bucket_time TEXT NOT NULL,
  left_streamer_id TEXT NOT NULL,
  right_streamer_id TEXT NOT NULL,
  passer_streamer_id TEXT NOT NULL,
  passed_streamer_id TEXT NOT NULL,
  gap_before REAL NOT NULL,
  gap_after REAL NOT NULL,
  heat_overlap REAL,
  pair_score REAL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_battle_reversal_events_day_bucket_desc
  ON battle_reversal_events(day, bucket_time DESC);
CREATE INDEX IF NOT EXISTS idx_battle_reversal_events_day_streamer
  ON battle_reversal_events(day, passer_streamer_id);

CREATE TABLE IF NOT EXISTS heatmap_frames_5m (
  day TEXT NOT NULL,
  bucket_time TEXT NOT NULL,
  top_scope TEXT NOT NULL,
  streamer_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  viewers INTEGER NOT NULL,
  momentum_delta REAL,
  momentum_state TEXT,
  activity_state TEXT,
  activity_level INTEGER,
  title TEXT,
  game_id TEXT,
  game_name TEXT,
  language TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (day, bucket_time, top_scope, streamer_id)
);

CREATE INDEX IF NOT EXISTS idx_heatmap_frames_5m_day_bucket
  ON heatmap_frames_5m(day, bucket_time);
CREATE INDEX IF NOT EXISTS idx_heatmap_frames_5m_day_streamer
  ON heatmap_frames_5m(day, streamer_id);

CREATE TABLE IF NOT EXISTS daily_stream_summaries (
  day TEXT NOT NULL,
  bucket_time TEXT,
  streamer_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  viewer_minutes_total REAL NOT NULL,
  avg_viewers REAL NOT NULL,
  peak_viewers INTEGER NOT NULL,
  peak_share REAL,
  first_seen_at TEXT,
  last_seen_at TEXT,
  biggest_rise_time TEXT,
  activity_best_state TEXT,
  activity_best_time TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (day, streamer_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_stream_summaries_day_bucket
  ON daily_stream_summaries(day, bucket_time);
CREATE INDEX IF NOT EXISTS idx_daily_stream_summaries_day_streamer
  ON daily_stream_summaries(day, streamer_id);
