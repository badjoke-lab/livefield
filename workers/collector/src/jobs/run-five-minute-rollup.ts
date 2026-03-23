import type { Env } from "../config/env"
import { buildBattleLines10mRollup, buildBattleLines5mRollup } from "../pipelines/build-battle-lines-rollup"
import { buildDayflow10mRollup, buildDayflow5mRollup } from "../pipelines/build-day-flow-rollup"
import { buildDailyStreamSummaries, buildHeatmap5mFrames } from "../pipelines/build-heatmap-payload"

function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10)
}

type RollupTaskResult = {
  step: string
  ok: boolean
  error?: string
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    const stackLine = error.stack?.split("\n")[1]?.trim()
    return stackLine ? `${error.message} (${stackLine})` : error.message
  }
  return String(error)
}

async function runRollupStep(step: string, fn: () => Promise<void>): Promise<RollupTaskResult> {
  try {
    await fn()
    return { step, ok: true }
  } catch (error) {
    return {
      step,
      ok: false,
      error: formatError(error)
    }
  }
}

export async function runFiveMinuteRollup(env: Env, now = new Date()): Promise<void> {
  const day = dayKey(now)
  const fiveMinute: RollupTaskResult[] = []
  fiveMinute.push(await runRollupStep("dayflow_bands_5m", async () => buildDayflow5mRollup(env.DB, day, now)))
  fiveMinute.push(
    await runRollupStep("battlelines_series_5m", async () => buildBattleLines5mRollup(env.DB, day, now))
  )
  fiveMinute.push(await runRollupStep("heatmap_frames_5m", async () => buildHeatmap5mFrames(env.DB, day, now)))

  const tenMinute: RollupTaskResult[] = []
  const dayflow5mOk = fiveMinute.some((step) => step.step === "dayflow_bands_5m" && step.ok)
  const battle5mOk = fiveMinute.some((step) => step.step === "battlelines_series_5m" && step.ok)

  if (dayflow5mOk) {
    tenMinute.push(await runRollupStep("dayflow_bands_10m", async () => buildDayflow10mRollup(env.DB, now)))
  }

  if (battle5mOk) {
    tenMinute.push(await runRollupStep("battlelines_series_10m", async () => buildBattleLines10mRollup(env.DB, now)))
  }

  tenMinute.push(await runRollupStep("daily_stream_summaries", async () => buildDailyStreamSummaries(env.DB, now)))

  const failures = [...fiveMinute, ...tenMinute].filter((step) => !step.ok)
  if (failures.length > 0) {
    throw new Error(
      `rollup_failed: ${failures.map((failure) => `${failure.step}: ${failure.error ?? "unknown"}`).join(" | ")}`
    )
  }
}
