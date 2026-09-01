import assert from 'node:assert/strict'
import { test } from 'node:test'
import { OBSIDIAN } from '../src/engine/generateTheme'
import { resolve } from '../src/resolve/resolve'
import { selectorFor } from '../src/resolve/selector'
import { emptyStore, put, reconcile, setScope } from '../src/store/store'
import type { Manifest, NodeAddress, Store } from '../src/schema'

const CARD = 'Card.div.st-card'
const MANIFEST: Manifest = {
  version: 1,
  generatedFrom: [],
  nodes: [
    {
      nodeId: CARD,
      file: 'fixtures/app/recipes/Card.tsx',
      component: 'Card',
      layer: 'recipe',
      tag: 'div',
      classes: ['st-card'],
      base: { radius: { token: '--radius-surface' }, padding: { token: '--surface-pad' } },
      baseFrom: {
        radius: { selector: '.st-card', file: 'fixtures/app/recipes/recipes.css' },
        padding: { selector: '.st-card', file: 'fixtures/app/recipes/recipes.css' },
      },
    },
    {
      nodeId: 'Gallery.div.gallery__grid',
      file: 'fixtures/app/views/Gallery.tsx',
      component: 'Gallery',
      layer: 'local',
      tag: 'div',
      classes: ['gallery__grid'],
      base: { gap: { literal: '24px' } },
      baseFrom: { gap: { selector: '.gallery__grid', file: 'fixtures/app/views/views.css' } },
    },
  ],
}

const at = (viewId: string, instancePath: string): NodeAddress => ({
  nodeId: CARD,
  viewId,
  instancePath,
})
const EMBER = at('gallery', 'ember')
const MEADOW = at('gallery', 'meadow')
const MOTION = at('settings', 'motion')

const radiusAt = (store: Store, address: NodeAddress) =>
  resolve({
    seeds: store.seeds,
    overrides: store.overrides,
    address,
    property: 'radius',
    base: { token: '--radius-surface' },
  })

const drag = (store: Store, address: NodeAddress, literal: string, ts = 1) =>
  put(store, { address, property: 'radius', value: { literal }, author: 'human', ts })

const scope = (store: Store, address: NodeAddress, to: Parameters<typeof setScope>[4]) =>
  setScope(store, MANIFEST, address, 'radius', to, 'human', 2)

test('a drag writes an instance override and nothing else moves', () => {
  const store = drag(emptyStore(OBSIDIAN), EMBER, '20px')
  assert.equal(store.overrides.length, 1)
  assert.equal(store.overrides[0].target.scope, 'instance')
  assert.equal(store.overrides[0].author, 'human')
  assert.equal(radiusAt(store, EMBER).css, '20px')
  assert.equal(radiusAt(store, MEADOW).source, 'base')
  assert.equal(radiusAt(store, MOTION).source, 'base')
})

test('a second drag on the same node replaces, never accumulates', () => {
  let store = drag(emptyStore(OBSIDIAN), EMBER, '20px', 1)
  store = drag(store, EMBER, '24px', 2)
  assert.equal(store.overrides.length, 1)
  assert.equal(radiusAt(store, EMBER).css, '24px')
})

test('“all here” reaches every card in the view and no card outside it', () => {
  let store = drag(emptyStore(OBSIDIAN), EMBER, '20px')
  const change = scope(store, EMBER, 'view')
  store = change.store
  assert.equal(store.overrides.length, 1)
  assert.equal(store.overrides[0].target.scope, 'view')
  assert.equal(radiusAt(store, EMBER).css, '20px')
  assert.equal(radiusAt(store, MEADOW).css, '20px')
  assert.equal(radiusAt(store, MOTION).source, 'base')
})

test('widening absorbs disagreeing siblings, and says how many', () => {
  let store = drag(emptyStore(OBSIDIAN), EMBER, '20px', 1)
  store = drag(store, MEADOW, '6px', 1)
  store = drag(store, MOTION, '9px', 1)
  const change = scope(store, EMBER, 'view')
  // The meadow instance disagreed and is absorbed — "all here" has to mean it.
  assert.equal(change.absorbed.length, 2)
  assert.equal(change.store.overrides.length, 2) // the view rule + settings' instance
  assert.equal(radiusAt(change.store, MEADOW).css, '20px')
  assert.equal(radiusAt(change.store, MOTION).css, '9px')
})

