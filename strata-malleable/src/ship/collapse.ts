/**
 * SHIP — the freeze.
 *
 * Three destinations, chosen by scope, and none of them is a database:
 *
 *   system     → the seed constant. The engine keeps its monopoly on tokens.
 *   component  → the recipe's own declaration, rewritten in place. A literal
 *                arrives with a `deviation:` comment, because Strata's grammar
 *                already has a sanctioned way to carry a raw value and inventing
 *                a second one would be the actual violation.
 *   instance   → a generated stylesheet, emitted by the same compiler the dev
 *   + view       runtime uses, so shipped pixels equal dragged pixels.
 *
 * Un-promoted overrides are not deleted on the way out. Someone made those
 * decisions on purpose; dropping them silently would be the worst behaviour
 * available. They ship, and they are counted in the report.
 */
import fs from 'node:fs'
import path from 'node:path'
import { parseRules, simpleClass } from '../identity/css'
import { compileStyleSheet } from '../runtime/styleSheet'
import { PROPERTIES } from '../resolve/properties'
import { effectiveSeeds, evaluate, tokenTable } from '../resolve/resolve'
import type { Manifest, Override, Store } from '../schema'
import { driftReport, formatDrift } from './drift'

export const FROZEN_PATH = 'fixtures/app/frozen.css'
export const SEEDS_SOURCE = 'src/engine/generateTheme.ts'

export interface ShipOptions {
  dryRun?: boolean
  root?: string
}

export interface ShipResult {
  store: Store
  log: string
  edits: Array<{ file: string; what: string }>
  refusals: string[]
}

