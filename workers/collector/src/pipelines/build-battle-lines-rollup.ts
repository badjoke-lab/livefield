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

type BucketStreamer = {
  streamerId: string
  displayName: string
  viewers: number
  activityLevel: number | null
}

const WINDOW_HOURS = 36
const TOP_SERIES = 10

function floorIsoToBucket(iso: string, minutes: 5 | 10): string {
  const d = new Date(iso)
  d.setUTCSeconds(0, 0)
  d.setUTCMinutes(d.getUTCMinutes() - (d.getUTCMinutes() % minutes))
  return d.toISOString().slice(0, 19) + ".000Z"
}

function isoDay(iso: string): string {
  return iso.slice(0, 10)
}

function dayBounds(day: string): { dayStartIso: string; dayEndIso: string } {
  const dayStartIso = `${day}T00:00:00.000Z`
  const dayEndIso = new Date(new Date(dayStartIso).getTime() + 24 * 60 * 60_000).toISOString().slice(0, 19) + ".000Z"
  return { dayStartIso, dayEndIso }
}

function activityStateFromLevel(level: number | null): string | null {
  if (level === null) return null
  if (level >= 4) return "hot"
  if (level >= 2) return "active"
  return "steady"
}

async function loadSnapshotsForDay(db: D1Database, day: string): Promise<SnapshotRow[]> {
  const { dayStartIso, dayEndIso } = dayBounds(day)
  const result = await db
    .prepare(
      `SELECT bucket_minute, payload_json
       FROM minute_snapshots
       WHERE provider = 'twitch' AND bucket_minute >= ? AND bucket_minute < ?
       ORDER BY bucket_minute ASC`
    )
    .bind(dayStartIso, dayEndIso)
    .all<SnapshotRow>()
  return result.results ?? []
}

function buildBucketSeries(snapshots: SnapshotRow[]): Map<string, BucketStreamer[]> {
  const agg = new Map<string, Map<string, { displayName: string; viewerMinutes: number; activitySum: number; activitySamples: number }>>()

  for (const row of snapshots) {
    let payload: SnapshotPayload
    try {
      payload = JSON.parse(row.payload_json) as SnapshotPayload
    } catch {
      continue
    }
    const bucket = floorIsoToBucket(row.bucket_minute, 5)
    const bucketMap = agg.get(bucket) ?? new Map<string, { displayName: string; viewerMinutes: number; activitySum: number; activitySamples: number }>()
    for (const stream of payload.streams ?? []) {
      if (!stream?.userId || !stream.displayName || typeof stream.viewerCount !== "number") continue
      const curr = bucketMap.get(stream.userId) ?? { displayName: stream.displayName, viewerMinutes: 0, activitySum: 0, activitySamples: 0 }
      curr.viewerMinutes += Math.max(0, stream.viewerCount)
      if (typeof stream.agitationLevel === "number") {
        curr.activitySum += Math.max(0, stream.agitationLevel)
        curr.activitySamples += 1
      }
      bucketMap.set(stream.userId, curr)
    }
    agg.set(bucket, bucketMap)
  }

  const series = new Map<string, BucketStreamer[]>()
  for (const [bucket, streamers] of agg.entries()) {
    const top = [...streamers.entries()]
      .map(([streamerId, value]) => ({
        streamerId,
        displayName: value.displayName,
        viewers: Math.round(value.viewerMinutes / 5),
        activityLevel: value.activitySamples > 0 ? Math.round(value.activitySum / value.activitySamples) : null
      }))
      .sort((a, b) => b.viewers - a.viewers)
      .slice(0, TOP_SERIES)

    series.set(bucket, top)
  }

  return new Map([...series.entries()].sort((a, b) => a[0].localeCompare(b[0])))
}

