import type { PagesFunction } from "@cloudflare/workers-types"

type Env = {
  DB?: {
    prepare: (sql: string) => {
      first: <T>() => Promise<T | null>
      bind: (...params: unknown[]) => { first: <T>() => Promise<T | null> }
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
  updated_at: string | null
}

type SnapshotRow = {
  bucket_minute: string
  collected_at: string
  live_count: number
  total_viewers: number
  covered_pages: number
  has_more: number
}

type StatusState = "real" | "stale" | "empty" | "demo" | "error"

function minutesSince(iso: string | null, now: Date): number | null {
  if (!iso) return null
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return null
  return Math.floor((now.getTime() - parsed.getTime()) / 60_000)
}

function resolveSourceMode(lastSuccessAt: string | null, freshnessMinutes: number | null): "real" | "stale" | "demo" {
  if (!lastSuccessAt) return "demo"
  if (freshnessMinutes === null) return "stale"
  if (freshnessMinutes <= 2) return "real"
  return "stale"
}

function resolveStatusState(sourceMode: "real" | "stale" | "demo", latestSnapshot: SnapshotRow | null): StatusState {
  if (sourceMode === "demo") return "demo"
  if (!latestSnapshot) return "empty"
  if (sourceMode === "stale") return "stale"
  return "real"
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const now = new Date()
  const db = context.env.DB

  if (!db) {
    return new Response(
      JSON.stringify(
        {
          ok: true,
          state: "demo" as StatusState,
          sourceMode: "demo",
          collectorState: "unconfigured",
          freshness: {
            minutesSinceSuccess: null,
            isFresh: false,
            thresholdMinutes: 2
          },
          collector: null,
          latestSnapshot: null,
          coverage: {
            observedCount: 0,
            coveredPages: 0,
            hasMore: false
          },
          updatedAt: now.toISOString()
        },
        null,
        2
      ),
      { headers: { "content-type": "application/json; charset=utf-8" } }
    )
  }

  try {
    const [collector, latestSnapshot] = await Promise.all([
      db
        .prepare(
          `SELECT provider, last_attempt_at, last_success_at, last_failure_at, last_error, covered_pages, has_more, last_live_count, last_total_viewers, updated_at
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
    const sourceMode = resolveSourceMode(collector?.last_success_at ?? null, minutesSinceSuccess)
    const state = resolveStatusState(sourceMode, latestSnapshot ?? null)
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

    const body = {
      ok: true,
      state,
      sourceMode,
      collectorState,
      freshness: {
        minutesSinceSuccess,
        isFresh: minutesSinceSuccess !== null && minutesSinceSuccess <= 2,
        thresholdMinutes: 2
      },
      collector: collector
        ? {
            provider: collector.provider,
            lastAttemptAt: collector.last_attempt_at,
            lastSuccessAt: collector.last_success_at,
            lastFailureAt: collector.last_failure_at,
            lastError: collector.last_error,
            lastLiveCount: collector.last_live_count,
            lastTotalViewers: collector.last_total_viewers
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
        : null,
      coverage: {
        observedCount: latestSnapshot?.live_count ?? 0,
        coveredPages: latestSnapshot?.covered_pages ?? 0,
        hasMore: latestSnapshot?.has_more === 1
      },
      updatedAt: now.toISOString()
    }

    return new Response(JSON.stringify(body, null, 2), {
      headers: { "content-type": "application/json; charset=utf-8" }
    })
  } catch (error) {
    return new Response(
      JSON.stringify(
        {
          ok: false,
          state: "error" as StatusState,
          sourceMode: "demo",
          collectorState: "error",
          freshness: {
            minutesSinceSuccess: null,
            isFresh: false,
            thresholdMinutes: 2
          },
          collector: null,
          latestSnapshot: null,
          coverage: {
            observedCount: 0,
            coveredPages: 0,
            hasMore: false
          },
          error: error instanceof Error ? error.message : "Unknown status query error",
          updatedAt: now.toISOString()
        },
        null,
        2
      ),
      {
        status: 500,
        headers: { "content-type": "application/json; charset=utf-8" }
      }
    )
  }
}
