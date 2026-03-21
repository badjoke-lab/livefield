import type { Env } from "../config/env"
import { buildBattleLines5mRollup } from "../pipelines/build-battle-lines-rollup"
import { buildDayflow5mRollup } from "../pipelines/build-day-flow-rollup"
import { buildHeatmap5mFrames } from "../pipelines/build-heatmap-payload"

function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10)
}

export async function runFiveMinuteRollup(env: Env, now = new Date()): Promise<void> {
  const day = dayKey(now)
  await Promise.all([
    buildDayflow5mRollup(env.DB, day),
    buildBattleLines5mRollup(env.DB, day),
    buildHeatmap5mFrames(env.DB, day)
  ])
}
