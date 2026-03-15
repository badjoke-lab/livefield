export interface Env {
  DB: D1Database
  TWITCH_CLIENT_ID: string
  TWITCH_APP_TOKEN: string
  BOT_USER_TOKEN?: string
  BOT_LOGIN?: string
  TWITCH_COLLECTION_MAX_PAGES?: string
  TWITCH_COLLECTION_PAGE_SIZE?: string
  TWITCH_CHAT_MAX_CHANNELS?: string
  TWITCH_CHAT_JOIN_INTERVAL_MS?: string
}

export interface CollectorConfig {
  maxPages: number
  pageSize: number
  chatMaxChannels: number
  chatJoinIntervalMs: number
}

const DEFAULT_MAX_PAGES = 2
const DEFAULT_PAGE_SIZE = 100
const DEFAULT_CHAT_MAX_CHANNELS = 30
const DEFAULT_CHAT_JOIN_INTERVAL_MS = 1200

function parseBoundedInt(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value ?? "", 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

export function getCollectorConfig(env: Env): CollectorConfig {
  return {
    maxPages: parseBoundedInt(env.TWITCH_COLLECTION_MAX_PAGES, DEFAULT_MAX_PAGES, 1, 10),
    pageSize: parseBoundedInt(env.TWITCH_COLLECTION_PAGE_SIZE, DEFAULT_PAGE_SIZE, 20, 100),
    chatMaxChannels: parseBoundedInt(env.TWITCH_CHAT_MAX_CHANNELS, DEFAULT_CHAT_MAX_CHANNELS, 5, 100),
    chatJoinIntervalMs: parseBoundedInt(env.TWITCH_CHAT_JOIN_INTERVAL_MS, DEFAULT_CHAT_JOIN_INTERVAL_MS, 300, 5000)
  }
}
