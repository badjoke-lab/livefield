import { readFileSync } from 'node:fs'

const pageSource = readFileSync(new URL('../../apps/web/src/features/day-flow/page.ts', import.meta.url), 'utf8')

const requiredSnippets = [
  'id="dayflow-focus"',
  'id="dayflow-focus-mobile"',
  'id="dayflow-detail-sheet"',
  'id="dayflow-detail"',
  'Open stream',
  'Jump to Battle Lines',
  'Activity unavailable'
]

for (const text of requiredSnippets) {
  if (!pageSource.includes(text)) {
    throw new Error(`day-flow render smoke: missing snippet ${text}`)
  }
}

console.log('day-flow render smoke passed')
