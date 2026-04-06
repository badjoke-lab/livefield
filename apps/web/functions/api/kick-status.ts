type KickStatusPayload = {
  source: "api" | "worker"
  platform: "kick"
  state: "unconfigured" | "loading" | "live" | "partial" | "empty" | "error"
  collectorState: string
  lastAttempt: string | null
  lastSuccess: string | null
  lastFailure: string | null
  lastError: string | null
  coverage: string
  note: string
  knownLimitations: string[]
}

type EnvWithKickStatus = {
  KICK_COLLECTOR_STATUS_URL?: string
}

function scaffold(): KickStatusPayload {
  return {
    source: "api",
    platform: "kick",
    state: "unconfigured",
    collectorState: "not_wired",
    lastAttempt: null,
    lastSuccess: null,
    lastFailure: null,
    lastError: null,
    coverage: "Kick collector not wired yet.",
    note: "Kick Status is still in scaffold mode.",
    knownLimitations: [
      "Kick collector is not connected yet.",
      "No real Kick snapshot or rollup pipeline is available yet.",
      "This status response is a scaffold for future collector truth."
    ]
  }
}

export const onRequestGet: PagesFunction<EnvWithKickStatus> = async (context) => {
  const statusUrl = context.env.KICK_COLLECTOR_STATUS_URL?.trim()

  if (!statusUrl) {
    return new Response(JSON.stringify(scaffold()), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    })
  }

  try {
    const response = await fetch(statusUrl, {
      headers: { accept: "application/json" },
      cache: "no-store"
    })

    if (!response.ok) {
      throw new Error(`kick collector status returned ${response.status}`)
    }

    const payload = (await response.json()) as KickStatusPayload

    return new Response(JSON.stringify(payload), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    })
  } catch (error) {
    const fallback = scaffold()
    fallback.state = "error"
    fallback.collectorState = "error"
    fallback.note = error instanceof Error ? error.message : "Unknown Kick collector status bridge error"
    fallback.knownLimitations = [
      "Kick collector bridge request failed.",
      "The configured worker status URL did not return a usable response.",
      "Scaffold fallback is being used instead."
    ]

    return new Response(JSON.stringify(fallback), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    })
  }
}
