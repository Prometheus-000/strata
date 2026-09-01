import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { buildManifest, readViewDecl } from '../src/identity/manifest'
import { lint, formatLint } from '../src/lint/lint'
import { commit } from '../src/store/commit'
import { accept, drop, emptyStore } from '../src/store/store'
import type { Manifest, Store } from '../src/schema'

const { manifest: M } = buildManifest('fixtures/app')
const GALLERY_FILE = 'fixtures/app/views/gallery.view.ts'

function sandbox(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slots-lint-'))
  fs.cpSync('fixtures', path.join(dir, 'fixtures'), { recursive: true })
  return dir
}
const read = (dir: string, rel: string) => fs.readFileSync(path.join(dir, rel), 'utf8')

/** Rebuild a manifest from a sandbox's committed declaration, as a fresh run would. */
function reread(dir: string, viewId: string, file: string): Manifest {
  const problems: string[] = []
  const decl = readViewDecl(path.join(dir, file), read(dir, file), problems)
  assert.deepEqual(problems, [])
  return { ...M, views: M.views.map((v) => (v.id === viewId ? decl! : v)) }
}

const move = (store: Store, view: string, state: string, feature: string, slot: string) =>
  drop(M, store, { view, state, feature }, { kind: 'append', slot }, 'human', 1).store

test('a clean tree lints clean', () => {
  const report = lint(M)
  assert.deepEqual(report.contracts, [])
  assert.deepEqual(report.dangling, [])
  assert.deepEqual(report.drift, [])
})

/* ---------------- class 1: unsatisfied contracts ---------------- */

test('an unsatisfied contract is read back out of source, not recomputed from a session', () => {
  const dir = sandbox()
  const store = move(emptyStore(), 'gallery', 'browse', 'gallery.masthead', 'footer/2')
  commit(M, store, dir)
  // The file itself carries it — this is the countable form.
  assert.match(read(dir, GALLERY_FILE), /open: \['before-main'\]/)

  const report = lint(reread(dir, 'gallery', GALLERY_FILE))
  assert.equal(report.contracts.length, 1)
  assert.equal(report.contracts[0].item.requirement, 'before-main')
  assert.equal(report.contracts[0].item.accepted, false)
})

test('a cost is recorded against the feature that pays it, even if it never moved', () => {
  const dir = sandbox()
  // Crowding the grid costs *the grid* its arrow keys; the grid did not move.
  const store = drop(
    M,
    emptyStore(),
    { view: 'gallery', state: 'browse', feature: 'gallery.activity' },
    { kind: 'after', slot: 'body/1', occupant: 'gallery.preset-grid' },
    'human',
    1,
  ).store
  commit(M, store, dir)
  assert.match(read(dir, GALLERY_FILE), /'gallery\.preset-grid':.*open: \['sole-focus'\]/)

  const report = lint(reread(dir, 'gallery', GALLERY_FILE))
  assert.equal(report.contracts.length, 1)
  assert.equal(report.contracts[0].item.feature, 'gallery.preset-grid')
})

test('an acknowledgement is recorded beside the cost, not instead of it', () => {
  const dir = sandbox()
  let store = move(emptyStore(), 'gallery', 'browse', 'gallery.masthead', 'footer/2')
  store = accept(
    M,
    store,
    { view: 'gallery', state: 'browse', feature: 'gallery.masthead' },
    'before-main',
    'human',
    2,
  )
  commit(M, store, dir)
  const text = read(dir, GALLERY_FILE)
  assert.match(text, /open: \['before-main'\], accepted: \['before-main'\]/)

  const report = lint(reread(dir, 'gallery', GALLERY_FILE))
  assert.equal(report.contracts.length, 1, 'still a finding')
  assert.equal(report.contracts[0].item.accepted, true, 'but an answered one')
  assert.deepEqual(report.byRequirement['before-main'], { total: 1, acknowledged: 1 })
})

