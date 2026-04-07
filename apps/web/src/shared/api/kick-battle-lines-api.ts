export type KickBattleLinesScaffoldPayload = {
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

export async function getKickBattleLinesScaffoldPayload(signal?: AbortSignal): Promise<KickBattleLinesScaffoldPayload> {
  const response = await fetch("/api/kick-battle-lines", {
    headers: { accept: "application/json" },
    cache: "no-store",
    signal
  })

  if (!response.ok) {
    throw new Error(`kick battle-lines api returned ${response.status}`)
  }

  return (await response.json()) as KickBattleLinesScaffoldPayload
}
