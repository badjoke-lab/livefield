export type KickStatusScaffoldPayload = {
  source: "api"
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

export async function getKickStatusScaffoldPayload(signal?: AbortSignal): Promise<KickStatusScaffoldPayload> {
  const response = await fetch("/api/kick-status", {
    headers: { accept: "application/json" },
    cache: "no-store",
    signal
  })

  if (!response.ok) {
    throw new Error(`kick status api returned ${response.status}`)
  }

  return (await response.json()) as KickStatusScaffoldPayload
}
