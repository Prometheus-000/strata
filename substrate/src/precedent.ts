/**
 * PRECEDENT — what the record says has been decided before, so a hand about
 * to decide has environmental context rather than isolated rules.
 *
 * A rule says "recipes speak tokens". Precedent says "thirty-seven instances
 * independently converged on 12px, across four views and three hands", and
 * lists the decisions. The second is what promotion is earned by, and it is
 * computed over history, never declared: nothing here has authority of its
 * own. The threshold at which a convergence is called a candidate is a
 * preference, held in the grammar; the default is three.
 *
 * Two things are counted, and they answer different questions. Distinct
 * *targets* say the value was reached in more than one place. Distinct
 * *hands* — distinct `decided.actor` — say it was reached by more than one
 * person. One hand touching nine instances is a habit; three hands reaching
 * the same value is evidence. Where no actor was named the record cannot tell
 * them apart, and this says so rather than assuming either.
 */
import { targetKey, type Author, type Decision, type Kind } from './decision.ts'
import { describe } from './format.ts'
import { current } from './log.ts'

export const PROMOTION_CANDIDATE_AT = 3

export interface PrecedentQuery {
  kind?: Kind
  /** An override's CSS property, or a prop name. */
  property?: string
  /** `var(--token)`, a literal, or a prop value, as text. */
  value?: string
  /** A component name: the node it owns, the region moved, the call site picked. */
  component?: string
  /** A token: decided by name, or snapped to by an override. */
  token?: string
  /** The kind of hand that decided it. */
  author?: Author
  /** The hand that decided it, by name. Opaque: an exact match on `decided.actor`. */
  actor?: string
  /** Every word must appear in the reason, the target or the description. */
  text?: string
  /** ISO date; decisions at or after it. */
  since?: string
  /** Only the current override decisions at instance or view scope — what drift is made of. */
  unpromoted?: boolean
}

export interface Convergence {
  /** 'override' for a property value, 'prop' for a pick. */
  kind: 'override' | 'prop'
  property: string
  value: string
  /** Distinct targets that reached this value. */
  count: number
  nodes: string[]
  views: string[]
  byAuthor: Record<Author, number>
  /** The distinct named hands that decided it, in the order the record met them. */
  actors: string[]
  /** Decisions here whose deciding hand went unnamed — countable, not attributable. */
  unnamed: number
  /**
   * Reached by more than one hand where hands are named, and from more than
   * one target where they are not. One hand revisiting one thing is neither.
   */
  independent: boolean
  /**
   * Meets the count the grammar prefers before a convergence is worth a
   * hand's attention. A candidate is computed and means "look at this"; it is
   * not a promotion, which only a hand can decide.
   */
  candidate: boolean
  decisions: string[]
}

export interface PrecedentResult {
  decisions: Decision[]
  convergence: Convergence[]
  /** The facts, as sentences. */
  lines: string[]
}

export interface PrecedentIndex {
  all: Decision[]
  current: Map<string, Decision>
  text: Map<string, string>
}

export const valueText = (d: Decision): string | undefined => {
  if (d.kind === 'override') return d.value ? ('token' in d.value ? `var(${d.value.token})` : d.value.literal) : undefined
  if (d.kind === 'prop') return d.to === null ? '(default)' : String(d.to)
  if (d.kind === 'token') return d.action
  return undefined
}

const componentOf = (d: Decision): string | undefined => {
  if (d.kind === 'override') return d.node?.split('.')[0]
  if (d.kind === 'move') return d.region
  if (d.kind === 'prop') return d.component
  return undefined
}

const tokenOf = (d: Decision): string | undefined => {
  if (d.kind === 'token') return d.token
  if (d.kind === 'override' && d.value && 'token' in d.value) return d.value.token
  return undefined
}

export function buildIndex(all: readonly Decision[]): PrecedentIndex {
  const text = new Map<string, string>()
  for (const d of all) text.set(d.id, `${d.reason ?? ''} ${targetKey(d)} ${describe(d)} ${d.consequence.refused ?? ''}`.toLowerCase())
  return { all: [...all], current: current(all), text }
}

