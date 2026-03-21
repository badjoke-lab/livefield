import type { TwitchStream } from "../providers/twitch/client"

export interface MinuteSnapshotRecord {
  provider: "twitch"
  bucketMinute: string
  collectedAt: string
  liveCount: number
  totalViewers: number
  coveredPages: number
  hasMore: boolean
  streams: TwitchStream[]
  commentCount?: number | null
  deltaComments?: number | null
  commentsPerMin?: number | null
  agitationRaw?: number | null
  agitationLevel?: number | null
}

export async function insertMinuteSnapshot(db: D1Database, row: MinuteSnapshotRecord): Promise<void> {
  await db
    .prepare(
      `INSERT INTO minute_snapshots (
        provider,
        bucket_minute,
        collected_at,
        live_count,
        total_viewers,
        covered_pages,
        has_more,
        comment_count,
        delta_comments,
        comments_per_min,
        agitation_raw,
        agitation_level,
        payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(provider, bucket_minute) DO UPDATE SET
        collected_at=excluded.collected_at,
        live_count=excluded.live_count,
        total_viewers=excluded.total_viewers,
        covered_pages=excluded.covered_pages,
        has_more=excluded.has_more,
        comment_count=excluded.comment_count,
        delta_comments=excluded.delta_comments,
        comments_per_min=excluded.comments_per_min,
        agitation_raw=excluded.agitation_raw,
        agitation_level=excluded.agitation_level,
        payload_json=excluded.payload_json`
    )
    .bind(
      row.provider,
      row.bucketMinute,
      row.collectedAt,
      row.liveCount,
      row.totalViewers,
      row.coveredPages,
      row.hasMore ? 1 : 0,
      row.commentCount ?? null,
      row.deltaComments ?? null,
      row.commentsPerMin ?? null,
      row.agitationRaw ?? null,
      row.agitationLevel ?? null,
      JSON.stringify({ streams: row.streams })
    )
    .run()
}

export async function pruneMinuteSnapshotsBefore(db: D1Database, cutoffIso: string): Promise<number> {
  const result = await db
    .prepare(
      `DELETE FROM minute_snapshots
       WHERE provider = 'twitch' AND bucket_minute < ?`
    )
    .bind(cutoffIso)
    .run()

  return result.meta.changes ?? 0
}

export async function getLatestSnapshotMeta(db: D1Database): Promise<Record<string, unknown> | null> {
  const result = await db
    .prepare(
      `SELECT provider, bucket_minute, collected_at, live_count, total_viewers, covered_pages, has_more, comment_count, comments_per_min, agitation_level
       FROM minute_snapshots
       ORDER BY bucket_minute DESC
       LIMIT 1`
    )
    .first<Record<string, unknown>>()

  return result ?? null
}
