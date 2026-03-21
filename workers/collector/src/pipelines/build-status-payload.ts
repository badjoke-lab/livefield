import { getCollectorStatus } from "../repositories/status-repo"

export async function buildStatusPayload(db: D1Database): Promise<Record<string, unknown>> {
  const collector = await getCollectorStatus(db)

  return {
    provider: "twitch",
    collector
  }
}
