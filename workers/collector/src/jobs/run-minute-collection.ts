import type { Env } from "../config/env"
import { collectSnapshot } from "../pipelines/collect-snapshot"

export async function runMinuteCollection(env: Env): Promise<void> {
  await collectSnapshot(env)
}
