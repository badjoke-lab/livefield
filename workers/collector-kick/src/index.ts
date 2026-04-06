type CollectorStatusPayload = {
  source: "worker"
  platform: "kick"
  state: "unconfigured"
  collectorState: "not_wired"
  lastAttempt: null
  lastSuccess: null
  lastFailure: null
  lastError: null
  coverage: string
  note: string
  knownLimitations: string[]
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

function getStatusPayload(): CollectorStatusPayload {
  return {
    source: "worker",
    platform: "kick",
    state: "unconfigured",
    collectorState: "not_wired",
    lastAttempt: null,
    lastSuccess: null,
    lastFailure: null,
    lastError: null,
    coverage: "Kick collector worker scaffold exists, but real collection is not wired yet.",
    note: "This worker currently exposes status only. No Kick provider, cron, D1 writes, or rollups are connected yet.",
    knownLimitations: [
      "No Kick provider is implemented yet.",
      "No cron trigger is configured yet.",
      "No D1 snapshot writes are configured yet.",
      "This worker is only a scaffold for future collector truth."
    ]
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === "/status") {
      return json(getStatusPayload())
    }

    if (url.pathname === "/" || url.pathname === "") {
      return json({
        ok: true,
        service: "livefield-kick-collector",
        routes: ["/status"]
      })
    }

    return json(
      {
        ok: false,
        error: "not_found",
        message: "Use /status for the current collector scaffold response."
      },
      { status: 404 }
    )
  },

  async scheduled(): Promise<void> {
    // Kick cron collection is intentionally not wired yet.
  }
}
