/**
 * THE DRIFT REPORT.
 *
 * Instance and view overrides that never got promoted are not failures and are
 * not cleaned up. They are the finding: places where someone needed something
 * the system did not offer, and did not — or could not — argue that it belonged
 * to everyone. Counts are the whole point. One is taste; nine of the same shape
 * is a missing token, and the report is where that becomes visible.
 */
import { PROMOTION_CANDIDATE_AT } from '@strata/substrate/precedent'
import { effectiveSeeds, evaluate, tokenTable } from '../resolve/resolve'
import { reconcile } from '../store/store'
import type { Manifest, Override, Store } from '../schema'

export interface DriftItem {
  override: Override
  nodeId: string
  /** 'snapped' still follows a retheme. 'drifted' is frozen at a number. */
  kind: 'snapped' | 'drifted'
  css: string
}

export interface DriftGroup {
  property: string
  value: string
  kind: 'snapped' | 'drifted'
  count: number
  instances: number
  views: number
  nodes: string[]
}

export interface DriftReport {
  promoted: { system: Override[]; component: Override[] }
  unresolved: DriftItem[]
  groups: DriftGroup[]
  redundant: Override[]
  byAuthor: Record<string, number>
}

const nodeIdOf = (o: Override) => o.target.selector.split('::').pop() ?? o.target.selector

export function driftReport(store: Store, manifest: Manifest): DriftReport {
  const table = tokenTable(effectiveSeeds(store.seeds, store.overrides))
  const redundant = reconcile(store, manifest)
  const redundantIds = new Set(redundant.map((o) => o.id))

  const live = store.overrides.filter((o) => !redundantIds.has(o.id))
  const unresolved: DriftItem[] = live
    .filter((o) => o.target.scope === 'instance' || o.target.scope === 'view')
    .map((o) => ({
      override: o,
      nodeId: nodeIdOf(o),
      kind: 'token' in o.value ? ('snapped' as const) : ('drifted' as const),
      css: evaluate(o.value, table).css,
    }))

  const groups = new Map<string, DriftGroup>()
  for (const item of unresolved) {
    const key = `${item.override.property}|${item.css}`
    const g =
      groups.get(key) ??
      ({
        property: item.override.property,
        value: item.css,
        kind: item.kind,
        count: 0,
        instances: 0,
        views: 0,
        nodes: [],
      } satisfies DriftGroup)
    g.count++
    if (item.override.target.scope === 'instance') g.instances++
    else g.views++
    if (!g.nodes.includes(item.nodeId)) g.nodes.push(item.nodeId)
    groups.set(key, g)
  }

  const byAuthor: Record<string, number> = {}
  for (const o of live) byAuthor[o.author] = (byAuthor[o.author] ?? 0) + 1

  return {
    promoted: {
      system: live.filter((o) => o.target.scope === 'system'),
      component: live.filter((o) => o.target.scope === 'component'),
    },
    unresolved,
    groups: [...groups.values()].sort((a, b) => b.count - a.count),
    redundant,
    byAuthor,
  }
}

export function formatDrift(r: DriftReport): string {
  const out: string[] = ['']
  const line = (s = '') => out.push(s)

  line('PROMOTED — collapses into source on ship')
  if (!r.promoted.system.length && !r.promoted.component.length) line('  none')
  for (const o of r.promoted.system)
    line(`  system     seed ${o.target.selector} = ${'literal' in o.value ? o.value.literal : ''}  · ${o.property} · ${o.author}`)
  for (const o of r.promoted.component)
    line(`  component  ${o.target.selector} · ${o.property} · ${o.author}`)

  line('')
  line('UNRESOLVED DRIFT — ships as-is, decided later')
  if (!r.groups.length) line('  none')
  for (const g of r.groups) {
    const where = [
      g.instances ? `${g.instances} instance${g.instances > 1 ? 's' : ''}` : '',
      g.views ? `${g.views} view${g.views > 1 ? 's' : ''}` : '',
    ]
      .filter(Boolean)
      .join(' + ')
    line(`  ${String(g.count).padStart(3)} × ${g.property} = ${g.value}  (${g.kind})`)
    line(`        ${where} · ${g.nodes.join(', ')}`)
    if (g.count >= PROMOTION_CANDIDATE_AT)
      line(`        ${g.count} appearances — promotion candidate`)
  }

  if (r.redundant.length) {
    line('')
    line('REDUNDANT — the system caught up; ship drops these')
    for (const o of r.redundant) line(`  ${o.target.scope.padEnd(10)} ${o.target.selector} · ${o.property}`)
  }

  line('')
  const authors = Object.entries(r.byAuthor).map(([a, n]) => `${n} ${a}`).join(' · ')
  line(`by author: ${authors || 'none'}`)
  line('')
  return out.join('\n')
}
