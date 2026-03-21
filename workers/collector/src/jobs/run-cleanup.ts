import type { Env } from "../config/env"
import { cleanupOldData } from "../pipelines/cleanup-old-data"

export async function runCleanup(env: Env): Promise<void> {
  await cleanupOldData(env.DB)
}
