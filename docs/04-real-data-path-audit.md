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