export async function buildBattleLines5mRollup(db: D1Database, day: string, _now = new Date()): Promise<void> {
  const snapshots = await loadSnapshotsForDay(db, day)
  if (snapshots.length === 0) {
    throw new Error(`battlelines_series_5m: no minute_snapshots found for day=${day} provider=twitch`)
  }

  const bucketSeries = buildBucketSeries(snapshots)
  if (bucketSeries.size === 0) {
    throw new Error(`battlelines_series_5m: built 0 buckets from ${snapshots.length} snapshots for day=${day}`)
  }

  await db.prepare(`DELETE FROM battlelines_series_5m WHERE day = ?`).bind(day).run()
  await db.prepare(`DELETE FROM battle_reversal_events WHERE day = ?`).bind(day).run()

  const peakByStreamer = new Map<string, number>()
  const prevByStreamer = new Map<string, number>()
  let seriesWrites = 0

  for (const [bucket, rows] of bucketSeries.entries()) {
    for (const row of rows) {
      const peak = Math.max(peakByStreamer.get(row.streamerId) ?? 0, row.viewers)
      const prev = prevByStreamer.get(row.streamerId)
      const result = await db
        .prepare(
          `INSERT INTO battlelines_series_5m (
            day, bucket_time, streamer_id, display_name, viewers,
            indexed_base_peak, viewer_delta, momentum_delta, activity_state
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(day, bucket_time, streamer_id) DO UPDATE SET
            display_name=excluded.display_name,
            viewers=excluded.viewers,
            indexed_base_peak=excluded.indexed_base_peak,
            viewer_delta=excluded.viewer_delta,
            momentum_delta=excluded.momentum_delta,
            activity_state=excluded.activity_state`
        )
        .bind(
          isoDay(bucket),
          bucket,
          row.streamerId,
          row.displayName,
          row.viewers,
          peak > 0 ? (row.viewers / peak) * 100 : 0,
          prev === undefined ? null : row.viewers - prev,
          prev === undefined ? null : (row.viewers - prev) / 5,
          activityStateFromLevel(row.activityLevel)
        )
        .run()
      seriesWrites += result.meta.changes ?? 0

      peakByStreamer.set(row.streamerId, peak)
      prevByStreamer.set(row.streamerId, row.viewers)
    }
  }

  const buckets = [...bucketSeries.keys()]
  for (let idx = 1; idx < buckets.length; idx += 1) {
    const prevRows = bucketSeries.get(buckets[idx - 1]) ?? []
    const currRows = bucketSeries.get(buckets[idx]) ?? []
    const prevById = new Map(prevRows.map((item) => [item.streamerId, item]))
    const currById = new Map(currRows.map((item) => [item.streamerId, item]))

    const ids = [...new Set([...prevById.keys(), ...currById.keys()])]
    for (let left = 0; left < ids.length; left += 1) {
      for (let right = left + 1; right < ids.length; right += 1) {
        const leftId = ids[left]
        const rightId = ids[right]
        const prevLeft = prevById.get(leftId)
        const prevRight = prevById.get(rightId)
        const currLeft = currById.get(leftId)
        const currRight = currById.get(rightId)
        if (!prevLeft || !prevRight || !currLeft || !currRight) continue

        const prevDiff = prevLeft.viewers - prevRight.viewers
        const currDiff = currLeft.viewers - currRight.viewers
        if (prevDiff === 0 || currDiff === 0) continue
        if ((prevDiff > 0 && currDiff > 0) || (prevDiff < 0 && currDiff < 0)) continue

        const passer = currDiff > 0 ? currLeft : currRight
        const passed = currDiff > 0 ? currRight : currLeft
        const heatOverlap = (prevLeft.activityLevel ?? 0) >= 3 && (prevRight.activityLevel ?? 0) >= 3
        const pairScore = Math.max(0, 1000 - Math.abs(currDiff) + Math.abs(prevDiff - currDiff))

        await db
          .prepare(
            `INSERT INTO battle_reversal_events (
              day, bucket_time, left_streamer_id, right_streamer_id, passer_streamer_id, passed_streamer_id,
              gap_before, gap_after, heat_overlap, pair_score
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            isoDay(buckets[idx]),
            buckets[idx],
            leftId,
            rightId,
            passer.streamerId,
            passed.streamerId,
            Math.abs(prevDiff),
            Math.abs(currDiff),
            heatOverlap ? 1 : 0,
            pairScore
          )
          .run()
      }
    }
  }

  if (seriesWrites === 0) {
    throw new Error(`battlelines_series_5m: wrote 0 rows from ${bucketSeries.size} buckets for day=${day}`)
  }
}

export async function buildBattleLines10mRollup(db: D1Database, now = new Date()): Promise<void> {
  const fromIso = new Date(now.getTime() - WINDOW_HOURS * 60 * 60_000).toISOString().slice(0, 19) + ".000Z"
  const res = await db
    .prepare(
      `SELECT bucket_time, streamer_id, display_name, viewers, activity_state
       FROM battlelines_series_5m
       WHERE bucket_time >= ?
       ORDER BY bucket_time ASC`
    )
    .bind(fromIso)
    .all<{ bucket_time: string; streamer_id: string; display_name: string; viewers: number; activity_state: string | null }>()

  await db.prepare(`DELETE FROM battlelines_series_10m WHERE bucket_time >= ?`).bind(fromIso).run()

  const grouped = new Map<string, { bucketTime: string; streamerId: string; displayName: string; viewersSum: number; samples: number; activeCount: number }>()
  for (const row of res.results ?? []) {
    const bucketTime = floorIsoToBucket(row.bucket_time, 10)
    const key = `${bucketTime}|${row.streamer_id}`
    const curr = grouped.get(key) ?? {
      bucketTime,
      streamerId: row.streamer_id,
      displayName: row.display_name,
      viewersSum: 0,
      samples: 0,
      activeCount: 0
    }
    curr.viewersSum += row.viewers
    curr.samples += 1
    if (row.activity_state === "active" || row.activity_state === "hot") curr.activeCount += 1
    grouped.set(key, curr)
  }

  const byBucket = new Map<string, Array<{ bucketTime: string; streamerId: string; displayName: string; viewers: number; activityState: string | null }>>()
  for (const item of grouped.values()) {
    const arr = byBucket.get(item.bucketTime) ?? []
    arr.push({
      bucketTime: item.bucketTime,
      streamerId: item.streamerId,
      displayName: item.displayName,
      viewers: Math.round(item.viewersSum / Math.max(1, item.samples)),
      activityState: item.activeCount > 0 ? "active" : "steady"
    })
    byBucket.set(item.bucketTime, arr)
  }

  const peakByStreamer = new Map<string, number>()
  const prevByStreamer = new Map<string, number>()
  const buckets = [...byBucket.keys()].sort((a, b) => a.localeCompare(b))
  for (const bucket of buckets) {
    const rows = (byBucket.get(bucket) ?? []).sort((a, b) => b.viewers - a.viewers).slice(0, TOP_SERIES)
    for (const row of rows) {
      const peak = Math.max(peakByStreamer.get(row.streamerId) ?? 0, row.viewers)
      const prev = prevByStreamer.get(row.streamerId)
      await db
        .prepare(
          `INSERT INTO battlelines_series_10m (
            day, bucket_time, streamer_id, display_name, viewers,
            indexed_base_peak, viewer_delta, momentum_delta, activity_state
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(day, bucket_time, streamer_id) DO UPDATE SET
            display_name=excluded.display_name,
            viewers=excluded.viewers,
            indexed_base_peak=excluded.indexed_base_peak,
            viewer_delta=excluded.viewer_delta,
            momentum_delta=excluded.momentum_delta,
            activity_state=excluded.activity_state`
        )
        .bind(
          isoDay(bucket),
          bucket,
          row.streamerId,
          row.displayName,
          row.viewers,
          peak > 0 ? (row.viewers / peak) * 100 : 0,
          prev === undefined ? null : row.viewers - prev,
          prev === undefined ? null : (row.viewers - prev) / 10,
          row.activityState
        )
        .run()
      peakByStreamer.set(row.streamerId, peak)
      prevByStreamer.set(row.streamerId, row.viewers)
    }
  }
}
