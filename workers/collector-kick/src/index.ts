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

type CollectorBattleLinesPayload = {
  source: "worker"
  platform: "kick"
  state: "unconfigured" | "live" | "partial" | "error"
  lastUpdated: string | null
  coverage: string
  note: string
  pairs: CollectorBattlePair[]
  summary: {
    observedPairs: number
    strongestPair: string | null
    strongestReversalWindow: string | null
    strongestPressureSide: string | null
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
  const absGap = Math.abs(currentGap)

  if (previousGap !== null && currentGap !== 0 && previousGap !== 0 && Math.sign(currentGap) !== Math.sign(previousGap)) {
    return "reversal_watch"
  }

  if (absGap <= 500) {
    return "neck_and_neck"
  }

  if (previousGap !== null && Math.abs(previousGap) - absGap >= 500) {
    return "closing_fast"
  }

  return "clear_lead"
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
      : "Kick collector is polling livestreams and storing top-viewer snapshots.",
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

async function getBattleLinesPayload(env: Env): Promise<CollectorBattleLinesPayload> {
  const latest = await getLatestRun(env.DB)

  if (!latest) {
    return {
      source: "worker",
      platform: "kick",
      state: "unconfigured",
      lastUpdated: null,
      coverage: "Kick collector worker exists, but no run has completed yet.",
      note: "No Kick rivalry history is stored yet.",
      pairs: [],
      summary: {
        observedPairs: 0,
        strongestPair: null,
        strongestReversalWindow: null,
        strongestPressureSide: null
      }
    }
  }

  const runs = await getLatestUsableRuns(env.DB, 2)

  if (runs.length < 2) {
    return {
      source: "worker",
      platform: "kick",
      state: "partial",
      lastUpdated: typeof latest.created_at === "string" ? latest.created_at : null,
      coverage: typeof latest.coverage_note === "string"
        ? latest.coverage_note
        : "Kick collector coverage note unavailable.",
      note: "Kick rivalry radar needs two non-empty observed windows.",
      pairs: [],
      summary: {
        observedPairs: 0,
        strongestPair: null,
        strongestReversalWindow: null,
        strongestPressureSide: null
      }
    }
  }

  const currentRun = runs[0]
  const previousRun = runs[1]

  const currentId = Number(currentRun.id)
  const previousId = Number(previousRun.id)

  const currentTop = await getTop10Map(env.DB, currentId)
  const previousTop = await getTop10Map(env.DB, previousId)

  const currentEntries = Array.from(currentTop.entries()).sort((a, b) => b[1] - a[1])
  const pairs: CollectorBattlePair[] = []

  for (let i = 0; i < currentEntries.length - 1; i += 1) {
    const [leftSlug, leftViewers] = currentEntries[i]
    const [rightSlug, rightViewers] = currentEntries[i + 1]
    const currentGap = leftViewers - rightViewers

    const prevLeft = previousTop.get(leftSlug)
    const prevRight = previousTop.get(rightSlug)
    const previousGap = prevLeft !== undefined && prevRight !== undefined ? prevLeft - prevRight : null
    const swing = previousGap !== null ? currentGap - previousGap : null
    const label = classifyPair(currentGap, previousGap)

    pairs.push({
      leftSlug,
      rightSlug,
      leftViewers,
      rightViewers,
      viewerGap: currentGap,
      previousGap,
      swing,
      label
    })
  }

  const strongest = pairs.length > 0 ? [...pairs].sort((a, b) => {
    const aScore =
      (a.label === "reversal_watch" ? 1000000 : 0) +
      (a.label === "closing_fast" ? 500000 : 0) -
      Math.abs(a.viewerGap)
    const bScore =
      (b.label === "reversal_watch" ? 1000000 : 0) +
      (b.label === "closing_fast" ? 500000 : 0) -
      Math.abs(b.viewerGap)
    return bScore - aScore
  })[0] : null

  const latestId = Number(latest.id)
  const usedFallback = Number.isFinite(latestId) && Number(currentRun.id) !== latestId
  const state = usedFallback || currentRun.state === "partial" ? "partial" : "live"

  return {
    source: "worker",
    platform: "kick",
    state,
    lastUpdated: typeof currentRun.created_at === "string" ? currentRun.created_at : null,
    coverage: typeof currentRun.coverage_note === "string"
      ? currentRun.coverage_note
      : "Kick collector coverage note unavailable.",
    note: usedFallback
      ? "Showing latest non-empty observed windows."
      : "Kick rivalry radar is using snapshot-to-snapshot viewer pressure only. Webhook activity is not wired yet.",
    pairs,
    summary: {
      observedPairs: pairs.length,
      strongestPair: strongest ? `${strongest.leftSlug} vs ${strongest.rightSlug}` : null,
      strongestReversalWindow: typeof currentRun.created_at === "string" ? currentRun.created_at : null,
      strongestPressureSide: strongest
        ? strongest.viewerGap >= 0
          ? strongest.leftSlug
          : strongest.rightSlug
        : null
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === "/status") return json(await getStatusPayload(env))
    if (url.pathname === "/heatmap") return json(await getHeatmapPayload(env))
    if (url.pathname === "/day-flow") return json(await getDayFlowPayload(env))
    if (url.pathname === "/battle-lines") return json(await getBattleLinesPayload(env))

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
        message: "Use /status, /heatmap, /day-flow, /battle-lines, or /run-once."
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
