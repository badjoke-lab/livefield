type Env = {
  DB: D1Database
  KICK_CLIENT_ID?: string
  KICK_CLIENT_SECRET?: string
}

type KickTokenResponse = {
  access_token: string
  token_type: string
  expires_in: number
}

type KickLivestreamItem = {
  broadcaster_user_id?: number | string
  channel_id?: number | string
  slug?: string
  stream_title?: string
  viewer_count?: number
  started_at?: string
  language?: string
  category?: {
    id?: number | string
    name?: string
  } | null
  [key: string]: unknown
}

type KickLivestreamsResponse = {
  data?: KickLivestreamItem[]
  message?: string
}

type KickStatsResponse = {
  data?: {
    livestreams?: number
    [key: string]: unknown
  }
  message?: string
}

type CollectorStatusPayload = {
  source: "worker"
  platform: "kick"
  state: "unconfigured" | "live" | "partial" | "error"
  collectorState: "not_wired" | "live" | "partial" | "error"
  lastAttempt: string | null
  lastSuccess: string | null
  lastFailure: string | null
  lastError: string | null
  coverage: string
  note: string
  knownLimitations: string[]
}

type CollectorHeatmapNode = {
  rank: number
  slug: string
  title: string
  viewers: number
  startedAt: string | null
  language: string | null
  category: string | null
  broadcasterUserId: string | null
  channelId: string | null
}

type CollectorHeatmapPayload = {
  source: "worker"
  platform: "kick"
  state: "unconfigured" | "live" | "partial" | "error"
  lastUpdated: string | null
  coverage: string
  note: string
  nodes: CollectorHeatmapNode[]
  summary: {
    activeStreams: number
    totalViewersObserved: number
    strongestMomentumStream: string | null
    highestActivityStream: string | null
    platformTotalCount: number | null
  }
}

type CollectorDayFlowPoint = {
  ts: string
  totalViewersObserved: number
  observedCount: number
  strongestStreamer: string | null
}

type CollectorDayFlowPayload = {
  source: "worker"
  platform: "kick"
  state: "unconfigured" | "live" | "partial" | "error"
  lastUpdated: string | null
  coverage: string
  note: string
  points: CollectorDayFlowPoint[]
  summary: {
    observedBuckets: number
    totalViewersObserved: number
    strongestWindow: string | null
    strongestStreamer: string | null
  }
}

type CollectorBattlePair = {
  leftSlug: string
  rightSlug: string
  leftViewers: number
  rightViewers: number
  viewerGap: number
  previousGap: number | null
  swing: number | null
  label: "neck_and_neck" | "closing_fast" | "reversal_watch" | "clear_lead"
}

type CollectorBattleGapTrend = "closing" | "widening" | "flat"
type CollectorBattleCandidateTag = "closing" | "recent-reversal" | "rising-challenger" | "heated"

type CollectorBattleFilters = {
  day: "today" | "yesterday" | "date"
  date: string
  top: 3 | 5 | 10
  metric: "viewers" | "indexed"
  bucketMinutes: 1 | 5 | 10
  focus?: string
}

type CollectorBattleLine = {
  streamerId: string
  name: string
  color: string
  points: number[]
  viewerPoints: number[]
  peakViewers: number
  latestViewers: number
  risePerMin: number
  reversalCount: number
}

type CollectorBattleEvent = {
  type: "peak" | "rise" | "reversal"
  bucket: string
  label: string
  streamerId: string
  rivalId?: string
}

type CollectorBattleCandidate = {
  key: string
  leftId: string
  rightId: string
  leftName: string
  rightName: string
  score: number
  gap: number
  gapTrend: CollectorBattleGapTrend
  lastReversalAt: string | null
  tag: CollectorBattleCandidateTag
  currentGapLabel: string
}

type CollectorBattleReversalStripItem = {
  timestamp: string
  label: string
  passer: string
  passed: string
  gapBefore: number
  gapAfter: number
  heatOverlap: boolean
}

type CollectorBattleLinesPayload = {
  source: "worker"
  platform: "kick"
  state: "unconfigured" | "loading" | "live" | "partial" | "empty" | "error" | "complete"
  updatedAt?: string
  lastUpdated: string | null
  coverage: string
  note: string
  filters?: CollectorBattleFilters
  buckets: string[]
  lines: CollectorBattleLine[]
  focusStrip: Array<{
    streamerId: string
    name: string
  }>
  focusDetail?: {
    streamerId: string
    name: string
    peakViewers: number
    latestViewers: number
    biggestRiseTime: string
    reversalCount: number
  }
  events: CollectorBattleEvent[]
  recommendation?: {
    primaryBattle: CollectorBattleCandidate | null
    secondaryBattles: CollectorBattleCandidate[]
    latestReversal: string
    fastestChallenger: string
    reversalStrip: CollectorBattleReversalStripItem[]
  }
  pairs: CollectorBattlePair[]
  summary: {
    observedPairs?: number
    strongestPair?: string | null
    strongestReversalWindow?: string | null
    strongestPressureSide?: string | null
    leader?: string
    biggestRise?: string
    peakMoment?: string
    reversals?: number
    liveBattleNow?: string
    latestReversal?: string
    fastestChallenger?: string
    mostHeatedBattle?: string
  }
}

function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    },
    ...init
  })
}

function nowIso(): string {
  return new Date().toISOString()
}

function toText(value: unknown): string | null {
  if (value === null || value === undefined) return null
  return String(value)
}

async function fetchKickToken(env: Env): Promise<string> {
  const clientId = env.KICK_CLIENT_ID?.trim()
  const clientSecret = env.KICK_CLIENT_SECRET?.trim()

  if (!clientId || !clientSecret) {
    throw new Error("Kick credentials are missing.")
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials"
  })

  const response = await fetch("https://id.kick.com/oauth/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "accept": "application/json"
    },
    body
  })

  if (!response.ok) {
    throw new Error(`Kick token request failed with ${response.status}`)
  }

  const payload = await response.json() as KickTokenResponse
  if (!payload.access_token) {
    throw new Error("Kick token response did not include access_token")
  }

  return payload.access_token
}

async function fetchKickLivestreams(token: string): Promise<KickLivestreamItem[]> {
  const response = await fetch("https://api.kick.com/public/v1/livestreams?limit=100&sort=viewer_count", {
    headers: {
      "authorization": `Bearer ${token}`,
      "accept": "application/json"
    }
  })

  if (!response.ok) {
    throw new Error(`Kick livestreams request failed with ${response.status}`)
  }

  const payload = await response.json() as KickLivestreamsResponse
  return Array.isArray(payload.data) ? payload.data : []
}

