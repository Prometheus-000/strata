import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildManifest } from '../src/identity/manifest'
import { layout, resolve } from '../src/resolve/resolve'
import { clear, drop, emptyStore, orderBetween, put, type DropTarget } from '../src/store/store'
import type { Store } from '../src/schema'

const { manifest: M } = buildManifest('fixtures/app')

const at = (store: Store, view: string, state: string, feature: string) =>
  resolve({ manifest: M, assignments: store.assignments }, view, state, feature)

const occupants = (store: Store, view: string, state: string, slot: string) =>
  layout({ manifest: M, assignments: store.assignments }, view, state)!
    .slots.find((s) => s.slot.id === slot)!
    .features.map((f) => f.feature)

const move = (
  store: Store,
  view: string,
  state: string,
  feature: string,
  target: DropTarget,
  ts = 1,
) => drop(M, store, { view, state, feature }, target, 'human', ts)

test('a drop into an empty slot moves exactly one feature', () => {
  const r = move(emptyStore(), 'gallery', 'browse', 'gallery.preset-grid', {
    kind: 'append',
    slot: 'body/3',
  })
  assert.equal(r.refused, undefined)
  assert.equal(r.store.assignments.length, 1)
  assert.equal(r.effects[0].kind, 'moved')
  assert.equal(at(r.store, 'gallery', 'browse', 'gallery.preset-grid')!.slot, 'body/3')
  assert.equal(at(r.store, 'gallery', 'browse', 'gallery.masthead')!.slot, 'masthead/1')
})

test('the store records who and when', () => {
  const r = drop(
    M,
    emptyStore(),
    { view: 'gallery', state: 'browse', feature: 'gallery.activity' },
    { kind: 'append', slot: 'body/2' },
    'human',
    1730000000000,
  )
  assert.equal(r.store.assignments[0].author, 'human')
  assert.equal(r.store.assignments[0].ts, 1730000000000)
  assert.equal(r.store.assignments[0].id, 'gallery:browse:gallery.activity')
})

test('moving in one state leaves the other state alone', () => {
  // The whole point: gallery.preset-grid appears in both states.
  const r = move(emptyStore(), 'gallery', 'focus', 'gallery.preset-grid', {
    kind: 'append',
    slot: 'lede/1',
  })
  assert.equal(at(r.store, 'gallery', 'focus', 'gallery.preset-grid')!.slot, 'lede/1')
  assert.equal(at(r.store, 'gallery', 'browse', 'gallery.preset-grid')!.slot, 'body/1')
})

test('dropping on the centre of an occupant swaps them', () => {
  const r = move(emptyStore(), 'gallery', 'browse', 'gallery.filters', {
    kind: 'swap',
    slot: 'lede/2',
    occupant: 'gallery.activity',
  })
  assert.equal(r.refused, undefined)
  assert.equal(at(r.store, 'gallery', 'browse', 'gallery.filters')!.slot, 'lede/2')
  assert.equal(at(r.store, 'gallery', 'browse', 'gallery.activity')!.slot, 'lede/1')
  assert.deepEqual(r.effects.map((e) => e.kind), ['moved', 'displaced'])
})

test('a swap is its own inverse', () => {
  const once = move(emptyStore(), 'gallery', 'browse', 'gallery.filters', {
    kind: 'swap',
    slot: 'lede/2',
    occupant: 'gallery.activity',
  }).store
  const back = move(once, 'gallery', 'browse', 'gallery.filters', {
    kind: 'swap',
    slot: 'lede/1',
    occupant: 'gallery.activity',
  }).store
  assert.equal(at(back, 'gallery', 'browse', 'gallery.filters')!.slot, 'lede/1')
  assert.equal(at(back, 'gallery', 'browse', 'gallery.activity')!.slot, 'lede/2')
})

test('dropping on an edge inserts rather than swapping', () => {
  const before = move(emptyStore(), 'settings', 'advanced', 'settings.appearance', {
    kind: 'before',
    slot: 'body/2',
    occupant: 'settings.motion',
  })
  assert.deepEqual(occupants(before.store, 'settings', 'advanced', 'body/2'), [
    'settings.appearance',
    'settings.motion',
    'settings.diagnostics',
  ])
  const after = move(emptyStore(), 'settings', 'advanced', 'settings.appearance', {
    kind: 'after',
    slot: 'body/2',
    occupant: 'settings.motion',
  })
  assert.deepEqual(occupants(after.store, 'settings', 'advanced', 'body/2'), [
    'settings.motion',
    'settings.appearance',
    'settings.diagnostics',
  ])
})

test('inserting between two occupants lands between them', () => {
  const r = move(emptyStore(), 'settings', 'advanced', 'settings.appearance', {
    kind: 'after',
    slot: 'body/2',
    occupant: 'settings.motion',
  })
  const order = r.store.assignments[0].order
  assert.ok(order > 2 && order < 3, `expected an order between motion and diagnostics, got ${order}`)
})

