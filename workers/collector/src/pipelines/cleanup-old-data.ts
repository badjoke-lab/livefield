import {
  RETENTION_COLLECTOR_RUNS_DAYS,
  RETENTION_DAILY_SUMMARY_DAYS,
  RETENTION_HISTORY_10M_DAYS,
  RETENTION_HISTORY_5M_DAYS,
  RETENTION_HOT_RAW_HOURS
} from "../config/limits"
import { minuteBucketFrom } from "../lib/time"
import { pruneDailySummariesBefore, pruneHistory10mBefore, pruneHistory5mBefore } from "../repositories/rollups-repo"
import { pruneMinuteSnapshotsBefore } from "../repositories/snapshots-repo"
import { pruneCollectorRunsBefore } from "../repositories/status-repo"

export interface CleanupResult {
  hotRawDeleted: number
  collectorRunsDeleted: number
  history5mDeleted: number
  history10mDeleted: number
  dailySummariesDeleted: number
}

function minusHours(base: Date, hours: number): string {
  return minuteBucketFrom(new Date(base.getTime() - hours * 60 * 60_000))
}

function minusDays(base: Date, days: number): string {
  return minuteBucketFrom(new Date(base.getTime() - days * 24 * 60 * 60_000))
}

export async function pruneHotRaw(db: D1Database, now: Date): Promise<{ hotRawDeleted: number; collectorRunsDeleted: number }> {
  const hotRawCutoff = minusHours(now, RETENTION_HOT_RAW_HOURS)
  const collectorRunsCutoff = minusDays(now, RETENTION_COLLECTOR_RUNS_DAYS)

  const [hotRawDeleted, collectorRunsDeleted] = await Promise.all([
    pruneMinuteSnapshotsBefore(db, hotRawCutoff),
    pruneCollectorRunsBefore(db, collectorRunsCutoff)
  ])

  return { hotRawDeleted, collectorRunsDeleted }
}

export async function pruneHistory(db: D1Database, now: Date): Promise<{ history5mDeleted: number; history10mDeleted: number; dailySummariesDeleted: number }> {
  const cutoff5m = minusDays(now, RETENTION_HISTORY_5M_DAYS)
  const cutoff10m = minusDays(now, RETENTION_HISTORY_10M_DAYS)
  const cutoffDaily = now.toISOString().slice(0, 10)
  const dailyBefore = new Date(`${cutoffDaily}T00:00:00.000Z`)
  dailyBefore.setUTCDate(dailyBefore.getUTCDate() - RETENTION_DAILY_SUMMARY_DAYS)

  const [pruned5m, pruned10m, dailySummariesDeleted] = await Promise.all([
    pruneHistory5mBefore(db, cutoff5m),
    pruneHistory10mBefore(db, cutoff10m),
    pruneDailySummariesBefore(db, dailyBefore.toISOString().slice(0, 10))
  ])

  return {
    history5mDeleted: pruned5m.reduce((sum, row) => sum + row.deleted, 0),
    history10mDeleted: pruned10m.reduce((sum, row) => sum + row.deleted, 0),
    dailySummariesDeleted
  }
}

export async function maybePromote5mTo10m(_db: D1Database, _now: Date): Promise<void> {
  // foundation skeleton for next PR
}

export async function cleanupOldData(db: D1Database, now = new Date()): Promise<CleanupResult> {
  const hotRaw = await pruneHotRaw(db, now)
  const history = await pruneHistory(db, now)

  return {
    hotRawDeleted: hotRaw.hotRawDeleted,
    collectorRunsDeleted: hotRaw.collectorRunsDeleted,
    history5mDeleted: history.history5mDeleted,
    history10mDeleted: history.history10mDeleted,
    dailySummariesDeleted: history.dailySummariesDeleted
  }
}