async function fetchKickStats(token: string): Promise<number | null> {
  const response = await fetch("https://api.kick.com/public/v1/livestreams/stats", {
    headers: {
      "authorization": `Bearer ${token}`,
      "accept": "application/json"
    }
  })

  if (!response.ok) return null

  const payload = await response.json() as KickStatsResponse
  const count = payload.data?.livestreams
  return typeof count === "number" && Number.isFinite(count) ? count : null
}

async function insertRun(
  db: D1Database,
  args: {
    state: "live" | "partial" | "error"
    coverageNote: string
    observedCount: number
    platformTotalCount: number | null
    totalViewersObserved: number
    errorMessage: string | null
  }
): Promise<number> {
  const result = await db.prepare(`
    INSERT INTO kick_runs (
      state,
      coverage_note,
      observed_count,
      platform_total_count,
      total_viewers_observed,
      error_message
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    args.state,
    args.coverageNote,
    args.observedCount,
    args.platformTotalCount,
    args.totalViewersObserved,
    args.errorMessage
  ).run()

  const id = Number(result.meta.last_row_id)
  if (!Number.isFinite(id)) throw new Error("Could not resolve kick_runs.id")
  return id
}

async function insertSnapshots(
  db: D1Database,
  runId: number,
  fetchedAt: string,
  items: KickLivestreamItem[]
): Promise<void> {
  if (items.length === 0) return

  const statements = items.map((item) =>
    db.prepare(`
      INSERT INTO kick_livestream_snapshots (
        run_id,
        fetched_at,
        broadcaster_user_id,
        channel_id,
        slug,
        stream_title,
        viewer_count,
        started_at,
        language,
        category_id,
        category_name,
        raw_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      runId,
      fetchedAt,
      toText(item.broadcaster_user_id),
      toText(item.channel_id),
      typeof item.slug === "string" ? item.slug : null,
      typeof item.stream_title === "string" ? item.stream_title : null,
      typeof item.viewer_count === "number" ? item.viewer_count : 0,
      typeof item.started_at === "string" ? item.started_at : null,
      typeof item.language === "string" ? item.language : null,
      item.category ? toText(item.category.id) : null,
      item.category && typeof item.category.name === "string" ? item.category.name : null,
      JSON.stringify(item)
    )
  )

  await db.batch(statements)
}

async function collectKickLivestreams(env: Env): Promise<void> {
  const fetchedAt = nowIso()
  const token = await fetchKickToken(env)
  const [items, platformTotalCount] = await Promise.all([
    fetchKickLivestreams(token),
    fetchKickStats(token)
  ])

  const observedCount = items.length
  const totalViewersObserved = items.reduce(
    (sum, item) => sum + (typeof item.viewer_count === "number" ? item.viewer_count : 0),
    0
  )

  const state: "live" | "partial" =
    platformTotalCount && platformTotalCount > observedCount ? "partial" : "live"

  const coverageNote =
    platformTotalCount && platformTotalCount > observedCount
      ? `Observed top ${observedCount} livestreams by viewer_count out of platform total ${platformTotalCount}.`
      : `Observed ${observedCount} livestreams from Kick livestreams endpoint.`

  const runId = await insertRun(env.DB, {
    state,
    coverageNote,
    observedCount,
    platformTotalCount,
    totalViewersObserved,
    errorMessage: null
  })

  await insertSnapshots(env.DB, runId, fetchedAt, items)
}

async function recordFailure(db: D1Database, message: string): Promise<void> {
  await insertRun(db, {
    state: "error",
    coverageNote: "Kick collector run failed before snapshot write.",
    observedCount: 0,
    platformTotalCount: null,
    totalViewersObserved: 0,
    errorMessage: message
  })
}

async function getLatestRun(db: D1Database): Promise<Record<string, unknown> | null> {
  return await db.prepare(`
    SELECT
      id,
      created_at,
      state,
      coverage_note,
      observed_count,
      platform_total_count,
      total_viewers_observed,
      error_message
    FROM kick_runs
    ORDER BY id DESC
    LIMIT 1
  `).first<Record<string, unknown>>() ?? null
}

async function getLatestUsableRun(db: D1Database): Promise<Record<string, unknown> | null> {
  return await db.prepare(`
    SELECT
      kr.id,
      kr.created_at,
      kr.state,
      kr.coverage_note,
      kr.observed_count,
      kr.platform_total_count,
      kr.total_viewers_observed,
      kr.error_message
    FROM kick_runs kr
    WHERE kr.state != 'error'
      AND COALESCE(kr.observed_count, 0) > 0
      AND EXISTS (
        SELECT 1
        FROM kick_livestream_snapshots kls
        WHERE kls.run_id = kr.id
          AND kls.slug IS NOT NULL
          AND TRIM(kls.slug) != ''
      )
    ORDER BY kr.id DESC
    LIMIT 1
  `).first<Record<string, unknown>>() ?? null
}

async function getLatestUsableRuns(db: D1Database, limit: number): Promise<Record<string, unknown>[]> {
  const result = await db.prepare(`
    SELECT
      kr.id,
      kr.created_at,
      kr.state,
      kr.coverage_note,
      kr.observed_count,
      kr.platform_total_count,
      kr.total_viewers_observed,
      kr.error_message
    FROM kick_runs kr
    WHERE kr.state != 'error'
      AND COALESCE(kr.observed_count, 0) > 0
      AND EXISTS (
        SELECT 1
        FROM kick_livestream_snapshots kls
        WHERE kls.run_id = kr.id
          AND kls.slug IS NOT NULL
          AND TRIM(kls.slug) != ''
      )
    ORDER BY kr.id DESC
    LIMIT ?
  `).bind(limit).all()

  return Array.isArray(result.results) ? result.results as Record<string, unknown>[] : []
}

