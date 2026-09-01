import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { buildManifest } from '../src/identity/manifest'
import { allOpenItems, costsOf, layout, unresolvedOpenItems } from '../src/resolve/resolve'
import { accept, drop, emptyStore, slotCosts, unaccept, type DropTarget } from '../src/store/store'
import { commit } from '../src/store/commit'
import type { Store } from '../src/schema'

const { manifest: M, problems } = buildManifest('fixtures/app')

const move = (store: Store, view: string, state: string, feature: string, target: DropTarget) =>
  drop(M, store, { view, state, feature }, target, 'human', 1)

const src = (store: Store) => ({ manifest: M, assignments: store.assignments })
const at = (store: Store, view: string, state: string, feature: string) =>
  layout(src(store), view, state)!
    .slots.flatMap((s) => s.features)
    .find((p) => p.feature === feature)

test('the fixtures build clean and start with nothing open', () => {
  assert.deepEqual(problems, [])
  assert.deepEqual(allOpenItems(src(emptyStore())), [])
})

/* ---------------- no move is ever blocked ---------------- */

test('a move that costs focus order still lands', () => {
  const r = move(emptyStore(), 'gallery', 'browse', 'gallery.masthead', {
    kind: 'append',
    slot: 'footer/2',
  })
  assert.equal(r.refused, undefined, 'nothing refuses on behavioural grounds')
  assert.equal(at(r.store, 'gallery', 'browse', 'gallery.masthead')!.slot, 'footer/2')
})

test('a move that costs dismissal still lands', () => {
  const r = move(emptyStore(), 'gallery', 'focus', 'gallery.detail', {
    kind: 'append',
    slot: 'body/2',
  })
  assert.equal(r.refused, undefined)
  assert.equal(at(r.store, 'gallery', 'focus', 'gallery.detail')!.slot, 'body/2')
})

test('a move that costs a neighbour its arrow keys still lands', () => {
  const r = move(emptyStore(), 'gallery', 'browse', 'gallery.activity', {
    kind: 'after',
    slot: 'body/1',
    occupant: 'gallery.preset-grid',
  })
  assert.equal(r.refused, undefined)
  assert.equal(at(r.store, 'gallery', 'browse', 'gallery.activity')!.slot, 'body/1')
})

test('NO MOVE IS EVER BLOCKED — every legal target lands, three deep', () => {
  const targets = (store: Store, view: string, state: string, feature: string): DropTarget[] => {
    const l = layout(src(store), view, state)!
    return l.slots.flatMap((s) => [
      { kind: 'append', slot: s.slot.id } as DropTarget,
      ...s.features
        .filter((p) => p.feature !== feature)
        .flatMap((p): DropTarget[] => [
          { kind: 'swap', slot: s.slot.id, occupant: p.feature },
          { kind: 'before', slot: s.slot.id, occupant: p.feature },
          { kind: 'after', slot: s.slot.id, occupant: p.feature },
        ]),
    ])
  }

  let frontier: Store[] = [emptyStore()]
  let tried = 0
  for (let depth = 0; depth < 3; depth++) {
    const next: Store[] = []
    for (const store of frontier)
      for (const view of M.views)
        for (const state of view.states)
          for (const f of M.features.filter(
            (x) => x.view === view.id && (x.states === null || x.states.includes(state)),
          ))
            for (const target of targets(store, view.id, state, f.id)) {
              const r = drop(M, store, { view: view.id, state, feature: f.id }, target, 'human', 1)
              assert.equal(
                r.refused,
                undefined,
                `depth ${depth}: ${f.id} → ${JSON.stringify(target)} was refused`,
              )
              const landed = at(r.store, view.id, state, f.id)
              assert.equal(landed?.slot, target.slot, `${f.id} did not land in ${target.slot}`)
              tried++
              if (next.length < 10) next.push(r.store)
            }
    frontier = next
  }
  assert.ok(tried > 500, `expected a real search, only tried ${tried}`)
})

/* ---------------- no cost is ever silent ---------------- */

test('a cost becomes a named open item, attributed to whoever pays it', () => {
  const r = move(emptyStore(), 'gallery', 'browse', 'gallery.masthead', {
    kind: 'append',
    slot: 'footer/2',
  })
  const items = allOpenItems(src(r.store))
  assert.equal(items.length, 1)
  assert.equal(items[0].feature, 'gallery.masthead')
  assert.equal(items[0].requirement, 'before-main')
  assert.equal(items[0].slot, 'footer/2')
  assert.equal(items[0].accepted, false)
  assert.match(items[0].reason, /reachable before the main content/)
})

