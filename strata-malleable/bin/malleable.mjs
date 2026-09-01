#!/usr/bin/env node
/**
 * The malleable CLI. Everything the harness does, the terminal can do too —
 * not for parity's sake, but because the resolver has to be provable without a
 * browser, and a command that prints its reasoning is how you prove it.
 */
import process from 'node:process'
import { assignIdentity, buildManifest } from '../src/identity/manifest.ts'
import { readManifest, readStore, writeManifest, writeStore } from '../src/store/persist.ts'
import { resolve as resolveValue } from '../src/resolve/resolve.ts'
import { describe, reconcile } from '../src/store/store.ts'
import { driftReport, formatDrift } from '../src/ship/drift.ts'
import { ship } from '../src/ship/collapse.ts'

const [cmd, ...rest] = process.argv.slice(2)
const flag = (name) => {
  const i = rest.indexOf(`--${name}`)
  return i === -1 ? undefined : rest[i + 1]
}
const has = (name) => rest.includes(`--${name}`)
const positional = rest.filter((a, i) => !a.startsWith('--') && !(i > 0 && rest[i - 1].startsWith('--')))

const ROOT = 'fixtures/app'

switch (cmd) {
  case 'id': {
    const { written, assigned, unchanged } = assignIdentity(ROOT)
    const manifest = buildManifest(ROOT)
    writeManifest(manifest)
    for (const a of assigned) console.log(`  + ${a.nodeId}`)
    console.log(
      `\n${assigned.length} assigned · ${unchanged} already pinned · ${written.length} file(s) rewritten`,
    )
    const malleable = manifest.nodes.filter((n) => Object.keys(n.base).length > 0)
    console.log(
      `${manifest.nodes.length} styled nodes · ${malleable.length} with malleable properties`,
    )
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
  default:
    console.log(`malleable — commands:
  id          assign identity across Layer 2/3 sources, rebuild the manifest
  manifest    list every styled node and its malleable base values
  resolve     <nodeId> <property> [--view v] [--instance i] — value, and why
  reconcile   overrides the system has caught up with
  drift       unresolved drift, with counts
  ship        collapse promoted overrides into source, freeze the rest`)
}
