/**
 * `slots grammar` — a description of a view's vocabulary.
 *
 * It describes; it does not score. A grammar "health number" would be something
 * we invented, and the first time it disagreed with a designer who was right
 * they would stop reading it. What can be stated without inventing anything is
 * the shape: how many positions there are, how many of them each feature can
 * reach for free, which requirements the grammar can satisfy and where, and
 * what has never been used.
 *
 * Free movement is computed with `slotCosts` — the same function the drag
 * surface asks. Reimplementing the cost rule here would let the description and
 * the drag drift apart, and the description would be the one people believed.
 */
import { slotsOf } from './grammar'
import { providersOf } from './grammar'
import { featuresOf, layout, presentIn, resolve, viewOf } from '../resolve/resolve'
import { slotCosts, storeFromSource } from '../store/store'
import { REQUIREMENTS } from '../schema'
import type {
  Band,
  Behavior,
  FeatureId,
  Manifest,
  Requirement,
  SlotId,
  StateId,
  ViewId,
} from '../schema'

export interface BandDescription {
  band: Band
  slots: SlotId[]
  provides: Behavior
}

export interface Freedom {
  feature: FeatureId
  component: string
  /** States this reading holds for — collapsed when identical across them. */
  states: StateId[]
  /** Slots this feature can occupy at no cost. */
  free: SlotId[]
  total: number
}

export interface Satisfiability {
  requirement: Requirement
  /** Bands whose contract provides it. Empty means nowhere in this view. */
  providers: string[]
  /** Whether any feature in this view actually asks for it. */
  required: boolean
}

export interface GrammarDescription {
  view: ViewId
  label?: string
  bands: BandDescription[]
  slotCount: number
  freedom: Freedom[]
  satisfiable: Satisfiability[]
  /** Slots no state has ever put a feature in. Headroom, or vocabulary nobody needed. */
  neverOccupied: SlotId[]
}

export function describeGrammar(manifest: Manifest, view: ViewId): GrammarDescription | null {
  const decl = viewOf(manifest, view)
  if (!decl) return null
  const slots = slotsOf(decl)
  const store = storeFromSource(manifest)

  const bands: BandDescription[] = decl.bands.map((band) => ({
    band,
    slots: slots.filter((s) => s.band === band.id).map((s) => s.id),
    provides: band.behavior ?? {},
  }))

  /* free movement, per feature, per state — then collapsed */
  const perFeature = new Map<FeatureId, Map<string, StateId[]>>()
  const components = new Map<FeatureId, string>()
  for (const state of decl.states)
    for (const f of featuresOf(manifest, view)) {
      if (!presentIn(f, state)) continue
      // A feature that does not resolve has no freedom to describe — its source
      // slot is gone. `costOfDrop` returns no cost for it, which would read as
      // "free everywhere", and that is a lie in exactly the case where the
      // grammar moved underneath it. Lint's dangling class is what reports it.
      if (!resolve({ manifest, assignments: store.assignments }, view, state, f.id)) continue
      components.set(f.id, f.component)
      const costs = slotCosts(manifest, store, { view, state, feature: f.id })
      const free = [...costs.entries()]
        .filter(([, c]) => c.length === 0)
        .map(([slot]) => slot)
        .sort()
      const key = free.join(',')
      const byKey = perFeature.get(f.id) ?? new Map<string, StateId[]>()
      byKey.set(key, [...(byKey.get(key) ?? []), state])
      perFeature.set(f.id, byKey)
    }

  const freedom: Freedom[] = []
  for (const [feature, byKey] of perFeature)
    for (const [key, states] of byKey)
      freedom.push({
        feature,
        component: components.get(feature) ?? feature,
        states,
        free: key ? key.split(',') : [],
        total: slots.length,
      })

  /* what the grammar can satisfy, and whether anything asks */
  const asked = new Set<Requirement>(featuresOf(manifest, view).flatMap((f) => f.requires))
  const satisfiable: Satisfiability[] = REQUIREMENTS.filter((r) => r !== 'sole-focus').map(
    (requirement) => ({
      requirement,
      providers: providersOf(decl, requirement) ?? [],
      required: asked.has(requirement),
    }),
  )

  /* what nobody has ever used */
  const occupied = new Set<SlotId>()
  for (const state of decl.states)
    for (const s of layout({ manifest, assignments: store.assignments }, view, state)?.slots ?? [])
      if (s.features.length) occupied.add(s.slot.id)

  return {
    view,
    label: decl.label,
    bands,
    slotCount: slots.length,
    freedom: freedom.sort((a, b) => a.feature.localeCompare(b.feature)),
    satisfiable,
    neverOccupied: slots.map((s) => s.id).filter((id) => !occupied.has(id)),
  }
}

export const describeAll = (manifest: Manifest): GrammarDescription[] =>
  manifest.views.flatMap((v) => describeGrammar(manifest, v.id) ?? [])

/* ---------------- printing ---------------- */

const phaseOf = (b: Behavior) =>
  [b.focusPhase, b.dismissible ? 'dismissible' : null, b.landmark]
    .filter(Boolean)
    .join(' · ') || 'no contract'

export function formatGrammar(descriptions: GrammarDescription[]): string {
  const out: string[] = ['']
  const line = (s = '') => out.push(s)

  for (const d of descriptions) {
    line(`${d.view}${d.label ? ` — ${d.label}` : ''} · ${d.bands.length} bands, ${d.slotCount} slots`)
    line('─'.repeat(46))
    for (const b of d.bands) line(`  ${b.slots.join('  ').padEnd(26)} ${phaseOf(b.provides)}`)

    line('')
    line('  free movement')
    for (const f of d.freedom) {
      const where = f.states.length === d.bands.length ? '' : ` (${f.states.join(', ')})`
      line(`    ${f.component.padEnd(16)} ${f.free.length} of ${f.total}${where}`)
    }

    line('')
    line('  satisfiable')
    for (const s of d.satisfiable)
      line(
        `    ${s.requirement.padEnd(14)} ${s.providers.length ? `✓ ${s.providers.join(', ')}` : '✗ nowhere'}` +
          (s.required && !s.providers.length ? '   ← something requires this' : ''),
      )

    line('')
    line(
      `  never occupied  ${d.neverOccupied.length ? d.neverOccupied.join(', ') : 'none'}`,
    )
    line('')
  }
  return out.join('\n')
}
