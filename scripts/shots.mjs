/**
 * THE CAPTURES, TAKEN AGAIN.
 *
 * A screenshot is the Figma library's category of thing: a projection nobody
 * can regenerate, which is why that one went stale and is named in
 * `docs/not-built.md` as evidence. These are taken by a command instead.
 *
 * Headless Chrome, no driver — the browser writes the file itself. STRATA_SITE
 * points it at a dev server instead of the published site.
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
  // `new URL`, so a STRATA_SITE without a trailing slash still resolves.
  const url = new URL(page, SITE.endsWith('/') ? SITE : `${SITE}/`).href
  execFileSync(CHROME, [
    '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--force-color-profile=srgb', `--window-size=${w},${h}`,
    '--virtual-time-budget=9000', `--screenshot=${file}`, url,
  ], { stdio: ['ignore', 'ignore', 'ignore'] })
  // Chrome can exit 0 having written nothing; a missing file is the real check.
  if (!fs.existsSync(file)) {
    console.error(`${url} produced no capture`)
    process.exit(1)
  }
  console.log(`${path.relative(process.cwd(), file)}  ${(fs.statSync(file).size / 1024).toFixed(0)} KB  ← ${url}`)
}