test('the cost of crowding a neighbour is charged to the neighbour', () => {
  const r = move(emptyStore(), 'gallery', 'browse', 'gallery.activity', {
    kind: 'after',
    slot: 'body/1',
    occupant: 'gallery.preset-grid',
  })
  const items = allOpenItems(src(r.store))
  assert.equal(items.length, 1)
  assert.equal(items[0].feature, 'gallery.preset-grid', 'the grid is what loses its arrow keys')
  assert.equal(items[0].requirement, 'sole-focus')
})

test('an open item in one state says nothing about the other', () => {
  const r = move(emptyStore(), 'gallery', 'focus', 'gallery.detail', {
    kind: 'append',
    slot: 'body/2',
  })
  const items = allOpenItems(src(r.store))
  assert.deepEqual(items.map((i) => i.state), ['focus'])
})

test('the cost is knowable before the drop, for every slot', () => {
  const costs = slotCosts(M, emptyStore(), {
    view: 'gallery',
    state: 'focus',
    feature: 'gallery.detail',
  })
  // Exhaustive: every slot is a destination, each with a price attached.
  assert.equal(costs.size, 9)
  assert.deepEqual(costs.get('aside/1'), [], 'the dismissible band costs nothing')
  assert.equal(costs.get('body/2')!.length, 1)
  assert.match(costs.get('body/2')![0].reason, /Escape and click-outside/)
})

test('what the drag previews is what the drop produces', () => {
  for (const f of M.features.filter((x) => x.view === 'gallery' && x.states === null)) {
    const where = { view: 'gallery', state: 'browse', feature: f.id }
    for (const [slot, preview] of slotCosts(M, emptyStore(), where)) {
      const after = move(emptyStore(), 'gallery', 'browse', f.id, { kind: 'append', slot })
      const actual = allOpenItems(src(after.store)).filter((i) => i.slot === slot)
      assert.equal(
        preview.length,
        actual.length,
        `${f.id} → ${slot}: previewed ${preview.length}, produced ${actual.length}`,
      )
    }
  }
})

test('costsOf prices a slot without touching a store', () => {
  const priced = costsOf(M, 'gallery', 'gallery.footnote', 'lede/1', [])
  assert.equal(priced.length, 1)
  assert.equal(priced[0].requirement, 'after-main')
})

/* ---------------- shipping is what stops ---------------- */

test('commit reports what the design costs and writes it anyway', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slots-nogate-'))
  fs.cpSync('fixtures', path.join(dir, 'fixtures'), { recursive: true })
  const r = move(emptyStore(), 'gallery', 'browse', 'gallery.masthead', {
    kind: 'append',
    slot: 'footer/2',
  })
  const result = commit(M, r.store, dir)
  assert.equal(result.carries.length, 1, 'the cost is reported')
  assert.deepEqual(result.written, ['fixtures/app/views/gallery.view.ts'], 'and it still writes')
})

test('acknowledging a cost records it without making it disappear', () => {
  let store = move(emptyStore(), 'gallery', 'browse', 'gallery.masthead', {
    kind: 'append',
    slot: 'footer/2',
  }).store
  assert.equal(unresolvedOpenItems(src(store)).length, 1)

  store = accept(
    M,
    store,
    { view: 'gallery', state: 'browse', feature: 'gallery.masthead' },
    'before-main',
    'human',
    2,
  )
  const items = allOpenItems(src(store))
  assert.equal(items.length, 1, 'the cost does not disappear — it is still real')
  assert.equal(items[0].accepted, true)
  assert.equal(items[0].acceptedBy, 'human')
  assert.deepEqual(unresolvedOpenItems(src(store)), [])
})

test('designing the cost away removes it entirely', () => {
  let store = move(emptyStore(), 'gallery', 'focus', 'gallery.detail', {
    kind: 'append',
    slot: 'body/2',
  }).store
  assert.equal(unresolvedOpenItems(src(store)).length, 1)
  store = move(store, 'gallery', 'focus', 'gallery.detail', { kind: 'append', slot: 'aside/1' }).store
  assert.deepEqual(allOpenItems(src(store)), [], 'no item, accepted or otherwise')
})

test('acceptance is bound to the slot it was given at', () => {
  let store = move(emptyStore(), 'gallery', 'browse', 'gallery.masthead', {
    kind: 'append',
    slot: 'footer/2',
  }).store
  store = accept(
    M,
    store,
    { view: 'gallery', state: 'browse', feature: 'gallery.masthead' },
    'before-main',
    'human',
    2,
  )
  assert.deepEqual(unresolvedOpenItems(src(store)), [])

  // Moving it somewhere else with the same cost is a new decision, not a
  // continuation of the old one.
  store = move(store, 'gallery', 'browse', 'gallery.masthead', {
    kind: 'append',
    slot: 'footer/1',
  }).store
  assert.equal(unresolvedOpenItems(src(store)).length, 1, 'a new slot asks again')
})

