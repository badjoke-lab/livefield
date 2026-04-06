type KickBattleLinesPayload = {
  source: "api" | "worker"
  platform: "kick"
  state: "unconfigured" | "loading" | "live" | "partial" | "empty" | "error"
  lastUpdated: string | null
  coverage: string
  note: string
  pairs: Array<unknown>
  summary: {
    observedPairs: number
    strongestPair: string | null
    strongestReversalWindow: string | null
    strongestPressureSide: string | null
  }
}

type EnvWithKickBattleLines = {
  KICK_COLLECTOR_BATTLE_LINES_URL?: string
}

function scaffold(): KickBattleLinesPayload {
  return {
    source: "api",
    platform: "kick",
    state: "unconfigured",
    lastUpdated: null,
    coverage: "Kick collector not wired yet.",
    note: "Kick Rivalry Radar is still in scaffold mode.",
    pairs: [],
    summary: {
      observedPairs: 0,
      strongestPair: null,
      strongestReversalWindow: null,
      strongestPressureSide: null
    }
  }
}

export const onRequestGet: PagesFunction<EnvWithKickBattleLines> = async (context) => {
  const battleLinesUrl = context.env.KICK_COLLECTOR_BATTLE_LINES_URL?.trim()

  if (!battleLinesUrl) {
    return new Response(JSON.stringify(scaffold()), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    })
  }

  try {
    const response = await fetch(battleLinesUrl, {
      headers: { accept: "application/json" },
      cache: "no-store"
    })

    if (!response.ok) {
      throw new Error(`kick collector battle-lines returned ${response.status}`)
    }

    const payload = (await response.json()) as KickBattleLinesPayload

    return new Response(JSON.stringify(payload), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    })
  } catch (error) {
    const fallback = scaffold()
    fallback.state = "error"
    fallback.note = error instanceof Error ? error.message : "Unknown Kick collector battle-lines bridge error"
    fallback.coverage = "Kick Rivalry Radar scaffold bridge failed."

    return new Response(JSON.stringify(fallback), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    })
  }
}
