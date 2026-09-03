/**
 * THE MALLEABLE PROJECTION'S HANDLERS — how an override, a move, a prop pick,
 * a seed change and a ship are applied when someone decides them.
 *
 * The substrate owns the record; this layer owns the state each decision
 * changes: the override store, the JSX, the seed constant. Each handler wraps
 * the function that already did the work — `put`, `setScope`, `applyMove`,
 * `applyProp`, `ship` — and hands back the canonical body of what happened
 * plus the facts it already had. Nothing here evaluates anything.
 *
 * Two roots: the log lives at the product's root; `.malleable/` and the app
 * tree live at the library's. In this repo they differ; in a project that
 * installs the library they are the same directory.
 */
import fs from 'node:fs'
import path from 'node:path'
import { registerHandler, type Applied, type Refused, type Request, type ResolvedContext } from '@strata/substrate/decide'
import type { Consequence, Decision, DecisionBody, Scope, Value } from '@strata/substrate/decision'
import { registerProjection, type Imported } from '@strata/substrate/projection'
import type { MoveRequest, NodeAddress, Override, PropRequest, Store, ThemeSeeds } from '../schema'
import { OBSIDIAN } from '../engine/generateTheme'
import { readManifest, readStore, writeStore, STORE_PATH } from '../store/persist'
import { addressOf, put, remove, setScope } from '../store/store'
import { resolve } from '../resolve/resolve'
import { selectorFor } from '../resolve/selector'
import { applyMove } from '../structure/apply'
import { applyProp } from '../controls/apply'
import { ship } from '../ship/collapse'
import { registerState } from '@strata/substrate/skills'
import { registerMalleableEvaluators } from '../evaluators'
import { buildStructure } from '../identity/manifest'
import { formatStructure } from '../structure/read'
import { driftReport, formatDrift } from '../ship/drift'

export interface MalleableHome {
  /** Where `.malleable/` lives. */
  root: string
  /** The app tree, relative to `root`. */
  source: string
}

export type OverrideRequest = Request & {
  kind: 'override'
  action: 'set' | 'remove' | 'rescope'
  address?: NodeAddress
  property?: string
  value?: Value
  scope?: Scope
  /** For remove: the override's id, `scope:selector:property`. */
  id?: string
}
export type MoveDecisionRequest = Request & { kind: 'move'; request: MoveRequest }
export type PropDecisionRequest = Request & { kind: 'prop'; request: PropRequest }
export type SeedRequest = Request & { kind: 'seed'; seeds: ThemeSeeds }
export type ShipRequest = Request & { kind: 'ship' }

const sameValue = (a: Value, b: Value) => ('token' in a && 'token' in b ? a.token === b.token : 'literal' in a && 'literal' in b && a.literal === b.literal)

/** The structure reader and the codemod resolve the app tree against cwd; hold it there for the call. */
function within<T>(dir: string, f: () => T): T {
  const cwd = process.cwd()
  try {
    process.chdir(dir)
    return f()
  } finally {
    process.chdir(cwd)
  }
}

const whereOf = (scope: Scope, address: NodeAddress | undefined) =>
  scope === 'system' || !address ? {} : { node: address.nodeId, ...(address.viewId ? { view: address.viewId } : {}) }

