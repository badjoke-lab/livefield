const body = {
  ok: true,
  source: "demo",
  collector: "idle",
  api: "ready",
  updatedAt: new Date().toISOString()
}

export const onRequestGet = async () =>
  new Response(JSON.stringify(body, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" }
  })
