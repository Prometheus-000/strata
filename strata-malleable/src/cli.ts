/**
 * The malleable commands. Everything the harness does, the terminal can do
 * too — not for parity's sake, but because the resolver has to be provable
 * without a browser, and a command that prints its reasoning is how you prove
 * it. Every write goes through `decide()`, the same call the overlay makes,
 * and says who is writing on every line.
 *
 * `bin/malleable.mjs` runs this with the library as its home; `bin/strata.mjs`
 * at the product's root runs the same function with the log one level up.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { authorFrom } from '@strata/substrate/author'
import { decide, type DecideContext, type Request } from '@strata/substrate/decide'
import { SCOPES, type Scope } from '@strata/substrate/decision'
import { describe as describeDecision, formatHandoff } from '@strata/substrate/format'
import { collapseReversals, current, readAll, since } from '@strata/substrate/log'
import { assignIdentity, buildManifest, buildStructure } from './identity/manifest'
import { readManifest, readStore, writeManifest, writeStructure } from './store/persist'
import { formatStructure } from './structure/read'
import { init } from './init'
import { parseTsx } from './controls/apply'
import { callSitesOf } from './controls/read'
import { resolve as resolveValue } from './resolve/resolve'
import { describe, reconcile } from './store/store'
import { driftReport, formatDrift } from './ship/drift'
import { registerMalleable } from './decide'

export interface CliHome {
  /** Where `.strata/decisions.jsonl` lives. */
  logRoot: string
  /** Where `.malleable/` lives. */
  root: string
  /** The app tree, relative to `root`. */
  source: string
}

export interface CliIo {
  out: (s: string) => void
  err: (s: string) => void
}

export const MALLEABLE_COMMANDS = ['id', 'regions', 'move', 'prop', 'ready', 'handoff', 'init', 'manifest', 'resolve', 'drift', 'ship', 'reconcile', 'set', 'remove'] as const

