const body = {
  ok: true,
  source: "demo",
  tool: "battle-lines",
  updatedAt: new Date().toISOString(),
  lines: []
}

export const onRequestGet = async () =>
  new Response(JSON.stringify(body, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" }
  })
