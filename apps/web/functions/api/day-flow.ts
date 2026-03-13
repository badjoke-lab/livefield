const body = {
  ok: true,
  source: "demo",
  tool: "day-flow",
  updatedAt: new Date().toISOString(),
  streams: []
}

export const onRequestGet = async () =>
  new Response(JSON.stringify(body, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" }
  })
