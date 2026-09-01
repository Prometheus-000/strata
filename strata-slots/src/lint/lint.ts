/**
 * LINT — a pass over what source records, runnable on its own or inside a
 * host's build.
 *
 * It reports. It does not decide. Whether a failing report stops anything is
 * the host's call, so this returns data and a printer, and never an exit code.
 *
 * Two classes, plus one that keeps the first honest:
 *
 *   1. **Unsatisfied behaviour contracts** recorded as open items. Read from
 *      source, not recomputed, because the question "what is this codebase
 *      carrying" should be answerable from the files rather than from a run.
 *
 *   2. **Assignments that no longer resolve** — a removed slot, a deleted
 *      feature, a renamed view. This class exists because *nothing generates an
 *      open item when the grammar changes underneath an assignment*: the
 *      contract check asks whether a slot satisfies a requirement, and a slot
 *      that no longer exists is not a slot that fails to satisfy — it is an
 *      assignment pointing at nothing, and it would otherwise be silent.
 *
 *   3. **Records that disagree with the resolver.** Recording derived data buys
 *      visibility and risks drift. The risk is not prevented, it is detected:
 *      recompute, compare, and say so. A stale line that announces itself is
 *      not a failure; a stale line nobody notices would be.
 */
import { slotsOf } from '../grammar/grammar'
import {
  allOpenItems,
  assignmentsFromSource,
  featureOf,
  featuresOf,
  openItemId,
  presentIn,
  recordedOpenItems,
  viewOf,
} from '../resolve/resolve'
import { describeGrammar } from '../grammar/describe'
import type { Band, Manifest, OpenItem, Requirement } from '../schema'

export interface ContractFinding {
  kind: 'unsatisfied-contract'
  item: OpenItem
}

export interface DanglingFinding {
  kind: 'dangling-assignment'
  view: string
  state: string
  feature: string
  slot: string
  reason: 'unknown-view' | 'unknown-state' | 'unknown-feature' | 'absent-in-state' | 'unknown-slot'
  detail: string
}

export interface DriftFinding {
  kind: 'record-drift'
  view: string
  state: string
  feature: string
  slot: string
  requirement: Requirement
  drift: 'recorded-but-satisfied' | 'unsatisfied-but-unrecorded'
  detail: string
}

/**
 * Something about the *vocabulary* rather than about a placement in it.
 *
 * Every one of these is a report. The grammar is the designer's, and most of
 * what can be said about it is a shape rather than a fault — the one that comes
 * closest to a rule is `unsatisfiable-requirement`, and even that is not us
 * disagreeing with them: they declared a requirement and built a vocabulary
 * that offers it nowhere, which is a contradiction inside their own work and a
 * dead end no drag can leave.
 *
 * See GRAMMAR.md for each rule and the reason it exists.
 */
export interface GrammarFinding {
  kind: 'grammar'
  rule:
    | 'unsatisfiable-requirement'
    | 'pinned-feature'
    | 'indistinguishable-bands'
    | 'contractless-band'
    | 'unused-columns'
    | 'unoccupied-slot'
    | 'position-name'
  view: string
  /** The band or slot the finding is about. */
  where: string
  detail: string
}

export type Finding = ContractFinding | DanglingFinding | DriftFinding | GrammarFinding

export interface LintReport {
  contracts: ContractFinding[]
  dangling: DanglingFinding[]
  drift: DriftFinding[]
  grammar: GrammarFinding[]
  /** Totals by requirement — the fleet-wide question, answered locally. */
  byRequirement: Record<string, { total: number; acknowledged: number }>
  /** Totals by band, so a count can say which contract-bearing unit is short. */
  byBand: Record<string, number>
}

