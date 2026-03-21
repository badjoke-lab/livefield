type SnapshotRow = {
  bucket_minute: string
  total_viewers: number
  payload_json: string
}

type SnapshotPayload = {
  streams?: Array<{
    userId?: string
    displayName?: string
    title?: string
    viewerCount?: number
    gameId?: string
    gameName?: string
    language?: string
    agitationLevel?: number | null
  }>
}

type HeatmapRow = {
  day: string
  bucketTime: string
  topScope: string
  streamerId: string
  displayName: string
  viewers: number
  momentumDelta: number | null
  momentumState: string | null
  activityState: string | null
  activityLevel: number | null
  title: string | null
  gameId: string | null
  gameName: string | null
  language: string | null
}

const WINDOW_HOURS = 36
const TOP_SCOPES = [20, 50, 100] as const

function floorIsoToBucket(iso: string, minutes: 5): string {
  const d = new Date(iso)
  d.setUTCSeconds(0, 0)
  d.setUTCMinutes(d.getUTCMinutes() - (d.getUTCMinutes() % minutes))
  return d.toISOString().slice(0, 19) + ".000Z"
}

function isoDay(iso: string): string {
  return iso.slice(0, 10)
}

function activityState(level: number | null): string | null {
  if (level === null) return null
  if (level >= 4) return "hot"
  if (level >= 2) return "active"
  return "steady"
}

function momentumState(delta: number | null): string | null {
  if (delta === null) return null
  if (delta >= 40) return "rising"
  if (delta <= -40) return "falling"
  return "flat"
}

async function loadSnapshotsSince(db: D1Database, sinceIso: string): Promise<SnapshotRow[]> {
  const result = await db
    .prepare(
      `SELECT bucket_minute, total_viewers, payload_json
       FROM minute_snapshots
       WHERE provider = 'twitch' AND bucket_minute >= ?
       ORDER BY bucket_minute ASC`
    )
    .bind(sinceIso)
    .all<SnapshotRow>()

  return result.results ?? []
}