async function getLatestNodes(db: D1Database, runId: number): Promise<CollectorHeatmapNode[]> {
  const result = await db.prepare(`
    SELECT
      broadcaster_user_id,
      channel_id,
      slug,
      stream_title,
      viewer_count,
      started_at,
      language,
      category_name
    FROM kick_livestream_snapshots
    WHERE run_id = ?
    ORDER BY viewer_count DESC, id ASC
  `).bind(runId).all()

  const rows = Array.isArray(result.results) ? result.results : []

  return rows
    .map((row, idx) => {
      const r = row as Record<string, unknown>
      const slug = typeof r.slug === "string" ? r.slug : null
      if (!slug) return null
      return {
        rank: idx + 1,
        slug,
        title: typeof r.stream_title === "string" && r.stream_title.trim() ? r.stream_title : slug,
        viewers: typeof r.viewer_count === "number" ? r.viewer_count : Number(r.viewer_count ?? 0),
        startedAt: typeof r.started_at === "string" ? r.started_at : null,
        language: typeof r.language === "string" ? r.language : null,
        category: typeof r.category_name === "string" ? r.category_name : null,
        broadcasterUserId: toText(r.broadcaster_user_id),
        channelId: toText(r.channel_id)
      } satisfies CollectorHeatmapNode
    })
    .filter((x): x is CollectorHeatmapNode => x !== null)
}

async function getTop10Map(db: D1Database, runId: number): Promise<Map<string, number>> {
  const result = await db.prepare(`
    SELECT slug, viewer_count
    FROM kick_livestream_snapshots
    WHERE run_id = ?
    ORDER BY viewer_count DESC, id ASC
    LIMIT 10
  `).bind(runId).all()

  const rows = Array.isArray(result.results) ? result.results : []
  const m = new Map<string, number>()

  for (const row of rows) {
    const r = row as Record<string, unknown>
    const slug = typeof r.slug === "string" ? r.slug : null
    if (!slug) continue
    const viewers = typeof r.viewer_count === "number" ? r.viewer_count : Number(r.viewer_count ?? 0)
    m.set(slug, viewers)
  }

  return m
}

function classifyPair(currentGap: number, previousGap: number | null): CollectorBattlePair["label"] {
  const absGap = Math.Math.abs(currentGap)

  if (previousGap !== null && currentGap !== 0 && previousGap !== 0 && Math.sign(currentGap) !== Math.sign(previousGap)) {
    return "reversal_watch"
  }

  if (absGap <= 500) {
    return "neck_and_neck"
  }

  if (previousGap !== null && Math.Math.abs(previousGap) - absGap >= 500) {
    return "closing_fast"
  }

  return "clear_lead"
}


const BATTLE_COLORS = ["#8ec5ff", "#c7a6ff", "#7ee0b5", "#ffd27a", "#ff9ab3", "#9be7ff", "#b8f27c", "#ffb86b", "#d6bcff", "#95f0d8"] as const
const battleNumberFmt = new Intl.NumberFormat("en-US")
const DAY_MS = 24 * 60 * 60 * 1000

type CollectorBattleReversalRecord = {
  key: string
  leftId: string
  rightId: string
  leftName: string
  rightName: string
  timestamp: string
  passerId: string
  passerName: string
  passedId: string
  passedName: string
  gapBefore: number
  gapAfter: number
}

function toDbSecond(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ")
}

