/**
 * The diff, per view and per state.
 *
 * Keyed that way because the node set varies by state — a feature can be
 * somewhere else in `focus` and untouched in `browse`, and a count that adds
 * the two together is a number that means nothing. Every row below belongs to
 * exactly one (view, state) pair.
 *
 * This is a reading of source, not a second record of it. `git diff` shows what
 * changed since the last commit; this shows what differs from the source
 * default and what that arrangement costs. Neither replaces the other, and
 * neither stops anything: the report is a ledger, not a verdict.
 */
import { featureOf, layout, presentIn, type Sources } from '../resolve/resolve'
import type { Author, FeatureId, OpenItem, SlotId, StateId, ViewId } from '../schema'

export interface DiffRow {
  feature: FeatureId
  component: string
  /** `accepted` = it did not move; a cost was taken on the record where it sits. */
  kind: 'moved' | 'reordered' | 'accepted'
  from: SlotId
  to: SlotId
  fromOrder: number
  toOrder: number
  author?: Author
}

export interface StateDiff {
  view: ViewId
  state: StateId
  rows: DiffRow[]
  /** Features this state does not include. Context, not drift. */
  absent: FeatureId[]
  orphans: Array<{ feature: FeatureId; slot: SlotId; reason: string }>
  /** What this state costs. Unaccepted ones block the commit. */
  openItems: OpenItem[]
}

export function diff(src: Sources): StateDiff[] {
  const out: StateDiff[] = []
  for (const view of src.manifest.views)
    for (const state of view.states) {
      const l = layout(src, view.id, state)
      if (!l) continue
      const rows: DiffRow[] = []
      for (const slot of l.slots)
        for (const p of slot.features) {
          if (p.from !== 'assigned') continue
          const f = featureOf(src.manifest, p.feature)
          if (!f) continue
          const moved = p.slot !== f.sourceSlot
          const reordered = p.order !== f.sourceIndex
          const acceptedOnly =
            !moved && !reordered && l.openItems.some((i) => i.feature === p.feature && i.accepted)
          if (!moved && !reordered && !acceptedOnly) continue
          rows.push({
            feature: p.feature,
            component: p.component,
            kind: moved ? 'moved' : reordered ? 'reordered' : 'accepted',
            from: f.sourceSlot,
            to: p.slot,
            fromOrder: f.sourceIndex,
            toOrder: p.order,
            author: p.author,
          })
        }
      out.push({
        view: view.id,
        state,
        rows,
        absent: l.absent,
        openItems: l.openItems,
        orphans: l.orphans.map((o) => ({
          feature: o.assignment.feature,
          slot: o.assignment.slot,
          reason: o.reason,
        })),
      })
    }
  return out
}

export function formatDiff(diffs: StateDiff[]): string {
  const out: string[] = ['']
  const line = (s = '') => out.push(s)
  let total = 0
  let open = 0

  for (const d of diffs) {
    const head = `${d.view} · ${d.state}`
    line(head)
    line('─'.repeat(Math.max(head.length, 24)))
    if (!d.rows.length) line('  at source defaults')
    for (const r of d.rows) {
      total++
      line(
        r.kind === 'moved'
          ? `  ${r.component.padEnd(16)} ${r.from} → ${r.to}${r.author ? `   · ${r.author}` : ''}`
          : r.kind === 'reordered'
            ? `  ${r.component.padEnd(16)} ${r.to} · order ${r.fromOrder} → ${r.toOrder}${r.author ? `   · ${r.author}` : ''}`
            : `  ${r.component.padEnd(16)} ${r.to} · cost accepted${r.author ? `   · ${r.author}` : ''}`,
      )
    }
    if (d.absent.length) line(`  absent in this state: ${d.absent.join(', ')}`)
    for (const o of d.orphans) line(`  ! ${o.feature} → ${o.slot} (${o.reason})`)
    for (const i of d.openItems) {
      if (!i.accepted) open++
      line(`  ${i.accepted ? '·' : '!'} ${i.component} · ${i.requirement} — ${i.reason}`)
      if (i.accepted) line(`      accepted by ${i.acceptedBy ?? 'human'}`)
    }
    line('')
  }

  line(
    total === 1
      ? '1 placement differs from source defaults'
      : `${total} placements differ from source defaults`,
  )
  line(
    open === 0
      ? 'every behavioural cost is acknowledged'
      : `${open} behavioural cost${open === 1 ? '' : 's'} not yet acknowledged`,
  )
  line('')
  return out.join('\n')
}

/** Rows for one state, for the drag surface's own readout. */
export const diffFor = (src: Sources, view: ViewId, state: StateId): StateDiff | undefined =>
  diff(src).find((d) => d.view === view && d.state === state)

export { presentIn }
