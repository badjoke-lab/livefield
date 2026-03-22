import type { Env } from "../config/env"
import { collectSnapshot } from "../pipelines/collect-snapshot"
import { getLatestSnapshotMeta } from "../repositories/snapshots-repo"
import { insertCollectorRun, upsertCollectorStatus } from "../repositories/status-repo"
import { runFiveMinuteRollup } from "./run-five-minute-rollup"

export async function runMinuteCollection(env: Env): Promise<void> {
  await collectSnapshot(env)

  try {
    await runFiveMinuteRollup(env)
  } catch (error) {
    const failedAt = new Date().toISOString()
    const message = error instanceof Error ? error.message : "rollup execution failed"
    const latestSnapshot = await getLatestSnapshotMeta(env.DB)

    await insertCollectorRun(env.DB, {
      provider: "twitch",
      runAt: failedAt,
      status: "failure",
      errorCode: "rollup_failed",
      errorMessage: message,
      liveCount: typeof latestSnapshot?.live_count === "number" ? latestSnapshot.live_count : null,
      totalViewers: typeof latestSnapshot?.total_viewers === "number" ? latestSnapshot.total_viewers : null,
      coveredPages: typeof latestSnapshot?.covered_pages === "number" ? latestSnapshot.covered_pages : null,
      hasMore: typeof latestSnapshot?.has_more === "number" ? latestSnapshot.has_more > 0 : null
    })

    await upsertCollectorStatus(env.DB, {
      provider: "twitch",
      lastAttemptAt: failedAt,
      lastFailureAt: failedAt,
      lastError: message,
      chatState: "error",
      chatUnavailableReason: message
    })

    throw error
  }
}