function normalizeDbTimestamp(value: string | null): string | null {
  if (!value) return null
  if (value.includes("T")) return value.endsWith("Z") ? value : `${value}Z`
  return `${value.replace(" ", "T")}Z`
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function toIsoMinute(date: Date): string {
  return `${date.toISOString().slice(0, 16)}:00.000Z`
}

function floorToBattleBucket(iso: string, minutes: 1 | 5 | 10): string {
  const d = new Date(iso)
  d.setUTCSeconds(0, 0)
  const m = d.getUTCMinutes()
  d.setUTCMinutes(m - (m % minutes))
  return toIsoMinute(d)
}

function isoMinuteLabel(iso: string): string {
  return iso.slice(11, 16)
}

function parseBattleMinute(value: string | null | undefined): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

function normalizeBattleTop(raw: string | null): 3 | 5 | 10 {
  if (raw === "3") return 3
  if (raw === "10") return 10
  return 5
}

function normalizeBattleMetric(raw: string | null): "viewers" | "indexed" {
  return raw === "indexed" ? "indexed" : "viewers"
}

function normalizeBattleBucket(raw: string | null): 1 | 5 | 10 {
  if (raw === "1") return 1
  if (raw === "10") return 10
  return 5
}

function parseBattleFilters(url: URL): CollectorBattleFilters {
  const now = new Date()
  const rawDay = url.searchParams.get("day")
  const rawDate = url.searchParams.get("date")
  let day: "today" | "yesterday" | "date" = "today"
  let date = startOfUtcDay(now).toISOString().slice(0, 10)

  if (rawDay === "yesterday") {
    day = "yesterday"
    date = startOfUtcDay(new Date(startOfUtcDay(now).getTime() - DAY_MS)).toISOString().slice(0, 10)
  } else if (rawDay === "date" && rawDate) {
    const parsed = new Date(`${rawDate}T00:00:00.000Z`)
    if (!Number.isNaN(parsed.getTime())) {
      day = "date"
      date = startOfUtcDay(parsed).toISOString().slice(0, 10)
    }
  }

  return {
    day,
    date,
    top: normalizeBattleTop(url.searchParams.get("top")),
    metric: normalizeBattleMetric(url.searchParams.get("metric")),
    bucketMinutes: normalizeBattleBucket(url.searchParams.get("bucket")),
    focus: url.searchParams.get("focus") ?? ""
  }
}

function buildBattleScaffold(
  filters: CollectorBattleFilters,
  state: CollectorBattleLinesPayload["state"],
  coverage: string,
  note: string,
  lastUpdated: string | null
): CollectorBattleLinesPayload {
  return {
    source: "worker",
    platform: "kick",
    state,
    updatedAt: lastUpdated ?? undefined,
    lastUpdated,
    coverage,
    note,
    filters,
    buckets: [],
    lines: [],
    focusStrip: [],
    focusDetail: {
      streamerId: "",
      name: "N/A",
      peakViewers: 0,
      latestViewers: 0,
      biggestRiseTime: "N/A",
      reversalCount: 0
    },
    events: [],
    recommendation: {
      primaryBattle: null,
      secondaryBattles: [],
      latestReversal: "No reversal yet",
      fastestChallenger: "N/A",
      reversalStrip: []
    },
    pairs: [],
    summary: {
      observedPairs: 0,
      strongestPair: null,
      strongestReversalWindow: null,
      strongestPressureSide: null,
      leader: "No leader",
      biggestRise: "No rise",
      peakMoment: "N/A",
      reversals: 0,
      liveBattleNow: "No live battle",
      latestReversal: "No reversal yet",
      fastestChallenger: "N/A",
      mostHeatedBattle: "No heated battle"
    }
  }
}

async function getUsableRunsInRange(
  db: D1Database,
  startDb: string,
  endDb: string
): Promise<Record<string, unknown>[]> {
  const result = await db.prepare(`
    SELECT
      kr.id,
      kr.created_at,
      kr.state,
      kr.coverage_note,
      kr.observed_count,
      kr.platform_total_count,
      kr.total_viewers_observed,
      kr.error_message
    FROM kick_runs kr
    WHERE kr.state != 'error'
      AND COALESCE(kr.observed_count, 0) > 0
      AND kr.created_at >= ?
      AND kr.created_at <= ?
      AND EXISTS (
        SELECT 1
        FROM kick_livestream_snapshots kls
        WHERE kls.run_id = kr.id
          AND kls.slug IS NOT NULL
          AND TRIM(kls.slug) != ''
      )
    ORDER BY kr.created_at ASC, kr.id ASC
  `).bind(startDb, endDb).all()

  return Array.isArray(result.results) ? result.results as Record<string, unknown>[] : []
}

function buildBattleBuckets(
  filters: CollectorBattleFilters,
  lastObservedIso: string | null
): string[] {
  const start = new Date(`${filters.date}T00:00:00.000Z`)
  const buckets: string[] = []

  if (filters.day === "today") {
    const endIso = lastObservedIso ?? new Date().toISOString()
    const end = new Date(floorToBattleBucket(endIso, filters.bucketMinutes))
    if (Number.isNaN(end.getTime()) || end.getTime() < start.getTime()) return []
    for (let ts = start.getTime(); ts <= end.getTime(); ts += filters.bucketMinutes * 60_000) {
      buckets.push(toIsoMinute(new Date(ts)))
    }
    return buckets
  }

  const endExclusive = new Date(start.getTime() + DAY_MS)
  for (let ts = start.getTime(); ts < endExclusive.getTime(); ts += filters.bucketMinutes * 60_000) {
    buckets.push(toIsoMinute(new Date(ts)))
  }
  return buckets
}

async function getSnapshotsForRunIds(
  db: D1Database,
  runIds: number[]
): Promise<Map<number, Map<string, { viewers: number; title: string }>>> {
  const out = new Map<number, Map<string, { viewers: number; title: string }>>()
  if (!runIds.length) return out

  const chunkSize = 400
  for (let start = 0; start < runIds.length; start += chunkSize) {
    const chunk = runIds.slice(start, start + chunkSize)
    const placeholders = chunk.map(() => "?").join(",")
    const result = await db.prepare(`
      SELECT run_id, slug, stream_title, viewer_count
      FROM kick_livestream_snapshots
      WHERE run_id IN (${placeholders})
      ORDER BY run_id ASC, viewer_count DESC, id ASC
    `).bind(...chunk).all()

    const rows = Array.isArray(result.results) ? result.results as Record<string, unknown>[] : []
    for (const row of rows) {
      const runId = typeof row.run_id === "number" ? row.run_id : Number(row.run_id ?? 0)
      const slug = typeof row.slug === "string" ? row.slug : null
      if (!Number.isFinite(runId) || !slug) continue
      let runMap = out.get(runId)
      if (!runMap) {
        runMap = new Map<string, { viewers: number; title: string }>()
        out.set(runId, runMap)
      }
      runMap.set(slug, {
        viewers: typeof row.viewer_count === "number" ? row.viewer_count : Number(row.viewer_count ?? 0),
        title: typeof row.stream_title === "string" && row.stream_title.trim() ? row.stream_title : slug
      })
    }
  }

  return out
}

function buildPairKey(leftId: string, rightId: string): string {
  return [leftId, rightId].sort().join("|")
}

function formatGap(value: number): string {
  return `${battleNumberFmt.format(Math.max(0, Math.round(value)))} gap`
}

function gapTrendFrom(previousGap: number, latestGap: number): CollectorBattleGapTrend {
  if (latestGap < previousGap) return "closing"
  if (latestGap > previousGap) return "widening"
  return "flat"
}

function pickBattleTag(args: {
  latestGap: number
  latestReversalAt: string | null
  gapTrend: CollectorBattleGapTrend
  combinedRise: number
}): CollectorBattleCandidateTag {
  if (args.latestReversalAt) return "recent-reversal"
  if (args.latestGap <= 150 && args.combinedRise > 0) return "heated"
  if (args.gapTrend === "closing") return "closing"
  return "rising-challenger"
}

function buildReversalRecords(
  lines: CollectorBattleLine[],
  buckets: string[]
): CollectorBattleReversalRecord[] {
  const records: CollectorBattleReversalRecord[] = []

  for (let left = 0; left < lines.length; left += 1) {
    for (let right = left + 1; right < lines.length; right += 1) {
      const a = lines[left]
      const b = lines[right]
      const key = buildPairKey(a.streamerId, b.streamerId)

      for (let idx = 1; idx < buckets.length; idx += 1) {
        const prevLeft = a.viewerPoints[idx - 1] ?? 0
        const prevRight = b.viewerPoints[idx - 1] ?? 0
        const nextLeft = a.viewerPoints[idx] ?? 0
        const nextRight = b.viewerPoints[idx] ?? 0

        const prevDelta = prevLeft - prevRight
        const nextDelta = nextLeft - nextRight
        if (prevDelta === 0 || nextDelta === 0) continue
        if (!((prevDelta > 0 && nextDelta < 0) || (prevDelta < 0 && nextDelta > 0))) continue

        const passerIsLeft = nextLeft > nextRight
        records.push({
          key,
          leftId: a.streamerId,
          rightId: b.streamerId,
          leftName: a.name,
          rightName: b.name,
          timestamp: buckets[idx] ?? buckets[0] ?? new Date().toISOString(),
          passerId: passerIsLeft ? a.streamerId : b.streamerId,
          passerName: passerIsLeft ? a.name : b.name,
          passedId: passerIsLeft ? b.streamerId : a.streamerId,
          passedName: passerIsLeft ? b.name : a.name,
          gapBefore: Math.Math.abs(prevDelta),
          gapAfter: Math.Math.abs(nextDelta)
        })
      }
    }
  }

  return records.sort((a, b) => parseBattleMinute(b.timestamp) - parseBattleMinute(a.timestamp))
}

function buildBattleEvents(
  lines: CollectorBattleLine[],
  buckets: string[],
  reversalRecords: CollectorBattleReversalRecord[]
): CollectorBattleEvent[] {
  const events: CollectorBattleEvent[] = []

  for (const line of lines) {
    if (!line.viewerPoints.length) continue

    let peakIdx = 0
    let riseIdx = 0
    let bestRise = Number.NEGATIVE_INFINITY

    for (let idx = 0; idx < line.viewerPoints.length; idx += 1) {
      if ((line.viewerPoints[idx] ?? 0) > (line.viewerPoints[peakIdx] ?? 0)) peakIdx = idx
      if (idx > 0) {
        const rise = (line.viewerPoints[idx] ?? 0) - (line.viewerPoints[idx - 1] ?? 0)
        if (rise > bestRise) {
          bestRise = rise
          riseIdx = idx
        }
      }
    }

    events.push({
      type: "peak",
      bucket: buckets[peakIdx] ?? buckets[0] ?? new Date().toISOString(),
      label: `${line.name} peak`,
      streamerId: line.streamerId
    })

    events.push({
      type: "rise",
      bucket: buckets[riseIdx] ?? buckets[0] ?? new Date().toISOString(),
      label: `${line.name} rise`,
      streamerId: line.streamerId
    })
  }

  for (const record of reversalRecords) {
    events.push({
      type: "reversal",
      bucket: record.timestamp,
      label: `${record.passerName} passed ${record.passedName}`,
      streamerId: record.passerId,
      rivalId: record.passedId
    })
  }

  return events.sort((a, b) => parseBattleMinute(b.bucket) - parseBattleMinute(a.bucket))
}

function buildBattlePayloadFromLines(args: {
  filters: CollectorBattleFilters
  buckets: string[]
  lines: CollectorBattleLine[]
  coverage: string
  note: string
  lastUpdated: string | null
  state: CollectorBattleLinesPayload["state"]
}): CollectorBattleLinesPayload {
  const reversalRecords = buildReversalRecords(args.lines, args.buckets)
  const pairCandidates: Array<CollectorBattleCandidate & { pair: CollectorBattlePair }> = []

  for (let left = 0; left < args.lines.length; left += 1) {
    for (let right = left + 1; right < args.lines.length; right += 1) {
      const a = args.lines[left]
      const b = args.lines[right]
      const latestGapSigned = (a.latestViewers ?? 0) - (b.latestViewers ?? 0)
      const prevA = a.viewerPoints.length >= 2 ? a.viewerPoints[a.viewerPoints.length - 2] ?? a.latestViewers : a.latestViewers
      const prevB = b.viewerPoints.length >= 2 ? b.viewerPoints[b.viewerPoints.length - 2] ?? b.latestViewers : b.latestViewers
      const previousGapSigned = prevA - prevB
      const latestGap = Math.Math.abs(latestGapSigned)
      const previousGap = Math.Math.abs(previousGapSigned)
      const label = classifyPair(latestGapSigned, previousGapSigned)
      const reversal = reversalRecords.find((record) => record.key === buildPairKey(a.streamerId, b.streamerId)) ?? null
      const gapTrend = gapTrendFrom(previousGap, latestGap)
      const combinedRise = Math.max(0, a.risePerMin) + Math.max(0, b.risePerMin)
      const score =
        Math.max(0, 3000 - latestGap * 6) +
        (reversal ? 1800 : 0) +
        Math.max(0, combinedRise) * 6 +
        (label === "reversal_watch" ? 1000 : 0) +
        (label === "closing_fast" ? 500 : 0)

      pairCandidates.push({
        key: `${a.streamerId}::${b.streamerId}`,
        leftId: a.streamerId,
        rightId: b.streamerId,
        leftName: a.name,
        rightName: b.name,
        score,
        gap: latestGap,
        gapTrend,
        lastReversalAt: reversal?.timestamp ?? null,
        tag: pickBattleTag({
          latestGap,
          latestReversalAt: reversal?.timestamp ?? null,
          gapTrend,
          combinedRise
        }),
        currentGapLabel: formatGap(latestGap),
        pair: {
          leftSlug: a.streamerId,
          rightSlug: b.streamerId,
          leftViewers: a.latestViewers,
          rightViewers: b.latestViewers,
          viewerGap: latestGapSigned,
          previousGap: previousGapSigned,
          swing: latestGapSigned - previousGapSigned,
          label
        }
      })
    }
  }

  pairCandidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (a.gap !== b.gap) return a.gap - b.gap
    return a.key.localeCompare(b.key)
  })

  const pairs = pairCandidates.slice(0, 10).map((item) => item.pair)
  const primaryBattle = pairCandidates[0] ? {
    key: pairCandidates[0].key,
    leftId: pairCandidates[0].leftId,
    rightId: pairCandidates[0].rightId,
    leftName: pairCandidates[0].leftName,
    rightName: pairCandidates[0].rightName,
    score: pairCandidates[0].score,
    gap: pairCandidates[0].gap,
    gapTrend: pairCandidates[0].gapTrend,
    lastReversalAt: pairCandidates[0].lastReversalAt,
    tag: pairCandidates[0].tag,
    currentGapLabel: pairCandidates[0].currentGapLabel
  } : null

  const secondaryBattles = pairCandidates.slice(1, 4).map((item) => ({
    key: item.key,
    leftId: item.leftId,
    rightId: item.rightId,
    leftName: item.leftName,
    rightName: item.rightName,
    score: item.score,
    gap: item.gap,
    gapTrend: item.gapTrend,
    lastReversalAt: item.lastReversalAt,
    tag: item.tag,
    currentGapLabel: item.currentGapLabel
  }))

  const fastest = [...args.lines].sort((a, b) => b.risePerMin - a.risePerMin)[0] ?? null
  const latestReversal = reversalRecords[0] ?? null
  const events = buildBattleEvents(args.lines, args.buckets, reversalRecords)

  const focusId =
    (args.filters.focus && args.lines.some((line) => line.streamerId === args.filters.focus) ? args.filters.focus : "") ||
    args.lines[0]?.streamerId ||
    ""

  const focusLine = args.lines.find((line) => line.streamerId === focusId) ?? args.lines[0] ?? null
  const focusRise = events.find((event) => event.type === "rise" && event.streamerId === (focusLine?.streamerId ?? "")) ?? null

  return {
    source: "worker",
    platform: "kick",
    state: args.state,
    updatedAt: args.lastUpdated ?? undefined,
    lastUpdated: args.lastUpdated,
    coverage: args.coverage,
    note: args.note,
    filters: args.filters,
    buckets: args.buckets,
    lines: args.lines,
    focusStrip: args.lines.map((line) => ({ streamerId: line.streamerId, name: line.name })),
    focusDetail: {
      streamerId: focusLine?.streamerId ?? "",
      name: focusLine?.name ?? "N/A",
      peakViewers: focusLine?.peakViewers ?? 0,
      latestViewers: focusLine?.latestViewers ?? 0,
      biggestRiseTime: focusRise?.bucket ? isoMinuteLabel(focusRise.bucket) : "N/A",
      reversalCount: focusLine?.reversalCount ?? 0
    },
    events,
    recommendation: {
      primaryBattle,
      secondaryBattles,
      latestReversal: latestReversal
        ? `${latestReversal.passerName} passed ${latestReversal.passedName} @ ${isoMinuteLabel(latestReversal.timestamp)}`
        : "No reversal yet",
      fastestChallenger: fastest
        ? `${fastest.name} (+${battleNumberFmt.format(Math.round(fastest.risePerMin))}/min)`
        : "N/A",
      reversalStrip: reversalRecords.slice(0, 6).map((record) => ({
        timestamp: record.timestamp,
        label: `${record.passerName} passed ${record.passedName}`,
        passer: record.passerName,
        passed: record.passedName,
        gapBefore: record.gapBefore,
        gapAfter: record.gapAfter,
        heatOverlap: false
      }))
    },
    pairs,
    summary: {
      observedPairs: pairs.length,
      strongestPair: primaryBattle ? `${primaryBattle.leftName} vs ${primaryBattle.rightName}` : null,
      strongestReversalWindow: latestReversal?.timestamp ?? null,
      strongestPressureSide: fastest?.name ?? null,
      leader: args.lines[0]?.name ?? "No leader",
      biggestRise: fastest?.name ?? "No rise",
      peakMoment: events.find((event) => event.type === "peak")?.bucket ?? (args.lastUpdated ?? "N/A"),
      reversals: reversalRecords.length,
      liveBattleNow: primaryBattle
        ? `${primaryBattle.leftName} vs ${primaryBattle.rightName} · ${primaryBattle.currentGapLabel} · ${primaryBattle.gapTrend}`
        : "No live battle",
      latestReversal: latestReversal
        ? `${latestReversal.passerName} passed ${latestReversal.passedName} @ ${isoMinuteLabel(latestReversal.timestamp)}`
        : "No reversal yet",
      fastestChallenger: fastest?.name ?? "N/A",
      mostHeatedBattle: primaryBattle
        ? `${primaryBattle.leftName} vs ${primaryBattle.rightName} · ${primaryBattle.tag}`
        : "No heated battle"
    }
  }
}

