import assert from 'node:assert/strict'
import { test } from 'node:test'
import { OBSIDIAN, generateTheme } from '../src/engine/generateTheme'
import { effectiveSeeds, isRedundant, resolve, tokenTable } from '../src/resolve/resolve'
import { selectorFor } from '../src/resolve/selector'
import type { NodeAddress, Override, Value } from '../src/schema'

const ADDRESS: NodeAddress = {
  nodeId: 'Card.div.st-card',
  viewId: 'gallery',
  instancePath: 'ember',
}
const BASE: Value = { token: '--radius-surface' }

const ov = (
  scope: Override['target']['scope'],
  selector: string,
  value: Value,
  ts = 1,
): Override => ({
  id: `${scope}:${selector}:radius`,
  target: { scope, selector },
  property: 'radius',
  value,
  author: 'human',
  ts,
})

const run = (overrides: Override[], address = ADDRESS) =>
  resolve({ seeds: OBSIDIAN, overrides, address, property: 'radius', base: BASE })

test('with no overrides the base wins and says so', () => {
  const r = run([])
  assert.equal(r.source, 'base')
  assert.equal(r.css, 'var(--radius-surface)')
  // radius = lerp(0.375, 0.75, energy=0.5) = 0.5625rem; surface = ×1.5 = 0.844rem
  assert.equal(generateTheme(OBSIDIAN)['--radius-surface'], '0.844rem')
  assert.equal(r.px, 0.844 * 16)
})

test('narrower wins: instance ▸ view ▸ component ▸ base', () => {
  const overrides = [
    ov('component', 'Card.div.st-card', { literal: '4px' }),
    ov('view', selectorFor('view', ADDRESS), { literal: '8px' }),
    ov('instance', selectorFor('instance', ADDRESS), { literal: '12px' }),
  ]
  assert.equal(run(overrides).css, '12px')
  assert.equal(run(overrides.slice(0, 2)).css, '8px')
  assert.equal(run(overrides.slice(0, 1)).css, '4px')
  assert.equal(run([]).source, 'base')
})

test('the chain records every candidate and why it lost', () => {
  const overrides = [
    ov('component', 'Card.div.st-card', { literal: '4px' }),
    ov('instance', selectorFor('instance', ADDRESS), { literal: '12px' }),
  ]
  const r = run(overrides)
  const byScope = Object.fromEntries(r.chain.map((s) => [s.scope, s]))
  assert.equal(byScope.instance.outcome, 'applied')
  assert.equal(byScope.view.outcome, 'no-match')
  assert.equal(byScope.component.outcome, 'shadowed')
  assert.match(byScope.component.note!, /instance is narrower/)
  assert.equal(byScope.base.outcome, 'shadowed')
})

test('an override only reaches the node it addresses', () => {
  const elsewhere = [ov('instance', 'settings/motion::Card.div.st-card', { literal: '2px' })]
  assert.equal(run(elsewhere).source, 'base')
  const other: NodeAddress = { ...ADDRESS, viewId: 'settings', instancePath: 'motion' }
  assert.equal(run(elsewhere, other).css, '2px')
})

test('snapped stays a var(), drifted freezes to the literal', () => {
  const snapped = run([ov('instance', selectorFor('instance', ADDRESS), { token: '--strata-radius-2' })])
  assert.equal(snapped.css, 'var(--strata-radius-2)')
  assert.equal(snapped.px, 8)
  const drifted = run([ov('instance', selectorFor('instance', ADDRESS), { literal: '13px' })])
  assert.equal(drifted.css, '13px')
  assert.equal(drifted.px, 13)
})

test('a snapped override follows a retheme; a drifted one does not', () => {
  const kinetic = { ...OBSIDIAN, energy: 1 }
  const sel = selectorFor('instance', ADDRESS)
  const snapped = resolve({
    seeds: kinetic,
    overrides: [ov('instance', sel, { token: '--radius-overlay' })],
    address: ADDRESS,
    property: 'radius',
    base: BASE,
  })
  const calm = resolve({
    seeds: { ...OBSIDIAN, energy: 0 },
    overrides: [ov('instance', sel, { token: '--radius-overlay' })],
    address: ADDRESS,
    property: 'radius',
    base: BASE,
  })
  assert.notEqual(snapped.px, calm.px)
  const drifted = (energy: number) =>
    resolve({
      seeds: { ...OBSIDIAN, energy },
      overrides: [ov('instance', sel, { literal: '13px' })],
      address: ADDRESS,
      property: 'radius',
      base: BASE,
    }).px
  assert.equal(drifted(0), drifted(1))
})

test('later ts wins inside a scope, in any array order', () => {
  const sel = selectorFor('instance', ADDRESS)
  const a = ov('instance', sel, { literal: '5px' }, 100)
  const b = { ...ov('instance', sel, { literal: '9px' }, 200), id: 'other' }
  assert.equal(run([a, b]).css, '9px')
  assert.equal(run([b, a]).css, '9px')
})

test('system scope moves the seed, not the node', () => {
  const overrides: Override[] = [
    { ...ov('system', 'energy', { literal: '1' }), property: 'radius' },
  ]
  const seeds = effectiveSeeds(OBSIDIAN, overrides)
  assert.equal(seeds.energy, 1)
  const r = run(overrides)
  // The node still reads its base token — the token itself moved.
  assert.equal(r.source, 'base')
  assert.equal(r.css, 'var(--radius-surface)')
  assert.equal(r.px, 0.75 * 1.5 * 16)
  assert.equal(r.chain[0].scope, 'system')
})

test('resolution is deterministic and does not mutate its input', () => {
  const overrides = [ov('view', selectorFor('view', ADDRESS), { literal: '7px' })]
  const snapshot = JSON.stringify({ overrides, seeds: OBSIDIAN })
  const a = run(overrides)
  const b = run(overrides)
  assert.deepEqual(a, b)
  assert.equal(JSON.stringify({ overrides, seeds: OBSIDIAN }), snapshot)
})

test('an override equal to its base is redundant', () => {
  const sel = selectorFor('instance', ADDRESS)
  const input = (value: Value) => ({
    seeds: OBSIDIAN,
    overrides: [ov('instance', sel, value)],
    address: ADDRESS,
    property: 'radius',
    base: BASE,
  })
  assert.equal(isRedundant(input({ token: '--radius-surface' })), true)
  assert.equal(isRedundant(input({ literal: '13.504px' })), true)
  assert.equal(isRedundant(input({ literal: '20px' })), false)
})

test('the token table carries primitives and seed-derived roles alike', () => {
  const t = tokenTable(OBSIDIAN)
  assert.equal(t['--strata-space-4'], '1rem')
  assert.equal(t['--radius-pill'], '999px')
  assert.equal(t['--surface-pad'], '1.5000rem')
})
