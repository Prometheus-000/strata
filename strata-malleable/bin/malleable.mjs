#!/usr/bin/env node
/**
 * The malleable CLI. Everything the harness does, the terminal can do too —
 * not for parity's sake, but because the resolver has to be provable without a
 * browser, and a command that prints its reasoning is how you prove it.
 */
import process from 'node:process'
import { assignIdentity, buildManifest, buildStructure } from '../src/identity/manifest.ts'
import { readManifest, readStore, writeManifest, writeStore, writeStructure } from '../src/store/persist.ts'
import { formatStructure } from '../src/structure/read.ts'
import { applyMove } from '../src/structure/apply.ts'
import { describeMove } from '../src/structure/move.ts'
import { formatReceipt, markReady, readReceipt, writeReceipt, READY_PATH } from '../src/structure/receipt.ts'
import { init } from '../src/init.ts'
import { applyProp, parseTsx } from '../src/controls/apply.ts'
import { callSitesOf } from '../src/controls/read.ts'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'
import { resolve as resolveValue } from '../src/resolve/resolve.ts'
import { describe, reconcile, put, remove, setScope } from '../src/store/store.ts'
import { driftReport, formatDrift } from '../src/ship/drift.ts'
import { ship } from '../src/ship/collapse.ts'
import { authorFrom } from '../src/author.ts'
import { SCOPES } from '../src/schema/index.ts'

const [cmd, ...rest] = process.argv.slice(2)
const flag = (name) => {
  const i = rest.indexOf(`--${name}`)
  return i === -1 ? undefined : rest[i + 1]
}
const has = (name) => rest.includes(`--${name}`)
const positional = rest.filter((a, i) => !a.startsWith('--') && !(i > 0 && rest[i - 1].startsWith('--')))

/** The tree the codemod and the reader operate on: --root, then MALLEABLE_ROOT, then this repo's fixtures. */
const ROOT = flag('root') ?? process.env.MALLEABLE_ROOT ?? 'fixtures/app'

/** Who is writing, or a usage error. Never a silent default. */
const author = () => {
  const who = authorFrom(rest, process.env)
  if ('error' in who) {
    console.error(`\n  ${who.error}\n`)
    process.exit(1)
  }
  return who
}

