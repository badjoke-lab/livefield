import type { Env } from "../config/env"
import { collectSnapshot } from "../pipelines/collect-snapshot"
import { getLatestSnapshotMeta } from "../repositories/snapshots-repo"
import { insertCollectorRun, upsertCollectorStatus } from "../repositories/status-repo"
import { runFiveMinuteRollup, type RollupStepName } from "./run-five-minute-rollup"

export type MinuteCollectionOptions = {
  mode?: "full" | "snapshot-only"
  step?: RollupStepName
}

export type MinuteCollectionResult = {
  ok: boolean
  mode: "full" | "snapshot-only" | "step-only"
  step?: RollupStepName
  snapshotDurationMs: number
  rollupDurationMs?: number
  totalDurationMs: number
}

export async function runMinuteCollection(env: Env, options: MinuteCollectionOptions = {}): Promise<MinuteCollectionResult> {
  const startedAtMs = Date.now()
  const attemptAt = new Date().toISOString()
  const mode = options.step ? "step-only" : options.mode ?? "full"
  try {
    const snapshotStartedAt = Date.now()
    await collectSnapshot(env)
    const snapshotDurationMs = Date.now() - snapshotStartedAt

    let rollupDurationMs: number | undefined
    if (mode !== "snapshot-only") {
      const rollupStartedAt = Date.now()
      await runFiveMinuteRollup(env, {
        step: options.step
      })
      rollupDurationMs = Date.now() - rollupStartedAt
    }

    const succeededAt = new Date().toISOString()
    const latestSnapshot = await getLatestSnapshotMeta(env.DB)

    await insertCollectorRun(env.DB, {
      provider: "twitch",
      runAt: succeededAt,
      status: "success",
      liveCount: typeof latestSnapshot?.live_count === "number" ? latestSnapshot.live_count : null,
      totalViewers: typeof latestSnapshot?.total_viewers === "number" ? latestSnapshot.total_viewers : null,
      coveredPages: typeof latestSnapshot?.covered_pages === "number" ? latestSnapshot.covered_pages : null,
      hasMore: typeof latestSnapshot?.has_more === "number" ? latestSnapshot.has_more > 0 : null
    })

    return {
      ok: true,
      mode,
      step: options.step,
      snapshotDurationMs,
      rollupDurationMs,
      totalDurationMs: Date.now() - startedAtMs
    }
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
      lastAttemptAt: attemptAt,
      lastFailureAt: failedAt,
      lastError: message,
      chatState: "error",
      chatUnavailableReason: message
    })

    throw error
  }
}