test('appending puts it last, and reordering within a slot works', () => {
  let s = move(emptyStore(), 'settings', 'advanced', 'settings.appearance', {
    kind: 'append',
    slot: 'body/2',
  }).store
  assert.deepEqual(occupants(s, 'settings', 'advanced', 'body/2'), [
    'settings.motion',
    'settings.diagnostics',
    'settings.appearance',
  ])
  s = move(s, 'settings', 'advanced', 'settings.appearance', {
    kind: 'before',
    slot: 'body/2',
    occupant: 'settings.motion',
  }).store
  assert.deepEqual(occupants(s, 'settings', 'advanced', 'body/2'), [
    'settings.appearance',
    'settings.motion',
    'settings.diagnostics',
  ])
})

test('a feature is never its own neighbour', () => {
  const s = move(emptyStore(), 'settings', 'advanced', 'settings.appearance', {
    kind: 'append',
    slot: 'body/2',
  }).store
  const again = move(s, 'settings', 'advanced', 'settings.appearance', {
    kind: 'append',
    slot: 'body/2',
  })
  assert.equal(again.refused, undefined)
  assert.equal(occupants(again.store, 'settings', 'advanced', 'body/2').length, 3)
})

test('orderBetween refuses to collapse, and the drop renumbers instead', () => {
  assert.equal(orderBetween(undefined, undefined), 0)
  assert.equal(orderBetween(2, undefined), 3)
  assert.equal(orderBetween(undefined, 2), 1)
  assert.equal(orderBetween(0, 1), 0.5)
  assert.equal(orderBetween(1, 1), null)
  const tight = Number.MIN_VALUE
  assert.equal(orderBetween(0, tight), null)

  // Force the gap shut, then insert again: the slot gets whole numbers back and
  // nobody's position changes.
  let s = put(emptyStore(), { view: 'settings', state: 'advanced', feature: 'settings.motion' }, 'body/2', 0, 'human', 1)
  s = put(s, { view: 'settings', state: 'advanced', feature: 'settings.diagnostics' }, 'body/2', Number.MIN_VALUE, 'human', 1)
  const r = move(s, 'settings', 'advanced', 'settings.appearance', {
    kind: 'before',
    slot: 'body/2',
    occupant: 'settings.diagnostics',
  })
  assert.equal(r.refused, undefined)
  assert.ok(r.effects.some((e) => e.kind === 'renumbered'))
  assert.deepEqual(occupants(r.store, 'settings', 'advanced', 'body/2'), [
    'settings.motion',
    'settings.appearance',
    'settings.diagnostics',
  ])
})

test('a slot outside the grammar is refused, not invented', () => {
  const r = move(emptyStore(), 'gallery', 'browse', 'gallery.masthead', {
    kind: 'append',
    slot: 'nowhere/9',
  })
  assert.match(r.refused!, /not in this view's grammar/)
  assert.deepEqual(r.store, emptyStore())
})

test('a drop is refused when the feature is not in that state', () => {
  const r = move(emptyStore(), 'gallery', 'browse', 'gallery.detail', {
    kind: 'append',
    slot: 'body/2',
  })
  assert.match(r.refused!, /not part of the "browse" state/)
})

test('a drop naming an occupant that is elsewhere is refused', () => {
  const r = move(emptyStore(), 'gallery', 'browse', 'gallery.activity', {
    kind: 'swap',
    slot: 'body/2',
    occupant: 'gallery.preset-grid',
  })
  assert.match(r.refused!, /is not in body\/2/)
})

test('unknown views, states and features are refused by name', () => {
  assert.match(move(emptyStore(), 'nope', 'browse', 'gallery.masthead', { kind: 'append', slot: 'body/1' }).refused!, /no view/)
  assert.match(move(emptyStore(), 'gallery', 'nope', 'gallery.masthead', { kind: 'append', slot: 'body/1' }).refused!, /no state/)
  assert.match(move(emptyStore(), 'gallery', 'browse', 'ghost', { kind: 'append', slot: 'body/1' }).refused!, /no feature/)
})

test('clearing an assignment returns the feature to source', () => {
  const s = move(emptyStore(), 'gallery', 'browse', 'gallery.preset-grid', {
    kind: 'append',
    slot: 'body/3',
  }).store
  const back = clear(s, { view: 'gallery', state: 'browse', feature: 'gallery.preset-grid' })
  assert.deepEqual(back.assignments, [])
  assert.equal(at(back, 'gallery', 'browse', 'gallery.preset-grid')!.from, 'source')
})

test('a second drop replaces rather than accumulating', () => {
  let s = move(emptyStore(), 'gallery', 'browse', 'gallery.activity', { kind: 'append', slot: 'body/2' }, 1).store
  s = move(s, 'gallery', 'browse', 'gallery.activity', { kind: 'append', slot: 'body/3' }, 2).store
  assert.equal(s.assignments.length, 1)
  assert.equal(at(s, 'gallery', 'browse', 'gallery.activity')!.slot, 'body/3')
})

test('drop mutates nothing it was given', () => {
  const store = emptyStore()
  const snapshot = JSON.stringify(store)
  move(store, 'gallery', 'browse', 'gallery.activity', { kind: 'append', slot: 'body/2' })
  assert.equal(JSON.stringify(store), snapshot)
})
