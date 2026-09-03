/**
 * LAYER 0 VALIDATOR — validators, not reviewers.
 * Scans Layer 2 (src/components) and the showcase (src/site) for color
 * literals: raw hex, oklch(), rgb()/rgba(), hsl()/hsla(). Components speak
 * the semantic tier; nothing else.
 *
 * Deviation stays legal — it just has to declare itself:
 *   a comment containing `deviation:` covers its statement, through the end
 *   of the current CSS rule (or the current line in TS/TSX).
 * Undeclared drift fails the build. Declared drift is printed — it is
 * promotion-candidate telemetry, not noise.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const SCAN_DIRS = ['src/components', 'src/site', 'src/personalize']
const EXTS = ['.css', '.tsx', '.ts']

const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\boklch\(|\brgba?\(|\bhsla?\(/

const files = []
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p)
    else if (EXTS.some((e) => p.endsWith(e))) files.push(p)
  }
}
SCAN_DIRS.forEach((d) => walk(join(ROOT, d)))

const violations = []
const deviations = []

for (const file of files) {
  const rel = relative(ROOT, file)
  const lines = readFileSync(file, 'utf8').split('\n')
  const isCss = file.endsWith('.css')
  let deviationActive = null // { reason, sinceLine }

  lines.forEach((line, i) => {
    const devMatch = line.match(/deviation:\s*(.*?)(?:\*\/|$)/)
    if (devMatch) deviationActive = { reason: devMatch[1].trim(), line: i + 1 }

    if (COLOR_LITERAL.test(line) && !line.includes('deviation:')) {
      // data-URI SVG payloads are encoded assets, not token drift
      const isDataUri = line.includes('data:image/')
      if (!isDataUri) {
        if (deviationActive) {
          deviations.push({ file: rel, line: i + 1, reason: deviationActive.reason })
        } else {
          violations.push({ file: rel, line: i + 1, snippet: line.trim().slice(0, 90) })
        }
      }
    }

    // A deviation declaration covers to the end of the CSS rule, or one line in TS
    if (deviationActive) {
      if (isCss ? line.includes('}') : i + 1 > deviationActive.line) deviationActive = null
    }
  })
}

if (deviations.length) {
  console.log(`\n${deviations.length} declared deviation(s) — legal, and logged:`)
  for (const d of deviations) console.log(`  ${d.file}:${d.line} — ${d.reason}`)
}

/* ---------------- pass 2: the ledger, as telemetry ----------------
 * Every generated token is a proposal in src/theme/ledger.json. This pass
 * counts who reaches for each one — the consumers above, plus the static
 * roles in semantic.css itself, which is where --shadow-color is spent — and
 * says two things without failing anything:
 *   - a cut token's usages, and what they now collapse to. The decision was
 *     made where the token is defined; this is where it lands.
 *   - a token nothing uses: "never used — cut candidate", the analogue of a
 *     slot no state ever occupies. Headroom, or vocabulary nobody needed.
 */
const ledgerPath = join(ROOT, 'src/theme/ledger.json')
if (existsSync(ledgerPath)) {
  const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'))
  const semantic = readFileSync(join(ROOT, 'src/tokens/semantic.css'), 'utf8')
  const staticBlock = semantic.slice(semantic.indexOf('Static roles'))
  const usage = new Map(Object.keys(ledger.tokens).map((t) => [t, []]))
  const count = (text, where) => {
    text.split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/var\((--[\w-]+)\)/g))
        if (usage.has(m[1])) usage.get(m[1]).push(`${where}:${i + 1}`)
    })
  }
  for (const file of files) count(readFileSync(file, 'utf8'), relative(ROOT, file))
  count(staticBlock, 'src/tokens/semantic.css (static roles)')

  // What each cut token landed on, as the emitter recorded it.
  const contract = JSON.parse(readFileSync(join(ROOT, 'src/tokens/tokens.json'), 'utf8'))
  const landed = new Map((contract.strata?.ledger?.cut ?? []).map((c) => [c.token, c.fallback]))
  const cut = Object.entries(ledger.tokens).filter(([, d]) => d.status === 'cut')
  if (cut.length) {
    console.log(`\n${cut.length} cut token(s) — collapsed at the definition, counted at the consumer:`)
    for (const [name, d] of cut) {
      const sites = usage.get(name) ?? []
      console.log(`  ${name} → ${landed.get(name) ?? '?'}  (${d.by ?? 'human'}${d.reason ? `: ${d.reason}` : ''}) — ${sites.length} usage(s) collapse`)
      for (const s of sites.slice(0, 6)) console.log(`      ${s}`)
      if (sites.length > 6) console.log(`      … ${sites.length - 6} more`)
    }
  }
  const never = [...usage].filter(([name, sites]) => !sites.length && ledger.tokens[name].status !== 'cut').map(([n]) => n)
  if (never.length) {
    console.log(`\n${never.length} token(s) never used — cut candidates, or headroom; only you know which:`)
    for (const n of never) console.log(`  ${n}`)
  }
  const proposed = Object.values(ledger.tokens).filter((d) => d.status === 'proposed').length
  if (proposed) console.log(`\n${proposed} token(s) still proposed — unreviewed; they ship as generated (npm run ledger -- list)`)
}

if (violations.length) {
  console.error(`\n✗ ${violations.length} undeclared color literal(s). Use a semantic token, or declare the drift with a "deviation: <reason>" comment.`)
  for (const v of violations) console.error(`  ${v.file}:${v.line}  ${v.snippet}`)
  process.exit(1)
}

console.log(`✓ token validation passed (${files.length} files scanned)`)
