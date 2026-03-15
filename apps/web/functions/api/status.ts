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
      degradationNote: "Serving demo status because Cloudflare D1 binding `DB` is missing.",
      knownLimitations: ["No collector telemetry without D1 binding.", "No live Twitch snapshot can be verified in this mode."],
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
          `SELECT provider, last_attempt_at, last_success_at, last_failure_at, last_error, covered_pages, has_more, last_live_count, last_total_viewers, chat_state, chat_unavailable_reason
           FROM collector_status
           WHERE provider = 'twitch'
           LIMIT 1`
        )
        .first<CollectorStatusRow>(),
      db
        .prepare(
          `SELECT bucket_minute, collected_at, live_count, total_viewers, covered_pages, has_more
           FROM minute_snapshots
           WHERE provider = 'twitch'
           ORDER BY bucket_minute DESC
           LIMIT 1`
        )
        .first<SnapshotRow>()
    ])

    const minutesSinceSuccess = minutesSince(collector?.last_success_at ?? null, now)
    const isFresh = minutesSinceSuccess !== null && minutesSinceSuccess <= FRESHNESS_MINUTES
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
      ? `Observed ${latestSnapshot.live_count} streams across ${latestSnapshot.covered_pages} page(s)${latestSnapshot.has_more === 1 ? " with remaining pages." : "."}`
      : "No minute snapshot rows are available yet."

    const chatNote = collector?.chat_state === "running"
      ? "Chat ingest: running."
      : `Chat ingest unavailable${collector?.chat_unavailable_reason ? ` (${collector.chat_unavailable_reason})` : "."}`

    const degradationNote =
      state === "live"
        ? "Collector telemetry is fresh and snapshot coverage is available."
        : state === "partial"
          ? `Collector is partial. ${(latestSnapshot?.has_more ?? 0) === 1 ? "streams has_more=true. " : ""}${chatNote}`
          : state === "stale"
            ? `Collector snapshot exists but freshness exceeded ${FRESHNESS_MINUTES} minutes.`
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
          ? "Heatmap activity uses Twitch chat comments/min with viewer-relative scaling."
          : "Heatmap activity is unavailable when Twitch chat ingest is down.",
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