export function search(index: PrecedentIndex, q: PrecedentQuery, opts: { candidateAt?: number } = {}): PrecedentResult {
  const words = (q.text ?? '').toLowerCase().split(/\s+/).filter(Boolean)
  const decisions = index.all.filter((d) => {
    if (q.kind && d.kind !== q.kind) return false
    if (q.author && d.decided.kind !== q.author) return false
    if (q.actor && d.decided.actor !== q.actor) return false
    if (q.since && d.at < q.since) return false
    if (q.property && !((d.kind === 'override' && d.property === q.property) || (d.kind === 'prop' && d.prop === q.property))) return false
    if (q.value && valueText(d) !== q.value) return false
    if (q.component && componentOf(d) !== q.component) return false
    if (q.token && tokenOf(d) !== q.token) return false
    if (q.unpromoted) {
      if (d.kind !== 'override' || d.consequence.refused || d.action === 'remove') return false
      if (d.scope !== 'instance' && d.scope !== 'view') return false
      if (index.current.get(targetKey(d)) !== d) return false
    }
    if (words.length) {
      const hay = index.text.get(d.id) ?? ''
      if (!words.every((w) => hay.includes(w))) return false
    }
    return true
  })
  const convergence = converge(decisions, opts.candidateAt ?? PROMOTION_CANDIDATE_AT)
  const lines = convergence.map(sentence)
  return { decisions, convergence, lines }
}

/** Distinct targets that reached the same value, per property. History counts; a refusal does not. */
export function converge(decisions: readonly Decision[], candidateAt = PROMOTION_CANDIDATE_AT): Convergence[] {
  const groups = new Map<string, { c: Convergence; targets: Set<string> }>()
  for (const d of decisions) {
    if (d.consequence.refused) continue
    if (!((d.kind === 'override' && d.action !== 'remove' && d.value) || d.kind === 'prop')) continue
    const property = d.kind === 'override' ? d.property : `${d.component}.${d.prop}`
    const value = valueText(d) ?? ''
    const key = `${d.kind}|${property}|${value}`
    let g = groups.get(key)
    if (!g) {
      g = { c: { kind: d.kind, property, value, count: 0, nodes: [], views: [], byAuthor: { human: 0, agent: 0 }, actors: [], unnamed: 0, independent: false, candidate: false, decisions: [] }, targets: new Set() }
      groups.set(key, g)
    }
    g.targets.add(targetKey(d))
    g.c.byAuthor[d.decided.kind]++
    if (d.decided.actor === undefined) g.c.unnamed++
    else if (!g.c.actors.includes(d.decided.actor)) g.c.actors.push(d.decided.actor)
    g.c.decisions.push(d.id)
    const node = d.kind === 'override' ? d.node : d.file
    const view = d.kind === 'override' ? d.view : undefined
    if (node && !g.c.nodes.includes(node)) g.c.nodes.push(node)
    if (view && !g.c.views.includes(view)) g.c.views.push(view)
  }
  return [...groups.values()]
    .map(({ c, targets }) => ({
      ...c,
      count: targets.size,
      // Where the record names hands, independence is a count of hands; where
      // it does not, the most it can honestly say is that the value was
      // reached in more than one place.
      independent: c.actors.length ? c.actors.length >= 2 : targets.size >= 2,
      candidate: targets.size >= candidateAt,
    }))
    .sort((a, b) => b.count - a.count || a.property.localeCompare(b.property))
}

/**
 * The hands, counted. Where none was named the record cannot tell one hand
 * from five, and says that rather than counting decisions as hands.
 */
export const handsIn = (c: Convergence): string => {
  if (!c.actors.length) return 'hands unnamed'
  const named = `${c.actors.length} hand${c.actors.length === 1 ? '' : 's'}: ${c.actors.join(', ')}`
  return c.unnamed ? `${named}, and ${c.unnamed} decision${c.unnamed === 1 ? '' : 's'} by an unnamed hand` : named
}

export function sentence(c: Convergence): string {
  const what = `${c.property} = ${c.value}`
  const who = [c.byAuthor.human ? `${c.byAuthor.human} by hand` : '', c.byAuthor.agent ? `${c.byAuthor.agent} by agent` : ''].filter(Boolean).join(', ')
  const where = c.views.length > 1 ? ` across ${c.views.length} views` : c.nodes.length > 1 ? ` across ${c.nodes.length} nodes` : ''
  const unit = c.kind === 'prop' ? 'call site' : 'instance'
  return `${c.count} ${unit}${c.count === 1 ? '' : 's'} ${c.independent ? 'independently ' : ''}converged on ${what}${where} · ${handsIn(c)} · ${who}${c.candidate ? ' — a candidate for promotion, which is a hand\'s to decide' : ''}`
}
