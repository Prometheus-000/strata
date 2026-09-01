import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { ARCHETYPES, renderSurface, renderView } from '../src/grammar/archetypes'
import { describeGrammar } from '../src/grammar/describe'
import { providersOf } from '../src/grammar/grammar'
import { buildManifest, readViewDecl } from '../src/identity/manifest'
import { grammarFindings, lint } from '../src/lint/lint'
import { allOpenItems } from '../src/resolve/resolve'
import { drop, emptyStore, storeFromSource } from '../src/store/store'
import type { Manifest, ViewDecl } from '../src/schema'

const { manifest: M } = buildManifest('fixtures/app')

/** The fixtures with one view's declaration swapped, to isolate a grammar change. */
const withView = (viewId: string, change: (v: ViewDecl) => ViewDecl): Manifest => ({
  ...M,
  views: M.views.map((v) => (v.id === viewId ? change(v) : v)),
})

const rules = (m: Manifest) => grammarFindings(m).map((g) => `${g.rule}:${g.view}/${g.where}`)

/* ---------------- the measure ---------------- */

test('a feature that no longer resolves has no freedom described for it', () => {
  // Its source slot is gone, so `costOfDrop` reports no cost — which would read
  // as "free everywhere", the worst possible lie in exactly this situation.
  const gone = withView('settings', (v) => ({
    ...v,
    bands: [{ id: 'nowhere', columns: 3, behavior: { focusPhase: 'main' } }],
  }))
  assert.deepEqual(describeGrammar(gone, 'settings')!.freedom, [])
})

test('free movement is what the grammar is measured by, and it is a real count', () => {
  const d = describeGrammar(M, 'gallery')!
  const detail = d.freedom.find((f) => f.component === 'Detail')!
  const activity = d.freedom.find((f) => f.component === 'Activity')!
  // Detail requires `dismissible`, which only `aside` provides — one slot.
  assert.deepEqual(detail.free, ['aside/1'])
  // Activity requires nothing, so it is free nearly everywhere.
  assert.ok(activity.free.length > detail.free.length * 4)
  assert.equal(detail.total, 9)
})

test('the description matches what a drop actually costs — for every feature, every slot', () => {
  // The one way this can lie: describing a freedom the drag does not honour.
  const d = describeGrammar(M, 'gallery')!
  for (const f of d.freedom)
    for (const state of f.states)
      for (const slot of d.bands.flatMap((b) => b.slots)) {
        const after = drop(
          M,
          emptyStore(),
          { view: 'gallery', state, feature: f.feature },
          { kind: 'append', slot },
          'human',
          1,
        )
        const costly = allOpenItems({ manifest: M, assignments: after.store.assignments }).length > 0
        assert.equal(
          f.free.includes(slot),
          !costly,
          `${f.component} → ${slot} in ${state}: described free=${f.free.includes(slot)}, actual cost=${costly}`,
        )
      }
})

test('a split with no contract difference buys nothing — cost follows the contract', () => {
  const free = (m: Manifest) =>
    describeGrammar(m, 'settings')!.freedom.reduce((n, f) => n + f.free.length, 0)

  const oneBand = withView('settings', (v) => ({
    ...v,
    bands: [{ id: 'main', columns: 3, behavior: { focusPhase: 'main' } }],
  }))
  const splitThreeWays = withView('settings', (v) => ({
    ...v,
    bands: [
      { id: 'a', columns: 1, behavior: { focusPhase: 'main' } },
      { id: 'b', columns: 1, behavior: { focusPhase: 'main' } },
      { id: 'c', columns: 1, behavior: { focusPhase: 'main' } },
    ],
  }))
  assert.equal(free(oneBand), free(splitThreeWays), 'identical contracts, identical freedom')
  // …which is exactly why the split is worth reporting: it changed nothing but
  // the number of names in the vocabulary.
  assert.ok(rules(splitThreeWays).some((r) => r.startsWith('indistinguishable-bands')))
  assert.ok(!rules(oneBand).some((r) => r.startsWith('indistinguishable-bands')))
})