export async function buildHeatmap5mFrames(db: D1Database, _day: string, now = new Date()): Promise<void> {
  const fromIso = new Date(now.getTime() - WINDOW_HOURS * 60 * 60_000).toISOString().slice(0, 19) + ".000Z"
  const snapshots = await loadSnapshotsSince(db, fromIso)

  const bucketAgg = new Map<string, Map<string, {
    displayName: string
    viewersSum: number
    samples: number
    agitationSum: number
    agitationSamples: number
    title: string | null
    gameId: string | null
    gameName: string | null
    language: string | null
  }>>()

  for (const snapshot of snapshots) {
    let payload: SnapshotPayload
    try {
      payload = JSON.parse(snapshot.payload_json) as SnapshotPayload
    } catch {
      continue
    }

    const bucket = floorIsoToBucket(snapshot.bucket_minute, 5)
    const perStreamer = bucketAgg.get(bucket) ?? new Map<string, {
      displayName: string
      viewersSum: number
      samples: number
      agitationSum: number
      agitationSamples: number
      title: string | null
      gameId: string | null
      gameName: string | null
      language: string | null
    }>()

    for (const stream of payload.streams ?? []) {
      if (!stream?.userId || !stream.displayName || typeof stream.viewerCount !== "number") continue
      const curr = perStreamer.get(stream.userId) ?? {
        displayName: stream.displayName,
        viewersSum: 0,
        samples: 0,
        agitationSum: 0,
        agitationSamples: 0,
        title: null,
        gameId: null,
        gameName: null,
        language: null
      }

      curr.viewersSum += Math.max(0, stream.viewerCount)
      curr.samples += 1
      if (typeof stream.agitationLevel === "number") {
        curr.agitationSum += Math.max(0, stream.agitationLevel)
        curr.agitationSamples += 1
      }
      curr.title = stream.title ?? curr.title
      curr.gameId = stream.gameId ?? curr.gameId
      curr.gameName = stream.gameName ?? curr.gameName
      curr.language = stream.language ?? curr.language
      perStreamer.set(stream.userId, curr)
    }

    bucketAgg.set(bucket, perStreamer)
  }

  await db.prepare(`DELETE FROM heatmap_frames_5m WHERE bucket_time >= ?`).bind(fromIso).run()

  const previousByScopeStreamer = new Map<string, number>()
  const buckets = [...bucketAgg.keys()].sort((a, b) => a.localeCompare(b))

  for (const bucket of buckets) {
    const streamers = [...(bucketAgg.get(bucket)?.entries() ?? [])]
      .map(([streamerId, item]) => ({
        streamerId,
        displayName: item.displayName,
        viewers: Math.round(item.viewersSum / 5),
        activityLevel: item.agitationSamples > 0 ? Math.round(item.agitationSum / item.agitationSamples) : null,
        title: item.title,
        gameId: item.gameId,
        gameName: item.gameName,
        language: item.language
      }))
      .sort((a, b) => b.viewers - a.viewers)

    for (const top of TOP_SCOPES) {
      const topScope = `top${top}`
      const picked = streamers.slice(0, top)
      const rows: HeatmapRow[] = picked.map((stream) => {
        const key = `${topScope}:${stream.streamerId}`
        const prev = previousByScopeStreamer.get(key)
        const delta = prev === undefined ? null : stream.viewers - prev
        previousByScopeStreamer.set(key, stream.viewers)
        return {
          day: isoDay(bucket),
          bucketTime: bucket,
          topScope,
          streamerId: stream.streamerId,
          displayName: stream.displayName,
          viewers: stream.viewers,
          momentumDelta: delta,
          momentumState: momentumState(delta),
          activityState: activityState(stream.activityLevel),
          activityLevel: stream.activityLevel,
          title: stream.title,
          gameId: stream.gameId,
          gameName: stream.gameName,
          language: stream.language
        }
      })

      for (const row of rows) {
        await db
          .prepare(
            `INSERT INTO heatmap_frames_5m (
              day, bucket_time, top_scope, streamer_id, display_name, viewers,
              momentum_delta, momentum_state, activity_state, activity_level,
              title, game_id, game_name, language
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(day, bucket_time, top_scope, streamer_id) DO UPDATE SET
              display_name=excluded.display_name,
              viewers=excluded.viewers,
              momentum_delta=excluded.momentum_delta,
              momentum_state=excluded.momentum_state,
              activity_state=excluded.activity_state,
              activity_level=excluded.activity_level,
              title=excluded.title,
              game_id=excluded.game_id,
              game_name=excluded.game_name,
              language=excluded.language`
          )
          .bind(
            row.day,
            row.bucketTime,
            row.topScope,
            row.streamerId,
            row.displayName,
            row.viewers,
            row.momentumDelta,
            row.momentumState,
            row.activityState,
            row.activityLevel,
            row.title,
            row.gameId,
            row.gameName,
            row.language
          )
          .run()
      }
    }
  }
}

