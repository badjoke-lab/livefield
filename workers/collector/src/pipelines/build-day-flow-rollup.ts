type SnapshotRow = {
  bucket_minute: string
  payload_json: string
}

type SnapshotPayload = {
  streams?: Array<{
    userId?: string
    displayName?: string
    viewerCount?: number
    agitationLevel?: number | null
  }>
}

type StreamBucketAgg = {
  streamerId: string
  displayName: string
  viewerMinutes: number
  peakViewers: number
  firstSeenAt: string | null
  lastSeenAt: string | null
  activityLevelSum: number
  activitySamples: number
}

type DayFlowRow = {
  day: string
  bucketTime: string
  topScope: string
  streamerId: string
  displayName: string
  isOthers: number
  avgViewers: number
  viewerMinutes: number
  share: number
  peakViewers: number
  firstSeenAt: string | null
  lastSeenAt: string | null
  momentumDelta: number | null
  activityState: string | null
  activityLevel: number | null
}

const TOP_SCOPES = [10, 20, 50] as const
const WINDOW_HOURS = 36

function floorIsoToBucket(iso: string, minutes: 5 | 10): string {
  const d = new Date(iso)
  d.setUTCSeconds(0, 0)
  d.setUTCMinutes(d.getUTCMinutes() - (d.getUTCMinutes() % minutes))
  return d.toISOString().slice(0, 19) + ".000Z"
}

function isoDay(iso: string): string {
  return iso.slice(0, 10)
}

function activityStateFromLevel(level: number | null): string | null {
  if (level === null) return null
  if (level >= 4) return "hot"
  if (level >= 2) return "active"
  return "steady"
}

async function loadSnapshotsSince(db: D1Database, sinceIso: string): Promise<SnapshotRow[]> {
  const result = await db
    .prepare(
      `SELECT bucket_minute, payload_json
       FROM minute_snapshots
       WHERE provider = 'twitch' AND bucket_minute >= ?
       ORDER BY bucket_minute ASC`
    )
    .bind(sinceIso)
    .all<SnapshotRow>()

  return result.results ?? []
}

function build5mRows(snapshots: SnapshotRow[]): DayFlowRow[] {
  const bucketAgg = new Map<string, Map<string, StreamBucketAgg>>()

  for (const snapshot of snapshots) {
    let payload: SnapshotPayload
    try {
      payload = JSON.parse(snapshot.payload_json) as SnapshotPayload
    } catch {
      continue
    }

    const bucket = floorIsoToBucket(snapshot.bucket_minute, 5)
    let perStreamer = bucketAgg.get(bucket)
    if (!perStreamer) {
      perStreamer = new Map<string, StreamBucketAgg>()
      bucketAgg.set(bucket, perStreamer)
    }

    for (const stream of payload.streams ?? []) {
      if (!stream?.userId || !stream.displayName || typeof stream.viewerCount !== "number") continue
      const current = perStreamer.get(stream.userId) ?? {
        streamerId: stream.userId,
        displayName: stream.displayName,
        viewerMinutes: 0,
        peakViewers: 0,
        firstSeenAt: null,
        lastSeenAt: null,
        activityLevelSum: 0,
        activitySamples: 0
      }

      current.viewerMinutes += Math.max(0, stream.viewerCount)
      current.peakViewers = Math.max(current.peakViewers, Math.max(0, stream.viewerCount))
      current.firstSeenAt = current.firstSeenAt ? (current.firstSeenAt < snapshot.bucket_minute ? current.firstSeenAt : snapshot.bucket_minute) : snapshot.bucket_minute
      current.lastSeenAt = current.lastSeenAt ? (current.lastSeenAt > snapshot.bucket_minute ? current.lastSeenAt : snapshot.bucket_minute) : snapshot.bucket_minute
      if (typeof stream.agitationLevel === "number") {
        current.activityLevelSum += Math.max(0, stream.agitationLevel)
        current.activitySamples += 1
      }

      perStreamer.set(stream.userId, current)
    }
  }

  const rows: DayFlowRow[] = []
  const orderedBuckets = [...bucketAgg.keys()].sort((a, b) => a.localeCompare(b))
  const previousAvgByScopeAndStreamer = new Map<string, number>()

  for (const bucket of orderedBuckets) {
    const perStreamer = bucketAgg.get(bucket)
    if (!perStreamer) continue

    const streamers = [...perStreamer.values()].sort((a, b) => b.viewerMinutes - a.viewerMinutes)
    const totalViewerMinutes = streamers.reduce((sum, item) => sum + item.viewerMinutes, 0)

    for (const top of TOP_SCOPES) {
      const topScope = `top${top}`
      const head = streamers.slice(0, top)
      const tail = streamers.slice(top)

      for (const item of head) {
        const avgViewers = item.viewerMinutes / 5
        const key = `${topScope}:${item.streamerId}`
        const previous = previousAvgByScopeAndStreamer.get(key)
        const activityLevel = item.activitySamples > 0 ? Math.round(item.activityLevelSum / item.activitySamples) : null
        rows.push({
          day: isoDay(bucket),
          bucketTime: bucket,
          topScope,
          streamerId: item.streamerId,
          displayName: item.displayName,
          isOthers: 0,
          avgViewers,
          viewerMinutes: item.viewerMinutes,
          share: totalViewerMinutes > 0 ? item.viewerMinutes / totalViewerMinutes : 0,
          peakViewers: item.peakViewers,
          firstSeenAt: item.firstSeenAt,
          lastSeenAt: item.lastSeenAt,
          momentumDelta: previous === undefined ? null : avgViewers - previous,
          activityState: activityStateFromLevel(activityLevel),
          activityLevel
        })
        previousAvgByScopeAndStreamer.set(key, avgViewers)
      }

      const othersViewerMinutes = tail.reduce((sum, item) => sum + item.viewerMinutes, 0)
      const othersPeak = tail.reduce((best, item) => Math.max(best, item.peakViewers), 0)
      const othersKey = `${topScope}:others`
      const prevOthers = previousAvgByScopeAndStreamer.get(othersKey)

      rows.push({
        day: isoDay(bucket),
        bucketTime: bucket,
        topScope,
        streamerId: "others",
        displayName: "Others",
        isOthers: 1,
        avgViewers: othersViewerMinutes / 5,
        viewerMinutes: othersViewerMinutes,
        share: totalViewerMinutes > 0 ? othersViewerMinutes / totalViewerMinutes : 0,
        peakViewers: othersPeak,
        firstSeenAt: null,
        lastSeenAt: null,
        momentumDelta: prevOthers === undefined ? null : othersViewerMinutes / 5 - prevOthers,
        activityState: null,
        activityLevel: null
      })
      previousAvgByScopeAndStreamer.set(othersKey, othersViewerMinutes / 5)
    }
  }

  return rows
}

