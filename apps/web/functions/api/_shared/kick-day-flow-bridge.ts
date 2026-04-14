import type { DayFlowPayload, DayFlowBandSeries, DayFlowFocusItem } from "../../../../../packages/shared/src/types/day-flow"

type WorkerPoint = {
  ts: string
  totalViewersObserved: number
  observedCount: number
  strongestStreamer: string | null
}

type WorkerPayload = {
  state: "unconfigured" | "loading" | "live" | "partial" | "empty" | "error"
  lastUpdated: string | null
  coverage: string
  note: string
  points: WorkerPoint[]
  summary: {
    strongestStreamer: string | null
  }
}

type DayScope = "today" | "rolling24h" | "yesterday" | "date"

const ID = "observed-total"
const NAME = "Observed total"
const TITLE = "Observed viewer total from Kick collector snapshots"
const URL = "/kick/status/"
const COLOR = "#7aa2ff"
const DAY_MS = 24 * 60 * 60 * 1000

function normalizeTop(raw: string | null): 10 | 20 | 50 {
  return raw === "10" ? 10 : raw === "50" ? 50 : 20
}

function normalizeBucket(raw: string | null): 5 | 10 {
  return raw === "10" ? 10 : 5
}

function normalizeMode(raw: string | null): "volume" | "share" {
  return raw === "share" ? "share" : "volume"
}