export async function buildDailyStreamSummaries(db: D1Database, now = new Date()): Promise<void> {
  const fromIso = new Date(now.getTime() - WINDOW_HOURS * 60 * 60_000).toISOString().slice(0, 19) + ".000Z"
  const snapshots = await loadSnapshotsSince(db, fromIso)

  const dailyAgg = new Map<string, {
    day: string
    streamerId: string
    displayName: string
    viewerMinutesTotal: number
    seenMinutes: number
    peakViewers: number
    peakShare: number
    firstSeenAt: string | null
    lastSeenAt: string | null
    biggestRiseTime: string | null
    biggestRiseDelta: number
    prevViewers: number | null
    bestActivityLevel: number | null
    bestActivityTime: string | null
  }>()

  for (const snapshot of snapshots) {
    let payload: SnapshotPayload
    try {
      payload = JSON.parse(snapshot.payload_json) as SnapshotPayload
    } catch {
      continue
    }

    const day = isoDay(snapshot.bucket_minute)
    const totalViewers = Math.max(1, snapshot.total_viewers)

    for (const stream of payload.streams ?? []) {
      if (!stream?.userId || !stream.displayName || typeof stream.viewerCount !== "number") continue
      const key = `${day}|${stream.userId}`
      const curr = dailyAgg.get(key) ?? {
        day,
        streamerId: stream.userId,
        displayName: stream.displayName,
        viewerMinutesTotal: 0,
        seenMinutes: 0,
        peakViewers: 0,
        peakShare: 0,
        firstSeenAt: null,
        lastSeenAt: null,
        biggestRiseTime: null,
        biggestRiseDelta: Number.NEGATIVE_INFINITY,
        prevViewers: null,
        bestActivityLevel: null,
        bestActivityTime: null
      }

      const viewers = Math.max(0, stream.viewerCount)
      curr.viewerMinutesTotal += viewers
      curr.seenMinutes += 1
      curr.peakViewers = Math.max(curr.peakViewers, viewers)
      curr.peakShare = Math.max(curr.peakShare, viewers / totalViewers)
      curr.firstSeenAt = curr.firstSeenAt ? (curr.firstSeenAt < snapshot.bucket_minute ? curr.firstSeenAt : snapshot.bucket_minute) : snapshot.bucket_minute
      curr.lastSeenAt = curr.lastSeenAt ? (curr.lastSeenAt > snapshot.bucket_minute ? curr.lastSeenAt : snapshot.bucket_minute) : snapshot.bucket_minute

      if (curr.prevViewers !== null) {
        const rise = viewers - curr.prevViewers
        if (rise > curr.biggestRiseDelta) {
          curr.biggestRiseDelta = rise
          curr.biggestRiseTime = snapshot.bucket_minute
        }
      }
      curr.prevViewers = viewers

      if (typeof stream.agitationLevel === "number") {
        const lv = Math.max(0, stream.agitationLevel)
        if (curr.bestActivityLevel === null || lv > curr.bestActivityLevel) {
          curr.bestActivityLevel = lv
          curr.bestActivityTime = snapshot.bucket_minute
        }
      }

      dailyAgg.set(key, curr)
    }
  }

  const days = [...new Set(snapshots.map((s) => isoDay(s.bucket_minute)))]
  for (const day of days) {
    await db.prepare(`DELETE FROM daily_stream_summaries WHERE day = ?`).bind(day).run()
  }

  for (const item of dailyAgg.values()) {
    await db
      .prepare(
        `INSERT INTO daily_stream_summaries (
          day, bucket_time, streamer_id, display_name,
          viewer_minutes_total, avg_viewers, peak_viewers, peak_share,
          first_seen_at, last_seen_at, biggest_rise_time,
          activity_best_state, activity_best_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(day, streamer_id) DO UPDATE SET
          bucket_time=excluded.bucket_time,
          display_name=excluded.display_name,
          viewer_minutes_total=excluded.viewer_minutes_total,
          avg_viewers=excluded.avg_viewers,
          peak_viewers=excluded.peak_viewers,
          peak_share=excluded.peak_share,
          first_seen_at=excluded.first_seen_at,
          last_seen_at=excluded.last_seen_at,
          biggest_rise_time=excluded.biggest_rise_time,
          activity_best_state=excluded.activity_best_state,
          activity_best_time=excluded.activity_best_time`
      )
      .bind(
        item.day,
        `${item.day}T00:00:00.000Z`,
        item.streamerId,
        item.displayName,
        item.viewerMinutesTotal,
        item.seenMinutes > 0 ? item.viewerMinutesTotal / item.seenMinutes : 0,
        item.peakViewers,
        item.peakShare,
        item.firstSeenAt,
        item.lastSeenAt,
        item.biggestRiseTime,
        activityState(item.bestActivityLevel),
        item.bestActivityTime
      )
      .run()
  }
}
