export async function onRequest(context: { next: () => Promise<Response> }) {
  const response = await context.next()
  const headers = new Headers(response.headers)
  headers.set("Cache-Control", "no-store")
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}
