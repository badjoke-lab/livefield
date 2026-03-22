import { resolveApiState, type ApiSource, type ApiState } from "./_shared/state"

type Env = {
  DB?: {
    prepare: (sql: string) => {
      first: <T>() => Promise<T | null>
    }
  }
}

type CollectorStatusRow = {
  provider: string
  last_attempt_at: string | null
  last_success_at: string | null
  last_failure_at: string | null
  last_error: string | null
  covered_pages: number | null
  has_more: number | null
  last_live_count: number | null
  last_total_viewers: number | null
  chat_state: "running" | "unavailable" | "error" | null
  chat_unavailable_reason: string | null
}

type SnapshotRow = {
  bucket_minute: string
  collected_at: string
  live_count: number
  total_viewers: number
  covered_pages: number
  has_more: number
  payload_json: string
}

type StatusPayload = {
  ok: boolean
  state: ApiState
  source: ApiSource
  lastUpdated: string
  coverageNote: string
  degradationNote: string
  knownLimitations: string[]
  collectorState: "unconfigured" | "idle" | "running" | "failing" | "error"
  freshness: {
    minutesSinceSuccess: number | null
    isFresh: boolean
    thresholdMinutes: number
  }
  collector: {
    provider: string
    lastAttemptAt: string | null
    lastSuccessAt: string | null
    lastFailureAt: string | null
    lastError: string | null
    lastLiveCount: number | null
    lastTotalViewers: number | null
    chatState: "running" | "unavailable" | "error" | "unknown"
    chatUnavailableReason: string | null
  } | null
  latestSnapshot: {
    bucketMinute: string
    collectedAt: string
    liveCount: number
    totalViewers: number
    coveredPages: number
    hasMore: boolean
  } | null
}

type SnapshotPayload = {
  streams?: Array<{
    activityAvailable?: boolean
    activitySampled?: boolean
    activityUnavailableReason?: string | null
  }>
}

type ActivityCoverage = {
  sampled: number
  available: number
  unavailable: number
}

function getActivityCoverage(snapshot: SnapshotRow | null): ActivityCoverage | null {
  if (!snapshot?.payload_json) return null

  try {
    const payload = JSON.parse(snapshot.payload_json) as SnapshotPayload
    const streams = payload.streams ?? []
    if (!streams.length) return null

    let sampled = 0
    let available = 0
    let unavailable = 0
    for (const stream of streams) {
      if (stream.activitySampled !== false) sampled += 1
      if (stream.activityAvailable === true) available += 1
      else unavailable += 1
    }

    return { sampled, available, unavailable }
  } catch {
    return null
  }
}

const FRESHNESS_MINUTES = 2

function minutesSince(iso: string | null, now: Date): number | null {
  if (!iso) return null
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return null
  return Math.floor((now.getTime() - parsed.getTime()) / 60_000)
}

function json(body: StatusPayload, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  })
}

