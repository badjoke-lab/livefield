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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === "/status") {
      const [collector, latestSnapshot] = await Promise.all([
        getCollectorStatus(env.DB),
        getLatestSnapshotMeta(env.DB)
      ])

      return jsonResponse({
        ok: true,
        provider: "twitch",
        collector,
        latestSnapshot
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