test('reordering inside a slot keeps an acceptance', () => {
  let store = move(emptyStore(), 'settings', 'advanced', 'settings.save-bar', {
    kind: 'append',
    slot: 'body/1',
  }).store
  store = accept(
    M,
    store,
    { view: 'settings', state: 'advanced', feature: 'settings.save-bar' },
    'after-main',
    'human',
    2,
  )
  assert.deepEqual(unresolvedOpenItems(src(store)), [])
  store = move(store, 'settings', 'advanced', 'settings.save-bar', {
    kind: 'before',
    slot: 'body/1',
    occupant: 'settings.appearance',
  }).store
  assert.deepEqual(unresolvedOpenItems(src(store)), [], 'same slot, same decision')
})

test('an acceptance can be withdrawn and the item reopens', () => {
  let store = move(emptyStore(), 'gallery', 'browse', 'gallery.masthead', {
    kind: 'append',
    slot: 'footer/2',
  }).store
  const where = { view: 'gallery', state: 'browse', feature: 'gallery.masthead' }
  store = accept(M, store, where, 'before-main', 'human', 2)
  assert.deepEqual(unresolvedOpenItems(src(store)), [])
  store = unaccept(store, where, 'before-main')
  assert.equal(unresolvedOpenItems(src(store)).length, 1)
})

test('accepting a cost a feature carries at its source default needs no move', () => {
  // Crowd the grid, then accept on the grid's behalf — it never moved.
  let store = move(emptyStore(), 'gallery', 'browse', 'gallery.activity', {
    kind: 'after',
    slot: 'body/1',
    occupant: 'gallery.preset-grid',
  }).store
  const item = allOpenItems(src(store))[0]
  assert.equal(item.feature, 'gallery.preset-grid')
  store = accept(
    M,
    store,
    { view: 'gallery', state: 'browse', feature: item.feature },
    'sole-focus',
    'human',
    3,
  )
  assert.deepEqual(unresolvedOpenItems(src(store)), [])
  const record = store.assignments.find((a) => a.feature === 'gallery.preset-grid')!
  assert.equal(record.slot, 'body/1', 'written at the slot it already occupied')
  assert.deepEqual(record.accepted, ['sole-focus'])
})

test('NOTHING IS EVER GATED — every reachable design commits', () => {
  // The counterpart to "no move is blocked": no *commit* is blocked either.
  // The system reports; it does not withhold. This searches for a design it
  // would refuse to write, and there is none.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slots-commit-'))
  fs.cpSync('fixtures', path.join(dir, 'fixtures'), { recursive: true })

  let frontier: Store[] = [emptyStore()]
  let withCost = 0
  for (let depth = 0; depth < 2; depth++) {
    const next: Store[] = []
    for (const store of frontier)
      for (const view of M.views)
        for (const state of view.states)
          for (const f of M.features.filter(
            (x) => x.view === view.id && (x.states === null || x.states.includes(state)),
          ))
            for (const slot of layout(src(store), view.id, state)!.slots.map((s) => s.slot.id)) {
              const r = drop(
                M,
                store,
                { view: view.id, state, feature: f.id },
                { kind: 'append', slot },
                'human',
                1,
              )
              assert.equal(r.refused, undefined, 'no move is blocked')
              const result = commit(M, r.store, dir)
              const stuck = unresolvedOpenItems(src(r.store))
              // Whatever it costs, it writes — and it says what it cost.
              assert.equal(result.carries.length, stuck.length)
              if (stuck.length) withCost++
              if (next.length < 8) next.push(r.store)
            }
    frontier = next
  }
  assert.ok(withCost > 50, `expected costly designs to exist and still commit, saw ${withCost}`)
})

test('the library gates nothing — no source file says otherwise', () => {
  // A guard against enforcement creeping back in: the words a gate would need.
  const commitSrc = fs.readFileSync('src/store/commit.ts', 'utf8')
  assert.ok(!/return \{ written: \[\]/.test(commitSrc), 'commit has no early refusal path')
  const resolveSrc = fs.readFileSync('src/resolve/resolve.ts', 'utf8')
  for (const word of ['refus', 'block', 'forbid', 'illegal'])
    assert.ok(
      !new RegExp(word, 'i').test(resolveSrc.replace(/\/\*[\s\S]*?\*\//g, '')),
      `resolver mentions "${word}" outside a comment`,
    )
})
