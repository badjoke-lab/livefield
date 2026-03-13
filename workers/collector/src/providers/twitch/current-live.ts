import type { CollectorConfig, Env } from "../../config/env"
import { fetchTwitchStreamsPage, type TwitchStream } from "./client"

export interface TwitchLiveSnapshot {
  streams: TwitchStream[]
  coveredPages: number
  hasMore: boolean
  collectedAt: string
}

export async function collectCurrentTwitchLive(env: Env, config: CollectorConfig): Promise<TwitchLiveSnapshot> {
  const streams: TwitchStream[] = []
  let cursor: string | undefined
  let coveredPages = 0

  while (coveredPages < config.maxPages) {
    const page = await fetchTwitchStreamsPage(env, config.pageSize, cursor)
    coveredPages += 1
    streams.push(...page.streams)
    cursor = page.cursor

    if (!cursor || page.streams.length === 0) {
      break
    }
  }

  return {
    streams,
    coveredPages,
    hasMore: Boolean(cursor),
    collectedAt: new Date().toISOString()
  }
}