export const onRequest = async (context: { env: Env; request: Request }) => {
  const now = new Date()
  const db = context.env.DB

  if (!db) {
    return json({
      ok: true,
      state: "demo",
      source: "demo",
      lastUpdated: now.toISOString(),
      coverageNote: "DB binding is not configured, so collector-backed coverage cannot be measured.",
      degradationNote: "Demo mode: Cloudflare D1 binding `DB` is missing, so status cannot verify collector or snapshot health.",
      knownLimitations: [
        "No collector telemetry without D1 binding.",
        "No live Twitch snapshot can be verified in demo mode.",
        "Use this mode only for UI smoke checks."
      ],
      collectorState: "unconfigured",
      freshness: { minutesSinceSuccess: null, isFresh: false, thresholdMinutes: FRESHNESS_MINUTES },
      collector: null,
      latestSnapshot: null
    })
  }

  try {
    const [collector, latestSnapshot] = await Promise.all([
      db
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
             cs.chat_unavailable_reason
           FROM (SELECT 'twitch' AS provider) p
           LEFT JOIN collector_status cs ON cs.provider = p.provider
           LIMIT 1`
        )
        .first<CollectorStatusRow>(),
      db
        .prepare(
          `SELECT bucket_minute, collected_at, live_count, total_viewers, covered_pages, has_more, payload_json
           FROM minute_snapshots
           WHERE provider = 'twitch'
           ORDER BY bucket_minute DESC
           LIMIT 1`
        )
        .first<SnapshotRow>()
    ])

    const minutesSinceSuccess = minutesSince(collector?.last_success_at ?? null, now)
    const isFresh = minutesSinceSuccess !== null && minutesSinceSuccess <= FRESHNESS_MINUTES
    const activityCoverage = getActivityCoverage(latestSnapshot ?? null)
    const chatPartial = collector?.chat_state !== "running"
    const isPartial = (latestSnapshot?.has_more ?? 0) === 1 || chatPartial
    const source: ApiSource = "api"

    const state = resolveApiState({
      source,
      hasSnapshot: Boolean(latestSnapshot),
      isFresh,
      isPartial,
      hasError: false
    })

    const hasRecentFailure = Boolean(
      collector?.last_failure_at &&
        collector.last_success_at &&
        new Date(collector.last_failure_at).getTime() > new Date(collector.last_success_at).getTime()
    )

    const collectorState = !collector
      ? "idle"
      : hasRecentFailure
        ? "failing"
        : collector.last_success_at
          ? "running"
          : collector.last_failure_at
            ? "error"
            : "idle"

    const coverageNote = latestSnapshot
      ? `Observed window currently includes ${latestSnapshot.live_count} streams across ${latestSnapshot.covered_pages} page(s)${latestSnapshot.has_more === 1 ? " with additional pages not yet collected for this run." : "."}${activityCoverage ? ` Activity samples are available for ${activityCoverage.available}/${latestSnapshot.live_count} streams.` : ""}`
      : "No minute snapshot rows are available yet."

    const sampledChat = collector?.chat_unavailable_reason?.includes("sampled") ?? false
    const chatNote = collector?.chat_state === "running"
      ? sampledChat
        ? "Chat ingest: running in sampled short-lived mode."
        : "Chat ingest: running."
      : `Chat ingest is not running${collector?.chat_unavailable_reason ? ` (${collector.chat_unavailable_reason})` : "."}`

    const activityReliability = !activityCoverage || !latestSnapshot || latestSnapshot.live_count === 0
      ? "Heatmap activity reliability: unknown."
      : activityCoverage.available >= Math.ceil(latestSnapshot.live_count * 0.6)
        ? `Heatmap activity reliability: moderate (${activityCoverage.available}/${latestSnapshot.live_count} streams with sampled activity).`
        : activityCoverage.available > 0
          ? `Heatmap activity reliability: limited (${activityCoverage.available}/${latestSnapshot.live_count} streams with sampled activity).`
          : "Heatmap activity reliability: unavailable (viewer + momentum only)."

    const degradationNote =
      state === "live"
        ? "Collector telemetry is fresh for the current observed window."
        : state === "partial"
          ? `Partial coverage: ${(latestSnapshot?.has_more ?? 0) === 1 ? "snapshot pagination is incomplete for this run. " : ""}${chatNote} ${activityReliability}`
          : state === "stale"
            ? `Snapshot exists but freshness exceeded ${FRESHNESS_MINUTES} minutes, so this view may lag current Twitch conditions.`
            : state === "empty"
              ? "Collector telemetry exists but no snapshot rows are available yet."
              : "Unknown status degradation."

    return json({
      ok: true,
      state,
      source,
      lastUpdated: latestSnapshot?.collected_at ?? collector?.last_attempt_at ?? now.toISOString(),
      coverageNote,
      degradationNote,
      knownLimitations: [
        collector?.chat_state === "running"
          ? sampledChat
            ? "Heatmap activity uses sampled Twitch chat comments/min from short-lived collection windows."
            : "Heatmap activity uses Twitch chat comments/min with viewer-relative scaling."
          : "Heatmap activity is unavailable when Twitch chat ingest is down.",
        activityCoverage && latestSnapshot
          ? `Sample coverage: sampled=${activityCoverage.sampled}, available=${activityCoverage.available}, unavailable=${activityCoverage.unavailable}.`
          : "Sample coverage is not available from latest snapshot payload.",
        "Heatmap remains viewers + momentum first; activity is a secondary signal."
      ],
      collectorState,
      freshness: {
        minutesSinceSuccess,
        isFresh,
        thresholdMinutes: FRESHNESS_MINUTES
      },
      collector: collector
        ? {
            provider: collector.provider,
            lastAttemptAt: collector.last_attempt_at,
            lastSuccessAt: collector.last_success_at,
            lastFailureAt: collector.last_failure_at,
            lastError: collector.last_error,
            lastLiveCount: collector.last_live_count,
            lastTotalViewers: collector.last_total_viewers,
            chatState: collector.chat_state ?? "unknown",
            chatUnavailableReason: collector.chat_unavailable_reason
          }
        : null,
      latestSnapshot: latestSnapshot
        ? {
            bucketMinute: latestSnapshot.bucket_minute,
            collectedAt: latestSnapshot.collected_at,
            liveCount: latestSnapshot.live_count,
            totalViewers: latestSnapshot.total_viewers,
            coveredPages: latestSnapshot.covered_pages,
            hasMore: latestSnapshot.has_more === 1
          }
        : null
    })
  } catch {
    return json(
      {
        ok: false,
        state: "error",
        source: "api",
        lastUpdated: now.toISOString(),
        coverageNote: "Collector coverage is unavailable due to status query failure.",
        degradationNote: "Failed to read collector/snapshot rows from D1.",
        knownLimitations: ["Status query failed before collector state could be evaluated."],
        collectorState: "error",
        freshness: { minutesSinceSuccess: null, isFresh: false, thresholdMinutes: FRESHNESS_MINUTES },
        collector: null,
        latestSnapshot: null
      },
      500
    )
  }
}
