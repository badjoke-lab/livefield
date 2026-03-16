import fs from "node:fs"

const raw = fs.readFileSync(new URL("../fixtures/demo/day-flow.json", import.meta.url), "utf8")
const payload = JSON.parse(raw)

const requiredTop = ["ok", "tool", "source", "state", "status", "selectedDate", "bucketSize", "topN", "buckets", "bands", "activity"]
for (const key of requiredTop) {
  if (!(key in payload)) {
    throw new Error(`day-flow demo payload missing key: ${key}`)
  }
}

if (payload.tool !== "day-flow") throw new Error("tool must be day-flow")
if (!Array.isArray(payload.buckets) || !Array.isArray(payload.bands)) throw new Error("buckets/bands must be arrays")
if (payload.bands.length === 0) throw new Error("bands must include at least Others")
if (!payload.bands.some((band) => band.isOthers === true)) throw new Error("bands must include Others")

console.log("day-flow payload checks: ok")
