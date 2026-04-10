# Kick deploy and cron runbook

## Current status
- Kick Heatmap / Day Flow / Battle Lines are live at page, API, worker, and cron level.
- collector-kick cron is restored at a 1 minute interval.

## Important deploy rule
Do not deploy Pages from repository root with only apps/web/dist as the effective target.
That can update static assets while Pages Functions are missing on production.

Use apps/web as the working directory so Functions are bundled.

## Correct Pages deploy
```bash
cd ~/livefield/apps/web || exit 1
pnpm build
pnpm exec wrangler pages deploy dist --project-name livefield --branch main --commit-dirty=true
```

## Correct collector-kick deploy
```bash
cd ~/livefield || exit 1
pnpm -C ~/livefield exec wrangler deploy --config workers/collector-kick/wrangler.toml
```

## Production API checks
```bash
curl -i -sS https://livefield.pages.dev/api/kick-heatmap | sed -n "1,20p"
curl -i -sS https://livefield.pages.dev/api/kick-day-flow | sed -n "1,20p"
curl -i -sS https://livefield.pages.dev/api/kick-battle-lines | sed -n "1,20p"
```

Expected:
- content-type: application/json
- body starts with {

## Cron note
Workers Free hit the cron trigger account limit.
To restore collector-kick cron, one unused worker cron had to be removed in the Cloudflare dashboard.

collector-kick current cron:
```toml
[triggers]
crons = ["* * * * *"]
```

## Kick collector health checks
```bash
curl -sS https://livefield-kick-collector.badjoke-lab.workers.dev/status | jq .
curl -sS https://livefield-kick-collector.badjoke-lab.workers.dev/day-flow | jq "{summary, points: (.points[-5:] // .points)}"
curl -sS https://livefield-kick-collector.badjoke-lab.workers.dev/battle-lines | jq "{summary, pairs: (.pairs[0:5])}"
```