switch (cmd) {
  case 'id': {
    const { written, assigned, regions, unchanged } = assignIdentity(ROOT)
    const manifest = buildManifest(ROOT)
    writeManifest(manifest)
    const structure = buildStructure(ROOT)
    writeStructure(structure)
    for (const a of assigned) console.log(`  + ${a.nodeId}`)
    for (const r of regions) console.log(`  + region ${r.component}`)
    console.log(
      `\n${assigned.length} assigned · ${regions.length} region(s) named · ${unchanged} already pinned · ${written.length} file(s) rewritten`,
    )
    const malleable = manifest.nodes.filter((n) => Object.keys(n.base).length > 0)
    console.log(
      `${manifest.nodes.length} styled nodes · ${malleable.length} with malleable properties · ${structure.containers.length} container(s)`,
    )
    break
  }

  case 'regions': {
    console.log(formatStructure(buildStructure(ROOT)))
    break
  }

  /* ---------------- the move, from the terminal ---------------- */
  // What the drag does, an agent can do from here: the same rewrite, the same
  // receipt. It has to say who is writing, and it says so on every write.

  case 'move': {
    const [component] = positional
    const to = flag('to')
    if (!component || !to) {
      console.error(
        '\n  usage: malleable move <Component> --to <tag|landmark|sid|file:line> [--from <file>] [--index n] [--line n] [--at n] [--by human|agent] [--dry]\n',
      )
      process.exit(1)
    }
    const who = author()
    const structure = buildStructure(ROOT)
    const inFile = flag('from')
    const line = flag('line') ? Number(flag('line')) : undefined
    const index = Number(flag('index') ?? 0)
    // Where it is: every container holding a <Component /> as a plain child.
    let sources = structure.containers
      .filter((c) => c.children.some((k) => k.kind === 'component' && k.component === component))
      .filter((c) => !inFile || c.file.endsWith(inFile))
    if (line !== undefined) sources = sources.filter((c) => c.children.some((k) => k.component === component && k.line === line))
    if (!sources.length) {
      console.error(`\n  no <${component} /> under any container${inFile ? ` in ${inFile}` : ''} — see \`malleable regions\`\n`)
      process.exit(1)
    }
    if (sources.length > 1) {
      console.error(`\n  <${component} /> sits under ${sources.length} containers — say which with --from <file> or --line <n>:`)
      for (const c of sources) console.error(`    ${c.sid.padEnd(30)} ${c.file}:${c.line}`)
      console.error('')
      process.exit(1)
    }
    const source = sources[0]
    const thing =
      line !== undefined
        ? source.children.find((k) => k.component === component && k.line === line)
        : source.children.find((k) => k.kind === 'component' && k.component === component && k.ordinal === index)
    if (!thing) {
      console.error(`\n  no <${component} /> #${index} under ${source.sid}\n`)
      process.exit(1)
    }
    // Where it goes: a tag, a landmark, a sid, or file:line.
    const [toFile, toLine] = to.includes(':') ? to.split(':') : [null, null]
    const targets = structure.containers.filter(
      (c) =>
        c.sid === to ||
        c.tag === to ||
        c.landmark === to ||
        (toFile && c.file.endsWith(toFile) && String(c.line) === toLine),
    )
    if (!targets.length) {
      console.error(`\n  no container "${to}" — see \`malleable regions\`\n`)
      process.exit(1)
    }
    if (targets.length > 1) {
      console.error(`\n  "${to}" names ${targets.length} containers — use the sid:`)
      for (const c of targets) console.error(`    ${c.sid.padEnd(30)} ${c.file}:${c.line}`)
      console.error('')
      process.exit(1)
    }
    const target = targets[0]
    const at = flag('at') !== undefined ? Number(flag('at')) : undefined
    const anchor = at !== undefined ? target.children.filter((k) => !(target.sid === source.sid && k === thing))[at] : undefined
    const req = {
      what: { container: source.sid, region: component, ordinal: thing.ordinal },
      to: anchor ? { container: target.sid, before: { region: anchor.component, ordinal: anchor.ordinal } } : { container: target.sid, end: true },
    }
    const result = applyMove(ROOT, req, who.author, new Date().toISOString(), { dryRun: has('dry') })
    if (!result.ok) {
      console.error(`\n  ${result.error}\n`)
      process.exit(1)
    }
    console.log('')
    if (result.unchanged) console.log(`  <${component} /> is already there — nothing written`)
    else {
      for (const e of result.edits) console.log(`  ${e.file.padEnd(34)} ${e.what}`)
      console.log(`\n  ${describeMove(result.record)}`)
    }
    console.log(`  ${who.because}`)
    console.log(has('dry') ? '  (dry run — nothing written)\n' : result.unchanged ? '' : `  ~ ${result.written.join(', ')} · ${READY_PATH}\n`)
    break
  }

  /* ---------------- a prop pick, from the terminal ---------------- */

  case 'prop': {
    const [component, prop, rawValue] = positional
    const file = flag('in')
    if (!component || !prop || (!rawValue && !has('default')) || !file) {
      console.error(
        '\n  usage: malleable prop <Component> <prop> <value | --default> --in <file> [--parent <Component>] [--index n] [--by human|agent] [--dry]\n',
      )
      process.exit(1)
    }
    const who = author()
    const abs = path.resolve(process.cwd(), file)
    if (!fs.existsSync(abs)) {
      console.error(`\n  no such file ${file}\n`)
      process.exit(1)
    }
    const sites = callSitesOf(parseTsx(file, fs.readFileSync(abs, 'utf8')), component)
    const parents = [...new Set(sites.map((s) => s.parent))]
    const parent = flag('parent') ?? (parents.length === 1 ? parents[0] : undefined)
    if (!parent) {
      console.error(
        parents.length
          ? `\n  <${component}> is called from ${parents.length} components in ${file} — say which with --parent: ${parents.join(', ')}\n`
          : `\n  no <${component}> in ${file}\n`,
      )
      process.exit(1)
    }
    // `true`/`false` are booleans, a number is a number, anything else a string; --default removes the attribute.
    const value = has('default') ? null : rawValue === 'true' ? true : rawValue === 'false' ? false : /^-?\d+(\.\d+)?$/.test(rawValue) ? Number(rawValue) : rawValue
    const req = { file, component, parent, ordinal: Number(flag('index') ?? 0), prop, value }
    const result = applyProp(req, who.author, new Date().toISOString(), { dryRun: has('dry') })
    if (!result.ok) {
      console.error(`\n  ${result.error}\n`)
      process.exit(1)
    }
    console.log('')
    console.log(result.unchanged ? `  ${prop} is already ${rawValue ?? 'the default'} there — nothing written` : `  ${result.edit}`)
    console.log(`  ${who.because}`)
    console.log(has('dry') ? '  (dry run — nothing written)\n' : result.unchanged ? '' : `  ~ ${file} · ${READY_PATH}\n`)
    break
  }

  case 'ready': {
    const who = author()
    const receipt = markReady(readReceipt(), who.author, new Date().toISOString())
    writeReceipt(receipt)
    console.log(formatReceipt(receipt))
    console.log(`  wrote ${READY_PATH} — ${who.because}`)
    console.log('  nothing was committed; the moves are already in source. Next: /malleable-review\n')
    break
  }

  case 'init': {
    const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
    const result = init(process.cwd(), packageRoot)
    for (const f of result.wrote) console.log(`  + ${f}`)
    for (const f of result.skipped) console.log(`  · ${f} (unchanged)`)
    for (const n of result.notes) console.log(`  note: ${n}`)
    console.log('\n  next: malleable id && npm run dev\n')
    break
  }
  case 'manifest': {
    const m = readManifest()
    for (const n of m.nodes) {
      const props = Object.entries(n.base)
        .map(([k, v]) => `${k}=${'token' in v ? v.token : v.literal}`)
        .join(' ')
      console.log(
        `${n.nodeId.padEnd(34)} ${n.layer.padEnd(7)} ${n.viewId ? `[view:${n.viewId}] ` : ''}${props || '—'}`,
      )
    }
    break
  }
  case 'resolve': {
    const [nodeId, property] = positional
    if (!nodeId || !property) {
      console.error('usage: resolve <nodeId> <property> [--view v] [--instance i]')
      process.exit(1)
    }
    const store = readStore()
    const manifest = readManifest()
    const node = manifest.nodes.find((n) => n.nodeId === nodeId)
    if (!node) { console.error(`unknown node ${nodeId}`); process.exit(1) }
    const base = node.base[property]
    if (!base) { console.error(`${nodeId} has no malleable ${property}`); process.exit(1) }
    const address = {
      nodeId,
      viewId: flag('view') ?? '',
      instancePath: flag('instance') ?? '',
    }
    const r = resolveValue({ seeds: store.seeds, overrides: store.overrides, address, property, base })
    console.log(`\n${nodeId} · ${property}\n`)
    for (const step of r.chain) {
      const mark = step.outcome === 'applied' ? '●' : step.outcome === 'shadowed' ? '○' : '·'
      const v = 'token' in step.value ? `var(${step.value.token})` : step.value.literal
      console.log(
        `  ${mark} ${step.scope.padEnd(10)} ${v.padEnd(26)} ${step.note ?? ''}`,
      )
    }
    console.log(`\n  = ${r.css}${r.px !== null ? `  (${r.px}px)` : ''}  from ${r.source}\n`)
    break
  }
  case 'drift': {
    console.log(formatDrift(driftReport(readStore(), readManifest())))
    break
  }
  case 'ship': {
    const dry = has('dry')
    const result = ship(readStore(), readManifest(), { dryRun: dry, root: process.cwd() })
    console.log(result.log)
    if (!dry) writeStore(result.store)
    break
  }
  case 'reconcile': {
    const store = readStore()
    const dead = reconcile(store, readManifest())
    if (!dead.length) console.log('nothing redundant.')
    for (const o of dead) console.log(`  redundant · ${describe(store, o)}`)
    break
  }

  /* ---------------- writes — the terminal's half of the drag ---------------- */
  // What the overlay's handle does, an agent can do from here, through the same
  // `put` and `setScope`. The terminal adds one thing: it has to say who is
  // writing, and it says so on every write.

  case 'set': {
    const [nodeId, property] = positional
    // A token is given as `--token --radius-surface` or as `var(--radius-surface)`;
    // a bare `--radius-surface` would be read as a flag.
    const raw = flag('token') ? `var(${flag('token')})` : positional[2]
    if (!nodeId || !property || !raw) {
      console.error(
        '\n  usage: malleable set <nodeId> <property> <value | --token --name> [--scope instance|view|component|system] [--view v] [--instance i] [--by human|agent] [--dry]\n',
      )
      process.exit(1)
    }
    const scope = flag('scope') ?? 'instance'
    if (!SCOPES.includes(scope)) {
      console.error(`\n  --scope must be one of ${SCOPES.join(', ')}\n`)
      process.exit(1)
    }
    const who = author()
    const manifest = readManifest()
    const node = manifest.nodes.find((n) => n.nodeId === nodeId)
    if (!node) { console.error(`\n  unknown node ${nodeId}\n`); process.exit(1) }
    if (!node.base[property]) {
      console.error(`\n  ${nodeId} has no malleable ${property}\n`)
      process.exit(1)
    }
    // A token stays a token so the value follows a retheme; anything else is a
    // literal, frozen where it was set. `--radius-surface` and
    // `var(--radius-surface)` both mean the token.
    const tokenName = /^var\((--[\w-]+)\)$/.exec(raw)?.[1] ?? null
    const value = tokenName ? { token: tokenName } : { literal: raw }
    const address = { nodeId, viewId: flag('view') ?? '', instancePath: flag('instance') ?? '' }
    const ts = Date.now()
    let store = put(readStore(), { address, property, value, author: who.author, ts })
    const log = [`\n  ${property} = ${tokenName ? `var(${tokenName})` : raw} on ${nodeId}`]
    if (scope !== 'instance') {
      // Widen from the instance write, exactly as the promote control does, so
      // the terminal and the overlay absorb the same narrower overrides.
      const change = setScope(store, manifest, address, property, scope, who.author, ts + 1)
      if (change.refused) {
        console.error(`\n  ${change.refused}\n`)
        process.exit(1)
      }
      store = change.store
      log.push(`  scope: ${scope}${change.absorbed.length ? ` · absorbed ${change.absorbed.length} narrower override(s)` : ''}`)
      if (change.proposal)
        log.push(
          `  seed ${change.proposal.seed} ${change.proposal.from} → ${change.proposal.to} · also moves ${change.proposal.sideEffects.length} token(s)`,
        )
    }
    console.log(log.join('\n'))
    if (has('dry')) console.log(`  ${who.because}\n  (dry run — nothing written)\n`)
    else {
      writeStore(store)
      console.log(`  ${who.because}\n  ~ .malleable/overrides.json\n`)
    }
    break
  }

  case 'remove': {
    const [id] = positional
    if (!id) { console.error('\n  usage: malleable remove <override id>\n'); process.exit(1) }
    const store = readStore()
    const gone = store.overrides.find((o) => o.id === id)
    if (!gone) { console.error(`\n  no override "${id}" — ids are scope:selector:property\n`); process.exit(1) }
    console.log(`\n  removed · ${describe(store, gone)}`)
    if (has('dry')) console.log('  (dry run — nothing written)\n')
    else {
      writeStore(remove(store, id))
      console.log('  ~ .malleable/overrides.json\n')
    }
    break
  }

  default:
    console.log(`malleable — commands:
  id          stamp identity (data-sid, data-view, data-region), rebuild the manifest and the structure
  manifest    list every styled node and its malleable base values
  regions     every container with its file:line, and the regions it holds, in order
  resolve     <nodeId> <property> [--view v] [--instance i] — value, and why
  reconcile   overrides the system has caught up with
  drift       unresolved drift, with counts
  ship        collapse promoted overrides into source, freeze the rest
  init        install the Claude Code skill and commands into this project

  writes — every one names its author (--by human|agent, MALLEABLE_AUTHOR, or CLAUDECODE):
  set         <nodeId> <property> <value | --token --name> [--scope s] [--view v] [--instance i] [--dry]
  remove      <override id>
  move        <Component> --to <tag|landmark|sid|file:line> [--from <file>] [--index n] [--line n] [--at n] [--dry]
  prop        <Component> <prop> <value | true | false | --default> --in <file> [--parent <Component>] [--index n] [--dry]
  ready       write ${READY_PATH} — hand the moves and picks to review; commits nothing

  --root <dir> or MALLEABLE_ROOT picks the tree (default: fixtures/app)`)
}
