import type { Env } from "../../config/env"

interface TwitchStreamsResponse {
  data: Array<{
    id: string
    user_id: string
    user_login: string
    user_name: string
    game_id: string
    game_name: string
    title: string
    viewer_count: number
    started_at: string
    language: string
    thumbnail_url: string
    is_mature: boolean
  }>
  pagination?: { cursor?: string }
}

export interface TwitchStream {
  id: string
  userId: string
  login: string
  displayName: string
  gameId: string
  gameName: string
  title: string
  viewerCount: number
  startedAt: string
  language: string
}

export interface TwitchStreamsPage {
  streams: TwitchStream[]
  cursor?: string
}

function requiredHeaders(env: Env): HeadersInit {
  if (!env.TWITCH_CLIENT_ID || !env.TWITCH_APP_TOKEN) {
    throw new Error("TWITCH_CLIENT_ID and TWITCH_APP_TOKEN are required")
  }

  return {
    "Client-Id": env.TWITCH_CLIENT_ID,
    Authorization: `Bearer ${env.TWITCH_APP_TOKEN}`
  }
}

export async function fetchTwitchStreamsPage(
  env: Env,
  pageSize: number,
  cursor?: string
): Promise<TwitchStreamsPage> {
  const url = new URL("https://api.twitch.tv/helix/streams")
  url.searchParams.set("first", String(pageSize))
  if (cursor) url.searchParams.set("after", cursor)

  const response = await fetch(url, { headers: requiredHeaders(env) })
  if (!response.ok) {
    throw new Error(`Twitch streams request failed: ${response.status}`)
  }

  const parsed = (await response.json()) as TwitchStreamsResponse
  return {
    streams: parsed.data.map((item) => ({
      id: item.id,
      userId: item.user_id,
      login: item.user_login,
      displayName: item.user_name,
      gameId: item.game_id,
      gameName: item.game_name,
      title: item.title,
      viewerCount: item.viewer_count,
      startedAt: item.started_at,
      language: item.language
    })),
    cursor: parsed.pagination?.cursor
  }
}
