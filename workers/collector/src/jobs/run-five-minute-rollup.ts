import type { Env } from "../config/env"
import { buildBattleLines10mRollup, buildBattleLines5mRollup } from "../pipelines/build-battle-lines-rollup"
import { buildDayflow10mRollup, buildDayflow5mRollup } from "../pipelines/build-day-flow-rollup"
import { buildDailyStreamSummaries, buildHeatmap5mFrames } from "../pipelines/build-heatmap-payload"

function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10)
}

export async function runFiveMinuteRollup(env: Env, now = new Date()): Promise<void> {
  const day = dayKey(now)
  await Promise.all([
    buildDayflow5mRollup(env.DB, day, now),
    buildBattleLines5mRollup(env.DB, day, now),
    buildHeatmap5mFrames(env.DB, day, now)
  ])

  await Promise.all([
    buildDayflow10mRollup(env.DB, now),
    buildBattleLines10mRollup(env.DB, now),
    buildDailyStreamSummaries(env.DB, now)
  ])
}
