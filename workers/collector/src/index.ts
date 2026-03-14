import type { Env } from "./config/env"
import { runMinuteCollection } from "./jobs/run-minute-collection"
import { getLatestSnapshotMeta } from "./repositories/snapshots-repo"
import { getCollectorStatus } from "./repositories/status-repo"

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  })
}

function minutesSince(iso: string | undefined, now: Date): number | null {
  if (!iso) return null
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return null
  return Math.floor((now.getTime() - parsed.getTime()) / 60_000)
}

function resolveSourceMode(lastSuccessAt: string | undefined, freshnessMinutes: number | null): "real" | "stale" | "demo" {
  if (!lastSuccessAt) return "demo"
  if (freshnessMinutes === null) return "stale"
  return freshnessMinutes <= 2 ? "real" : "stale"
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === "/status") {
      const now = new Date()
      const [collector, latestSnapshot] = await Promise.all([getCollectorStatus(env.DB), getLatestSnapshotMeta(env.DB)])

      const lastSuccessAt = typeof collector?.last_success_at === "string" ? collector.last_success_at : undefined
      const lastFailureAt = typeof collector?.last_failure_at === "string" ? collector.last_failure_at : undefined
      const freshnessMinutes = minutesSince(lastSuccessAt, now)
      const sourceMode = resolveSourceMode(lastSuccessAt, freshnessMinutes)
      const collectorState = !collector
        ? "idle"
        : lastFailureAt && (!lastSuccessAt || new Date(lastFailureAt).getTime() > new Date(lastSuccessAt).getTime())
          ? "failing"
          : lastSuccessAt
            ? "running"
            : "idle"

      return jsonResponse({
        ok: true,
        provider: "twitch",
        sourceMode,
        collectorState,
        freshness: {
          minutesSinceSuccess: freshnessMinutes,
          isFresh: freshnessMinutes !== null && freshnessMinutes <= 2,
          thresholdMinutes: 2
        },
        collector,
        latestSnapshot,
        updatedAt: now.toISOString()
      })
    }

    if (url.pathname === "/collect" && request.method === "POST") {
      try {
        await runMinuteCollection(env)
        return jsonResponse({ ok: true, triggered: "manual" })
      } catch (error) {
        return jsonResponse(
          {
            ok: false,
            error: error instanceof Error ? error.message : "manual collection failed"
          },
          500
        )
      }
    }

    return jsonResponse({ ok: true, worker: "livefield-collector", provider: "twitch" })
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      runMinuteCollection(env).catch((error) => {
        console.error("[collector] scheduled collection failed", {
          cron: controller.cron,
          scheduledTime: new Date(controller.scheduledTime).toISOString(),
          error: error instanceof Error ? error.message : error
        })
      })
    )
  }
}
