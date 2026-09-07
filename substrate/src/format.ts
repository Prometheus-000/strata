/**
 * THE GLASS BOX — a decision printed so that what happened, what the system
 * knew, and what followed are four blocks a person or an agent reads top to
 * bottom. The CLI, the check report and the hub all render through here, so
 * there is one shape to learn.
 *
 *   DECISION      the body, who decided it, and whose hand wrote it
 *   CONTEXT       what was true around it (supplied by whoever asked)
 *   EVIDENCE      what an evaluator found (supplied, never computed here)
 *   CONSEQUENCE   what the operation recorded when it ran
 */
import { handText, targetKey, type Decision, type Value } from './decision.ts'

export interface Fact {
  name: string
  value: string | number | boolean
  /** Where it came from — an evaluator id, a file, a query. */
  source?: string
}

const RULE = '──────────────'

/**
 * A band, and what it obliges of the reader, said where the band is. Check,
 * explain and precedent all use it, so the shape is written once rather than
 * transcribed into three modules that drift.
 */
export const band = (name: string, means?: string): string[] => [means ? `${name}  ·  ${means}` : name, RULE]

/** The width these reports lay out for: the narrow terminal, not the wide one. */
export const COLUMNS = 78

/**
 * Lines no wider than the room left beside an indent, broken on spaces.
 *
 * A lone separator rides with the word before it, so no line opens on a `·` or
 * a dash — the mark that joins two things should not begin one.
 */
export function fold(text: string, indent: number, width = COLUMNS): string[] {
  const room = Math.max(24, width - indent)
  const words: string[] = []
  for (const w of text.split(' ')) {
    if (words.length && /^[·—–-]$/.test(w)) words[words.length - 1] += ` ${w}`
    else words.push(w)
  }
  const out: string[] = []
  let line = ''
  for (const word of words) {
    if (line && line.length + 1 + word.length > room) {
      out.push(line)
      line = word
    } else line = line ? `${line} ${word}` : word
  }
  if (line) out.push(line)
  return out
}

/** A paragraph whose first line follows a prefix already `indent` wide. */
export const hang = (text: string, indent: number): string[] => fold(text, indent).map((l, i) => (i ? ' '.repeat(indent) + l : l))

const valueText = (v: Value | undefined) => (v === undefined ? '' : 'token' in v ? `var(${v.token})` : v.literal)
const propText = (v: unknown) => (v === null || v === undefined ? '(default)' : String(v))

