CREATE INDEX IF NOT EXISTS idx_minute_snapshots_provider_bucket
  ON minute_snapshots(provider, bucket_minute DESC);