async function getStatusPayload(env: Env): Promise<CollectorStatusPayload> {
  const latest = await getLatestRun(env.DB)

  if (!latest) {
    return {
      source: "worker",
      platform: "kick",
      state: "unconfigured",
      collectorState: "not_wired",
      lastAttempt: null,
      lastSuccess: null,
      lastFailure: null,
      lastError: null,
      coverage: "Kick collector worker exists, but no run has completed yet.",
      note: "Collector scaffold is deployed, but no successful collection run is recorded yet.",
      knownLimitations: [
        "Top 100 livestream polling only.",
        "Coverage note is required because platform total can exceed observed rows.",
        "Webhook-based activity is not wired yet."
      ]
    }
  }

  const state = latest.state === "error" ? "error" : latest.state === "partial" ? "partial" : "live"
  const collectorState = latest.state === "error" ? "error" : latest.state === "partial" ? "partial" : "live"

  return {
    source: "worker",
    platform: "kick",
    state,
    collectorState,
    lastAttempt: typeof latest.created_at === "string" ? latest.created_at : null,
    lastSuccess: latest.state === "error" ? null : (typeof latest.created_at === "string" ? latest.created_at : null),
    lastFailure: latest.state === "error" ? (typeof latest.created_at === "string" ? latest.created_at : null) : null,
    lastError: typeof latest.error_message === "string" ? latest.error_message : null,
    coverage: typeof latest.coverage_note === "string" ? latest.coverage_note : "Kick collector coverage note unavailable.",
    note: latest.state === "error"
      ? "Latest Kick collector run failed."
      : "Kick collector is polling livestreams && storing top-viewer snapshots.",
    knownLimitations: [
      "Top 100 livestream polling only.",
      "Coverage note is required because platform total can exceed observed rows.",
      "Webhook-based activity is not wired yet."
    ]
  }
}