export function registerMalleable(home: MalleableHome): void {
  registerHandler<OverrideRequest>('override', (req, ctx) => overrideHandler(req, ctx, home))
  registerHandler<MoveDecisionRequest>('move', (req, ctx) => moveHandler(req, ctx, home))
  registerHandler<PropDecisionRequest>('prop', (req, ctx) => propHandler(req, ctx, home))
  registerHandler<SeedRequest>('seed', (req, ctx) => seedHandler(req, ctx, home))
  registerHandler<ShipRequest>('ship', (_req, ctx) => shipHandler(ctx, home))
  registerProjection({
    name: path.join(path.relative(process.cwd(), home.root) || '.', STORE_PATH).replace(/^\.\//, ''),
    import: () => importStore(home),
    project: (_root, log) => ({ [path.join(path.relative(_root, home.root) || '.', STORE_PATH).replace(/^\.\//, '')]: projectStore(log) }),
  })
  registerMalleableEvaluators(home)
  registerState('structure', () => within(home.root, () => formatStructure(buildStructure(home.source))))
  registerState('drift', () => {
    try {
      return formatDrift(driftReport(readStore(home.root), readManifest(home.root)))
    } catch (err) {
      return `(no manifest here — ${err instanceof Error ? err.message : String(err)})`
    }
  })
}

/* ---------------- the store as a projection ---------------- */

const nodeOf = (o: Override) => (o.target.scope === 'system' ? {} : whereOf(o.target.scope, addressOf(o, o.target.selector.split('::').pop() ?? o.target.selector)))

/** Every row in the old store as the decision that wrote it; the seeds too, when someone moved them. */
function importStore(home: MalleableHome): Imported[] {
  const file = path.join(home.root, STORE_PATH)
  if (!fs.existsSync(file)) return []
  const store = readStore(home.root)
  const rows: Imported[] = store.overrides.map((o) => ({
    kind: 'override' as const,
    action: 'set' as const,
    scope: o.target.scope,
    selector: o.target.selector,
    property: o.property,
    value: o.value,
    ...nodeOf(o),
    at: new Date(o.ts).toISOString(),
    // The store recorded one `author`, and what it recorded was the surface
    // that wrote — the same conflation the ledger made. These rows take the
    // hands the import states rather than reading a judgement into a channel.
  }))
  if (JSON.stringify(store.seeds) !== JSON.stringify(OBSIDIAN))
    rows.push({ kind: 'seed', seeds: store.seeds, at: fs.statSync(file).mtime.toISOString() })
  return rows
}

/**
 * The store the record says. A fold, in order: a set or a rescope upserts its
 * row and drops what it absorbed; a remove drops its row; a ship drops what it
 * collapsed and moves the seeds; a retheme moves the seeds. The same order of
 * operations the handlers ran, so the text is the same text.
 */
export function projectStore(log: readonly Decision[], initialSeeds: ThemeSeeds = OBSIDIAN): string {
  let seeds = initialSeeds
  let overrides: Override[] = []
  const drop = (ids: readonly string[] | undefined) => {
    if (ids?.length) overrides = overrides.filter((o) => !ids.includes(o.id))
  }
  for (const d of log) {
    if (d.consequence.refused) continue
    if (d.kind === 'override') {
      const id = `${d.scope}:${d.selector}:${d.property}`
      if (d.action === 'remove') {
        drop([id])
        continue
      }
      if (!d.value) continue
      overrides = overrides.filter((o) => o.id !== id)
      overrides.push({ id, target: { scope: d.scope, selector: d.selector }, property: d.property, value: d.value, author: d.decided.kind, ts: Date.parse(d.at) })
      drop(d.consequence.absorbed)
    } else if (d.kind === 'seed') seeds = d.seeds
    else if (d.kind === 'ship') {
      drop(d.consequence.absorbed)
      if (d.seeds) seeds = d.seeds
    }
  }
  const store: Store = { version: 1, seeds, overrides }
  return JSON.stringify(store, null, 2) + '\n'
}

function overrideHandler(req: OverrideRequest, ctx: ResolvedContext, home: MalleableHome): Applied | Refused {
  const store = readStore(home.root)
  const ts = Date.parse(ctx.at)
  const written = [STORE_PATH]

  if (req.action === 'remove') {
    if (!req.id) return { refused: 'remove needs the override id — ids are scope:selector:property' }
    const gone = store.overrides.find((o) => o.id === req.id)
    if (!gone) return { refused: `no override "${req.id}" — ids are scope:selector:property` }
    const nodeId = gone.target.selector.split('::').pop() ?? gone.target.selector
    const body: DecisionBody = {
      kind: 'override',
      action: 'remove',
      scope: gone.target.scope,
      selector: gone.target.selector,
      property: gone.property,
      value: gone.value,
      ...whereOf(gone.target.scope, addressOf(gone, nodeId)),
    }
    if (!ctx.dryRun) writeStore(remove(store, req.id), home.root)
    return { body, written }
  }

  const { address, property } = req
  if (!address || !property) return { refused: `${req.action} needs an address and a property` }
  const manifest = readManifest(home.root)
  const node = manifest.nodes.find((n) => n.nodeId === address.nodeId)
  if (!node) return { refused: `unknown node ${address.nodeId}` }
  const base = node.base[property]
  if (!base) return { refused: `${address.nodeId} has no malleable ${property}` }

  if (req.action === 'set') {
    if (!req.value) return { refused: 'set needs a value' }
    const scope = req.scope ?? 'instance'
    const selector = selectorFor(scope === 'system' ? 'instance' : scope, address)
    const bodyFor = (s: Scope, sel: string, v: Value): DecisionBody => ({ kind: 'override', action: 'set', scope: s, selector: sel, property, value: v, ...whereOf(s, address) })
    // A drag is a statement about the thing under the cursor; widening goes
    // through setScope exactly as the promote control does.
    const prior = store.overrides.find((o) => o.id === `instance:${selectorFor('instance', address)}:${property}`)
    let next = put(store, { address, property, value: req.value, author: ctx.decided.kind, ts })
    const consequence: Consequence = {}
    let body = bodyFor(scope, selector, req.value)
    if (scope === 'instance' && prior && sameValue(prior.value, req.value)) return { body, unchanged: true }
    if (scope !== 'instance') {
      const change = setScope(next, manifest, address, property, scope, ctx.decided.kind, ts)
      if (change.refused) return { refused: change.refused, body }
      next = change.store
      if (change.absorbed.length) consequence.absorbed = change.absorbed.map((o) => o.id)
      if (change.proposal) {
        body = bodyFor('system', change.proposal.seed, { literal: String(change.proposal.to) })
        consequence.note = `seed ${change.proposal.seed} ${change.proposal.from} → ${change.proposal.to} · also moves ${change.proposal.sideEffects.length} token(s)`
      }
    }
    if (!ctx.dryRun) writeStore(next, home.root)
    return { body, consequence, written }
  }

  // rescope: the value winning at this address moves to another scope
  if (!req.scope) return { refused: 'rescope needs a scope' }
  const before = resolve({ seeds: store.seeds, overrides: store.overrides, address, property, base })
  const change = setScope(store, manifest, address, property, req.scope, ctx.decided.kind, ts)
  const selector = change.proposal ? change.proposal.seed : selectorFor(req.scope, address)
  const body: DecisionBody = {
    kind: 'override',
    action: 'rescope',
    scope: req.scope,
    selector,
    property,
    value: change.proposal ? { literal: String(change.proposal.to) } : before.value,
    ...(before.source !== 'base' ? { fromScope: before.source } : {}),
    ...whereOf(req.scope, address),
  }
  if (change.refused) return { refused: change.refused, body }
  const consequence: Consequence = {}
  if (change.absorbed.length) consequence.absorbed = change.absorbed.map((o) => o.id)
  if (change.proposal)
    consequence.note = `seed ${change.proposal.seed} ${change.proposal.from} → ${change.proposal.to} · also moves ${change.proposal.sideEffects.length} token(s)`
  if (!ctx.dryRun) writeStore(change.store, home.root)
  return { body, consequence, written }
}

function moveHandler(req: MoveDecisionRequest, ctx: ResolvedContext, home: MalleableHome): Applied | Refused {
  if (!req.request?.what || !req.request?.to) return { refused: 'a move needs what and to' }
  const result = within(home.root, () => applyMove(home.source, req.request, ctx.decided.kind, ctx.at, { root: home.root, dryRun: ctx.dryRun }))
  if (!result.ok) return { refused: result.error }
  const r = result.record
  const body: DecisionBody = { kind: 'move', region: r.what, from: r.from, to: r.to }
  const consequence: Consequence = {}
  if (result.adapt.length) consequence.adapt = result.adapt
  if (result.edits.length) consequence.note = result.edits.map((e) => `${e.file}: ${e.what}`).join(' · ')
  return { body, consequence, written: result.written, unchanged: result.unchanged }
}

function propHandler(req: PropDecisionRequest, ctx: ResolvedContext, home: MalleableHome): Applied | Refused {
  if (!req.request?.file || !req.request?.component || !req.request?.prop) return { refused: 'a pick needs file, component and prop' }
  const result = applyProp(req.request, ctx.decided.kind, ctx.at, { root: home.root, dryRun: ctx.dryRun })
  if (!result.ok) return { refused: result.error }
  const r = result.record
  const body: DecisionBody = { kind: 'prop', component: r.what, prop: r.prop, file: r.file, line: r.line, from: r.from, to: r.to }
  return { body, consequence: result.edit ? { note: result.edit } : {}, written: result.written, unchanged: result.unchanged }
}

function seedHandler(req: SeedRequest, ctx: ResolvedContext, home: MalleableHome): Applied | Refused {
  if (!req.seeds || typeof req.seeds.hue !== 'number') return { refused: 'a retheme needs six seeds' }
  const store = readStore(home.root)
  const body: DecisionBody = { kind: 'seed', seeds: req.seeds, from: store.seeds }
  if (JSON.stringify(store.seeds) === JSON.stringify(req.seeds)) return { body, unchanged: true }
  if (!ctx.dryRun) writeStore({ ...store, seeds: req.seeds }, home.root)
  return { body, written: [STORE_PATH] }
}

function shipHandler(ctx: ResolvedContext, home: MalleableHome): Applied | Refused {
  const store = readStore(home.root)
  const manifest = readManifest(home.root)
  const result = ship(store, manifest, { dryRun: ctx.dryRun, root: home.root })
  if (!ctx.dryRun) writeStore(result.store, home.root)
  const body: DecisionBody = { kind: 'ship', promoted: result.promoted, frozen: result.frozen, seeds: result.store.seeds }
  const dropped = store.overrides.filter((o) => !result.store.overrides.some((k) => k.id === o.id)).map((o) => o.id)
  const consequence: Consequence = { affected: result.edits.length, ...(dropped.length ? { absorbed: dropped } : {}) }
  const notes = [...result.edits.map((e) => `${e.file}: ${e.what}`), ...result.refusals.map((r) => `refused: ${r}`)]
  if (notes.length) consequence.note = notes.join(' · ')
  return { body, consequence, written: [...result.edits.map((e) => e.file), STORE_PATH] }
}