async function replace5mRows(db: D1Database, fromIso: string, rows: DayFlowRow[]): Promise<void> {
  await db
    .prepare(`DELETE FROM dayflow_bands_5m WHERE bucket_time >= ?`)
    .bind(fromIso)
    .run()

  for (const row of rows) {
    await db
      .prepare(
        `INSERT INTO dayflow_bands_5m (
          day, bucket_time, top_scope, streamer_id, display_name, is_others,
          avg_viewers, viewer_minutes, share, peak_viewers,
          first_seen_at, last_seen_at, momentum_delta, activity_state, activity_level
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(day, bucket_time, top_scope, streamer_id) DO UPDATE SET
          display_name=excluded.display_name,
          is_others=excluded.is_others,
          avg_viewers=excluded.avg_viewers,
          viewer_minutes=excluded.viewer_minutes,
          share=excluded.share,
          peak_viewers=excluded.peak_viewers,
          first_seen_at=excluded.first_seen_at,
          last_seen_at=excluded.last_seen_at,
          momentum_delta=excluded.momentum_delta,
          activity_state=excluded.activity_state,
          activity_level=excluded.activity_level`
      )
      .bind(
        row.day,
        row.bucketTime,
        row.topScope,
        row.streamerId,
        row.displayName,
        row.isOthers,
        row.avgViewers,
        row.viewerMinutes,
        row.share,
        row.peakViewers,
        row.firstSeenAt,
        row.lastSeenAt,
        row.momentumDelta,
        row.activityState,
        row.activityLevel
      )
      .run()
  }
}

export async function buildDayflow5mRollup(db: D1Database, _day: string, now = new Date()): Promise<void> {
  const fromIso = new Date(now.getTime() - WINDOW_HOURS * 60 * 60_000).toISOString().slice(0, 19) + ".000Z"
  const snapshots = await loadSnapshotsSince(db, fromIso)
  const rows = build5mRows(snapshots)
  await replace5mRows(db, fromIso, rows)
}

