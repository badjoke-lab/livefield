import { existsSync } from "node:fs"
import { resolve } from "node:path"

const required = [
  "apps/web/index.html",
  "apps/web/heatmap/index.html",
  "apps/web/day-flow/index.html",
  "apps/web/battle-lines/index.html",
  "workers/collector/src/index.ts"
]

const missing = required.filter((file) => !existsSync(resolve(process.cwd(), file)))

if (missing.length) {
  console.error("Missing required files:")
  for (const file of missing) console.error(`- ${file}`)
  process.exit(1)
}

console.log("release-check: ok")
