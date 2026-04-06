export const onRequestGet: PagesFunction = async () => {
  const body = {
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

  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  })
}
