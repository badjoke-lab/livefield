import { getCollectorConfig, type Env } from "../config/env"
import { minuteBucketFrom } from "../lib/time"
import { collectCurrentTwitchLive } from "../providers/twitch/current-live"
import { insertMinuteSnapshot } from "../repositories/snapshots-repo"
import { upsertCollectorStatus } from "../repositories/status-repo"

export async function collectSnapshot(env: Env): Promise<void> {
  const startedAt = new Date()
  const attemptAt = startedAt.toISOString()

  try {
    const config = getCollectorConfig(env)
    const snapshot = await collectCurrentTwitchLive(env, config)
    const totalViewers = snapshot.streams.reduce((sum, stream) => sum + stream.viewerCount, 0)

    await insertMinuteSnapshot(env.DB, {
      provider: "twitch",
      bucketMinute: minuteBucketFrom(startedAt),
      collectedAt: snapshot.collectedAt,
      liveCount: snapshot.streams.length,
      totalViewers,
      coveredPages: snapshot.coveredPages,
      hasMore: snapshot.hasMore,
      streams: snapshot.streams
    })

    await upsertCollectorStatus(env.DB, {
      provider: "twitch",
      lastAttemptAt: attemptAt,
      lastSuccessAt: new Date().toISOString(),
      lastError: undefined,
      coveredPages: snapshot.coveredPages,
      hasMore: snapshot.hasMore,
      lastLiveCount: snapshot.streams.length,
      lastTotalViewers: totalViewers
    })
  } catch (error) {
    await upsertCollectorStatus(env.DB, {
      provider: "twitch",
      lastAttemptAt: attemptAt,
      lastFailureAt: new Date().toISOString(),
      lastError: error instanceof Error ? error.message : "Unknown collection failure"
    })

    throw error
  }
}
