import { getCollectorConfig, type Env } from "../config/env"
import { minuteBucketFrom } from "../lib/time"
import { collectTwitchChatForStreams } from "../providers/twitch/chat-collector"
import { collectCurrentTwitchLive } from "../providers/twitch/current-live"
import type { TwitchStream } from "../providers/twitch/client"
import { insertMinuteSnapshot } from "../repositories/snapshots-repo"
import { upsertCollectorStatus } from "../repositories/status-repo"

type PreviousSnapshotRow = {
  payload_json: string
}

type PreviousSnapshotPayload = {
  streams?: Array<{ userId?: string; commentCount?: number | null }>
}

function clampLevel(value: number): 0 | 1 | 2 | 3 | 4 | 5 {
  const n = Math.max(0, Math.min(5, Math.round(value)))
  return n as 0 | 1 | 2 | 3 | 4 | 5
}

function computeAgitation(commentsPerMin: number, viewers: number): { agitationRaw: number; agitationLevel: 0 | 1 | 2 | 3 | 4 | 5 } {
  const viewerFloor = Math.max(viewers, 20)
  const normalized = commentsPerMin / (Math.pow(viewerFloor, 0.42) + 1)
  const scaled = Math.log1p(Math.max(0, normalized) * 1.45) * 3.2
  const level = clampLevel(scaled)
  return { agitationRaw: Number(scaled.toFixed(3)), agitationLevel: level }
}

async function getPreviousCommentCountByUserId(db: D1Database): Promise<Map<string, number>> {
  const row = await db
    .prepare(
      `SELECT payload_json
       FROM minute_snapshots
       WHERE provider = 'twitch'
       ORDER BY bucket_minute DESC
       LIMIT 1`
    )
    .first<PreviousSnapshotRow>()

  if (!row?.payload_json) return new Map()

  try {
    const payload = JSON.parse(row.payload_json) as PreviousSnapshotPayload
    const map = new Map<string, number>()
    for (const stream of payload.streams ?? []) {
      if (!stream?.userId || typeof stream.commentCount !== "number") continue
      map.set(stream.userId, stream.commentCount)
    }
    return map
  } catch {
    return new Map()
  }
}

function enrichStreamsWithChat(
  streams: TwitchStream[],
  chatByLogin: Map<string, { commentCount: number; commentsPerMin: number }>,
  observedLogins: Set<string>,
  previousCommentCountByUserId: Map<string, number>,
  chatAvailable: boolean,
  sampled: boolean,
  unavailableReason?: string
): TwitchStream[] {
  return streams.map((stream) => {
    const metrics = chatByLogin.get(stream.login.toLowerCase())
    if (!chatAvailable) {
      return {
        ...stream,
        commentCount: null,
        deltaComments: null,
        commentsPerMin: null,
        agitationRaw: null,
        agitationLevel: null,
        activityAvailable: false,
        activitySampled: sampled,
        activityUnavailableReason: unavailableReason ?? "chat unavailable"
      }
    }

    if (!metrics) {
      const observed = observedLogins.has(stream.login.toLowerCase())
      return {
        ...stream,
        commentCount: observed ? 0 : null,
        deltaComments: observed ? 0 : null,
        commentsPerMin: observed ? 0 : null,
        agitationRaw: observed ? 0 : null,
        agitationLevel: observed ? 0 : null,
        activityAvailable: observed,
        activitySampled: sampled,
        activityUnavailableReason: observed ? null : "not sampled in this window"
      }
    }

    const previousComments = previousCommentCountByUserId.get(stream.userId) ?? metrics.commentCount
    const deltaComments = Math.max(0, metrics.commentCount - previousComments)
    const agitation = computeAgitation(metrics.commentsPerMin, stream.viewerCount)

    return {
      ...stream,
      commentCount: metrics.commentCount,
      deltaComments,
      commentsPerMin: metrics.commentsPerMin,
      agitationRaw: agitation.agitationRaw,
      agitationLevel: agitation.agitationLevel,
      activityAvailable: true,
      activitySampled: sampled,
      activityUnavailableReason: null
    }
  })
}

export async function collectSnapshot(env: Env): Promise<void> {
  const startedAt = new Date()
  const attemptAt = startedAt.toISOString()

  try {
    const config = getCollectorConfig(env)
    const snapshot = await collectCurrentTwitchLive(env, config)
    const previousCommentCountByUserId = await getPreviousCommentCountByUserId(env.DB)
    const chatSnapshot = await collectTwitchChatForStreams(
      env,
      config,
      snapshot.streams.map((stream) => stream.login),
      startedAt
    )

    const streams = enrichStreamsWithChat(
      snapshot.streams,
      chatSnapshot.byLogin,
      chatSnapshot.observedLogins,
      previousCommentCountByUserId,
      chatSnapshot.available,
      chatSnapshot.sampled,
      chatSnapshot.reason
    )

    const totalViewers = streams.reduce((sum, stream) => sum + stream.viewerCount, 0)
    const aggregateCommentCount = chatSnapshot.available
      ? streams.reduce((sum, stream) => sum + (stream.commentCount ?? 0), 0)
      : null
    const aggregateCommentsPerMin = chatSnapshot.available
      ? streams.reduce((sum, stream) => sum + (stream.commentsPerMin ?? 0), 0)
      : null
    const aggregateAgitationRaw = chatSnapshot.available
      ? Number(streams.reduce((sum, stream) => sum + (stream.agitationRaw ?? 0), 0).toFixed(3))
      : null
    const aggregateAgitationLevel =
      chatSnapshot.available && streams.length > 0
        ? clampLevel((streams.reduce((sum, stream) => sum + (stream.agitationLevel ?? 0), 0) / streams.length))
        : null

    await insertMinuteSnapshot(env.DB, {
      provider: "twitch",
      bucketMinute: minuteBucketFrom(startedAt),
      collectedAt: snapshot.collectedAt,
      liveCount: streams.length,
      totalViewers,
      coveredPages: snapshot.coveredPages,
      hasMore: snapshot.hasMore,
      streams,
      commentCount: aggregateCommentCount,
      deltaComments: aggregateCommentsPerMin,
      commentsPerMin: aggregateCommentsPerMin,
      agitationRaw: aggregateAgitationRaw,
      agitationLevel: aggregateAgitationLevel
    })

    await upsertCollectorStatus(env.DB, {
      provider: "twitch",
      lastAttemptAt: attemptAt,
      lastSuccessAt: new Date().toISOString(),
      lastError: chatSnapshot.available
        ? (chatSnapshot.sampled ? "chat sampled: short-lived session" : undefined)
        : `chat unavailable: ${chatSnapshot.reason ?? "unknown"}`,
      coveredPages: snapshot.coveredPages,
      hasMore: snapshot.hasMore,
      lastLiveCount: streams.length,
      lastTotalViewers: totalViewers,
      chatState: chatSnapshot.available ? "running" : "unavailable",
      chatUnavailableReason: chatSnapshot.available
        ? (chatSnapshot.sampled ? "short-lived sampled session" : undefined)
        : chatSnapshot.reason
    })
  } catch (error) {
    await upsertCollectorStatus(env.DB, {
      provider: "twitch",
      lastAttemptAt: attemptAt,
      lastFailureAt: new Date().toISOString(),
      lastError: error instanceof Error ? error.message : "Unknown collection failure",
      chatState: "error",
      chatUnavailableReason: error instanceof Error ? error.message : "unknown chat failure"
    })

    throw error
  }
}
