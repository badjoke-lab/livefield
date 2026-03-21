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
  chatState?: "running" | "unavailable" | "error"
  chatUnavailableReason?: string
}

export interface CollectorRunRecord {
  provider: "twitch"
  runAt: string
  status: "success" | "failure"
  errorCode?: string | null
  errorMessage?: string | null
  liveCount?: number | null
  totalViewers?: number | null
  coveredPages?: number | null
  hasMore?: boolean | null
}

export async function insertCollectorRun(db: D1Database, row: CollectorRunRecord): Promise<void> {
  await db
    .prepare(
      `INSERT INTO collector_runs (
        provider,
        run_at,
        status,
        error_code,
        error_message,
        live_count,
        total_viewers,
        covered_pages,
        has_more
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      row.provider,
      row.runAt,
      row.status,
      row.errorCode ?? null,
      row.errorMessage ?? null,
      row.liveCount ?? null,
      row.totalViewers ?? null,
      row.coveredPages ?? null,
      typeof row.hasMore === "boolean" ? (row.hasMore ? 1 : 0) : null
    )
    .run()
}

export async function pruneCollectorRunsBefore(db: D1Database, cutoffIso: string): Promise<number> {
  const result = await db
    .prepare(
      `DELETE FROM collector_runs
       WHERE provider = 'twitch' AND run_at < ?`
    )
    .bind(cutoffIso)
    .run()

  return result.meta.changes ?? 0
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
        chat_state,
        chat_unavailable_reason,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(provider) DO UPDATE SET
        last_attempt_at=excluded.last_attempt_at,
        last_success_at=COALESCE(excluded.last_success_at, collector_status.last_success_at),
        last_failure_at=COALESCE(excluded.last_failure_at, collector_status.last_failure_at),
        last_error=excluded.last_error,
        covered_pages=excluded.covered_pages,
        has_more=excluded.has_more,
        last_live_count=excluded.last_live_count,
        last_total_viewers=excluded.last_total_viewers,
        chat_state=COALESCE(excluded.chat_state, collector_status.chat_state),
        chat_unavailable_reason=excluded.chat_unavailable_reason,
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
      state.chatState ?? null,
      state.chatUnavailableReason ?? null,
      new Date().toISOString()
    )
    .run()
}

export async function getCollectorStatus(db: D1Database): Promise<Record<string, unknown> | null> {
  return (
    (await db
      .prepare(
        `SELECT
           COALESCE(cs.provider, p.provider) AS provider,
           cs.last_attempt_at,
           COALESCE(cs.last_success_at, (
             SELECT cr.run_at
             FROM collector_runs cr
             WHERE cr.provider = p.provider AND cr.status = 'success'
             ORDER BY cr.run_at DESC
             LIMIT 1
           )) AS last_success_at,
           COALESCE(cs.last_failure_at, (
             SELECT cr.run_at
             FROM collector_runs cr
             WHERE cr.provider = p.provider AND cr.status = 'failure'
             ORDER BY cr.run_at DESC
             LIMIT 1
           )) AS last_failure_at,
           COALESCE(cs.last_error, (
             SELECT COALESCE(cr.error_message, cr.error_code)
             FROM collector_runs cr
             WHERE cr.provider = p.provider AND cr.status = 'failure'
             ORDER BY cr.run_at DESC
             LIMIT 1
           )) AS last_error,
           cs.covered_pages,
           cs.has_more,
           cs.last_live_count,
           cs.last_total_viewers,
           cs.chat_state,
           cs.chat_unavailable_reason,
           cs.updated_at
         FROM (SELECT 'twitch' AS provider) p
         LEFT JOIN collector_status cs ON cs.provider = p.provider
         LIMIT 1`
      )
      .first<Record<string, unknown>>()) ?? null
  )
}
