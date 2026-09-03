/**
 * The malleable projection behind decide(): every write is applied by its
 * handler and lands on the record with its author, and the handoff is a
 * query over that record.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { decide, resetHandlers } from '@strata/substrate/decide'
import { collapseReversals, readAll, since } from '@strata/substrate/log'
import { formatHandoff } from '@strata/substrate/format'
import { registerMalleable } from '../src/decide'
import { OBSIDIAN } from '../src/engine/generateTheme'
import { readStore, writeManifest, writeStore } from '../src/store/persist'
import { emptyStore } from '../src/store/store'
import type { Manifest, MoveRequest } from '../src/schema'

const PAGE = `import { Filters } from './Filters'
import { Gallery } from './Gallery'
import { TopBar } from './TopBar'

export function Page() {
  return (
    <div className="page">
      <TopBar />
      <main className="page__main">
        <Filters />
        <Gallery />
      </main>
    </div>
  )
}
`
const TOPBAR = `import { Badge } from '../recipes/Badge'

export function TopBar() {
  return (
    <header className="topbar">
      <a href="#">Logo</a>
      <nav className="nav">
        <Badge />
      </nav>
    </header>
  )
}
`
const FILES: Record<string, string> = {
  'views/Page.tsx': PAGE,
  'views/TopBar.tsx': TOPBAR,
  'views/Filters.tsx': `export function Filters() { return <form role="search" className="filters">f</form> }\n`,
  'views/Gallery.tsx': `export function Gallery() { return <section className="gallery"><Badge tone="accent">six</Badge></section> }\nimport { Badge } from '../recipes/Badge'\n`,
  'recipes/Badge.tsx': `export function Badge({ tone = 'neutral', children }: { tone?: string; children?: unknown }) { return <span className="st-badge">{children}</span> }\n`,
}
const CARD = 'Card.div.st-card'
const MANIFEST: Manifest = {
  version: 1,
  generatedFrom: [],
  nodes: [
    {
      nodeId: CARD,
      file: 'app/recipes/Card.tsx',
      component: 'Card',
      layer: 'recipe',
      tag: 'div',
      classes: ['st-card'],
      base: { radius: { token: '--radius-surface' } },
      baseFrom: { radius: { selector: '.st-card', file: 'app/recipes/recipes.css' } },
    },
  ],
}

function world() {
  resetHandlers()
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'malleable-decide-'))
  for (const [f, t] of Object.entries(FILES)) {
    fs.mkdirSync(path.dirname(path.join(dir, 'app', f)), { recursive: true })
    fs.writeFileSync(path.join(dir, 'app', f), t)
  }
  writeManifest(MANIFEST, dir)
  writeStore(emptyStore(OBSIDIAN), dir)
  registerMalleable({ root: dir, source: 'app' })
  let t = Date.parse('2026-09-03T12:00:00.000Z')
  const ctx = (by: 'human' | 'agent' = 'human', extra: { dryRun?: boolean } = {}) => ({ root: dir, by, via: 'test', at: new Date((t += 1000)).toISOString(), ...extra })
  return { dir, ctx }
}
const address = (instancePath: string) => ({ nodeId: CARD, viewId: 'gallery', instancePath })

test('an override is set, widened, and removed through decide, and each lands on the record', () => {
  const { dir, ctx } = world()
  const set = decide({ kind: 'override', action: 'set', address: address('ember'), property: 'radius', value: { literal: '20px' } }, ctx('agent'))
  assert.ok(set.ok, set.ok ? '' : set.error)
  assert.equal(readStore(dir).overrides.length, 1)
  assert.equal(readStore(dir).overrides[0].author, 'agent')
  assert.deepEqual(set.written, ['.malleable/overrides.json'])
  assert.ok(set.decision.kind === 'override' && set.decision.node === CARD && set.decision.view === 'gallery')

  const same = decide({ kind: 'override', action: 'set', address: address('ember'), property: 'radius', value: { literal: '20px' } }, ctx())
  assert.ok(same.ok && same.unchanged)

  const wider = decide({ kind: 'override', action: 'rescope', address: address('ember'), property: 'radius', scope: 'view' }, ctx())
  assert.ok(wider.ok, wider.ok ? '' : wider.error)
  assert.ok(wider.decision.kind === 'override' && wider.decision.scope === 'view' && wider.decision.fromScope === 'instance')
  assert.deepEqual(wider.decision.consequence.absorbed, [`instance:gallery/ember::${CARD}:radius`])
  const store = readStore(dir)
  assert.deepEqual(store.overrides.map((o) => o.target.scope), ['view'])

  const refused = decide({ kind: 'override', action: 'rescope', address: { nodeId: CARD, viewId: 'settings', instancePath: 'x' }, property: 'radius', scope: 'view' }, ctx())
  assert.ok(!refused.ok && refused.decision?.consequence.refused, 'nothing to scope at a view with no override is refused, on the record')
  assert.equal(readStore(dir).overrides.length, 1, 'a refusal changes nothing')

  const gone = decide({ kind: 'override', action: 'remove', id: store.overrides[0].id }, ctx())
  assert.ok(gone.ok)
  assert.equal(readStore(dir).overrides.length, 0)

  const log = readAll(dir)
  assert.deepEqual(log.map((d) => [d.kind, d.by, !!d.consequence.refused]), [
    ['override', 'agent', false],
    ['override', 'human', false],
    ['override', 'human', false],
    ['override', 'human', true],
    ['override', 'human', false],
  ])
  assert.equal(log[2].supersedes, undefined, 'a view-scope decision is a different target from the instance one')
  assert.equal(log[4].supersedes, log[2].id)
})

test('a move and a pick rewrite source through decide; the handoff lists them, collapsing a change of mind', () => {
  const { dir, ctx } = world()
  const req: MoveRequest = { what: { container: 'Page.main.page__main', region: 'Filters', ordinal: 0 }, to: { container: 'TopBar.nav.nav', end: true } }
  const dry = decide({ kind: 'move', request: req }, ctx('agent', { dryRun: true }))
  assert.ok(dry.ok && dry.written.length === 0)
  assert.equal(readAll(dir).length, 0)

  const moved = decide({ kind: 'move', request: req, reason: 'the filters belong with the nav' }, ctx('agent'))
  assert.ok(moved.ok, moved.ok ? '' : moved.error)
  assert.deepEqual(moved.written.sort(), ['app/views/Page.tsx', 'app/views/TopBar.tsx'])
  assert.ok(moved.decision.kind === 'move' && moved.decision.region === 'Filters' && moved.decision.reason === 'the filters belong with the nav')
  assert.match(fs.readFileSync(path.join(dir, 'app/views/TopBar.tsx'), 'utf8'), /<Filters \/>/)

  const picked = decide(
    { kind: 'prop', request: { file: 'app/views/Gallery.tsx', component: 'Badge', parent: 'Gallery', ordinal: 0, prop: 'tone', value: 'positive' } },
    ctx(),
  )
  assert.ok(picked.ok, picked.ok ? '' : picked.error)
  assert.ok(picked.decision.kind === 'prop' && picked.decision.from === 'accent' && picked.decision.to === 'positive')
  assert.match(picked.decision.consequence.note ?? '', /tone/)

  const back = decide({ kind: 'move', request: { what: { container: 'TopBar.nav.nav', region: 'Filters', ordinal: 0 }, to: { container: 'Page.main.page__main', before: { region: 'Gallery', ordinal: 0 } } } }, ctx())
  assert.ok(back.ok)
  assert.equal(fs.readFileSync(path.join(dir, 'app/views/Page.tsx'), 'utf8'), PAGE)

  const all = readAll(dir)
  assert.equal(all.length, 3, 'the record keeps both moves')
  const handoff = collapseReversals(since(all, 'ready'))
  assert.deepEqual(handoff.map((d) => d.kind), ['prop'], 'the reviewer sees the pick and not the move that was undone')

  const ready = decide({ kind: 'ready' }, ctx('agent'))
  assert.ok(ready.ok && ready.decision.consequence.affected === 3)
  const text = formatHandoff(handoff, ready.decision)
  assert.match(text, /<Badge tone>\s+accent → positive/)
  assert.match(text, /ready for review — agent/)
  assert.ok(!fs.existsSync(path.join(dir, '.malleable/ready.json')), 'no receipt file: the handoff is a query')
})

test('a refused move is returned, not recorded; a seed change and a ship are decisions too', () => {
  const { dir, ctx } = world()
  const nope = decide({ kind: 'move', request: { what: { container: 'Page.main.page__main', region: 'Nothing', ordinal: 0 }, to: { container: 'TopBar.nav.nav', end: true } } }, ctx())
  assert.ok(!nope.ok && !nope.decision)
  assert.equal(readAll(dir).length, 0)

  const seeds = { ...OBSIDIAN, hue: 200 }
  const retheme = decide({ kind: 'seed', seeds }, ctx())
  assert.ok(retheme.ok && retheme.decision.kind === 'seed' && retheme.decision.from?.hue === OBSIDIAN.hue)
  assert.equal(readStore(dir).seeds.hue, 200)

  const shipped = decide({ kind: 'ship' }, ctx('agent', { dryRun: true }))
  assert.ok(shipped.ok && shipped.decision.kind === 'ship' && shipped.decision.frozen === 0)
})