export function ship(store: Store, manifest: Manifest, opts: ShipOptions = {}): ShipResult {
  const root = opts.root ?? process.cwd()
  const dry = opts.dryRun ?? false
  const edits: ShipResult['edits'] = []
  const refusals: string[] = []
  const report = driftReport(store, manifest)
  const table = tokenTable(effectiveSeeds(store.seeds, store.overrides))

  /* ---- 1. system → seeds ---- */
  let seeds = store.seeds
  if (report.promoted.system.length) {
    seeds = effectiveSeeds(store.seeds, store.overrides)
    const p = path.join(root, SEEDS_SOURCE)
    const src = fs.readFileSync(p, 'utf8')
    const next = rewriteSeedConstant(src, 'OBSIDIAN', seeds)
    if (next === src) refusals.push(`could not find the OBSIDIAN seed constant in ${SEEDS_SOURCE}`)
    else {
      if (!dry) fs.writeFileSync(p, next)
      for (const o of report.promoted.system)
        edits.push({
          file: SEEDS_SOURCE,
          what: `seed ${o.target.selector} → ${'literal' in o.value ? o.value.literal : ''} (from ${o.property})`,
        })
    }
  }

  /* ---- 2. component → the recipe's declaration ---- */
  const byFile = new Map<string, Array<{ o: Override; cssProperty: string; selector: string; value: string; literal: boolean }>>()
  for (const o of report.promoted.component) {
    const node = manifest.nodes.find((n) => n.nodeId === o.target.selector)
    const from = node?.baseFrom[o.property]
    const spec = PROPERTIES[o.property]
    if (!node || !from || !spec) {
      refusals.push(`${o.target.selector} · ${o.property}: no source declaration to write back to`)
      continue
    }
    const { css } = evaluate(o.value, table)
    for (const cssProperty of spec.css) {
      const list = byFile.get(from.file) ?? []
      list.push({ o, cssProperty, selector: from.selector, value: css, literal: !('token' in o.value) })
      byFile.set(from.file, list)
    }
  }

  for (const [file, writes] of byFile) {
    // Two nodes sharing one class cannot be given different values through it.
    // Guessing here is how a design system quietly changes something nobody asked about.
    const conflicts = new Map<string, Set<string>>()
    for (const w of writes) {
      const key = `${w.selector}|${w.cssProperty}`
      const set = conflicts.get(key) ?? new Set<string>()
      set.add(w.value)
      conflicts.set(key, set)
    }
    const blocked = new Set([...conflicts].filter(([, v]) => v.size > 1).map(([k]) => k))
    for (const key of blocked)
      refusals.push(
        `${file} ${key.replace('|', ' · ')}: two nodes promoted different values through one class — resolve by hand`,
      )

    const p = path.join(root, file)
    let src = fs.readFileSync(p, 'utf8')
    const splices: Array<{ start: number; end: number; text: string }> = []
    for (const w of writes) {
      if (blocked.has(`${w.selector}|${w.cssProperty}`)) continue
      const cls = simpleClass(w.selector)
      const rules = parseRules(src).filter(
        (r) => !r.condition && r.selectors.some((s) => simpleClass(s) === cls),
      )
      let hit: { start: number; end: number } | null = null
      for (const r of rules)
        for (const d of r.decls)
          if (d.property === w.cssProperty) hit = { start: d.valueStart, end: d.valueEnd }
      if (!hit) {
        refusals.push(`${file} ${w.selector}: no ${w.cssProperty} declaration to rewrite`)
        continue
      }
      const deviation = w.literal
        ? ` /* deviation: shipped literal, promoted from ${w.o.author} edits */`
        : ''
      splices.push({ start: hit.start, end: hit.end, text: w.value + deviation })
      edits.push({ file, what: `${w.selector} { ${w.cssProperty}: ${w.value} }` })
    }
    splices.sort((a, b) => b.start - a.start)
    for (const s of splices) src = src.slice(0, s.start) + s.text + src.slice(s.end)
    if (!dry && splices.length) fs.writeFileSync(p, src)
  }

  /* ---- 3. instance + view → the frozen stylesheet ---- */
  const kept = store.overrides.filter(
    (o) =>
      (o.target.scope === 'instance' || o.target.scope === 'view') &&
      !report.redundant.some((r) => r.id === o.id),
  )
  const frozenStore: Store = { ...store, seeds, overrides: kept }
  const body = compileStyleSheet(frozenStore, manifest)
  const frozen = `/* GENERATED by \`npm run ship\` — do not edit.
   Instance- and view-scope overrides that were never promoted. They ship
   because someone chose them; they are counted in the drift report because
   nobody argued they belonged to everyone.

   Import after the recipe stylesheet: these selectors are more specific,
   but source order still decides ties against equally specific rules. */
${body || '/* none */'}
`
  if (!dry) fs.writeFileSync(path.join(root, FROZEN_PATH), frozen)
  if (kept.length) edits.push({ file: FROZEN_PATH, what: `${kept.length} frozen override(s)` })

  /* ---- 4. the store after the freeze ---- */
  const next: Store = { version: 1, seeds, overrides: kept }

  const log = [
    formatDrift(report),
    'SHIP',
    ...(edits.length ? edits.map((e) => `  ${e.file.padEnd(34)} ${e.what}`) : ['  nothing to collapse']),
    ...(refusals.length ? ['', 'REFUSED — needs a human'] : []),
    ...refusals.map((r) => `  ${r}`),
    '',
    dry ? '(dry run — nothing written)' : `${edits.length} edit(s) written · store frozen to ${kept.length} override(s)`,
    '',
  ].join('\n')

  return { store: dry ? store : next, log, edits, refusals }
}

/** Rewrite the seed literal in the engine source, preserving its formatting. */
export function rewriteSeedConstant(source: string, name: string, seeds: object): string {
  const start = source.indexOf(`export const ${name}: ThemeSeeds = {`)
  if (start < 0) return source
  const open = source.indexOf('{', start)
  let depth = 0
  let end = open
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++
    else if (source[i] === '}') {
      depth--
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  let body = source.slice(open + 1, end)
  for (const [key, value] of Object.entries(seeds as Record<string, unknown>)) {
    const literal = typeof value === 'string' ? `'${value}'` : String(value)
    const re = new RegExp(`(\\n\\s*${key}\\s*:\\s*)[^,\\n]+`, 'g')
    if (re.test(body)) body = body.replace(re, `$1${literal}`)
  }
  return source.slice(0, open + 1) + body + source.slice(end)
}