export function lint(manifest: Manifest): LintReport {
  const src = { manifest, assignments: assignmentsFromSource(manifest) }

  /* 1 — unsatisfied contracts, as source records them */
  const computed = allOpenItems(src)
  const contracts: ContractFinding[] = computed.map((item) => ({
    kind: 'unsatisfied-contract',
    item,
  }))

  /* 2 — assignments that no longer resolve */
  const dangling: DanglingFinding[] = []
  for (const view of manifest.views) {
    const legal = new Set(slotsOf(view).map((s) => s.id))
    for (const [state, byFeature] of Object.entries(view.placement ?? {})) {
      const knownState = view.states.includes(state)
      for (const [feature, record] of Object.entries(byFeature)) {
        const at = { view: view.id, state, feature, slot: record.slot }
        if (!knownState) {
          dangling.push({
            kind: 'dangling-assignment',
            ...at,
            reason: 'unknown-state',
            detail: `view "${view.id}" has no state "${state}" — renamed or removed`,
          })
          continue
        }
        const f = featureOf(manifest, feature)
        if (!f || f.view !== view.id) {
          dangling.push({
            kind: 'dangling-assignment',
            ...at,
            reason: 'unknown-feature',
            detail: `no feature "${feature}" in view "${view.id}" — deleted or renamed`,
          })
          continue
        }
        if (!presentIn(f, state)) {
          dangling.push({
            kind: 'dangling-assignment',
            ...at,
            reason: 'absent-in-state',
            detail: `"${feature}" is not part of the "${state}" state, so this placement never applies`,
          })
          continue
        }
        if (!legal.has(record.slot))
          dangling.push({
            kind: 'dangling-assignment',
            ...at,
            reason: 'unknown-slot',
            detail: `slot "${record.slot}" is not in view "${view.id}"'s grammar — the band changed underneath it`,
          })
      }
    }
  }
  // A placement naming a view that no longer exists cannot be found by walking
  // views, so it is not reachable here — an orphaned declaration file is a
  // missing file, which the manifest reports as a problem of its own.

  /* 3 — recorded vs computed */
  const drift: DriftFinding[] = []
  const computedIds = new Set(computed.map((i) => i.id))
  const recorded = recordedOpenItems(manifest)
  const recordedIds = new Set(
    recorded.map((r) => openItemId(r.view, r.state, r.feature, r.slot, r.requirement)),
  )
  for (const r of recorded) {
    const id = openItemId(r.view, r.state, r.feature, r.slot, r.requirement)
    if (!computedIds.has(id))
      drift.push({
        kind: 'record-drift',
        ...r,
        drift: 'recorded-but-satisfied',
        detail: `source records ${r.requirement} as unsatisfied at ${r.slot}, but it is satisfied now`,
      })
  }
  for (const i of computed) {
    // Only records that exist can be stale. A feature at its source default has
    // nothing written about it, and nothing written is not a wrong record — it
    // is a design that has never been committed.
    const hasRecord = manifest.views
      .find((v) => v.id === i.view)
      ?.placement?.[i.state]?.[i.feature]
    if (hasRecord && !recordedIds.has(i.id))
      drift.push({
        kind: 'record-drift',
        view: i.view,
        state: i.state,
        feature: i.feature,
        slot: i.slot,
        requirement: i.requirement,
        drift: 'unsatisfied-but-unrecorded',
        detail: `${i.requirement} is unsatisfied at ${i.slot} but source does not record it — recommit to bring the file up to date`,
      })
  }

  /* totals */
  const byRequirement: LintReport['byRequirement'] = {}
  const byBand: LintReport['byBand'] = {}
  for (const { item } of contracts) {
    const r = (byRequirement[item.requirement] ??= { total: 0, acknowledged: 0 })
    r.total++
    if (item.accepted) r.acknowledged++
    byBand[`${item.view}/${item.band}`] = (byBand[`${item.view}/${item.band}`] ?? 0) + 1
  }

  return { contracts, dangling, drift, grammar: grammarFindings(manifest), byRequirement, byBand }
}

/* ---------------- the vocabulary itself ---------------- */

const POSITION_NAMES = new Set([
  'left', 'right', 'top', 'bottom', 'upper', 'lower', 'start', 'end', 'middle', 'centre', 'center',
])

const sameContract = (a: Band, b: Band) =>
  JSON.stringify(a.behavior ?? {}) === JSON.stringify(b.behavior ?? {})