function normalizeScope(raw: string | null): DayScope {
  return raw === "rolling24h" || raw === "yesterday" || raw === "date" ? raw : "today"
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function isoMinute(date: Date): string {
  return `${date.toISOString().slice(0, 16)}:00.000Z`
}

function floorBucket(iso: string, minutes: 5 | 10): string {
  const d = new Date(iso)
  d.setUTCSeconds(0, 0)
  d.setUTCMinutes(d.getUTCMinutes() - (d.getUTCMinutes() % minutes))
  return isoMinute(d)
}

function isoDay(iso: string): string {
  return iso.slice(0, 10)
}

function buildDayBuckets(day: string, size: 5 | 10): string[] {
  const start = new Date(`${day}T00:00:00.000Z`)
  const out: string[] = []
  for (let ts = start.getTime(); ts < start.getTime() + DAY_MS; ts += size * 60_000) out.push(isoMinute(new Date(ts)))
  return out
}

function buildRollingBuckets(endIso: string, size: 5 | 10): string[] {
  const end = new Date(endIso)
  end.setUTCSeconds(0, 0)
  end.setUTCMinutes(end.getUTCMinutes() - (end.getUTCMinutes() % size))
  const out: string[] = []
  for (let ts = end.getTime() - DAY_MS; ts <= end.getTime(); ts += size * 60_000) out.push(isoMinute(new Date(ts)))
  return out
}

function emptyPayload(scope: DayScope, selectedDate: string, bucketSize: 5 | 10, topN: 10 | 20 | 50, mode: "volume" | "share", updatedAt: string, coverageNote: string, note: string): DayFlowPayload {
  const buckets = scope === "rolling24h" ? buildRollingBuckets(updatedAt, bucketSize) : buildDayBuckets(selectedDate, bucketSize)
  return {
    ok: true,
    tool: "day-flow",
    source: "api",
    state: "empty",
    status: "empty",
    note,
    coverageNote,
    partialNote: "Kick Day Flow currently reflects observed total viewer history only.",
    lastUpdated: updatedAt,
    selectedDate,
    bucketSize,
    topN,
    valueMode: mode,
    defaultMode: mode,
    dateScope: scope,
    rangeMode: scope,
    windowStart: buckets[0] ?? `${selectedDate}T00:00:00.000Z`,
    windowEnd: buckets[buckets.length - 1] ?? updatedAt,
    rankingWindowStart: buckets[0] ?? `${selectedDate}T00:00:00.000Z`,
    rankingWindowEnd: buckets[buckets.length - 1] ?? updatedAt,
    isRolling: scope === "rolling24h",
    summary: { peakLeader: NAME, longestDominance: NAME, highestActivity: "Activity unavailable", biggestRise: "N/A" },
    timeline: { dayStart: buckets[0] ?? `${selectedDate}T00:00:00.000Z`, dayEnd: buckets[buckets.length - 1] ?? updatedAt, nowBucket: null, bucketCount: buckets.length, futureBlankFrom: null },
    buckets,
    totalViewersByBucket: new Array(buckets.length).fill(0),
    bands: [{ streamerId: ID, name: NAME, title: TITLE, url: URL, color: COLOR, isOthers: false, order: 0, totalViewerMinutes: 0, peakViewers: 0, avgViewers: 0, peakShare: 0, biggestRiseBucket: null, firstSeen: null, lastSeen: null, activityMax: null, buckets: buckets.map(() => ({ viewers: 0, share: 0, activityAvailable: false, peak: false, rise: false })) }],
    focusSnapshot: { selectedBucket: null, items: [], strongestMomentum: "N/A", highestActivity: "Activity unavailable" },
    detailPanelSource: { defaultStreamerId: ID, streamers: [{ streamerId: ID, name: NAME, title: TITLE, url: URL, peakViewers: 0, avgViewers: 0, viewerMinutes: 0, peakShare: 0, highestActivity: null, biggestRiseTime: null, firstSeen: null, lastSeen: null }] },
    activity: { available: false, note: "Activity unavailable for Kick Day Flow: current collector payload does not expose per-stream chat activity." }
  }
}

export function bridgeKickDayFlow(raw: WorkerPayload, req: URL): DayFlowPayload {
  const now = new Date()
  const scope = normalizeScope(req.searchParams.get("day") ?? req.searchParams.get("rangeMode"))
  const bucketSize = normalizeBucket(req.searchParams.get("bucket"))
  const topN = normalizeTop(req.searchParams.get("top"))
  const mode = normalizeMode(req.searchParams.get("mode") ?? req.searchParams.get("metric"))
  const selectedDate = scope === "date" && req.searchParams.get("date")
    ? String(req.searchParams.get("date"))
    : scope === "yesterday"
      ? startOfUtcDay(new Date(startOfUtcDay(now).getTime() - DAY_MS)).toISOString().slice(0, 10)
      : startOfUtcDay(now).toISOString().slice(0, 10)

  const points = (raw.points ?? [])
    .filter((p) => typeof p.ts === "string" && p.ts)
    .map((p) => ({ ts: p.ts, bucket: floorBucket(p.ts, bucketSize), viewers: Number(p.totalViewersObserved ?? 0), strongest: p.strongestStreamer ?? raw.summary?.strongestStreamer ?? null }))
    .sort((a, b) => a.ts.localeCompare(b.ts))

  const lastUpdated = raw.lastUpdated ?? points.at(-1)?.ts ?? now.toISOString()
  const latestObservedDay = points.at(-1)?.ts ? isoDay(points.at(-1)!.ts) : null
  const effectiveDate = scope === "today" && latestObservedDay && !points.some((p) => isoDay(p.ts) === selectedDate) ? latestObservedDay : selectedDate
  const note = scope === "today" && effectiveDate !== selectedDate ? `No current-day Kick snapshots yet. Showing latest available observed day ${effectiveDate}.` : raw.note
  const buckets = scope === "rolling24h" ? buildRollingBuckets(lastUpdated, bucketSize) : buildDayBuckets(effectiveDate, bucketSize)
  const totals = new Map<string, number>()
  const strongest = new Map<string, string | null>()

  for (const p of points) {
    if (scope === "rolling24h") {
      if (!buckets.includes(p.bucket)) continue
    } else if (isoDay(p.ts) !== effectiveDate) {
      continue
    }
    totals.set(p.bucket, p.viewers)
    strongest.set(p.bucket, p.strongest)
  }

  const totalViewersByBucket = buckets.map((b) => totals.get(b) ?? 0)
  if (!totalViewersByBucket.some((v) => v > 0) || raw.state === "unconfigured") return emptyPayload(scope, effectiveDate, bucketSize, topN, mode, lastUpdated, raw.coverage, note)

  const peakIndex = totalViewersByBucket.reduce((best, v, i, arr) => v > (arr[best] ?? -1) ? i : best, 0)
  let riseIndex = -1
  let riseValue = Number.NEGATIVE_INFINITY
  for (let i = 1; i < totalViewersByBucket.length; i += 1) {
    const d = totalViewersByBucket[i] - totalViewersByBucket[i - 1]
    if (d > riseValue) { riseValue = d; riseIndex = i }
  }
  const peakViewers = Math.max(...totalViewersByBucket, 0)
  const avgViewers = Math.round(totalViewersByBucket.reduce((a, b) => a + b, 0) / Math.max(1, totalViewersByBucket.length))
  const firstSeen = buckets.find((b) => (totals.get(b) ?? 0) > 0) ?? null
  const lastSeen = [...buckets].reverse().find((b) => (totals.get(b) ?? 0) > 0) ?? null
  const bandBuckets = buckets.map((bucket, i) => ({ viewers: totalViewersByBucket[i] ?? 0, share: (totalViewersByBucket[i] ?? 0) > 0 ? 1 : 0, activityAvailable: false, peak: i === peakIndex && (totalViewersByBucket[i] ?? 0) > 0, rise: i === riseIndex && riseValue > 0 }))
  const bands: DayFlowBandSeries[] = [{ streamerId: ID, name: NAME, title: TITLE, url: URL, color: COLOR, isOthers: false, order: 0, totalViewerMinutes: totalViewersByBucket.reduce((sum, v) => sum + v * bucketSize, 0), peakViewers, avgViewers, peakShare: peakViewers > 0 ? 1 : 0, biggestRiseBucket: riseIndex >= 0 ? buckets[riseIndex] ?? null : null, firstSeen, lastSeen, activityMax: null, buckets: bandBuckets }]
  const nowBucket = [...buckets].reverse().find((bucket, i) => (totalViewersByBucket[buckets.length - 1 - i] ?? 0) > 0) ?? null
  const selectedBucket = nowBucket ?? buckets[peakIndex] ?? null
  const focusIndex = selectedBucket ? buckets.indexOf(selectedBucket) : -1
  const focusItem: DayFlowFocusItem | null = focusIndex >= 0 ? { streamerId: ID, name: strongest.get(selectedBucket ?? "") ?? NAME, viewers: totalViewersByBucket[focusIndex] ?? 0, share: (totalViewersByBucket[focusIndex] ?? 0) > 0 ? 1 : 0, momentum: focusIndex > 0 ? (totalViewersByBucket[focusIndex] ?? 0) - (totalViewersByBucket[focusIndex - 1] ?? 0) : 0, activity: null, activityAvailable: false } : null
  const state = raw.state === "error" ? "error" : scope === "yesterday" || scope === "date" ? "complete" : raw.state === "partial" || raw.state === "loading" ? "partial" : "live"
  return {
    ok: true,
    tool: "day-flow",
    source: "api",
    state,
    status: state === "live" ? "live-today" : state,
    note,
    coverageNote: raw.coverage,
    partialNote: "Kick Day Flow currently reflects observed total viewer history only.",
    lastUpdated,
    selectedDate: effectiveDate,
    bucketSize,
    topN,
    valueMode: mode,
    defaultMode: mode,
    dateScope: scope,
    rangeMode: scope,
    windowStart: buckets[0] ?? `${effectiveDate}T00:00:00.000Z`,
    windowEnd: buckets[buckets.length - 1] ?? lastUpdated,
    rankingWindowStart: buckets[0] ?? `${effectiveDate}T00:00:00.000Z`,
    rankingWindowEnd: buckets[buckets.length - 1] ?? lastUpdated,
    isRolling: scope === "rolling24h",
    summary: { peakLeader: raw.summary?.strongestStreamer ?? strongest.get(buckets[peakIndex] ?? "") ?? NAME, longestDominance: raw.summary?.strongestStreamer ?? strongest.get(buckets[peakIndex] ?? "") ?? NAME, highestActivity: "Activity unavailable", biggestRise: riseValue > 0 ? strongest.get(buckets[riseIndex] ?? "") ?? NAME : "N/A" },
    timeline: { dayStart: buckets[0] ?? `${effectiveDate}T00:00:00.000Z`, dayEnd: buckets[buckets.length - 1] ?? lastUpdated, nowBucket, bucketCount: buckets.length, futureBlankFrom: scope === "today" ? nowBucket : null },
    buckets,
    totalViewersByBucket,
    bands,
    focusSnapshot: { selectedBucket, items: focusItem ? [focusItem] : [], strongestMomentum: focusItem?.name ?? NAME, highestActivity: "Activity unavailable" },
    detailPanelSource: { defaultStreamerId: ID, streamers: [{ streamerId: ID, name: NAME, title: TITLE, url: URL, peakViewers, avgViewers, viewerMinutes: totalViewersByBucket.reduce((sum, v) => sum + v * bucketSize, 0), peakShare: peakViewers > 0 ? 1 : 0, highestActivity: null, biggestRiseTime: riseIndex >= 0 ? buckets[riseIndex] ?? null : null, firstSeen, lastSeen }] },
    activity: { available: false, note: "Activity unavailable for Kick Day Flow: current collector payload does not expose per-stream chat activity." }
  }
}