/** Runs one command; returns the exit code. */
export function runMalleable(argv: string[], home: CliHome, env: Record<string, string | undefined> = process.env, io: CliIo = { out: console.log, err: console.error }): number {
  const [cmd, ...rest] = argv
  const flag = (name: string) => {
    const i = rest.indexOf(`--${name}`)
    return i === -1 ? undefined : rest[i + 1]
  }
  const has = (name: string) => rest.includes(`--${name}`)
  const positional = rest.filter((a, i) => !a.startsWith('--') && !(i > 0 && rest[i - 1].startsWith('--')))
  const fail = (msg: string) => {
    io.err(`\n  ${msg}\n`)
    return 1
  }

  registerMalleable({ root: home.root, source: home.source })
  const cwd = process.cwd()
  process.chdir(home.root)
  try {
    return run()
  } finally {
    process.chdir(cwd)
  }

  /** Who is writing, or a usage error. Never a silent default. */
  function context(): DecideContext | { error: string } {
    const who = authorFrom(rest, env)
    if ('error' in who) return who
    return { root: home.logRoot, by: who.author, via: 'cli', because: who.because, dryRun: has('dry') }
  }

  function write(request: Request, ctx: DecideContext) {
    const result = decide(request, ctx)
    if (!result.ok) {
      io.err(`\n  ${result.error}${result.decision ? '  (on the record as a refusal)' : ''}\n`)
      return null
    }
    return result
  }

  const footer = (ctx: DecideContext, written: string[]) =>
    ctx.dryRun ? `  ${ctx.because}\n  (dry run — nothing written)\n` : `  ${ctx.because}\n  ~ ${[...written, '.strata/decisions.jsonl'].join(', ')}\n`

  function run(): number {
    switch (cmd) {
      case 'id': {
        const { assigned, regions, unchanged, written } = assignIdentity(home.source)
        const manifest = buildManifest(home.source)
        writeManifest(manifest)
        const structure = buildStructure(home.source)
        writeStructure(structure)
        for (const a of assigned) io.out(`  + ${a.nodeId}`)
        for (const r of regions) io.out(`  + region ${r.component}`)
        io.out(`\n${assigned.length} assigned · ${regions.length} region(s) named · ${unchanged} already pinned · ${written.length} file(s) rewritten`)
        const malleable = manifest.nodes.filter((n) => Object.keys(n.base).length > 0)
        io.out(`${manifest.nodes.length} styled nodes · ${malleable.length} with malleable properties · ${structure.containers.length} container(s)`)
        return 0
      }

      case 'regions':
        io.out(formatStructure(buildStructure(home.source)))
        return 0

      /* ---------------- the move, from the terminal ---------------- */

      case 'move': {
        const [component] = positional
        const to = flag('to')
        if (!component || !to)
          return fail('usage: move <Component> --to <tag|landmark|sid|file:line> [--from <file>] [--index n] [--line n] [--at n] [--why "…"] [--by human|agent] [--dry]')
        const ctx = context()
        if ('error' in ctx) return fail(ctx.error)
        const structure = buildStructure(home.source)
        const inFile = flag('from')
        const line = flag('line') ? Number(flag('line')) : undefined
        const index = Number(flag('index') ?? 0)
        let sources = structure.containers
          .filter((c) => c.children.some((k) => k.kind === 'component' && k.component === component))
          .filter((c) => !inFile || c.file.endsWith(inFile))
        if (line !== undefined) sources = sources.filter((c) => c.children.some((k) => k.component === component && k.line === line))
        if (!sources.length) return fail(`no <${component} /> under any container${inFile ? ` in ${inFile}` : ''} — see \`regions\``)
        if (sources.length > 1) {
          io.err(`\n  <${component} /> sits under ${sources.length} containers — say which with --from <file> or --line <n>:`)
          for (const c of sources) io.err(`    ${c.sid.padEnd(30)} ${c.file}:${c.line}`)
          io.err('')
          return 1
        }
        const source = sources[0]
        const thing =
          line !== undefined
            ? source.children.find((k) => k.component === component && k.line === line)
            : source.children.find((k) => k.kind === 'component' && k.component === component && k.ordinal === index)
        if (!thing) return fail(`no <${component} /> #${index} under ${source.sid}`)
        const [toFile, toLine] = to.includes(':') ? to.split(':') : [null, null]
        const targets = structure.containers.filter(
          (c) => c.sid === to || c.tag === to || c.landmark === to || (toFile && c.file.endsWith(toFile) && String(c.line) === toLine),
        )
        if (!targets.length) return fail(`no container "${to}" — see \`regions\``)
        if (targets.length > 1) {
          io.err(`\n  "${to}" names ${targets.length} containers — use the sid:`)
          for (const c of targets) io.err(`    ${c.sid.padEnd(30)} ${c.file}:${c.line}`)
          io.err('')
          return 1
        }
        const target = targets[0]
        const at = flag('at') !== undefined ? Number(flag('at')) : undefined
        const anchor = at !== undefined ? target.children.filter((k) => !(target.sid === source.sid && k === thing))[at] : undefined
        const request = {
          what: { container: source.sid, region: component, ordinal: thing.ordinal },
          to: anchor ? { container: target.sid, before: { region: anchor.component, ordinal: anchor.ordinal } } : { container: target.sid, end: true },
        }
        const result = write({ kind: 'move', request, reason: flag('why') }, ctx)
        if (!result) return 1
        io.out('')
        if (result.unchanged) io.out(`  <${component} /> is already there — nothing written`)
        else {
          if (result.decision.consequence.note) io.out(`  ${result.decision.consequence.note}`)
          io.out(`\n  ${describeDecision(result.decision)}`)
        }
        io.out(footer(ctx, result.written))
        return 0
      }

      /* ---------------- a prop pick, from the terminal ---------------- */

      case 'prop': {
        const [component, prop, rawValue] = positional
        const file = flag('in')
        if (!component || !prop || (!rawValue && !has('default')) || !file)
          return fail('usage: prop <Component> <prop> <value | --default> --in <file> [--parent <Component>] [--index n] [--why "…"] [--by human|agent] [--dry]')
        const ctx = context()
        if ('error' in ctx) return fail(ctx.error)
        const abs = path.resolve(home.root, file)
        if (!fs.existsSync(abs)) return fail(`no such file ${file}`)
        const sites = callSitesOf(parseTsx(file, fs.readFileSync(abs, 'utf8')), component)
        const parents = [...new Set(sites.map((s) => s.parent))]
        const parent = flag('parent') ?? (parents.length === 1 ? parents[0] : undefined)
        if (!parent)
          return fail(
            parents.length
              ? `<${component}> is called from ${parents.length} components in ${file} — say which with --parent: ${parents.join(', ')}`
              : `no <${component}> in ${file}`,
          )
        // `true`/`false` are booleans, a number is a number, anything else a string; --default removes the attribute.
        const value = has('default') ? null : rawValue === 'true' ? true : rawValue === 'false' ? false : /^-?\d+(\.\d+)?$/.test(rawValue) ? Number(rawValue) : rawValue
        const request = { file, component, parent, ordinal: Number(flag('index') ?? 0), prop, value }
        const result = write({ kind: 'prop', request, reason: flag('why') }, ctx)
        if (!result) return 1
        io.out('')
        io.out(result.unchanged ? `  ${prop} is already ${rawValue ?? 'the default'} there — nothing written` : `  ${result.decision.consequence.note ?? describeDecision(result.decision)}`)
        io.out(footer(ctx, result.written))
        return 0
      }

      /* ---------------- the handoff ---------------- */

      case 'ready': {
        const ctx = context()
        if ('error' in ctx) return fail(ctx.error)
        const result = write({ kind: 'ready', reason: flag('why') }, ctx)
        if (!result) return 1
        io.out(handoff())
        io.out(`  ${ctx.because}`)
        io.out('  nothing was committed; the moves are already in source. Next: /malleable-review\n')
        return 0
      }

      case 'handoff':
        io.out(handoff())
        return 0

      case 'init': {
        const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
        const result = init(process.cwd(), packageRoot)
        for (const f of result.wrote) io.out(`  + ${f}`)
        for (const f of result.skipped) io.out(`  · ${f} (unchanged)`)
        for (const n of result.notes) io.out(`  note: ${n}`)
        io.out('\n  next: malleable id && npm run dev\n')
        return 0
      }

      case 'manifest': {
        for (const n of readManifest().nodes) {
          const props = Object.entries(n.base)
            .map(([k, v]) => `${k}=${'token' in v ? v.token : v.literal}`)
            .join(' ')
          io.out(`${n.nodeId.padEnd(34)} ${n.layer.padEnd(7)} ${n.viewId ? `[view:${n.viewId}] ` : ''}${props || '—'}`)
        }
        return 0
      }

      case 'resolve': {
        const [nodeId, property] = positional
        if (!nodeId || !property) return fail('usage: resolve <nodeId> <property> [--view v] [--instance i]')
        const store = readStore()
        const node = readManifest().nodes.find((n) => n.nodeId === nodeId)
        if (!node) return fail(`unknown node ${nodeId}`)
        const base = node.base[property]
        if (!base) return fail(`${nodeId} has no malleable ${property}`)
        const address = { nodeId, viewId: flag('view') ?? '', instancePath: flag('instance') ?? '' }
        const r = resolveValue({ seeds: store.seeds, overrides: store.overrides, address, property, base })
        io.out(`\n${nodeId} · ${property}\n`)
        for (const step of r.chain) {
          const mark = step.outcome === 'applied' ? '●' : step.outcome === 'shadowed' ? '○' : '·'
          const v = 'token' in step.value ? `var(${step.value.token})` : step.value.literal
          io.out(`  ${mark} ${step.scope.padEnd(10)} ${v.padEnd(26)} ${step.note ?? ''}`)
        }
        io.out(`\n  = ${r.css}${r.px !== null ? `  (${r.px}px)` : ''}  from ${r.source}\n`)
        return 0
      }

      case 'drift':
        io.out(formatDrift(driftReport(readStore(), readManifest())))
        return 0

      case 'ship': {
        const ctx = context()
        if ('error' in ctx) return fail(ctx.error)
        const result = write({ kind: 'ship', reason: flag('why') }, ctx)
        if (!result) return 1
        io.out(formatDrift(driftReport(readStore(), readManifest())))
        io.out(`  ${describeDecision(result.decision)}`)
        if (result.decision.consequence.note) for (const n of result.decision.consequence.note.split(' · ')) io.out(`    ${n}`)
        io.out(footer(ctx, result.written))
        return 0
      }

      case 'reconcile': {
        const store = readStore()
        const dead = reconcile(store, readManifest())
        if (!dead.length) io.out('nothing redundant.')
        for (const o of dead) io.out(`  redundant · ${describe(store, o)}`)
        return 0
      }

      /* ---------------- writes — the terminal's half of the drag ---------------- */

      case 'set': {
        const [nodeId, property] = positional
        // A token is given as `--token --radius-surface` or as `var(--radius-surface)`;
        // a bare `--radius-surface` would be read as a flag.
        const raw = flag('token') ? `var(${flag('token')})` : positional[2]
        if (!nodeId || !property || !raw)
          return fail('usage: set <nodeId> <property> <value | --token --name> [--scope instance|view|component|system] [--view v] [--instance i] [--why "…"] [--by human|agent] [--dry]')
        const scope = (flag('scope') ?? 'instance') as Scope
        if (!SCOPES.includes(scope)) return fail(`--scope must be one of ${SCOPES.join(', ')}`)
        const ctx = context()
        if ('error' in ctx) return fail(ctx.error)
        const tokenName = /^var\((--[\w-]+)\)$/.exec(raw)?.[1] ?? null
        const value = tokenName ? { token: tokenName } : { literal: raw }
        const address = { nodeId, viewId: flag('view') ?? '', instancePath: flag('instance') ?? '' }
        const result = write({ kind: 'override', action: 'set', address, property, value, scope, reason: flag('why') }, ctx)
        if (!result) return 1
        const d = result.decision
        io.out(`\n  ${property} = ${tokenName ? `var(${tokenName})` : raw} on ${nodeId}${result.unchanged ? ' — already so' : ''}`)
        if (d.kind === 'override' && d.scope !== 'instance') io.out(`  scope: ${d.scope}${d.consequence.absorbed?.length ? ` · absorbed ${d.consequence.absorbed.length} narrower override(s)` : ''}`)
        if (d.consequence.note) io.out(`  ${d.consequence.note}`)
        io.out(footer(ctx, result.written))
        return 0
      }

      case 'remove': {
        const [id] = positional
        if (!id) return fail('usage: remove <override id> [--why "…"] [--by human|agent] [--dry]')
        const ctx = context()
        if ('error' in ctx) return fail(ctx.error)
        const result = write({ kind: 'override', action: 'remove', id, reason: flag('why') }, ctx)
        if (!result) return 1
        io.out(`\n  removed · ${describeDecision(result.decision)}`)
        io.out(footer(ctx, result.written))
        return 0
      }

      default:
        io.out(`malleable — commands:
  id          stamp identity (data-sid, data-view, data-region), rebuild the manifest and the structure
  manifest    list every styled node and its malleable base values
  regions     every container with its file:line, and the regions it holds, in order
  resolve     <nodeId> <property> [--view v] [--instance i] — value, and why
  reconcile   overrides the system has caught up with
  drift       unresolved drift, with counts
  handoff     what changed since the last ready, from the record

  writes — every one is a decision on the record and names its author (--by human|agent, STRATA_AUTHOR, or CLAUDECODE):
  set         <nodeId> <property> <value | --token --name> [--scope s] [--view v] [--instance i] [--why "…"] [--dry]
  remove      <override id>
  move        <Component> --to <tag|landmark|sid|file:line> [--from <file>] [--index n] [--line n] [--at n] [--why "…"] [--dry]
  prop        <Component> <prop> <value | true | false | --default> --in <file> [--parent <Component>] [--index n] [--dry]
  ship        collapse promoted overrides into source, freeze the rest
  ready       hand the moves and picks to review; commits nothing
  init        install the Claude Code skill and commands into this project

  --root <dir> or MALLEABLE_ROOT picks the app tree (default: fixtures/app)`)
        return cmd ? 1 : 0
    }
  }

  /** Handed off means nothing has happened since the last ready; otherwise the ready is stale and the list is what is pending. */
  function handoff(): string {
    const all = readAll(home.logRoot)
    const pending = since(all, 'ready')
    const ready = pending.length === 0 ? (current(all).get('ready') ?? null) : null
    return formatHandoff(collapseReversals(pending), ready)
  }
}
