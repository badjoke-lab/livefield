export const onRequestGet: PagesFunction = async () => {
  const body = {
    source: "api",
    platform: "kick",
    state: "unconfigured",
    lastUpdated: null,
    coverage: "Kick collector not wired yet.",
    note: "Kick Heatmap is still in scaffold mode.",
    nodes: [],
    summary: {
      activeStreams: 0,
      totalViewersObserved: 0,
      strongestMomentumStream: null,
      highestActivityStream: null
    }
  }

  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  })
}