async function getHeatmapPayload(env: Env): Promise<CollectorHeatmapPayload> {
  const latest = await getLatestRun(env.DB)

  if (!latest) {
    return {
      source: "worker",
      platform: "kick",
      state: "unconfigured",
      lastUpdated: null,
      coverage: "Kick collector worker exists, but no run has completed yet.",
      note: "No Kick snapshot is stored yet.",
      nodes: [],
      summary: {
        activeStreams: 0,
        totalViewersObserved: 0,
        strongestMomentumStream: null,
        highestActivityStream: null,
        platformTotalCount: null
      }
    }
  }

  const latestRunId = Number(latest.id)
  const latestNodes = Number.isFinite(latestRunId) ? await getLatestNodes(env.DB, latestRunId) : []
  const latestObservedCount = typeof latest.observed_count === "number"
    ? latest.observed_count
    : Number(latest.observed_count ?? 0)
  const latestIsUsable = latest.state !== "error" && latestObservedCount > 0 && latestNodes.length > 0

  const selectedRun = latestIsUsable ? latest : await getLatestUsableRun(env.DB)
  const selectedRunId = Number(selectedRun?.id)
  const nodes = !selectedRun || !Number.isFinite(selectedRunId)
    ? []
    : (latestIsUsable && selectedRunId === latestRunId
      ? latestNodes
      : await getLatestNodes(env.DB, selectedRunId))

  if (!selectedRun || nodes.length === 0) {
    return {
      source: "worker",
      platform: "kick",
      state: latest.state === "error" ? "error" : "partial",
      lastUpdated: typeof latest.created_at === "string" ? latest.created_at : null,
      coverage: typeof latest.coverage_note === "string"
        ? latest.coverage_note
        : "Kick collector coverage note unavailable.",
      note: latest.state === "error"
        ? "Latest Kick heatmap collection failed."
        : "No non-empty observed window is available yet.",
      nodes: [],
      summary: {
        activeStreams: 0,
        totalViewersObserved: typeof latest.total_viewers_observed === "number"
          ? latest.total_viewers_observed
          : Number(latest.total_viewers_observed ?? 0),
        strongestMomentumStream: null,
        highestActivityStream: null,
        platformTotalCount: latest.platform_total_count === null
          ? null
          : (typeof latest.platform_total_count === "number"
            ? latest.platform_total_count
            : Number(latest.platform_total_count))
      }
    }
  }

  const topSlug = nodes.length > 0 ? nodes[0].slug : null
  const usedFallback = Number(selectedRun.id) !== latestRunId
  const state = usedFallback || selectedRun.state === "partial" ? "partial" : "live"

  return {
    source: "worker",
    platform: "kick",
    state,
    lastUpdated: typeof selectedRun.created_at === "string" ? selectedRun.created_at : null,
    coverage: typeof selectedRun.coverage_note === "string"
      ? selectedRun.coverage_note
      : "Kick collector coverage note unavailable.",
    note: usedFallback
      ? "Showing latest non-empty observed window."
      : "Kick heatmap is backed by top-viewer livestream polling.",
    nodes,
    summary: {
      activeStreams: nodes.length,
      totalViewersObserved: typeof selectedRun.total_viewers_observed === "number"
        ? selectedRun.total_viewers_observed
        : Number(selectedRun.total_viewers_observed ?? 0),
      strongestMomentumStream: topSlug,
      highestActivityStream: null,
      platformTotalCount: selectedRun.platform_total_count === null
        ? null
        : (typeof selectedRun.platform_total_count === "number"
          ? selectedRun.platform_total_count
          : Number(selectedRun.platform_total_count))
    }
  }
}