test('a split with a real contract difference constrains, which is the point', () => {
  // Same band ids throughout, so every feature still resolves — only the
  // contracts change. Otherwise this would be measuring a broken grammar.
  const bands = (phases: Array<'before-main' | 'main' | 'after-main'>) => [
    { id: 'masthead', columns: 1, behavior: { focusPhase: phases[0] } },
    { id: 'body', columns: 2, behavior: { focusPhase: phases[1] } },
    { id: 'footer', columns: 1, behavior: { focusPhase: phases[2] } },
  ]
  const headerFreedom = (m: Manifest) =>
    describeGrammar(m, 'settings')!.freedom.find((f) => f.component === 'SettingsHeader')!.free

  // Every band says `main`: SettingsHeader requires before-main and has nowhere.
  const flat = withView('settings', (v) => ({ ...v, bands: bands(['main', 'main', 'main']) }))
  assert.deepEqual(headerFreedom(flat), [], 'nowhere legal to be')

  // Give one band a different contract and it has somewhere — the constraint
  // is what created the destination.
  const phased = withView('settings', (v) => ({
    ...v,
    bands: bands(['before-main', 'main', 'after-main']),
  }))
  assert.deepEqual(headerFreedom(phased), ['masthead/1'])
})

test('a feature that can only ever sit in one place is reported', () => {
  // Detail requires dismissible; only aside/1 provides it.
  const found = grammarFindings(M).find(
    (g) => g.rule === 'pinned-feature' && g.view === 'gallery',
  )!
  assert.equal(found.where, 'aside/1')
  assert.match(found.detail, /Detail can only ever sit in aside\/1/)
  // Widening that band unpins it — no new band needed.
  const wider = withView('gallery', (v) => ({
    ...v,
    bands: v.bands.map((b) => (b.id === 'aside' ? { ...b, columns: 2 } : b)),
  }))
  assert.ok(!rules(wider).some((r) => r.startsWith('pinned-feature:gallery')))
})

/* ---------------- the one hard finding ---------------- */

test('a requirement no band provides is named — the dead end dragging cannot leave', () => {
  // Remove the only dismissible band. Detail still requires `dismissible`.
  const m = withView('gallery', (v) => ({ ...v, bands: v.bands.filter((b) => b.id !== 'aside') }))
  const found = grammarFindings(m).filter((g) => g.rule === 'unsatisfiable-requirement')
  assert.equal(found.length, 1)
  assert.equal(found[0].where, 'dismissible')
  assert.match(found[0].detail, /Detail requires dismissible/)
  assert.match(found[0].detail, /No drag can resolve this/)
})

test('a requirement nothing asks for is not a finding', () => {
  // No band provides `dismissible` in settings, and nothing there requires it.
  assert.ok(!rules(M).some((r) => r.startsWith('unsatisfiable-requirement:settings')))
  const d = describeGrammar(M, 'settings')!
  const dismissible = d.satisfiable.find((s) => s.requirement === 'dismissible')!
  assert.deepEqual(dismissible.providers, [], 'the description still says it is unavailable')
  assert.equal(dismissible.required, false, 'but nothing is asking, so lint stays quiet')
})

test('sole-focus is never a grammar fault — it depends on who else is there', () => {
  assert.equal(providersOf(M.views[0], 'sole-focus'), null)
  // PresetGrid requires sole-focus and no band could ever "provide" it.
  assert.ok(!rules(M).some((r) => r.includes('unsatisfiable-requirement') && r.includes('sole')))
})

/* ---------------- shapes, reported not judged ---------------- */

test('two bands nothing can tell apart are reported as one wider band', () => {
  const m = withView('settings', (v) => ({
    ...v,
    bands: [
      { id: 'masthead', columns: 1, behavior: { focusPhase: 'before-main', landmark: 'banner' } },
      { id: 'body', columns: 2, behavior: { focusPhase: 'main', landmark: 'main' } },
      { id: 'extra', columns: 2, behavior: { focusPhase: 'main', landmark: 'main' } },
      { id: 'footer', columns: 1, behavior: { focusPhase: 'after-main', landmark: 'contentinfo' } },
    ],
  }))
  const found = grammarFindings(m).find((g) => g.rule === 'indistinguishable-bands')!
  assert.equal(found.where, 'body + extra')
  assert.match(found.detail, /buys no free movement/)
  assert.match(found.detail, /One band of 4 says the same thing once/)
})

test('a band with no contract is reported', () => {
  const m = withView('settings', (v) => ({
    ...v,
    bands: [...v.bands, { id: 'extra', columns: 1 }],
  }))
  const found = grammarFindings(m).find((g) => g.rule === 'contractless-band')!
  assert.equal(found.where, 'extra')
  assert.match(found.detail, /satisfies no focus-phase requirement/)
})

test('a position name is reported as convention, with the reason', () => {
  const m = withView('settings', (v) => ({
    ...v,
    bands: v.bands.map((b) => (b.id === 'body' ? { ...b, id: 'right' } : b)),
  }))
  const found = grammarFindings(m).find((g) => g.rule === 'position-name')!
  assert.equal(found.where, 'right')
  assert.match(found.detail, /right-to-left/)
  assert.match(found.detail, /do not aggregate/)
})

