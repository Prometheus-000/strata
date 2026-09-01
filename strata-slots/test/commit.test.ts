import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { buildManifest, readViewDecl } from '../src/identity/manifest'
import {
  allOpenItems,
  assignmentsFromSource,
  resolve,
  unresolvedOpenItems,
  type Sources,
} from '../src/resolve/resolve'
import { diff, formatDiff } from '../src/report/diff'
import { commit } from '../src/store/commit'
import { accept, drop, emptyStore, type DropTarget } from '../src/store/store'
import { renderPlacements, writePlacements } from '../src/store/source'
import type { Manifest, Store } from '../src/schema'

const { manifest: M } = buildManifest('fixtures/app')
const GALLERY_FILE = 'fixtures/app/views/gallery.view.ts'

/** A throwaway copy of the tree, so commit can write for real and be read back. */
function sandbox(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slots-'))
  fs.cpSync('fixtures', path.join(dir, 'fixtures'), { recursive: true })
  return dir
}
const read = (dir: string, rel: string) => fs.readFileSync(path.join(dir, rel), 'utf8')

const move = (store: Store, view: string, state: string, feature: string, target: DropTarget) =>
  drop(M, store, { view, state, feature }, target, 'human', 1).store

/** Re-read a committed view declaration and resolve against it, as a fresh build would. */
function reread(dir: string, viewId: string, file: string): Sources {
  const problems: string[] = []
  const decl = readViewDecl(path.join(dir, file), read(dir, file), problems)
  assert.deepEqual(problems, [], 'the committed file must parse cleanly')
  const manifest: Manifest = {
    ...M,
    views: M.views.map((v) => (v.id === viewId ? decl! : v)),
  }
  return { manifest, assignments: assignmentsFromSource(manifest) }
}