async function getDayFlowPayload(env: Env): Promise<CollectorDayFlowPayload> {
  const latest = await getLatestRun(env.DB)

  if (!latest) {
    return {
      source: "worker",
      platform: "kick",
      state: "unconfigured",
      lastUpdated: null,
      coverage: "Kick collector worker exists, but no run has completed yet.",
      note: "No Kick day-flow history is stored yet.",
      points: [],
      summary: {
        observedBuckets: 0,
        totalViewersObserved: 0,
        strongestWindow: null,
        strongestStreamer: null
      }
    }
  }

  const runsResult = await env.DB.prepare(`
    SELECT
      id,
      created_at,
      observed_count,
      total_viewers_observed,
      coverage_note,
      state
    FROM kick_runs
    WHERE state != 'error'
    ORDER BY id DESC
    LIMIT 120
  `).all()

  const runRows = Array.isArray(runsResult.results) ? runsResult.results as Record<string, unknown>[] : []
  const points: CollectorDayFlowPoint[] = []

  for (const row of runRows.reverse()) {
    const runId = Number(row.id)
    let strongestStreamer: string | null = null

    if (Number.isFinite(runId)) {
      const top = await env.DB.prepare(`
        SELECT slug
        FROM kick_livestream_snapshots
        WHERE run_id = ?
        ORDER BY viewer_count DESC, id ASC
        LIMIT 1
      `).bind(runId).first<Record<string, unknown>>()

      strongestStreamer = top && typeof top.slug === "string" ? top.slug : null
    }

    points.push({
      ts: typeof row.created_at === "string" ? row.created_at : "",
      totalViewersObserved: typeof row.total_viewers_observed === "number"
        ? row.total_viewers_observed
        : Number(row.total_viewers_observed ?? 0),
      observedCount: typeof row.observed_count === "number"
        ? row.observed_count
        : Number(row.observed_count ?? 0),
      strongestStreamer
    })
  }

  let strongestWindow: string | null = null
  let strongestStreamer: string | null = null
  let strongestViewers = -1

  for (const point of points) {
    if (point.totalViewersObserved > strongestViewers) {
      strongestViewers = point.totalViewersObserved
      strongestWindow = point.ts
      strongestStreamer = point.strongestStreamer
    }
  }

  const state = latest.state === "error" ? "error" : latest.state === "partial" ? "partial" : "live"

  return {
    source: "worker",
    platform: "kick",
    state,
    lastUpdated: typeof latest.created_at === "string" ? latest.created_at : null,
    coverage: typeof latest.coverage_note === "string" ? latest.coverage_note : "Kick collector coverage note unavailable.",
    note: points.length < 2
      ? "Kick day-flow is live, but more runs are needed for a richer history."
      : "Kick day-flow is backed by repeated top-viewer snapshots.",
    points,
    summary: {
      observedBuckets: points.length,
      totalViewersObserved: points.length > 0 ? points[points.length - 1].totalViewersObserved : 0,
      strongestWindow,
      strongestStreamer
    }
  }
}


