import type { Env } from "../config/env"
import { buildBattleLines10mRollup, buildBattleLines5mRollup } from "../pipelines/build-battle-lines-rollup"
import { buildDayflow10mRollup, buildDayflow5mRollup } from "../pipelines/build-day-flow-rollup"
import { buildDailyStreamSummaries, buildHeatmap5mFrames } from "../pipelines/build-heatmap-payload"

function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10)
}

type RollupTaskResult = {
  step: RollupStepName
  ok: boolean
  error?: string
  durationMs: number
}

export const ROLLUP_STEP_NAMES = [
  "dayflow_bands_5m",
  "battlelines_series_5m",
  "heatmap_frames_5m",
  "dayflow_bands_10m",
  "battlelines_series_10m",
  "daily_stream_summaries"
] as const

export type RollupStepName = (typeof ROLLUP_STEP_NAMES)[number]

export function isRollupStepName(value: string): value is RollupStepName {
  return (ROLLUP_STEP_NAMES as readonly string[]).includes(value)
}

export type RollupRunSummary = {
  ok: boolean
  day: string
  steps: RollupTaskResult[]
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    const stackLine = error.stack?.split("\n")[1]?.trim()
    return stackLine ? `${error.message} (${stackLine})` : error.message
  }
  return String(error)
}

async function runRollupStep(step: RollupStepName, fn: () => Promise<void>): Promise<RollupTaskResult> {
  const startedAt = Date.now()
  try {
    await fn()
    return { step, ok: true, durationMs: Date.now() - startedAt }
  } catch (error) {
    return {
      step,
      ok: false,
      error: formatError(error),
      durationMs: Date.now() - startedAt
    }
  }
}

export async function runFiveMinuteRollup(
  env: Env,
  options: { now?: Date; step?: RollupStepName } = {}
): Promise<RollupRunSummary> {
  const now = options.now ?? new Date()
  const day = dayKey(now)
  const steps: RollupTaskResult[] = []

  const runSelectedStep = async (step: RollupStepName): Promise<RollupTaskResult> => {
    switch (step) {
      case "dayflow_bands_5m":
        return runRollupStep(step, async () => buildDayflow5mRollup(env.DB, day, now))
      case "battlelines_series_5m":
        return runRollupStep(step, async () => buildBattleLines5mRollup(env.DB, day, now))
      case "heatmap_frames_5m":
        return runRollupStep(step, async () => buildHeatmap5mFrames(env.DB, day, now))
      case "dayflow_bands_10m":
        return runRollupStep(step, async () => buildDayflow10mRollup(env.DB, now))
      case "battlelines_series_10m":
        return runRollupStep(step, async () => buildBattleLines10mRollup(env.DB, now))
      case "daily_stream_summaries":
        return runRollupStep(step, async () => buildDailyStreamSummaries(env.DB, now))
    }
  }

  if (options.step) {
    steps.push(await runSelectedStep(options.step))
  } else {
    const fiveMinute: RollupTaskResult[] = []
    fiveMinute.push(await runSelectedStep("dayflow_bands_5m"))
    fiveMinute.push(await runSelectedStep("battlelines_series_5m"))
    fiveMinute.push(await runSelectedStep("heatmap_frames_5m"))
    steps.push(...fiveMinute)

    const dayflow5mOk = fiveMinute.some((step) => step.step === "dayflow_bands_5m" && step.ok)
    const battle5mOk = fiveMinute.some((step) => step.step === "battlelines_series_5m" && step.ok)

    if (dayflow5mOk) {
      steps.push(await runSelectedStep("dayflow_bands_10m"))
    }

    if (battle5mOk) {
      steps.push(await runSelectedStep("battlelines_series_10m"))
    }

    steps.push(await runSelectedStep("daily_stream_summaries"))
  }

  const failures = steps.filter((step) => !step.ok)
  if (failures.length > 0) {
    throw new Error(
      `rollup_failed: ${failures.map((failure) => `${failure.step}: ${failure.error ?? "unknown"}`).join(" | ")}`
    )
  }

  return {
    ok: true,
    day,
    steps
  }
}