/** The rows of the DECISION block, per kind. */
export function rows(d: Decision): Array<[string, string]> {
  const r: Array<[string, string]> = []
  switch (d.kind) {
    case 'token':
      r.push(['Token', d.token], ['Action', d.action])
      if (d.value) r.push(['Value', valueText(d.value)])
      if (d.from?.length) r.push(['Earned by', `${d.from.length} decision(s): ${d.from.join(', ')}`])
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
  r.push(['Decided by', handText(d.decided)], ['Written by', handText(d.written)])
  // How both hands were determined, verbatim, under the two rows it is the
  // evidence for. Who chose is the claim a reviewer most needs to check.
  if (d.because) r.push(['Because', d.because])
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

const block = (title: string, lines: string[], means?: string) => (lines.length ? [...band(title, means), ...lines, ''] : [])
const factLines = (facts: Fact[]) => facts.map((f) => `${f.name}: ${String(f.value)}${f.source ? `  (${f.source})` : ''}`)

/**
 * What each block is, said where the block is. Nothing in the word EVIDENCE
 * tells a reader it was computed just now and never on the write path, which
 * is the reason a drag mid-design hears nothing.
 */
const MEANS = {
  decision: 'what was chosen, by whom, and why',
  context: 'what the record already knew about this target',
  evidence: 'computed when you asked, not when the decision was written',
  consequence: 'what the operation already knew when it ran',
} as const

export function formatDecision(d: Decision, extras: { context?: Fact[]; evidence?: Fact[] } = {}): string {
  const out = [
    ...block(
      'DECISION',
      [
        ...rows(d).map(([k, v]) => `${k}: ${v}`),
        `Id: ${d.id}${d.supersedes ? ` (supersedes ${d.supersedes})` : ''}`,
        `At: ${d.at} · via ${d.via}`,
      ],
      MEANS.decision,
    ),
    ...block('CONTEXT', factLines(extras.context ?? []), MEANS.context),
    ...block('EVIDENCE', factLines(extras.evidence ?? []), MEANS.evidence),
    ...block('CONSEQUENCE', consequenceRows(d).map(([k, v]) => `${k} → ${v}`), MEANS.consequence),
  ]
  return out.join('\n').trimEnd() + '\n'
}

/** One line, for lists. */
export function describe(d: Decision): string {
  const who = ` · ${handText(d.decided)}${d.written.kind === d.decided.kind && d.written.actor === d.decided.actor ? '' : ` (written ${handText(d.written)})`}`
  switch (d.kind) {
    case 'token':
      return `${d.action} ${d.token}${d.value ? ` = ${valueText(d.value)}` : ''}${d.consequence.collapsesTo ? ` → ${d.consequence.collapsesTo}` : ''}${who}${d.reason ? ` · ${d.reason}` : ''}`
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

/**
 * The handoff: what changed since the last ready, and whether it has been
 * handed off.
 *
 * The lines are split by the hand that *chose* them. An agent typing a
 * person's decision is the ordinary case and needs nothing; an agent that
 * chose is the case a person has not seen yet, and those are named so a
 * reviewer does not have to go looking for them.
 */
export function formatHandoff(changes: readonly Decision[], ready: Decision | null): string {
  const out: string[] = ['']
  if (!changes.length) {
    out.push('  nothing changed since the last review', '')
    out.push(ready ? `ready for review — ${handText(ready.decided)}, ${ready.at}` : 'not yet handed off', '')
    return out.join('\n')
  }

  // An agent-decided line that a person has since ruled on is settled: the
  // later decision *is* the review. Listing it anyway would send a reviewer to
  // look at something already answered, which is the fastest way to teach them
  // to stop reading this list.
  const chosen = new Set(
    changes
      .filter((d, i) => d.decided.kind === 'agent' && !changes.slice(i + 1).some((later) => later.decided.kind === 'human' && targetKey(later) === targetKey(d)))
      .map((d) => d.id),
  )

  out.push(
    ...fold(
      `${changes.length} change(s) since the last review` +
        (chosen.size ? ` · ${chosen.size} decided by an agent, not merely written by one, and a person rules on ${chosen.size === 1 ? 'it' : 'those'}` : ''),
      2,
    ).map((l) => `  ${l}`),
    '',
  )
  if (chosen.size) out.push('  → decided by an agent', '')

  // Marked in place, with its id, rather than listed a second time. The lines
  // that need a person were printed twice in full — one of them two hundred
  // characters of font stack — and matching the second list to the first by
  // eye is work a reader should not be doing.
  for (const d of changes) {
    const mark = chosen.has(d.id) ? '  → ' : '    '
    // A move describes itself on two lines: what moved, and what it left
    // needing wiring. Folding that into one loses the second as a sentence.
    const [head, ...tail] = describe(d).split('\n')
    const said = head + (chosen.has(d.id) ? `   ${d.id}` : '')
    const [first, ...rest] = fold(said, 6)
    out.push(mark + first, ...rest.map((l) => '      ' + l))
    for (const more of tail) out.push(...fold(more.trim(), 6).map((l) => '      ' + l))
  }
  out.push('')
  out.push(ready ? `ready for review — ${handText(ready.decided)}, ${ready.at}` : 'not yet handed off — npx strata ready hands it off', '')
  return out.join('\n')
}

export const keyOf = targetKey