async function getBattleLinesPayload(env: Env, url: URL): Promise<CollectorBattleLinesPayload> {
  const filters = parseBattleFilters(url)
  const latest = await getLatestRun(env.DB)

  if (!latest) {
    return buildBattleScaffold(
      filters,
      "unconfigured",
      "Kick collector worker exists, but no run has completed yet.",
      "No Kick rivalry history is stored yet.",
      null
    )
  }

  const dayStart = new Date(`${filters.date}T00:00:00.000Z`)
  const dayEndExclusive = new Date(dayStart.getTime() + DAY_MS)
  const queryStartDb = toDbSecond(dayStart)
  const queryEndDb = filters.day === "today" ? toDbSecond(new Date()) : toDbSecond(new Date(dayEndExclusive.getTime() - 1000))

  const usableRuns = await getUsableRunsInRange(env.DB, queryStartDb, queryEndDb)
  if (!usableRuns.length) {
    return buildBattleScaffold(
      filters,
      latest.state === "error" ? "error" : (filters.day === "today" ? "partial" : "empty"),
      typeof latest.coverage_note === "string" ? latest.coverage_note : "Kick collector coverage note unavailable.",
      latest.state === "error"
        ? "Latest Kick collector run failed."
        : "No non-empty observed windows are available for the selected date.",
      typeof latest.created_at === "string" ? latest.created_at : null
    )
  }

  const bucketToRun = new Map<string, Record<string, unknown>>()
  for (const run of usableRuns) {
    const createdAtIso = normalizeDbTimestamp(typeof run.created_at === "string" ? run.created_at : null)
    if (!createdAtIso) continue
    bucketToRun.set(floorToBattleBucket(createdAtIso, filters.bucketMinutes), run)
  }

  const latestObservedBucket = [...bucketToRun.keys()].sort().at(-1) ?? null
  const buckets = buildBattleBuckets(filters, latestObservedBucket)
  if (!buckets.length) {
    return buildBattleScaffold(
      filters,
      filters.day === "today" ? "partial" : "empty",
      typeof latest.coverage_note === "string" ? latest.coverage_note : "Kick collector coverage note unavailable.",
      "No bucketed rivalry history is available for the selected range.",
      typeof latest.created_at === "string" ? latest.created_at : null
    )
  }

  const selectedRunIds = Array.from(new Set(
    buckets
      .map((bucket) => bucketToRun.get(bucket))
      .filter((run): run is Record<string, unknown> => run !== undefined)
      .map((run) => Number(run.id))
      .filter((id) => Number.isFinite(id))
  ))

  const snapshotMaps = await getSnapshotsForRunIds(env.DB, selectedRunIds)
  const totalsBySlug = new Map<string, number>()

  for (const bucket of buckets) {
    const run = bucketToRun.get(bucket)
    const runId = Number(run?.id)
    if (!Number.isFinite(runId)) continue
    const snapshot = snapshotMaps.get(runId)
    if (!snapshot) continue
    for (const [slug, item] of snapshot.entries()) {
      totalsBySlug.set(slug, (totalsBySlug.get(slug) ?? 0) + item.viewers * filters.bucketMinutes)
    }
  }

  const rankedSlugs = [...totalsBySlug.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([slug]) => slug)
    .slice(0, filters.top)

  if (!rankedSlugs.length) {
    return buildBattleScaffold(
      filters,
      filters.day === "today" ? "partial" : "empty",
      typeof latest.coverage_note === "string" ? latest.coverage_note : "Kick collector coverage note unavailable.",
      "No qualifying visible streams were available after ranking.",
      typeof latest.created_at === "string" ? latest.created_at : null
    )
  }

  const titleBySlug = new Map<string, string>()
  const viewerPointsBySlug = new Map<string, number[]>()
  for (const slug of rankedSlugs) viewerPointsBySlug.set(slug, new Array<number>(buckets.length).fill(0))

  let lastUpdated: string | null = null
  let usedFallback = false

  for (let bucketIndex = 0; bucketIndex < buckets.length; bucketIndex += 1) {
    const bucket = buckets[bucketIndex]
    const run = bucketToRun.get(bucket)
    const runId = Number(run?.id)
    if (!Number.isFinite(runId)) continue

    if (bucketIndex === buckets.length - 1) {
      lastUpdated = typeof run?.created_at === "string" ? run.created_at : lastUpdated
      if (latest && Number(latest.id) !== runId) usedFallback = true
    }

    const snapshot = snapshotMaps.get(runId)
    if (!snapshot) continue

    for (const slug of rankedSlugs) {
      const entry = snapshot.get(slug)
      if (!entry) continue
      const series = viewerPointsBySlug.get(slug)
      if (!series) continue
      series[bucketIndex] = entry.viewers
      if (!titleBySlug.has(slug)) titleBySlug.set(slug, entry.title)
    }
  }

  const lines: CollectorBattleLine[] = rankedSlugs.map((slug, index) => {
    const viewerPoints = viewerPointsBySlug.get(slug) ?? new Array<number>(buckets.length).fill(0)
    const peakViewers = viewerPoints.reduce((best, value) => Math.max(best, value), 0)
    let risePerMin = 0
    for (let idx = 1; idx < viewerPoints.length; idx += 1) {
      risePerMin = Math.max(risePerMin, (viewerPoints[idx] - viewerPoints[idx - 1]) / filters.bucketMinutes)
    }

    const nonZero = viewerPoints.filter((value) => value > 0)
    const latestViewers = (() => {
      for (let idx = viewerPoints.length - 1; idx >= 0; idx -= 1) {
        if ((viewerPoints[idx] ?? 0) > 0) return viewerPoints[idx]
      }
      return viewerPoints[viewerPoints.length - 1] ?? 0
    })()

    const points =
      filters.metric === "indexed"
        ? (peakViewers > 0 ? viewerPoints.map((value) => Math.round((value / peakViewers) * 1000) / 10) : viewerPoints.map(() => 0))
        : [...viewerPoints]

    return {
      streamerId: slug,
      name: slug,
      color: BATTLE_COLORS[index % BATTLE_COLORS.length],
      points,
      viewerPoints,
      peakViewers,
      latestViewers,
      risePerMin,
      reversalCount: 0
    }
  })

  const payload = buildBattlePayloadFromLines({
    filters,
    buckets,
    lines,
    coverage: typeof latest.coverage_note === "string" ? latest.coverage_note : "Kick collector coverage note unavailable.",
    note: usedFallback
      ? "Showing latest non-empty observed windows."
      : "Kick rivalry radar is built from stored top-viewer snapshot history.",
    lastUpdated,
    state: filters.day === "today" ? "partial" : "complete"
  })

  if (!payload.filters) payload.filters = filters
  if (!payload.updatedAt) payload.updatedAt = payload.lastUpdated ?? undefined
  if (latest && payload.lastUpdated === null && typeof latest.created_at === "string") {
    payload.lastUpdated = latest.created_at
    payload.updatedAt = latest.created_at
  }

  return payload
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === "/status") return json(await getStatusPayload(env))
    if (url.pathname === "/heatmap") return json(await getHeatmapPayload(env))
    if (url.pathname === "/day-flow") return json(await getDayFlowPayload(env))
    if (url.pathname === "/battle-lines") return json(await getBattleLinesPayload(env, url))

    if (url.pathname === "/run-once") {
      try {
        await collectKickLivestreams(env)
        return json({ ok: true, ranAt: nowIso() })
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown collector error"
        await recordFailure(env.DB, message)
        return json({ ok: false, error: message }, { status: 500 })
      }
    }

    if (url.pathname === "/" || url.pathname === "") {
      return json({
        ok: true,
        service: "livefield-kick-collector",
        routes: ["/status", "/heatmap", "/day-flow", "/battle-lines", "/run-once"]
      })
    }

    return json(
      {
        ok: false,
        error: "not_found",
        message: "Use /status, /heatmap, /day-flow, /battle-lines, || /run-once."
      },
      { status: 404 }
    )
  },

  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    try {
      await collectKickLivestreams(env)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown collector error"
      await recordFailure(env.DB, message)
    }
  }
}
