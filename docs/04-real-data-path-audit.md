# Real data path audit (Twitch MVP backbone)

## Scope
This audit checks whether Livefield currently has real Twitch data end-to-end, and identifies where demo fallback is still in use.

## What is already real
- **Real Twitch provider exists** in `workers/collector/src/providers/twitch/client.ts` and calls Twitch Helix `GET /streams` with `Client-Id` + bearer token.
- **Collector is wired on a 1-minute cron** in `workers/collector/wrangler.toml` (`* * * * *`) and calls `runMinuteCollection`.
- **Minute collection pipeline runs** through `collectSnapshot`:
  - calls Twitch provider,
  - computes aggregate counts,
  - writes `minute_snapshots` in D1,
  - updates `collector_status` in D1.
- **D1 schema supports real snapshots + status** in `db/migrations/0001_init.sql`.

## What was still mock/stub/demo before this PR
- **Web `/api/status` was placeholder-only** and did not read D1 collector/snapshot state (`source: "demo"`, static values).
- **Status page UI was placeholder-only** (non-blocking for data backbone but not yet connected to live status API).
- **Feature APIs still have explicit demo fallback paths** when DB is missing, empty, or parse fails.

## Changes in this PR
- Made snapshot writes **idempotent per provider+minute** with upsert semantics in `minute_snapshots`.
- Replaced web `/api/status` placeholder with **real D1-backed status** reporting:
  - last attempt / last success / last failure / last error,
  - freshness (`minutesSinceSuccess`, threshold, fresh/stale),
  - latest snapshot coverage (`observedCount`, `coveredPages`, `hasMore`),
  - `sourceMode` (`real` / `stale` / `demo`),
  - explicit collector state (`idle` / `running` / `failing` / `error` / `unconfigured`).
- Upgraded collector worker `/status` with matching freshness/source semantics to make operational truth visible from the collector itself.

## Still deferred (explicit)
- **Status UI wiring** (`/status` page) still renders placeholders; this task focuses on real data backbone and status API truth.
- **Rollup/cache pipelines** are still separate follow-ups.
- **Demo fallback remains** by design and is now explicitly surfaced through `sourceMode` instead of pretending to be live.

## PR7 page-level audit: real consumption vs fallback

| Page | Primary real path status | Fallback status | Remaining gaps |
| --- | --- | --- | --- |
| Heatmap (`/heatmap` via `/api/heatmap`) | **Real by default** when D1 exists and latest snapshot contains English Twitch streams; uses current+previous snapshots for momentum. | Demo only when DB binding is missing or payload parse fails. Empty snapshots now return explicit `source: api`, `nodes: []` (`state-like empty`) instead of demo. | Activity/comment signals are still unavailable from Twitch snapshot-only data (explicitly labeled). |
| Day Flow (`/day-flow` via `/api/day-flow`) | **Real by default** when D1 snapshots exist for the selected day; computes bucket rollups from `minute_snapshots`. | Demo only when DB binding is missing or unexpected processing error occurs. Empty/no-stream cases now return explicit `source: api`, `state: empty` instead of demo. | `metric=share` remains geometry-only in UI copy; no separate share-normalized aggregation yet. |
| Battle Lines / Rivalry Radar (`/battle-lines` via `/api/battle-lines`) | **Real by default** when D1 snapshots exist for the selected day; derives lines/events from Twitch minute snapshots. | Demo only when DB binding is missing or unexpected processing error occurs. Empty/no-stream cases now return explicit `source: api`, `state: empty` instead of demo. | Event semantics are derived from viewer deltas only (no chat/activity fusion yet). |

### Fallback honesty rules now enforced
- `source: "demo"` is reserved for explicit demo fallback paths (missing DB binding or processing failure).
- `source: "api"` + empty payload is used when real pipeline is healthy but there is no qualifying stream data in the selected scope.
- UI `Data State` cards continue to show `source` and `state`, so users can distinguish real/empty from demo.