test('“the component” crosses views; “all here” did not', () => {
  let store = drag(emptyStore(OBSIDIAN), EMBER, '20px')
  store = scope(store, EMBER, 'view').store
  assert.equal(radiusAt(store, MOTION).source, 'base')
  store = scope(store, EMBER, 'component').store
  assert.equal(store.overrides.length, 1)
  assert.equal(store.overrides[0].target.scope, 'component')
  assert.equal(radiusAt(store, MOTION).css, '20px')
})

test('“just this” narrows back and the siblings return to base', () => {
  let store = drag(emptyStore(OBSIDIAN), EMBER, '20px')
  store = scope(store, EMBER, 'component').store
  store = scope(store, EMBER, 'instance').store
  assert.equal(store.overrides.length, 1)
  assert.equal(store.overrides[0].target.scope, 'instance')
  assert.equal(radiusAt(store, EMBER).css, '20px')
  assert.equal(radiusAt(store, MEADOW).source, 'base')
})

test('narrowing leaves an unrelated wider decision standing', () => {
  // Someone set the recipe to 4px last week. Today a new edit is narrowed to
  // one card: the sibling must fall back to the recipe, not to the base.
  let store = put(emptyStore(OBSIDIAN), {
    address: EMBER,
    property: 'radius',
    value: { literal: '4px' },
    author: 'human',
    ts: 1,
    scope: 'component',
  })
  store = drag(store, EMBER, '20px', 2)
  store = scope(store, EMBER, 'instance').store
  assert.equal(radiusAt(store, EMBER).css, '20px')
  assert.equal(radiusAt(store, MEADOW).css, '4px')
})

test('re-scoping is idempotent', () => {
  let store = drag(emptyStore(OBSIDIAN), EMBER, '20px')
  const once = scope(store, EMBER, 'view').store
  const twice = scope(once, EMBER, 'view').store
  assert.deepEqual(once.overrides, twice.overrides)
})

test('“the system” proposes a seed, reports what else it moves, and applies it', () => {
  let store = drag(emptyStore(OBSIDIAN), EMBER, '18px')
  const change = scope(store, EMBER, 'system')
  const p = change.proposal!
  assert.equal(p.seed, 'energy')
  assert.equal(p.token, '--radius-surface')
  assert.ok(p.to > OBSIDIAN.energy, 'a bigger radius needs more energy')
  assert.ok(Math.abs(p.achievedPx - 18) < 0.05)
  assert.equal(p.exact, true)
  // Energy is motion as well as shape. Going system-wide has to say so.
  const moved = p.sideEffects.map((s) => s.token)
  assert.ok(moved.includes('--motion-base'))
  assert.ok(moved.includes('--radius-interactive'))
  assert.equal(change.store.overrides.length, 1)
  assert.equal(change.store.overrides[0].target.scope, 'system')
  assert.ok(Math.abs(radiusAt(change.store, MEADOW).px! - 18) < 0.05)
})

test('an unreachable value is reported as unreachable, not silently clamped', () => {
  const store = drag(emptyStore(OBSIDIAN), EMBER, '400px')
  const p = scope(store, EMBER, 'system').proposal!
  assert.equal(p.exact, false)
  assert.ok(p.achievedPx < 400)
  assert.equal(p.to, 1) // energy pinned at its ceiling
})

test('system scope is refused when no token carries the base', () => {
  const grid: NodeAddress = { nodeId: 'Gallery.div.gallery__grid', viewId: 'gallery', instancePath: '' }
  const store = put(emptyStore(OBSIDIAN), {
    address: grid,
    property: 'gap',
    value: { literal: '30px' },
    author: 'human',
    ts: 1,
  })
  const change = setScope(store, MANIFEST, grid, 'gap', 'system', 'human', 2)
  assert.ok(change.refused)
  assert.match(change.refused!, /literal/)
  assert.deepEqual(change.store.overrides, store.overrides)
})

test('scoping refuses when nothing has been changed yet', () => {
  const change = scope(emptyStore(OBSIDIAN), EMBER, 'view')
  assert.match(change.refused!, /nothing to scope/)
})

test('reconcile finds the hand edits the seed change made redundant', () => {
  // One card dragged to 18px; another dragged to 18px; then the first is
  // promoted to the system. The second is now saying what the system says.
  let store = drag(emptyStore(OBSIDIAN), EMBER, '18px', 1)
  store = drag(store, MOTION, '18.0px', 1)
  store = scope(store, EMBER, 'system').store
  const dead = reconcile(store, MANIFEST)
  assert.equal(dead.length, 1)
  assert.equal(dead[0].target.selector, selectorFor('instance', MOTION))
})
