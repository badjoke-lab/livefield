export interface CollectorStatusState {
  provider: "twitch"
  lastAttemptAt: string
  lastSuccessAt?: string
  lastFailureAt?: string
  lastError?: string
  coveredPages?: number
  hasMore?: boolean
  lastLiveCount?: number
  lastTotalViewers?: number
}

export async function upsertCollectorStatus(db: D1Database, state: CollectorStatusState): Promise<void> {
  await db
    .prepare(
      `INSERT INTO collector_status (
        provider,
        last_attempt_at,
        last_success_at,
        last_failure_at,
        last_error,
        covered_pages,
        has_more,
        last_live_count,
        last_total_viewers,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(provider) DO UPDATE SET
        last_attempt_at=excluded.last_attempt_at,
        last_success_at=COALESCE(excluded.last_success_at, collector_status.last_success_at),
        last_failure_at=COALESCE(excluded.last_failure_at, collector_status.last_failure_at),
        last_error=excluded.last_error,
        covered_pages=excluded.covered_pages,
        has_more=excluded.has_more,
        last_live_count=excluded.last_live_count,
        last_total_viewers=excluded.last_total_viewers,
        updated_at=excluded.updated_at`
    )
    .bind(
      state.provider,
      state.lastAttemptAt,
      state.lastSuccessAt ?? null,
      state.lastFailureAt ?? null,
      state.lastError ?? null,
      state.coveredPages ?? null,
      typeof state.hasMore === "boolean" ? (state.hasMore ? 1 : 0) : null,
      state.lastLiveCount ?? null,
      state.lastTotalViewers ?? null,
      new Date().toISOString()
    )
    .run()
}

export async function getCollectorStatus(db: D1Database): Promise<Record<string, unknown> | null> {
  return (
    (await db
      .prepare(
        `SELECT provider, last_attempt_at, last_success_at, last_failure_at, last_error, covered_pages, has_more, last_live_count, last_total_viewers, updated_at
         FROM collector_status
         WHERE provider = 'twitch'
         LIMIT 1`
      )
      .first<Record<string, unknown>>()) ?? null
  )
}