export async function buildDayflow10mRollup(db: D1Database, now = new Date()): Promise<void> {
  const fromIso = new Date(now.getTime() - WINDOW_HOURS * 60 * 60_000).toISOString().slice(0, 19) + ".000Z"
  const five = await db
    .prepare(
      `SELECT day, bucket_time, top_scope, streamer_id, display_name, is_others,
              avg_viewers, viewer_minutes, share, peak_viewers, first_seen_at, last_seen_at,
              momentum_delta, activity_state, activity_level
       FROM dayflow_bands_5m
       WHERE bucket_time >= ?
       ORDER BY bucket_time ASC`
    )
    .bind(fromIso)
    .all<{
      day: string
      bucket_time: string
      top_scope: string
      streamer_id: string
      display_name: string
      is_others: number
      viewer_minutes: number
      peak_viewers: number
      first_seen_at: string | null
      last_seen_at: string | null
      activity_level: number | null
    }>()

  await db.prepare(`DELETE FROM dayflow_bands_10m WHERE bucket_time >= ?`).bind(fromIso).run()

  const grouped = new Map<string, {
    day: string
    bucketTime: string
    topScope: string
    streamerId: string
    displayName: string
    isOthers: number
    viewerMinutes: number
    peakViewers: number
    firstSeenAt: string | null
    lastSeenAt: string | null
    activityLevelSum: number
    activitySamples: number
  }>()

  for (const row of five.results ?? []) {
    const bucketTime = floorIsoToBucket(row.bucket_time, 10)
    const key = `${bucketTime}|${row.top_scope}|${row.streamer_id}`
    const curr = grouped.get(key) ?? {
      day: isoDay(bucketTime),
      bucketTime,
      topScope: row.top_scope,
      streamerId: row.streamer_id,
      displayName: row.display_name,
      isOthers: row.is_others,
      viewerMinutes: 0,
      peakViewers: 0,
      firstSeenAt: null,
      lastSeenAt: null,
      activityLevelSum: 0,
      activitySamples: 0
    }
    curr.viewerMinutes += row.viewer_minutes
    curr.peakViewers = Math.max(curr.peakViewers, row.peak_viewers)
    curr.firstSeenAt = curr.firstSeenAt ? (curr.firstSeenAt < (row.first_seen_at ?? curr.firstSeenAt) ? curr.firstSeenAt : (row.first_seen_at ?? curr.firstSeenAt)) : row.first_seen_at
    curr.lastSeenAt = curr.lastSeenAt ? (curr.lastSeenAt > (row.last_seen_at ?? curr.lastSeenAt) ? curr.lastSeenAt : (row.last_seen_at ?? curr.lastSeenAt)) : row.last_seen_at
    if (typeof row.activity_level === "number") {
      curr.activityLevelSum += row.activity_level
      curr.activitySamples += 1
    }
    grouped.set(key, curr)
  }

  const byBucketScope = new Map<string, Array<typeof grouped extends Map<any, infer V> ? V : never>>()
  for (const item of grouped.values()) {
    const key = `${item.bucketTime}|${item.topScope}`
    const arr = byBucketScope.get(key) ?? []
    arr.push(item)
    byBucketScope.set(key, arr)
  }

  const prev = new Map<string, number>()
  const orderedKeys = [...byBucketScope.keys()].sort((a, b) => a.localeCompare(b))
  for (const key of orderedKeys) {
    const items = byBucketScope.get(key) ?? []
    const totalViewerMinutes = items.reduce((sum, item) => sum + item.viewerMinutes, 0)
    for (const item of items) {
      const avgViewers = item.viewerMinutes / 10
      const prevKey = `${item.topScope}:${item.streamerId}`
      const before = prev.get(prevKey)
      const activityLevel = item.activitySamples > 0 ? Math.round(item.activityLevelSum / item.activitySamples) : null
      await db
        .prepare(
          `INSERT INTO dayflow_bands_10m (
            day, bucket_time, top_scope, streamer_id, display_name, is_others,
            avg_viewers, viewer_minutes, share, peak_viewers,
            first_seen_at, last_seen_at, momentum_delta, activity_state, activity_level
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(day, bucket_time, top_scope, streamer_id) DO UPDATE SET
            display_name=excluded.display_name,
            is_others=excluded.is_others,
            avg_viewers=excluded.avg_viewers,
            viewer_minutes=excluded.viewer_minutes,
            share=excluded.share,
            peak_viewers=excluded.peak_viewers,
            first_seen_at=excluded.first_seen_at,
            last_seen_at=excluded.last_seen_at,
            momentum_delta=excluded.momentum_delta,
            activity_state=excluded.activity_state,
            activity_level=excluded.activity_level`
        )
        .bind(
          item.day,
          item.bucketTime,
          item.topScope,
          item.streamerId,
          item.displayName,
          item.isOthers,
          avgViewers,
          item.viewerMinutes,
          totalViewerMinutes > 0 ? item.viewerMinutes / totalViewerMinutes : 0,
          item.peakViewers,
          item.firstSeenAt,
          item.lastSeenAt,
          before === undefined ? null : avgViewers - before,
          activityStateFromLevel(activityLevel),
          activityLevel
        )
        .run()
      prev.set(prevKey, avgViewers)
    }
  }
}
