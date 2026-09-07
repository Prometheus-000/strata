/**
 * THE SURVEY — what a product's stylesheets already decided, before anyone
 * writes it down.
 *
 * Context precedes judgment, and for a product that exists, the context is
 * in the CSS: which faces it sets, how many radii it uses, whether it paints
 * shadows, how many raw colours it carries and which ones it keeps reaching
 * for. The survey counts those and says nothing about them; `write-grammar`
 * reads it and asks which were decided and which were accidents. On a
 * product with no stylesheet yet it says so, because the voice of a new
 * product starts from references and rejections rather than from evidence.
 */
import { COLUMNS, fold } from '@strata/substrate/format'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { COLOR_LITERAL } from './handlers'
import { literals, scanFiles } from './evaluators'

export interface Survey {
  stylesheets: number
  sources: number
  colours: { count: number; declared: number; top: Array<[string, number]> }
  fonts: Array<[string, number]>
  radii: Array<[string, number]>
  shadows: number
  durations: Array<[string, number]>
}

const top = (m: Map<string, number>, n = 5): Array<[string, number]> => [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n)
const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1)

export function survey(root: string): Survey {
  const files = scanFiles(root)
  const css = files.filter((f) => f.endsWith('.css'))
  const fonts = new Map<string, number>()
  const radii = new Map<string, number>()
  const durations = new Map<string, number>()
  const colours = new Map<string, number>()
  let shadows = 0
  for (const file of files) {
    const text = readFileSync(join(root, file), 'utf8')
    for (const m of text.matchAll(/font-family\s*:\s*([^;}]+)/g)) bump(fonts, m[1].trim().replace(/\s+/g, ' '))
    for (const m of text.matchAll(/fontFamily\s*:\s*['"`]([^'"`]+)['"`]/g)) bump(fonts, m[1].trim())
    for (const m of text.matchAll(/border-radius\s*:\s*([^;}]+)/g)) bump(radii, m[1].trim())
    for (const m of text.matchAll(/box-shadow\s*:\s*([^;}]+)/g)) if (!/^\s*none\b/.test(m[1])) shadows++
    for (const m of text.matchAll(/(?:transition|animation)(?:-duration)?\s*:\s*[^;}]*?(\d+(?:\.\d+)?m?s)/g)) bump(durations, m[1])
    for (const line of text.split('\n')) if (!line.includes('data:image/')) for (const m of line.matchAll(new RegExp(COLOR_LITERAL.source, 'g'))) bump(colours, m[0])
  }
  const { undeclared, declared } = literals(root)
  return {
    stylesheets: css.length,
    sources: files.length,
    colours: { count: undeclared.length + declared.length, declared: declared.length, top: top(colours) },
    fonts: top(fonts),
    radii: top(radii),
    shadows,
    durations: top(durations),
  }
}

/**
 * A `·`-joined list, packed into lines that fit — broken between facts, never
 * inside one. Plain word-wrapping split "3 radii" across two lines, which
 * leaves a number stranded from its unit.
 */
function packFacts(facts: string[], indent: number, width = COLUMNS): string[] {
  const room = Math.max(24, width - indent)
  const out: string[] = []
  let line = ''
  for (const f of facts) {
    const next = line ? `${line} · ${f}` : f
    if (line && next.length > room) {
      out.push(`${line} ·`)
      line = f
    } else line = next
  }
  if (line) out.push(line)
  return out
}

export function formatSurvey(s: Survey): string {
  if (s.sources === 0) return '  no stylesheets or components under the source yet — nothing to survey; the voice starts from references and rejections'
  const facts = [
    `${s.stylesheets} stylesheet(s) in ${s.sources} file(s)`,
    `${s.colours.count} raw colour(s)${s.colours.declared ? ` (${s.colours.declared} declared)` : ''}`,
    `${s.fonts.length} font famil${s.fonts.length === 1 ? 'y' : 'ies'}`,
    `${s.radii.length} radi${s.radii.length === 1 ? 'us' : 'i'}`,
    `${s.shadows} shadow(s)`,
  ]
  const rows = (name: string, xs: Array<[string, number]>) => (xs.length ? [`  ${name}`, ...xs.map(([k, n]) => `    ${String(n).padStart(3)} × ${k}`)] : [])
  return [
    ...packFacts([`found ${facts[0]}`, ...facts.slice(1)], 2).map((l) => `  ${l}`),
    ...rows('fonts', s.fonts),
    ...rows('radii', s.radii),
    ...rows('colours reached for most', s.colours.top),
    ...rows('durations', s.durations),
    s.colours.count ? fold('npx strata check lists every raw colour with the way to declare it; /write-grammar asks which of these were decided', 2).map((l) => `  ${l}`).join('\n') : '',
  ]
    .filter(Boolean)
    .join('\n')
}