test('a drop writes through to the view declaration', () => {
  const dir = sandbox()
  const store = move(emptyStore(), 'gallery', 'focus', 'gallery.preset-grid', {
    kind: 'append',
    slot: 'lede/1',
  })
  const result = commit(M, store, dir)
  assert.deepEqual(result.written, [GALLERY_FILE])
  assert.match(
    read(dir, GALLERY_FILE),
    /placement: \{\n\s+focus: \{\n\s+'gallery\.preset-grid': \{ slot: 'lede\/1', order: 0, by: 'human' \},/,
  )
})

test('DONE WHEN — moved in one state, the other state untouched, and it survives a rebuild', () => {
  const dir = sandbox()
  const store = move(emptyStore(), 'gallery', 'focus', 'gallery.preset-grid', {
    kind: 'append',
    slot: 'lede/1',
  })
  commit(M, store, dir)

  const fresh = reread(dir, 'gallery', GALLERY_FILE)
  assert.equal(resolve(fresh, 'gallery', 'focus', 'gallery.preset-grid')!.slot, 'lede/1')
  assert.equal(resolve(fresh, 'gallery', 'focus', 'gallery.preset-grid')!.from, 'assigned')
  assert.equal(resolve(fresh, 'gallery', 'browse', 'gallery.preset-grid')!.slot, 'body/1')
  assert.equal(resolve(fresh, 'gallery', 'browse', 'gallery.preset-grid')!.from, 'source')
})

test('commit touches nothing else in the file', () => {
  const dir = sandbox()
  const before = read(dir, GALLERY_FILE)
  const store = move(emptyStore(), 'gallery', 'focus', 'gallery.footnote', {
    kind: 'append',
    slot: 'footer/2',
  })
  commit(M, store, dir)
  const after = read(dir, GALLERY_FILE)
  // Every original line survives; the diff is purely an insertion.
  for (const line of before.split('\n')) assert.ok(after.includes(line), `lost: ${line}`)
  assert.ok(after.includes('a unit of design work'), 'comment prose intact')
  assert.ok(after.includes("import { defineView }"), 'imports intact')
})

test('reverting every drop returns the file to the bytes it started with', () => {
  const dir = sandbox()
  const before = read(dir, GALLERY_FILE)
  const store = move(emptyStore(), 'gallery', 'focus', 'gallery.footnote', {
    kind: 'append',
    slot: 'footer/2',
  })
  commit(M, store, dir)
  assert.notEqual(read(dir, GALLERY_FILE), before)
  commit(M, emptyStore(), dir)
  assert.equal(read(dir, GALLERY_FILE), before)
})

test('committing twice writes once', () => {
  const dir = sandbox()
  const store = move(emptyStore(), 'gallery', 'focus', 'gallery.footnote', {
    kind: 'append',
    slot: 'footer/2',
  })
  const first = commit(M, store, dir)
  const text = read(dir, GALLERY_FILE)
  const second = commit(M, store, dir)
  assert.deepEqual(first.written, [GALLERY_FILE])
  assert.deepEqual(second.written, [])
  assert.equal(read(dir, GALLERY_FILE), text)
})

test('only the view that changed is written', () => {
  const dir = sandbox()
  const store = move(emptyStore(), 'settings', 'advanced', 'settings.diagnostics', {
    kind: 'append',
    slot: 'body/1',
  })
  const result = commit(M, store, dir)
  assert.deepEqual(result.written, ['fixtures/app/views/settings.view.ts'])
  assert.ok(result.unchanged.includes(GALLERY_FILE))
})

test('the emitted literal is deterministic — states declared, features in source order', () => {
  let store = move(emptyStore(), 'settings', 'advanced', 'settings.diagnostics', {
    kind: 'append',
    slot: 'body/1',
  })
  store = move(store, 'settings', 'default', 'settings.motion', { kind: 'append', slot: 'body/1' })
  store = move(store, 'settings', 'advanced', 'settings.appearance', {
    kind: 'append',
    slot: 'body/2',
  })
  const a = sandbox()
  const b = sandbox()
  commit(M, store, a)
  commit(M, { ...store, assignments: [...store.assignments].reverse() }, b)
  const text = read(a, 'fixtures/app/views/settings.view.ts')
  assert.equal(read(b, 'fixtures/app/views/settings.view.ts'), text)
  // default is declared before advanced, and appearance before diagnostics.
  assert.ok(text.indexOf("default: {") < text.indexOf("advanced: {"))
  assert.ok(text.indexOf("settings.appearance") < text.indexOf("settings.diagnostics"))
})

test('an empty placement renders as nothing at all', () => {
  assert.equal(renderPlacements({}), '')
  assert.equal(renderPlacements({ focus: {} }), '')
  const src = `export default defineView({\n  id: 'x',\n})\n`
  assert.equal(writePlacements(src, {}), src)
})

test('the diff is keyed per view and per state', () => {
  const store = move(emptyStore(), 'gallery', 'focus', 'gallery.preset-grid', {
    kind: 'append',
    slot: 'lede/1',
  })
  const rows = diff({ manifest: M, assignments: store.assignments })
  assert.deepEqual(
    rows.map((r) => `${r.view}/${r.state}`),
    ['gallery/browse', 'gallery/focus', 'settings/default', 'settings/advanced'],
  )
  const focus = rows.find((r) => r.state === 'focus')!
  assert.equal(focus.rows.length, 1)
  assert.equal(focus.rows[0].kind, 'moved')
  assert.equal(focus.rows[0].from, 'body/1')
  assert.equal(focus.rows[0].to, 'lede/1')
  assert.equal(focus.rows[0].author, 'human')
  // The same feature in the other state contributes nothing.
  assert.equal(rows.find((r) => r.state === 'browse')!.rows.length, 0)
})

test('the diff separates a reorder from a move', () => {
  const store = move(emptyStore(), 'settings', 'advanced', 'settings.diagnostics', {
    kind: 'before',
    slot: 'body/2',
    occupant: 'settings.motion',
  })
  const advanced = diff({ manifest: M, assignments: store.assignments }).find(
    (r) => r.state === 'advanced',
  )!
  assert.equal(advanced.rows.length, 1)
  assert.equal(advanced.rows[0].kind, 'reordered')
  assert.equal(advanced.rows[0].to, 'body/2')
})

test('the diff carries the state axis into its printed form', () => {
  const store = move(emptyStore(), 'gallery', 'focus', 'gallery.preset-grid', {
    kind: 'append',
    slot: 'lede/1',
  })
  const text = formatDiff(diff({ manifest: M, assignments: store.assignments }))
  assert.match(text, /gallery · focus/)
  assert.match(text, /PresetGrid\s+body\/1 → lede\/1/)
  assert.match(text, /gallery · browse[\s\S]*?at source defaults/)
  assert.match(text, /absent in this state: gallery\.detail/)
  assert.match(text, /1 placement differs from source defaults/)
})

/* ---------------- the commit gate ---------------- */

test('an accepted cost writes into the placement record, on the same line as the slot', () => {
  const dir = sandbox()
  let store = drop(
    M,
    emptyStore(),
    { view: 'gallery', state: 'browse', feature: 'gallery.masthead' },
    { kind: 'append', slot: 'footer/2' },
    'human',
    1,
  ).store
  store = accept(
    M,
    store,
    { view: 'gallery', state: 'browse', feature: 'gallery.masthead' },
    'before-main',
    'human',
    2,
  )
  const result = commit(M, store, dir)
  assert.deepEqual(result.carries, [], 'acknowledged, so nothing outstanding')
  assert.match(
    read(dir, GALLERY_FILE),
    /'gallery\.masthead': \{ slot: 'footer\/2', order: 0, by: 'human', open: \['before-main'\], accepted: \['before-main'\] \}/,
  )
})

test('a committed acceptance survives the round trip', () => {
  const dir = sandbox()
  let store = drop(
    M,
    emptyStore(),
    { view: 'gallery', state: 'browse', feature: 'gallery.masthead' },
    { kind: 'append', slot: 'footer/2' },
    'human',
    1,
  ).store
  store = accept(
    M,
    store,
    { view: 'gallery', state: 'browse', feature: 'gallery.masthead' },
    'before-main',
    'human',
    2,
  )
  commit(M, store, dir)

  const fresh = reread(dir, 'gallery', GALLERY_FILE)
  const items = allOpenItems(fresh)
  assert.equal(items.length, 1, 'the cost is still real after a rebuild')
  assert.equal(items[0].accepted, true)
  assert.deepEqual(unresolvedOpenItems(fresh), [], 'and still resolved')
})

test('a costly design still writes, and the cost is reported alongside', () => {
  const dir = sandbox()
  const store = drop(
    M,
    emptyStore(),
    { view: 'gallery', state: 'focus', feature: 'gallery.detail' },
    { kind: 'append', slot: 'body/2' },
    'human',
    1,
  ).store
  const result = commit(M, store, dir)
  assert.deepEqual(result.written, [GALLERY_FILE], 'nothing is withheld')
  assert.equal(result.carries.length, 1)
  assert.equal(result.carries[0].requirement, 'dismissible')
  assert.match(read(dir, GALLERY_FILE), /'gallery\.detail': \{ slot: 'body\/2'/)
})

test('the diff names the open items alongside the placements', () => {
  const store = drop(
    M,
    emptyStore(),
    { view: 'gallery', state: 'focus', feature: 'gallery.detail' },
    { kind: 'append', slot: 'body/2' },
    'human',
    1,
  ).store
  const text = formatDiff(diff({ manifest: M, assignments: store.assignments }))
  assert.match(text, /Detail\s+aside\/1 → body\/2/)
  assert.match(text, /! Detail · dismissible/)
  assert.match(text, /1 behavioural cost not yet acknowledged/)
})
