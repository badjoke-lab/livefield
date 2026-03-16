import { readFileSync } from 'node:fs'

const payload = JSON.parse(readFileSync(new URL('../../fixtures/demo/day-flow.json', import.meta.url), 'utf8'))

const requiredRoot = ['ok','tool','state','status','coverageNote','buckets','totalViewersByBucket','bands','focusSnapshot','detailPanelSource','activity']
for (const key of requiredRoot) {
  if (!(key in payload)) throw new Error(`missing root key: ${key}`)
}
if (payload.tool !== 'day-flow') throw new Error('tool must be day-flow')
if (!Array.isArray(payload.bands) || payload.bands.length < 1) throw new Error('bands must be non-empty')
if (!payload.bands.some((b) => b.isOthers)) throw new Error('must include Others band')
if (payload.buckets.length !== payload.totalViewersByBucket.length) throw new Error('buckets and totals length mismatch')

console.log('day-flow payload shape smoke passed')
