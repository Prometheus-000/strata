/**
 * THE GLASS BOX — a decision printed so that what happened, what the system
 * knew, and what followed are four blocks a person or an agent reads top to
 * bottom. The CLI, the check report and the hub all render through here, so
 * there is one shape to learn.
 *
 *   DECISION      the body and its provenance
 *   CONTEXT       what was true around it (supplied by whoever asked)
 *   EVIDENCE      what an evaluator found (supplied, never computed here)
 *   CONSEQUENCE   what the operation recorded when it ran
 */
import { targetKey, type Decision, type Value } from './decision.ts'

export interface Fact {
  name: string
  value: string | number | boolean
  /** Where it came from — an evaluator id, a file, a query. */
  source?: string
}

const RULE = '──────────────'

const valueText = (v: Value | undefined) => (v === undefined ? '' : 'token' in v ? `var(${v.token})` : v.literal)
const propText = (v: unknown) => (v === null || v === undefined ? '(default)' : String(v))

/** The rows of the DECISION block, per kind. */
export function rows(d: Decision): Array<[string, string]> {
  const r: Array<[string, string]> = []
  switch (d.kind) {
    case 'token':
      r.push(['Token', d.token], ['Action', d.action])
      break
    case 'override':
      r.push(['Override', `${d.property} on ${d.selector}`], ['Action', d.action], ['Scope', d.fromScope ? `${d.fromScope} → ${d.scope}` : d.scope])
      if (d.value) r.push(['Value', valueText(d.value)])
      break
    case 'move':
      r.push(['Region', `<${d.region} />`], ['Action', 'move'], ['From', `${d.from.container} (${d.from.file}:${d.from.line})`], ['To', `${d.to.container} (${d.to.file}:${d.to.line}) at ${d.to.index}`])
      break
    case 'prop':
      r.push(['Prop', `<${d.component} ${d.prop}>`], ['Action', 'pick'], ['From', propText(d.from)], ['To', propText(d.to)], ['Where', `${d.file}:${d.line}`])
      break
    case 'seed':
      r.push(['Seeds', Object.entries(d.seeds).map(([k, v]) => `${k} ${v}`).join(' · ')], ['Action', 'retheme'])
      break
    case 'deviation':
      r.push(['Deviation', `${d.file}:${d.line}`], ['Action', 'declare'], ['Value', d.value])
      break
    case 'ship':
      r.push(['Action', 'ship'], ['Promoted', `${d.promoted.system} system · ${d.promoted.component} component`], ['Frozen', String(d.frozen)])
      break
    case 'ready':
      r.push(['Action', 'ready'])
      break
  }
  r.push(['Author', d.by])
  if (d.reason) r.push(['Reason', d.reason])
  return r
}

const consequenceRows = (d: Decision): Array<[string, string]> => {
  const c = d.consequence
  const r: Array<[string, string]> = []
  if (c.refused) r.push(['refused', c.refused])
  if (c.collapsesTo) r.push(['fallback', c.collapsesTo])
  if (c.absorbed?.length) r.push(['absorbed', c.absorbed.join(', ')])
  if (c.adapt?.length) r.push(['needs wiring', c.adapt.join(', ')])
  if (c.affected !== undefined) r.push(['affected', String(c.affected)])
  if (c.written?.length) r.push(['written', c.written.join(', ')])
  if (c.note) r.push(['note', c.note])
  return r
}

const block = (title: string, lines: string[]) => (lines.length ? [title, RULE, ...lines, ''] : [])
const factLines = (facts: Fact[]) => facts.map((f) => `${f.name}: ${String(f.value)}${f.source ? `  (${f.source})` : ''}`)

export function formatDecision(d: Decision, extras: { context?: Fact[]; evidence?: Fact[] } = {}): string {
  const out = [
    ...block('DECISION', [...rows(d).map(([k, v]) => `${k}: ${v}`), `Id: ${d.id}${d.supersedes ? ` (supersedes ${d.supersedes})` : ''}`, `At: ${d.at} · via ${d.via}`]),
    ...block('CONTEXT', factLines(extras.context ?? [])),
    ...block('EVIDENCE', factLines(extras.evidence ?? [])),
    ...block('CONSEQUENCE', consequenceRows(d).map(([k, v]) => `${k} → ${v}`)),
  ]
  return out.join('\n').trimEnd() + '\n'
}

/** One line, for lists. */
export function describe(d: Decision): string {
  const who = ` · ${d.by}`
  switch (d.kind) {
    case 'token':
      return `${d.action} ${d.token}${d.consequence.collapsesTo ? ` → ${d.consequence.collapsesTo}` : ''}${who}${d.reason ? ` · ${d.reason}` : ''}`
    case 'override':
      return `${d.action} ${d.property}${d.value ? ` = ${valueText(d.value)}` : ''} on ${d.selector} @ ${d.scope}${who}`
    case 'move': {
      const where = d.from.container === d.to.container ? `within ${d.to.container}` : `${d.from.container} → ${d.to.container}`
      return `<${d.region} />  ${where}   ${d.to.file}:${d.to.line}${who}${d.consequence.adapt?.length ? `\n      needs wiring: ${d.consequence.adapt.join(', ')}` : ''}`
    }
    case 'prop':
      return `<${d.component} ${d.prop}>  ${propText(d.from)} → ${propText(d.to)}   ${d.file}:${d.line}${who}`
    case 'seed':
      return `retheme hue ${d.seeds.hue} chroma ${d.seeds.chroma} ${d.seeds.appearance}${who}`
    case 'deviation':
      return `deviation ${d.file}:${d.line} = ${d.value}${who}${d.reason ? ` · ${d.reason}` : ''}`
    case 'ship':
      return `ship · ${d.promoted.system} system · ${d.promoted.component} component · ${d.frozen} frozen${who}`
    case 'ready':
      return `ready${who}`
  }
}

/** The handoff: what changed since the last ready, and whether it has been handed off. */
export function formatHandoff(changes: readonly Decision[], ready: Decision | null): string {
  const out: string[] = ['']
  if (!changes.length) out.push('  nothing changed since the last review')
  for (const d of changes) out.push(`  ${describe(d)}`)
  out.push('')
  out.push(ready ? `ready for review — ${ready.by}, ${ready.at}` : 'not yet handed off')
  out.push('')
  return out.join('\n')
}

export const keyOf = targetKey
