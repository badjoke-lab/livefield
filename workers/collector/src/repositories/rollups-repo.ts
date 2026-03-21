export interface HistoryPruneResult {
  table: string
  deleted: number
}

async function deleteOlderThan(db: D1Database, table: string, column: string, cutoffIso: string): Promise<number> {
  const result = await db
    .prepare(`DELETE FROM ${table} WHERE ${column} < ?`)
    .bind(cutoffIso)
    .run()

  return result.meta.changes ?? 0
}

export async function pruneHistory5mBefore(db: D1Database, cutoffIso: string): Promise<HistoryPruneResult[]> {
  const results = await Promise.all([
    deleteOlderThan(db, "dayflow_bands_5m", "bucket_time", cutoffIso),
    deleteOlderThan(db, "battlelines_series_5m", "bucket_time", cutoffIso),
    deleteOlderThan(db, "battle_reversal_events", "bucket_time", cutoffIso),
    deleteOlderThan(db, "heatmap_frames_5m", "bucket_time", cutoffIso)
  ])

  return [
    { table: "dayflow_bands_5m", deleted: results[0] },
    { table: "battlelines_series_5m", deleted: results[1] },
    { table: "battle_reversal_events", deleted: results[2] },
    { table: "heatmap_frames_5m", deleted: results[3] }
  ]
}

export async function pruneHistory10mBefore(db: D1Database, cutoffIso: string): Promise<HistoryPruneResult[]> {
  const results = await Promise.all([
    deleteOlderThan(db, "dayflow_bands_10m", "bucket_time", cutoffIso),
    deleteOlderThan(db, "battlelines_series_10m", "bucket_time", cutoffIso)
  ])

  return [
    { table: "dayflow_bands_10m", deleted: results[0] },
    { table: "battlelines_series_10m", deleted: results[1] }
  ]
}

export async function pruneDailySummariesBefore(db: D1Database, cutoffIso: string): Promise<number> {
  return deleteOlderThan(db, "daily_stream_summaries", "day", cutoffIso)
}