test('findings total by contract and by band — the fleet-wide question, asked locally', () => {
  const dir = sandbox()
  let store = move(emptyStore(), 'gallery', 'browse', 'gallery.masthead', 'footer/2')
  store = move(store, 'gallery', 'focus', 'gallery.detail', 'body/2')
  commit(M, store, dir)
  const report = lint(reread(dir, 'gallery', GALLERY_FILE))
  assert.equal(report.byRequirement['before-main'].total, 1)
  assert.equal(report.byRequirement['dismissible'].total, 1)
  assert.equal(report.byBand['gallery/footer'], 1)
  assert.equal(report.byBand['gallery/body'], 1)
  // Each item says what the band did provide, so a count can say why.
  const detail = report.contracts.find((c) => c.item.requirement === 'dismissible')!
  assert.equal(detail.item.band, 'body')
  assert.equal(detail.item.provides.dismissible, undefined)
  assert.equal(detail.item.provides.focusPhase, 'main')
})

/* ---------------- class 2: assignments that no longer resolve ---------------- */

test('a removed slot is caught — nothing generates an open item for it', () => {
  const dir = sandbox()
  const store = move(emptyStore(), 'gallery', 'browse', 'gallery.activity', 'body/3')
  commit(M, store, dir)

  // The grammar narrows underneath the assignment: body loses its third column.
  const file = path.join(dir, GALLERY_FILE)
  fs.writeFileSync(
    file,
    read(dir, GALLERY_FILE).replace("{ id: 'body', columns: 3,", "{ id: 'body', columns: 2,"),
  )
  const report = lint(reread(dir, 'gallery', GALLERY_FILE))
  assert.equal(report.dangling.length, 1)
  assert.equal(report.dangling[0].reason, 'unknown-slot')
  assert.match(report.dangling[0].detail, /the band changed underneath it/)
  // And it produced no contract finding, which is precisely why this class exists.
  assert.deepEqual(report.contracts, [])
})

test('a renamed band is caught the same way', () => {
  const dir = sandbox()
  const store = move(emptyStore(), 'gallery', 'focus', 'gallery.detail', 'body/2')
  commit(M, store, dir)
  const file = path.join(dir, GALLERY_FILE)
  fs.writeFileSync(file, read(dir, GALLERY_FILE).replace("id: 'body',", "id: 'core',"))
  const report = lint(reread(dir, 'gallery', GALLERY_FILE))
  assert.ok(report.dangling.some((d) => d.reason === 'unknown-slot'))
})

test('a deleted feature is caught', () => {
  const dir = sandbox()
  const store = move(emptyStore(), 'gallery', 'browse', 'gallery.activity', 'body/2')
  commit(M, store, dir)
  const manifest = reread(dir, 'gallery', GALLERY_FILE)
  const without: Manifest = {
    ...manifest,
    features: manifest.features.filter((f) => f.id !== 'gallery.activity'),
  }
  const report = lint(without)
  assert.equal(report.dangling.length, 1)
  assert.equal(report.dangling[0].reason, 'unknown-feature')
  assert.match(report.dangling[0].detail, /deleted or renamed/)
})

test('a renamed state is caught', () => {
  const dir = sandbox()
  const store = move(emptyStore(), 'gallery', 'browse', 'gallery.activity', 'body/2')
  commit(M, store, dir)
  const file = path.join(dir, GALLERY_FILE)
  fs.writeFileSync(
    file,
    read(dir, GALLERY_FILE)
      .replace("states: ['browse', 'focus']", "states: ['list', 'focus']")
      .replace("defaultState: 'browse'", "defaultState: 'list'"),
  )
  const report = lint(reread(dir, 'gallery', GALLERY_FILE))
  assert.ok(report.dangling.some((d) => d.reason === 'unknown-state'))
})

test('a placement for a feature absent in that state is caught', () => {
  const dir = sandbox()
  const store = move(emptyStore(), 'gallery', 'browse', 'gallery.activity', 'body/2')
  commit(M, store, dir)
  const file = path.join(dir, GALLERY_FILE)
  // The placement stays in `browse`; the feature is moved out of that state.
  const surface = path.join(dir, 'fixtures/app/views/Gallery.tsx')
  fs.writeFileSync(
    surface,
    fs
      .readFileSync(surface, 'utf8')
      .replace('fid="gallery.activity" slot="lede/2" states="browse"', 'fid="gallery.activity" slot="lede/2" states="focus"'),
  )
  const manifest = reread(dir, 'gallery', GALLERY_FILE)
  const moved: Manifest = {
    ...manifest,
    features: manifest.features.map((f) =>
      f.id === 'gallery.activity' ? { ...f, states: ['focus'] } : f,
    ),
  }
  assert.ok(fs.existsSync(file))
  assert.ok(lint(moved).dangling.some((d) => d.reason === 'absent-in-state'))
})

