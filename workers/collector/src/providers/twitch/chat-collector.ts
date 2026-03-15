import type { CollectorConfig, Env } from "../../config/env"
import { minuteBucketFrom } from "../../lib/time"

export interface TwitchChatMetric {
  commentCount: number
  commentsPerMin: number
}

export interface TwitchChatSnapshot {
  available: boolean
  reason?: string
  bucketMinute: string
  byLogin: Map<string, TwitchChatMetric>
}

type ChannelCounter = {
  minute: string
  minuteCount: number
  totalCount: number
}

class TwitchChatCollector {
  private socket: WebSocket | null = null
  private connected = false
  private connecting = false
  private lastError: string | null = null
  private joinedChannels = new Set<string>()
  private channelCounters = new Map<string, ChannelCounter>()
  private reconnectTimer: number | null = null

  private resetConnectionState(): void {
    this.connected = false
    this.connecting = false
    this.socket = null
    this.joinedChannels = new Set()
  }

  private onMessage(raw: string): void {
    if (raw.startsWith("PING")) {
      this.socket?.send(raw.replace("PING", "PONG"))
      return
    }

    const lines = raw.split("\r\n")
    for (const line of lines) {
      if (!line || !line.includes(" PRIVMSG #")) continue
      const channelMatch = line.match(/ PRIVMSG #([^\s]+) /)
      if (!channelMatch?.[1]) continue
      const login = channelMatch[1].toLowerCase()
      const nowMinute = minuteBucketFrom(new Date())
      const current = this.channelCounters.get(login)
      if (!current || current.minute !== nowMinute) {
        this.channelCounters.set(login, {
          minute: nowMinute,
          minuteCount: 1,
          totalCount: (current?.totalCount ?? 0) + 1
        })
        continue
      }

      current.minuteCount += 1
      current.totalCount += 1
    }
  }

  private scheduleReconnect(env: Env): void {
    if (this.reconnectTimer !== null) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      void this.ensureConnected(env)
    }, 3_000) as unknown as number
  }

  async ensureConnected(env: Env): Promise<void> {
    if (this.connected || this.connecting) return
    if (!env.BOT_USER_TOKEN || !env.BOT_LOGIN) {
      this.lastError = "BOT_USER_TOKEN or BOT_LOGIN is missing"
      return
    }

    this.connecting = true

    try {
      const socket = new WebSocket("wss://irc-ws.chat.twitch.tv:443")
      socket.addEventListener("open", () => {
        this.connected = true
        this.connecting = false
        this.lastError = null
        socket.send(`PASS oauth:${env.BOT_USER_TOKEN}`)
        socket.send(`NICK ${env.BOT_LOGIN}`)
        socket.send("CAP REQ :twitch.tv/commands twitch.tv/tags")
      })
      socket.addEventListener("message", (event) => {
        this.onMessage(String(event.data ?? ""))
      })
      socket.addEventListener("close", () => {
        this.resetConnectionState()
        this.lastError = "chat socket closed"
        this.scheduleReconnect(env)
      })
      socket.addEventListener("error", () => {
        this.lastError = "chat socket error"
      })

      this.socket = socket
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : "chat connect failed"
      this.resetConnectionState()
      this.scheduleReconnect(env)
    } finally {
      this.connecting = false
    }
  }

  async syncJoinedChannels(logins: string[], env: Env, config: CollectorConfig): Promise<void> {
    if (!this.connected || !this.socket) return
    const target = new Set(logins.slice(0, config.chatMaxChannels).map((v) => v.toLowerCase()))

    for (const joined of this.joinedChannels) {
      if (!target.has(joined)) {
        this.socket.send(`PART #${joined}`)
        this.joinedChannels.delete(joined)
      }
    }

    for (const login of target) {
      if (this.joinedChannels.has(login)) continue
      this.socket.send(`JOIN #${login}`)
      this.joinedChannels.add(login)
      await new Promise((resolve) => setTimeout(resolve, config.chatJoinIntervalMs))
    }
  }

  collectMinuteSnapshot(now: Date): TwitchChatSnapshot {
    const bucketMinute = minuteBucketFrom(now)
    if (!this.connected) {
      return {
        available: false,
        reason: this.lastError ?? "chat collector not connected",
        bucketMinute,
        byLogin: new Map()
      }
    }

    const byLogin = new Map<string, TwitchChatMetric>()
    for (const [login, counter] of this.channelCounters.entries()) {
      byLogin.set(login, {
        commentCount: counter.totalCount,
        commentsPerMin: counter.minute === bucketMinute ? counter.minuteCount : 0
      })
    }

    return {
      available: true,
      bucketMinute,
      byLogin
    }
  }
}

const globalCollector = new TwitchChatCollector()

export async function collectTwitchChatForStreams(
  env: Env,
  config: CollectorConfig,
  streamLogins: string[],
  now: Date
): Promise<TwitchChatSnapshot> {
  await globalCollector.ensureConnected(env)
  await globalCollector.syncJoinedChannels(streamLogins, env, config)
  return globalCollector.collectMinuteSnapshot(now)
}
