/**
 * THE CAPTURES, TAKEN AGAIN.
 *
 * A screenshot in a README is the same category of thing as the Figma library:
 * a projection nobody can regenerate, which is why that one went stale and is
 * named in `docs/not-built.md` as evidence. So this exists — the shots the
 * front door carries are taken from the published site by a command, and a
 * seed change makes them stale in a way that `npm run shots` answers.
 *
 * Headless Chrome, no driver: the browser writes the file itself. Point it
 * somewhere else with STRATA_SITE when the dev server is what you want to see.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'public')
const SITE = process.env.STRATA_SITE ?? 'https://prometheus-000.github.io/strata/'
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

/** The two surfaces the README shows: what a designer touches, and the hub. */
const SHOTS = [
  { name: 'shot-lab', page: 'lab.html', w: 1400, h: 880 },
  { name: 'shot-hub', page: '', w: 1400, h: 900 },
]

if (!fs.existsSync(CHROME)) {
  console.error(`no Chrome at ${CHROME} — set CHROME to its path`)
  process.exit(1)
}

for (const { name, page, w, h } of SHOTS) {
  const file = path.join(OUT, `${name}.png`)
  execFileSync(CHROME, [
    '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--force-color-profile=srgb', `--window-size=${w},${h}`,
    '--virtual-time-budget=9000', `--screenshot=${file}`, SITE + page,
  ], { stdio: ['ignore', 'ignore', 'ignore'] })
  console.log(`${path.relative(process.cwd(), file)}  ${(fs.statSync(file).size / 1024).toFixed(0)} KB  ← ${SITE}${page}`)
}