/* ---------------- class 3: records that disagree ---------------- */

test('a record that says unsatisfied when it is satisfied is reported, not trusted', () => {
  const dir = sandbox()
  const store = move(emptyStore(), 'gallery', 'browse', 'gallery.masthead', 'footer/2')
  commit(M, store, dir)
  // Somebody widens the contract by hand: footer now runs before main.
  const file = path.join(dir, GALLERY_FILE)
  fs.writeFileSync(
    file,
    read(dir, GALLERY_FILE).replace(
      "behavior: { focusPhase: 'after-main', landmark: 'contentinfo' }",
      "behavior: { focusPhase: 'before-main', landmark: 'contentinfo' }",
    ),
  )
  const report = lint(reread(dir, 'gallery', GALLERY_FILE))
  assert.equal(report.drift.length, 1)
  assert.equal(report.drift[0].drift, 'recorded-but-satisfied')
  assert.equal(report.drift[0].feature, 'gallery.masthead')
  // The stale record is not counted as a live finding…
  assert.ok(!report.contracts.some((c) => c.item.feature === 'gallery.masthead'))
  // …though widening one band's contract narrowed another feature's, which is
  // a real new cost and is reported as one. Loosening a rule is not free.
  assert.ok(report.contracts.every((c) => c.item.feature === 'gallery.footnote'))
})

test('a record missing a cost that is now real is reported', () => {
  const dir = sandbox()
  const store = move(emptyStore(), 'gallery', 'browse', 'gallery.activity', 'footer/2')
  commit(M, store, dir)
  assert.doesNotMatch(read(dir, GALLERY_FILE), /open:/, 'Activity requires nothing, so no cost')

  // Narrow the contract under it: give Activity a requirement it now fails.
  const manifest = reread(dir, 'gallery', GALLERY_FILE)
  const stricter: Manifest = {
    ...manifest,
    features: manifest.features.map((f) =>
      f.id === 'gallery.activity' ? { ...f, requires: ['before-main' as const] } : f,
    ),
  }
  const report = lint(stricter)
  assert.equal(report.drift.length, 1)
  assert.equal(report.drift[0].drift, 'unsatisfied-but-unrecorded')
  assert.match(report.drift[0].detail, /recommit/)
})

test('a feature at its source default is not "drifted" — it is just uncommitted', () => {
  const stricter: Manifest = {
    ...M,
    features: M.features.map((f) =>
      f.id === 'gallery.activity' ? { ...f, requires: ['before-main' as const] } : f,
    ),
  }
  // Activity sits at lede/2, which is before-main, so nothing is unsatisfied…
  assert.deepEqual(lint(stricter).drift, [])
  // …and a feature with no record at all never reports drift either.
  const harsher: Manifest = {
    ...M,
    features: M.features.map((f) =>
      f.id === 'gallery.footnote' ? { ...f, requires: ['before-main' as const] } : f,
    ),
  }
  // Footnote appears in both states, so an unmet requirement costs once in each.
  assert.equal(lint(harsher).contracts.length, 2, 'the cost is live, per state')
  assert.deepEqual(lint(harsher).drift, [], 'but nothing written is not a wrong record')
})

/* ---------------- reporting ---------------- */

test('lint reports and never decides', () => {
  const source = fs.readFileSync('src/lint/lint.ts', 'utf8')
  assert.ok(!/process\.exit/.test(source), 'lint does not exit')
  assert.ok(!/throw new/.test(source), 'lint does not throw')
  const cli = fs.readFileSync('bin/slots.mjs', 'utf8')
  const lintCase = cli.slice(cli.indexOf("case 'lint'"), cli.indexOf("case 'open'"))
  assert.ok(!/exitCode/.test(lintCase), 'the lint command sets no exit code')
})

test('the printed report names all three classes', () => {
  const dir = sandbox()
  const store = move(emptyStore(), 'gallery', 'focus', 'gallery.detail', 'body/2')
  commit(M, store, dir)
  const text = formatLint(lint(reread(dir, 'gallery', GALLERY_FILE)))
  assert.match(text, /UNSATISFIED BEHAVIOUR CONTRACTS/)
  assert.match(text, /ASSIGNMENTS THAT NO LONGER RESOLVE/)
  assert.match(text, /BY CONTRACT/)
  assert.match(text, /1 × dismissible/)
})
