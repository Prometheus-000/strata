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
import { readFileSync, readdirSync, statSync } from 'node:fs'
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

if (violations.length) {
  console.error(`\n✗ ${violations.length} undeclared color literal(s). Use a semantic token, or declare the drift with a "deviation: <reason>" comment.`)
  for (const v of violations) console.error(`  ${v.file}:${v.line}  ${v.snippet}`)
  process.exit(1)
}

console.log(`✓ token validation passed (${files.length} files scanned)`)