test('trailing empty columns are reported as a narrowing, not as loose holes', () => {
  // gallery/body has 3 columns; only body/1 is ever used.
  const found = grammarFindings(M).filter((g) => g.view === 'gallery')
  const columns = found.find((g) => g.rule === 'unused-columns' && g.where === 'body')!
  assert.match(columns.detail, /3 columns and no state has ever used more than 1/)
  // …and the same slots are not also reported individually.
  assert.ok(
    !found.some((g) => g.rule === 'unoccupied-slot' && ['body/2', 'body/3'].includes(g.where)),
    'each fact is reported once',
  )
})

test('an interior gap is reported as a slot, since narrowing would not fix it', () => {
  // Occupy the last column of a 3-wide band, leaving a hole in the middle.
  const m = withView('gallery', (v) => v)
  const store = drop(
    M,
    storeFromSource(m),
    { view: 'gallery', state: 'browse', feature: 'gallery.activity' },
    { kind: 'append', slot: 'body/3' },
    'human',
    1,
  ).store
  const committed: Manifest = {
    ...m,
    views: m.views.map((v) =>
      v.id === 'gallery'
        ? {
            ...v,
            placement: {
              browse: {
                'gallery.activity': { slot: 'body/3', order: 0, by: 'human' as const },
              },
            },
          }
        : v,
    ),
  }
  void store
  const found = grammarFindings(committed).filter((g) => g.view === 'gallery')
  assert.ok(found.some((g) => g.rule === 'unoccupied-slot' && g.where === 'body/2'))
})

/* ---------------- it still decides nothing ---------------- */

test('grammar findings report and never enforce', () => {
  const m = withView('gallery', (v) => ({ ...v, bands: v.bands.filter((b) => b.id !== 'aside') }))
  const report = lint(m)
  assert.ok(report.grammar.length > 0, 'findings exist')
  // Nothing here throws, nothing exits, and the rest of the report is unaffected.
  assert.ok(Array.isArray(report.contracts))
  const source = fs.readFileSync('src/grammar/describe.ts', 'utf8')
  assert.ok(!/process\.exit/.test(source) && !/throw new/.test(source))
  const cli = fs.readFileSync('bin/slots.mjs', 'utf8')
  const lintCase = cli.slice(cli.indexOf("case 'lint'"), cli.indexOf("case 'open'"))
  assert.ok(!/exitCode/.test(lintCase), 'grammar findings do not give lint an exit code')
})

/* ---------------- the seeds ---------------- */

test('every archetype is a grammar that builds clean and lints clean', () => {
  for (const [name, archetype] of Object.entries(ARCHETYPES)) {
    if (name === 'blank') continue
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `slots-${name}-`))
    const viewFile = path.join(dir, 'demo.view.ts')
    fs.writeFileSync(viewFile, renderView('demo', ['default'], archetype))
    fs.writeFileSync(path.join(dir, 'Demo.tsx'), renderSurface('demo', archetype))

    const problems: string[] = []
    const decl = readViewDecl(viewFile, fs.readFileSync(viewFile, 'utf8'), problems)
    assert.deepEqual(problems, [], `${name}: declaration must parse and validate`)

    const manifest: Manifest = {
      version: 1,
      generatedFrom: [],
      views: [decl!],
      features: [],
      viewFiles: { demo: 'demo.view.ts' },
      viewSurfaces: {},
    }
    // A seed that lints dirty on creation teaches the wrong thing immediately.
    // Empty slots are the exception: a seed has no features yet, so every slot
    // is unoccupied by construction and that is not a fault of the grammar.
    const faults = grammarFindings(manifest).filter(
      (g) => g.rule !== 'unoccupied-slot' && g.rule !== 'unused-columns',
    )
    assert.deepEqual(faults, [], `${name}: ${JSON.stringify(faults)}`)
  }
})

test('the blank archetype points at the six steps rather than at a shape', () => {
  const text = renderView('demo', ['default'], ARCHETYPES.blank)
  assert.match(text, /Deriving one/)
  assert.match(text, /list every feature across all states/)
  assert.doesNotMatch(text, /masthead/)
})

test('a seed says it is a seed, at the point someone is deciding', () => {
  const text = renderView('demo', ['default'], ARCHETYPES.document)
  assert.match(text, /seed, not a schema/)
  assert.match(text, /Nothing validates this against the archetype/)
  // `document` ships main:2 to teach that columns are peers.
  assert.match(text, /peers — swapping them is taste, not meaning/)
})
