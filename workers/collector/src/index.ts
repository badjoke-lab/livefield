export interface Env {}

export default {
  async fetch(_request: Request, _env: Env): Promise<Response> {
    return new Response(
      JSON.stringify(
        {
          ok: true,
          worker: "twitcasting-livefield-collector",
          mode: "placeholder",
          now: new Date().toISOString()
        },
        null,
        2
      ),
      {
        headers: {
          "content-type": "application/json; charset=utf-8"
        }
      }
    )
  },

  async scheduled(controller: ScheduledController, _env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      Promise.resolve().then(() => {
        console.log("[collector] scheduled tick", controller.cron, new Date(controller.scheduledTime).toISOString())
      })
    )
  }
}
