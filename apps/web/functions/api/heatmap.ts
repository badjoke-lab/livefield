import demoPayload from "../../../../fixtures/demo/heatmap.json"

export const onRequestGet = async () =>
  new Response(JSON.stringify(demoPayload, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" }
  })