export function grammarFindings(manifest: Manifest): GrammarFinding[] {
  const out: GrammarFinding[] = []
  const at = (view: string, where: string, rule: GrammarFinding['rule'], detail: string) =>
    out.push({ kind: 'grammar', rule, view, where, detail })

  for (const view of manifest.views) {
    const description = describeGrammar(manifest, view.id)
    if (!description) continue
    const features = featuresOf(manifest, view.id)

    /* a requirement nothing provides — the one that dragging cannot fix */
    for (const s of description.satisfiable) {
      if (!s.required || s.providers.length) continue
      const who = features
        .filter((f) => f.requires.includes(s.requirement))
        .map((f) => f.component)
      at(
        view.id,
        s.requirement,
        'unsatisfiable-requirement',
        `${who.join(', ')} require${who.length === 1 ? 's' : ''} ${s.requirement}, and no band in "${view.id}" provides it. ` +
          'No drag can resolve this — add a band or widen an existing one.',
      )
    }

    /* a feature that can only ever sit in one place */
    for (const f of description.freedom) {
      if (f.free.length !== 1) continue
      const feature = features.find((x) => x.id === f.feature)
      if (!feature?.requires.length) continue
      at(
        view.id,
        f.free[0],
        'pinned-feature',
        `${f.component} can only ever sit in ${f.free[0]} — it requires ${feature.requires.join(', ')} ` +
          'and nothing else satisfies that. Sometimes right; more often a contract provided by one narrow band.',
      )
    }

    /* two bands nothing can tell apart */
    for (let i = 1; i < view.bands.length; i++) {
      const prev = view.bands[i - 1]
      const band = view.bands[i]
      if (!sameContract(prev, band)) continue
      at(
        view.id,
        `${prev.id} + ${band.id}`,
        'indistinguishable-bands',
        `"${prev.id}" and "${band.id}" carry the same contract, so no requirement can tell them apart. ` +
          'The split buys no free movement — cost follows the contract, not the band count — and leaves ' +
          `the vocabulary with two names for one region. One band of ${prev.columns + band.columns} says the same thing once.`,
      )
    }

    /* a band that promises nothing */
    for (const band of view.bands)
      if (!band.behavior || Object.keys(band.behavior).length === 0)
        at(
          view.id,
          band.id,
          'contractless-band',
          `"${band.id}" declares no behaviour, so it satisfies no focus-phase requirement. ` +
            'Anything requiring one costs something here.',
        )

    /* a name that will stop being true */
    for (const band of view.bands)
      if (POSITION_NAMES.has(band.id.toLowerCase()))
        at(
          view.id,
          band.id,
          'position-name',
          `"${band.id}" names a position. Position names stop being true when the band stacks or the ` +
            'document runs right-to-left, and they do not aggregate across a codebase — two repos ' +
            'naming one region differently make the counts worthless. Prefer a role name.',
        )

    /* vocabulary nobody has used */
    const never = new Set(description.neverOccupied)
    const namedByColumns = new Set<string>()
    for (const band of view.bands) {
      // Trailing unused columns name their own fix, so report the narrowing
      // rather than the individual holes.
      let unused = 0
      for (let c = band.columns; c >= 1; c--) {
        if (!never.has(`${band.id}/${c}`)) break
        unused++
      }
      if (unused > 0 && unused < band.columns) {
        for (let c = band.columns; c > band.columns - unused; c--)
          namedByColumns.add(`${band.id}/${c}`)
        at(
          view.id,
          band.id,
          'unused-columns',
          `"${band.id}" has ${band.columns} columns and no state has ever used more than ` +
            `${band.columns - unused}. Narrow it, or keep the headroom deliberately.`,
        )
      }
    }
    for (const slot of description.neverOccupied)
      if (!namedByColumns.has(slot))
        at(
          view.id,
          slot,
          'unoccupied-slot',
          `${slot} holds nothing in any state. Headroom, or vocabulary nobody needed — only you know which.`,
        )
  }

  return out
}

export function formatLint(report: LintReport): string {
  const out: string[] = ['']
  const line = (s = '') => out.push(s)

  line('UNSATISFIED BEHAVIOUR CONTRACTS')
  line('─'.repeat(34))
  if (!report.contracts.length) line('  none')
  for (const { item } of report.contracts) {
    line(
      `  ${item.accepted ? '·' : '!'} ${item.view}/${item.state}  ${item.component} in ${item.slot}  ${item.requirement}`,
    )
    line(`      ${item.reason}`)
    if (item.accepted) line(`      acknowledged by ${item.acceptedBy ?? 'human'}`)
  }

  line('')
  line('ASSIGNMENTS THAT NO LONGER RESOLVE')
  line('─'.repeat(34))
  if (!report.dangling.length) line('  none')
  for (const d of report.dangling)
    line(`  ! ${d.view}/${d.state}  ${d.feature} → ${d.slot}  (${d.reason})\n      ${d.detail}`)

  if (report.drift.length) {
    line('')
    line('RECORDS THAT DISAGREE WITH THE RESOLVER')
    line('─'.repeat(38))
    for (const d of report.drift) line(`  ~ ${d.view}/${d.state}  ${d.feature}\n      ${d.detail}`)
  }

  if (report.grammar.length) {
    line('')
    line('THE GRAMMAR ITSELF')
    line('─'.repeat(34))
    for (const g of report.grammar) {
      // Only the dead end gets an exclamation. The rest are shapes, not faults.
      const mark = g.rule === 'unsatisfiable-requirement' ? '!' : '~'
      line(`  ${mark} ${g.view}/${g.where}  (${g.rule})`)
      line(`      ${g.detail}`)
    }
  }

  const totals = Object.entries(report.byRequirement)
  if (totals.length) {
    line('')
    line('BY CONTRACT')
    line('─'.repeat(34))
    for (const [requirement, n] of totals.sort((a, b) => b[1].total - a[1].total))
      line(`  ${String(n.total).padStart(3)} × ${requirement.padEnd(14)} ${n.acknowledged} acknowledged`)
  }

  line('')
  const unack = report.contracts.filter((c) => !c.item.accepted).length
  line(
    `${report.contracts.length} contract finding(s), ${unack} unacknowledged · ` +
      `${report.dangling.length} dangling · ${report.drift.length} drifted · ` +
      `${report.grammar.length} grammar`,
  )
  line('')
  return out.join('\n')
}
