import type { CollectorConfig, Env } from "../../config/env"
import { minuteBucketFrom } from "../../lib/time"

export interface TwitchChatMetric {
  commentCount: number
  commentsPerMin: number
}

export interface TwitchChatSnapshot {
  available: boolean
  sampled: boolean
  reason?: string
  bucketMinute: string
  byLogin: Map<string, TwitchChatMetric>
  observedLogins: Set<string>
}

type ConnectionContext = {
  socket: WebSocket
  closePromise: Promise<void>
}

type ChannelCounter = {
  totalCount: number
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parsePrivmsgLogin(line: string): string | null {
  if (!line.includes(" PRIVMSG #")) return null
  const channelMatch = line.match(/ PRIVMSG #([^\s]+) /)
  return channelMatch?.[1]?.toLowerCase() ?? null
}

function normalizeLogins(logins: string[], maxChannels: number): string[] {
  const deduped = new Set<string>()
  for (const login of logins) {
    const normalized = login.trim().toLowerCase()
    if (!normalized) continue
    deduped.add(normalized)
    if (deduped.size >= maxChannels) break
  }
  return [...deduped]
}

async function openTwitchIrcSocket(env: Env): Promise<ConnectionContext> {
  const socket = new WebSocket("wss://irc-ws.chat.twitch.tv:443")

  const connected = new Promise<void>((resolve, reject) => {
    const openHandler = () => {
      cleanup()
      resolve()
    }
    const errorHandler = () => {
      cleanup()
      reject(new Error("chat socket error"))
    }
    const cleanup = () => {
      socket.removeEventListener("open", openHandler)
      socket.removeEventListener("error", errorHandler)
    }

    socket.addEventListener("open", openHandler)
    socket.addEventListener("error", errorHandler)
  })

  const closePromise = new Promise<void>((resolve) => {
    socket.addEventListener("close", () => resolve(), { once: true })
  })

  await connected

  socket.send(`PASS oauth:${env.BOT_USER_TOKEN}`)
  socket.send(`NICK ${env.BOT_LOGIN}`)
  socket.send("CAP REQ :twitch.tv/commands twitch.tv/tags")

  return { socket, closePromise }
}

function parseJoinAckLogin(line: string): string | null {
  const match = line.match(/:(?:[^\s]+)\s+JOIN\s+#([^\s]+)/)
  return match?.[1]?.toLowerCase() ?? null
}

function collectFromSocket(
  socket: WebSocket,
  counters: Map<string, ChannelCounter>,
  channels: Set<string>,
  observedLogins: Set<string>
): () => void {
  const messageHandler = (event: MessageEvent) => {
    const raw = String(event.data ?? "")
    if (raw.startsWith("PING")) {
      socket.send(raw.replace("PING", "PONG"))
      return
    }

    const lines = raw.split("\r\n")
    for (const line of lines) {
      const joinedLogin = parseJoinAckLogin(line)
      if (joinedLogin && channels.has(joinedLogin)) {
        observedLogins.add(joinedLogin)
      }

      const login = parsePrivmsgLogin(line)
      if (!login || !channels.has(login)) continue
      observedLogins.add(login)

      const current = counters.get(login) ?? { totalCount: 0 }
      current.totalCount += 1
      counters.set(login, current)
    }
  }

  socket.addEventListener("message", messageHandler)
  return () => socket.removeEventListener("message", messageHandler)
}

export async function collectTwitchChatForStreams(
  env: Env,
  config: CollectorConfig,
  streamLogins: string[],
  now: Date
): Promise<TwitchChatSnapshot> {
  const bucketMinute = minuteBucketFrom(now)
  const logins = normalizeLogins(streamLogins, config.chatMaxChannels)

  if (!env.BOT_USER_TOKEN || !env.BOT_LOGIN) {
    return {
      available: false,
      sampled: true,
      reason: "BOT_USER_TOKEN or BOT_LOGIN is missing",
      bucketMinute,
      byLogin: new Map(),
      observedLogins: new Set()
    }
  }

  if (!logins.length) {
    return {
      available: true,
      sampled: true,
      bucketMinute,
      byLogin: new Map(),
      observedLogins: new Set()
    }
  }

  let connection: ConnectionContext | null = null
  const counters = new Map<string, ChannelCounter>()

  try {
    connection = await openTwitchIrcSocket(env)
    const trackedChannels = new Set(logins)
    const observedLogins = new Set<string>()
    const unsubscribe = collectFromSocket(connection.socket, counters, trackedChannels, observedLogins)

    for (const login of logins) {
      connection.socket.send(`JOIN #${login}`)
      await delay(config.chatJoinIntervalMs)
    }

    await delay(config.chatObserveMs)
    unsubscribe()

    const byLogin = new Map<string, TwitchChatMetric>()
    for (const login of logins) {
      const commentCount = counters.get(login)?.totalCount ?? 0
      const commentsPerMin = Number(((commentCount * 60_000) / config.chatObserveMs).toFixed(3))
      byLogin.set(login, { commentCount, commentsPerMin })
    }

    return {
      available: true,
      sampled: true,
      bucketMinute,
      byLogin,
      observedLogins
    }
  } catch (error) {
    return {
      available: false,
      sampled: true,
      reason: error instanceof Error ? error.message : "chat sampling failed",
      bucketMinute,
      byLogin: new Map(),
      observedLogins: new Set()
    }
  } finally {
    if (connection?.socket && (connection.socket.readyState === WebSocket.OPEN || connection.socket.readyState === WebSocket.CONNECTING)) {
      connection.socket.close(1000, "sample complete")
      await connection.closePromise.catch(() => undefined)
    }
  }
}
