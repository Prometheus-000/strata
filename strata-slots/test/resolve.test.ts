import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildManifest } from '../src/identity/manifest'
import { allStates, assignmentsFromSource, layout, resolve, type Sources } from '../src/resolve/resolve'
import type { Assignment, Manifest } from '../src/schema'

const { manifest: MANIFEST, problems } = buildManifest('fixtures/app')
const src = (assignments: Assignment[] = []): Sources => ({ manifest: MANIFEST, assignments })

const assign = (
  view: string,
  state: string,
  feature: string,
  slot: string,
  order = 0,
): Assignment => ({
  id: `${view}:${state}:${feature}`,
  view,
  state,
  feature,
  slot,
  order,
  author: 'human',
  ts: 1,
  accepted: [],
  open: [],
})

const slotOf = (s: Sources, view: string, state: string, feature: string) =>
  resolve(s, view, state, feature)?.slot

const occupants = (s: Sources, view: string, state: string, slot: string) =>
  layout(s, view, state)!
    .slots.find((x) => x.slot.id === slot)!
    .features.map((f) => f.feature)

test('the fixtures are well formed', () => {
  assert.deepEqual(problems, [])
  assert.equal(MANIFEST.views.length, 2)
  assert.equal(MANIFEST.features.length, 11)
})

test('with nothing assigned, source is the answer', () => {
  assert.equal(slotOf(src(), 'gallery', 'browse', 'gallery.preset-grid'), 'body/1')
  assert.equal(resolve(src(), 'gallery', 'browse', 'gallery.preset-grid')!.from, 'source')
})

test('an assignment wins, and says where it came from', () => {
  const s = src([assign('gallery', 'browse', 'gallery.preset-grid', 'lede/2')])
  const p = resolve(s, 'gallery', 'browse', 'gallery.preset-grid')!
  assert.equal(p.slot, 'lede/2')
  assert.equal(p.from, 'assigned')
  assert.equal(p.movedFrom, 'body/1')
  assert.equal(p.author, 'human')
})

test('an assignment in one state leaves the other state alone', () => {
  const s = src([assign('gallery', 'focus', 'gallery.preset-grid', 'lede/1')])
  assert.equal(slotOf(s, 'gallery', 'focus', 'gallery.preset-grid'), 'lede/1')
  assert.equal(slotOf(s, 'gallery', 'browse', 'gallery.preset-grid'), 'body/1')
})

test('a state is a node set: absent features resolve nowhere and are listed', () => {
  assert.equal(resolve(src(), 'gallery', 'browse', 'gallery.detail'), null)
  assert.deepEqual(layout(src(), 'gallery', 'browse')!.absent, ['gallery.detail'])
  assert.deepEqual(
    layout(src(), 'gallery', 'focus')!.absent,
    ['gallery.filters', 'gallery.activity'],
  )
})

test('a view that does not exist, or a state it does not have, resolves to null', () => {
  assert.equal(resolve(src(), 'nope', 'browse', 'gallery.masthead'), null)
  assert.equal(resolve(src(), 'gallery', 'nope', 'gallery.masthead'), null)
  assert.equal(layout(src(), 'gallery', 'nope'), null)
})

test('a feature belongs to exactly one view', () => {
  assert.equal(resolve(src(), 'settings', 'default', 'gallery.masthead'), null)
})

test('the layout covers every slot the grammar defines, occupied or not', () => {
  const l = layout(src(), 'gallery', 'browse')!
  assert.deepEqual(
    l.slots.map((s) => s.slot.id),
    [
      'masthead/1',
      'lede/1',
      'lede/2',
      'body/1',
      'body/2',
      'body/3',
      'aside/1',
      'footer/1',
      'footer/2',
    ],
  )
  assert.equal(l.slots.filter((s) => s.features.length === 0).length, 4)
})

test('two features share a slot, ordered on one number line', () => {
  // Source order: Motion is declared before Diagnostics, so it sits first.
  assert.deepEqual(occupants(src(), 'settings', 'advanced', 'body/2'), [
    'settings.motion',
    'settings.diagnostics',
  ])
  // An assignment orders against an un-assigned neighbour without a second rule.
  const before = src([assign('settings', 'advanced', 'settings.diagnostics', 'body/2', -1)])
  assert.deepEqual(occupants(before, 'settings', 'advanced', 'body/2'), [
    'settings.diagnostics',
    'settings.motion',
  ])
})

test('ordering is total, so two machines get the same layout', () => {
  const tied = src([
    assign('settings', 'advanced', 'settings.motion', 'body/2', 5),
    assign('settings', 'advanced', 'settings.diagnostics', 'body/2', 5),
  ])
  const a = layout(tied, 'settings', 'advanced')
  const b = layout({ ...tied, assignments: [...tied.assignments].reverse() }, 'settings', 'advanced')
  assert.deepEqual(a, b)
})

test('an assignment naming a slot the grammar dropped is reported, not applied', () => {
  const s = src([assign('gallery', 'browse', 'gallery.preset-grid', 'aside/9')])
  // The feature falls back to source rather than vanishing…
  assert.equal(slotOf(s, 'gallery', 'browse', 'gallery.preset-grid'), 'body/1')
  // …and the assignment is named rather than silently dropped.
  const l = layout(s, 'gallery', 'browse')!
  assert.equal(l.orphans.length, 1)
  assert.equal(l.orphans[0].reason, 'unknown-slot')
})

test('an assignment for a feature this state does not have is an orphan', () => {
  const s = src([assign('gallery', 'browse', 'gallery.detail', 'body/3')])
  assert.equal(layout(s, 'gallery', 'browse')!.orphans[0].reason, 'absent-in-state')
  const gone = src([assign('gallery', 'browse', 'gallery.ghost', 'body/3')])
  assert.equal(layout(gone, 'gallery', 'browse')!.orphans[0].reason, 'unknown-feature')
})

test('resolution is deterministic and mutates nothing', () => {
  const assignments = [assign('gallery', 'focus', 'gallery.detail', 'lede/1')]
  const snapshot = JSON.stringify(assignments)
  const a = layout(src(assignments), 'gallery', 'focus')
  const b = layout(src(assignments), 'gallery', 'focus')
  assert.deepEqual(a, b)
  assert.equal(JSON.stringify(assignments), snapshot)
})

test('the resolver reads no clock, no DOM and no globals', () => {
  const source = layout.toString() + resolve.toString()
  for (const forbidden of ['Date.', 'Math.random', 'document', 'window', 'globalThis'])
    assert.ok(!source.includes(forbidden), `resolver touches ${forbidden}`)
})

test('every declared (view, state) pair is enumerable — the report axis', () => {
  assert.deepEqual(allStates(MANIFEST), [
    { view: 'gallery', state: 'browse' },
    { view: 'gallery', state: 'focus' },
    { view: 'settings', state: 'default' },
    { view: 'settings', state: 'advanced' },
  ])
})

test('source placements are read back as assignments', () => {
  const withPlacement: Manifest = {
    ...MANIFEST,
    views: MANIFEST.views.map((v) =>
      v.id === 'gallery'
        ? {
            ...v,
            placement: {
              focus: { 'gallery.detail': { slot: 'aside/1', order: 3, by: 'human' as const } },
            },
          }
        : v,
    ),
  }
  const assignments = assignmentsFromSource(withPlacement)
  assert.equal(assignments.length, 1)
  assert.equal(assignments[0].id, 'gallery:focus:gallery.detail')
  assert.equal(
    resolve({ manifest: withPlacement, assignments }, 'gallery', 'focus', 'gallery.detail')!.slot,
    'aside/1',
  )
})
