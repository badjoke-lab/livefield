import type { Env } from "../config/env"
import { collectSnapshot } from "../pipelines/collect-snapshot"
import { runFiveMinuteRollup } from "./run-five-minute-rollup"

export async function runMinuteCollection(env: Env): Promise<void> {
  await collectSnapshot(env)
  await runFiveMinuteRollup(env)
}
