import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { OBSIDIAN } from '../src/engine/generateTheme'
import { buildManifest } from '../src/identity/manifest'
import { emptyStore, put, setScope } from '../src/store/store'
import { ship, FROZEN_PATH } from '../src/ship/collapse'
import type { NodeAddress, Store } from '../src/schema'

/**
 * A throwaway copy of the tree, so ship can write for real and be read back.
 * No engine in it: a system promotion moves the seeds, and the seeds are on
 * the record. This used to copy the engine's source here because ship
 * rewrote the seed constant in it — a file a product that installs the engine
 * cannot write to, and a copy of what the record already held.
 */
function sandbox(): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'malleable-'))
  const dir = path.join(tmp, 'lib')
  fs.mkdirSync(dir)
  fs.cpSync('fixtures', path.join(dir, 'fixtures'), { recursive: true })
  return dir
}

const read = (dir: string, rel: string) => fs.readFileSync(path.join(dir, rel), 'utf8')
const manifest = () => buildManifest('fixtures/app')

const EMBER: NodeAddress = { nodeId: 'Card.div.st-card', viewId: 'gallery', instancePath: 'ember' }
const MEADOW: NodeAddress = { ...EMBER, instancePath: 'meadow' }

const drag = (store: Store, address: NodeAddress, value: { token: string } | { literal: string }) =>
  put(store, { address, property: 'radius', value, author: 'human', ts: 1 })

test('a component-scope override is written into the recipe’s own declaration', () => {
  const dir = sandbox()
  const m = manifest()
  let store = drag(emptyStore(OBSIDIAN), EMBER, { token: '--strata-radius-2' })
  store = setScope(store, m, EMBER, 'radius', 'component', 'human', 2).store
  const result = ship(store, m, { root: dir })
  assert.equal(result.refusals.length, 0)
  assert.match(read(dir, 'fixtures/app/recipes/recipes.css'), /border-radius: var\(--strata-radius-2\);/)
  // The promoted override is gone from the store — source is where it lives now.
  assert.equal(result.store.overrides.length, 0)
})

test('a drifted literal ships with a declared deviation, not in silence', () => {
  const dir = sandbox()
  const m = manifest()
  let store = drag(emptyStore(OBSIDIAN), EMBER, { literal: '17px' })
  store = setScope(store, m, EMBER, 'radius', 'component', 'human', 2).store
  ship(store, m, { root: dir })
  const css = read(dir, 'fixtures/app/recipes/recipes.css')
  assert.match(css, /border-radius: 17px \/\* deviation: shipped literal/)
})

test('two nodes promoting different values through one class is refused, not guessed', () => {
  const dir = sandbox()
  const m = manifest()
  // Force the collision: two distinct nodeIds pointing at the same declaration.
  const twinned = {
    ...m,
    nodes: m.nodes.map((n) =>
      n.nodeId === 'Card.div.st-card__head'
        ? {
            ...n,
            base: { ...n.base, radius: { token: '--radius-surface' } as const },
            baseFrom: {
              ...n.baseFrom,
              radius: { selector: '.st-card', file: 'fixtures/app/recipes/recipes.css' },
            },
          }
        : n,
    ),
  }
  let store = emptyStore(OBSIDIAN)
  store = put(store, { address: EMBER, property: 'radius', value: { literal: '4px' }, author: 'human', ts: 1, scope: 'component' })
  store = put(store, {
    address: { ...EMBER, nodeId: 'Card.div.st-card__head' },
    property: 'radius',
    value: { literal: '9px' },
    author: 'human',
    ts: 1,
    scope: 'component',
  })
  const result = ship(store, twinned, { root: dir })
  assert.equal(result.refusals.length, 1)
  assert.match(result.refusals[0], /two nodes promoted different values through one class/)
  assert.doesNotMatch(read(dir, 'fixtures/app/recipes/recipes.css'), /4px|9px/)
})

test('a system-scope override moves the seeds on the record, not a token and not a source file', () => {
  const dir = sandbox()
  const m = manifest()
  const store = drag(emptyStore(OBSIDIAN), EMBER, { literal: '18px' })
  const change = setScope(store, m, EMBER, 'radius', 'system', 'human', 2)
  const result = ship(change.store, m, { root: dir })
  assert.equal(result.store.seeds.energy, 1, 'the seeds the ship carries')
  assert.deepEqual(result.edits.filter((e) => /generateTheme/.test(e.file)), [], 'no source file is rewritten')
  assert.match(result.moved.join(' '), /seed energy → 1/)
  assert.match(result.log, /\(the record\)\s+seed energy → 1/)
  // Nothing was written into the token layer.
  assert.doesNotMatch(read(dir, 'fixtures/app/recipes/recipes.css'), /18px/)
})

test('un-promoted overrides ship frozen and are counted, never dropped', () => {
  const dir = sandbox()
  const m = manifest()
  let store = drag(emptyStore(OBSIDIAN), EMBER, { literal: '20px' })
  store = drag(store, MEADOW, { literal: '20px' })
  const result = ship(store, m, { root: dir })
  const frozen = read(dir, FROZEN_PATH)
  assert.match(frozen, /\[data-view="gallery"\] \[data-mi="ember"\]\[data-sid="Card.div.st-card"\]/)
  assert.match(frozen, /border-radius: 20px;/)
  assert.equal(result.store.overrides.length, 2, 'kept, not deleted')
  assert.match(result.log, /2 × radius = 20px/)
  assert.match(result.log, /2 instances/)
})

test('three of the same shape is called out as a candidate, and promoting it is named as a decision', () => {
  const m = manifest()
  let store = emptyStore(OBSIDIAN)
  for (const k of ['ember', 'meadow', 'glacier'])
    store = drag(store, { ...EMBER, instancePath: k }, { literal: '20px' })
  const result = ship(store, m, { dryRun: true })
  assert.match(result.log, /3 appearances — a candidate\. Promoting it is a decision:/)
  // Counted by the report; coined by a hand. The report offers the two ways
  // and takes neither.
  assert.match(result.log, /strata mint --<name> --value/)
})

test('a dry run writes nothing', () => {
  const dir = sandbox()
  const m = manifest()
  const before = read(dir, 'fixtures/app/recipes/recipes.css')
  let store = drag(emptyStore(OBSIDIAN), EMBER, { literal: '17px' })
  store = setScope(store, m, EMBER, 'radius', 'component', 'human', 2).store
  const result = ship(store, m, { root: dir, dryRun: true })
  assert.equal(read(dir, 'fixtures/app/recipes/recipes.css'), before)
  assert.match(result.log, /dry run/)
  assert.deepEqual(result.store, store)
})

test('shipping twice is shipping once', () => {
  const dir = sandbox()
  const m = manifest()
  let store = drag(emptyStore(OBSIDIAN), EMBER, { literal: '20px' })
  store = drag(store, MEADOW, { token: '--strata-radius-3' })
  const first = ship(store, m, { root: dir })
  const cssAfterFirst = read(dir, 'fixtures/app/recipes/recipes.css')
  const frozenAfterFirst = read(dir, FROZEN_PATH)
  const second = ship(first.store, m, { root: dir })
  assert.equal(read(dir, 'fixtures/app/recipes/recipes.css'), cssAfterFirst)
  assert.equal(read(dir, FROZEN_PATH), frozenAfterFirst)
  assert.deepEqual(second.store, first.store)
})
