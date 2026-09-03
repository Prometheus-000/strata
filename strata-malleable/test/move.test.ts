import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { applyMove } from '../src/structure/apply'
import { planMove } from '../src/structure/move'
import { readStructureFrom } from '../src/structure/read'
import type { MoveRequest } from '../src/schema'

/** An in-memory tree rooted at /app, planned against exactly like the disk. */
function world(files: Record<string, string>) {
  const texts = new Map(Object.entries(files))
  const abs = (rel: string) => path.join('/app', rel)
  const structure = () =>
    readStructureFrom([...texts.keys()].map(abs), {
      read: (f) => texts.get(path.relative('/app', f)) ?? null,
      relative: (f) => path.relative('/app', f),
    })
  const plan = (req: MoveRequest, by: 'human' | 'agent' = 'human') =>
    planMove(structure(), (rel) => texts.get(rel) ?? null, req, by, 'now', abs)
  const apply = (req: MoveRequest, by: 'human' | 'agent' = 'human') => {
    const p = plan(req, by)
    for (const [f, t] of p.texts) texts.set(f, t)
    return p.result
  }
  return { texts, structure, plan, apply, get: (f: string) => texts.get(f)! }
}

const ok = (r: ReturnType<ReturnType<typeof world>['apply']>) => {
  assert.ok(r.ok, r.ok ? '' : r.error)
  return r as Extract<typeof r, { ok: true }>
}

const S = `export function S() {
  return (
    <main>
      <A />
      <B />
      <C />
    </main>
  )
}
function A() { return <p className="a">a</p> }
function B() { return <p className="b">b</p> }
function C() { return <p className="c">c</p> }
`
const MAIN = 'S.main'
const at = (region: string, ordinal = 0) => ({ region, ordinal })
const from = (container: string, region: string, ordinal = 0) => ({ container, region, ordinal })

/* ---------------- reorder within a container ---------------- */

test('before a sibling: the line moves, nothing else changes', () => {
  const w = world({ 'S.tsx': S })
  const r = ok(w.apply({ what: from(MAIN, 'C'), to: { container: MAIN, before: at('A') } }))
  assert.equal(w.get('S.tsx'), S.replace('      <A />\n      <B />\n      <C />\n', '      <C />\n      <A />\n      <B />\n'))
  assert.equal(r.record.to.index, 0)
  assert.deepEqual(r.adapt, [])
})

test('after a sibling, and to the end', () => {
  const w = world({ 'S.tsx': S })
  ok(w.apply({ what: from(MAIN, 'A'), to: { container: MAIN, after: at('B') } }))
  assert.equal(w.get('S.tsx'), S.replace('      <A />\n      <B />\n', '      <B />\n      <A />\n'))
  ok(w.apply({ what: from(MAIN, 'B'), to: { container: MAIN, end: true } }))
  assert.equal(w.get('S.tsx'), S.replace('      <A />\n      <B />\n      <C />\n', '      <A />\n      <C />\n      <B />\n'))
})

test('a move to where it already is writes nothing and records nothing', () => {
  const w = world({ 'S.tsx': S })
  for (const req of [
    { what: from(MAIN, 'A'), to: { container: MAIN, before: at('B') } },
    { what: from(MAIN, 'B'), to: { container: MAIN, after: at('A') } },
    { what: from(MAIN, 'C'), to: { container: MAIN, end: true } },
  ] as MoveRequest[]) {
    const p = w.plan(req)
    assert.ok(p.result.ok && p.result.unchanged, JSON.stringify(req))
    assert.equal(p.texts.size, 0)
  }
})

test('the same move twice is one move', () => {
  const w = world({ 'S.tsx': S })
  ok(w.apply({ what: from(MAIN, 'C'), to: { container: MAIN, before: at('A') } }))
  const once = w.get('S.tsx')
  const again = w.plan({ what: from(MAIN, 'C'), to: { container: MAIN, before: at('A') } })
  assert.ok(again.result.ok && again.result.unchanged)
  assert.equal(w.get('S.tsx'), once)
})

test('a region is not its own neighbour, and a list is not moved', () => {
  const w = world({
    'S.tsx': `export function S() {
  return (<main>{items.map((i) => <A key={i} />)}<B /></main>)
}
function A() { return <p className="a">a</p> }
function B() { return <p className="b">b</p> }
`,
  })
  const self = w.plan({ what: from(MAIN, 'B'), to: { container: MAIN, before: at('B') } })
  assert.ok(!self.result.ok && /own neighbour/.test(self.result.error))
  const list = w.plan({ what: from(MAIN, 'A'), to: { container: MAIN, after: at('B') } })
  assert.ok(!list.result.ok && /list/.test(list.result.error))
})

test('into an empty multi-line container, and into a single-line one', () => {
  const w = world({
    'S.tsx': `export function S() {
  return (
    <div className="s">
      <main>
        <A />
      </main>
      <aside>
      </aside>
      <footer><B /></footer>
    </div>
  )
}
function A() { return <p className="a">a</p> }
function B() { return <p className="b">b</p> }
`,
  })
  ok(w.apply({ what: from(MAIN, 'A'), to: { container: 'S.aside', end: true } }))
  assert.match(w.get('S.tsx'), /<aside>\n        <A \/>\n      <\/aside>/)
  ok(w.apply({ what: from('S.aside', 'A'), to: { container: 'S.footer', end: true } }))
  assert.match(w.get('S.tsx'), /<footer><B \/><A \/><\/footer>/)
  assert.match(w.get('S.tsx'), /<aside>\n      <\/aside>/)
})

test('a multi-line element re-indents to where it lands', () => {
  const w = world({
    'S.tsx': `export function S() {
  return (
    <div className="s">
      <main>
        <A
          title="deep"
        />
      </main>
      <aside><B /></aside>
      <footer>
        <C />
      </footer>
    </div>
  )
}
function A() { return <p className="a">a</p> }
function B() { return <p className="b">b</p> }
function C() { return <p className="c">c</p> }
`,
  })
  ok(w.apply({ what: from(MAIN, 'A'), to: { container: 'S.footer', before: at('C') } }))
  assert.match(w.get('S.tsx'), /<footer>\n        <A\n          title="deep"\n        \/>\n        <C \/>\n      <\/footer>/)
})

/* ---------------- across files ---------------- */

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
const FILTERS = `export function Filters() { return <form role="search" className="filters">f</form> }\n`
const GALLERY = `export function Gallery() { return <section className="gallery">g</section> }\n`
const BADGE = `export function Badge() { return <span className="st-badge">b</span> }\n`
const PAGES = () => ({
  'views/Page.tsx': PAGE,
  'views/TopBar.tsx': TOPBAR,
  'views/Filters.tsx': FILTERS,
  'views/Gallery.tsx': GALLERY,
  'recipes/Badge.tsx': BADGE,
})
const PMAIN = 'Page.main.page__main'
const NAV = 'TopBar.nav.nav'

test('a region moved into a container in another file is imported there and dropped here', () => {
  const w = world(PAGES())
  const r = ok(w.apply({ what: from(PMAIN, 'Filters'), to: { container: NAV, after: at('Badge') } }))
  assert.equal(
    w.get('views/TopBar.tsx'),
    TOPBAR.replace("import { Badge } from '../recipes/Badge'\n", "import { Badge } from '../recipes/Badge'\nimport { Filters } from './Filters'\n").replace(
      '        <Badge />\n',
      '        <Badge />\n        <Filters />\n',
    ),
  )
  assert.equal(w.get('views/Page.tsx'), PAGE.replace("import { Filters } from './Filters'\n", '').replace('        <Filters />\n', ''))
  // The landing line counts the import added above it.
  assert.deepEqual(
    r.edits.map((e) => e.what),
    ['cut <Filters /> (line 10)', 'insert <Filters /> after <Badge /> (line 10)', "import { Filters } from './Filters'", 'drop the unused import of Filters'],
  )
  assert.equal(r.record.from.container, PMAIN)
  assert.equal(r.record.to.container, NAV)
  assert.equal(r.record.to.line, 10)
  assert.equal(w.get('views/TopBar.tsx').split('\n')[9].trim(), '<Filters />')
})

test('moving it back restores both files byte for byte', () => {
  const w = world(PAGES())
  ok(w.apply({ what: from(PMAIN, 'Filters'), to: { container: NAV, after: at('Badge') } }))
  ok(w.apply({ what: from(NAV, 'Filters'), to: { container: PMAIN, before: at('Gallery') } }))
  assert.equal(w.get('views/Page.tsx'), PAGE)
  assert.equal(w.get('views/TopBar.tsx'), TOPBAR)
})

test('a destination that already binds the name gets no second import; the source keeps an import it still uses', () => {
  const w = world({
    ...PAGES(),
    'views/Page.tsx': PAGE.replace("import { Gallery } from './Gallery'\n", "import { Badge } from '../recipes/Badge'\nimport { Gallery } from './Gallery'\n").replace(
      '        <Gallery />\n',
      '        <Gallery />\n        <Badge />\n',
    ),
  })
  const r = ok(w.apply({ what: from(NAV, 'Badge'), to: { container: PMAIN, end: true } }))
  assert.ok(!r.edits.some((e) => /^import/.test(e.what)), 'Page already imports Badge')
  assert.equal(w.get('views/Page.tsx').match(/import \{ Badge \}/g)!.length, 1)
  // TopBar no longer uses Badge, so its import goes; the nav is left empty but intact.
  assert.ok(!/import \{ Badge \}/.test(w.get('views/TopBar.tsx')))
  assert.match(w.get('views/TopBar.tsx'), /<nav className="nav">\n      <\/nav>/)
})

test('an import is re-relativised for the file it lands in, and joins an existing import of the same module', () => {
  const w = world({
    ...PAGES(),
    'App.tsx': `import { Button } from './recipes/Badge'
import { Page } from './views/Page'

export function App() {
  return (
    <div className="app">
      <Page />
      <footer className="foot">
        <Button />
      </footer>
    </div>
  )
}
`,
    'recipes/Badge.tsx': `export function Badge() { return <span className="st-badge">b</span> }\nexport function Button() { return <button className="st-button">b</button> }\n`,
  })
  // Badge lives in recipes/Badge, which App already imports Button from: join it.
  ok(w.apply({ what: from(NAV, 'Badge'), to: { container: 'App.footer.foot', before: at('Button') } }))
  assert.match(w.get('App.tsx'), /import \{ Button, Badge \} from '\.\/recipes\/Badge'/)
  // Filters is not imported anywhere near App: a new relative import, in sorted position.
  ok(w.apply({ what: from(PMAIN, 'Filters'), to: { container: 'App.footer.foot', end: true } }))
  assert.match(w.get('App.tsx'), /import \{ Button, Badge \} from '\.\/recipes\/Badge'\nimport \{ Filters \} from '\.\/views\/Filters'\nimport \{ Page \} from '\.\/views\/Page'/)
})

test('a component declared but not exported in its file is exported so the destination can import it', () => {
  const w = world({
    ...PAGES(),
    'views/Page.tsx': PAGE.replace('        <Gallery />\n', '        <Gallery />\n        <Notes />\n') + `
function Notes() {
  return <div className="notes">n</div>
}
`,
  })
  ok(w.apply({ what: from(PMAIN, 'Notes'), to: { container: NAV, end: true } }))
  assert.match(w.get('views/Page.tsx'), /\nexport function Notes\(\)/)
  assert.match(w.get('views/TopBar.tsx'), /import \{ Notes \} from '\.\/Page'/)
  assert.match(w.get('views/TopBar.tsx'), /<Badge \/>\n        <Notes \/>\n/)
})

test('a conditional region moves with its condition, and what it leaves behind is named — the move still lands', () => {
  const w = world({
    ...PAGES(),
    'views/Page.tsx': `import { useState } from 'react'
import { Dialog } from './Dialog'
import { TopBar } from './TopBar'

export function Page() {
  const [open, setOpen] = useState(false)
  return (
    <div className="page">
      <TopBar />
      <main className="page__main">
        {open && <Dialog onClose={() => setOpen(false)} />}
      </main>
    </div>
  )
}
`,
    'views/Dialog.tsx': `export function Dialog({ onClose }: { onClose: () => void }) { return <div role="dialog" className="d" onClick={onClose}>d</div> }\n`,
  })
  const r = ok(w.apply({ what: from(PMAIN, 'Dialog'), to: { container: NAV, end: true } }))
  assert.deepEqual(r.adapt, ['open', 'setOpen'])
  assert.match(w.get('views/TopBar.tsx'), /<Badge \/>\n        \{open && <Dialog onClose=\{\(\) => setOpen\(false\)\} \/>\}\n/)
  assert.deepEqual(r.record.adapt, ['open', 'setOpen'])
  assert.ok(!/<Dialog/.test(w.get('views/Page.tsx')))
})

test('a thing with a conditional twin is refused by name; so is a drop into itself', () => {
  const w = world({
    ...PAGES(),
    'views/Page.tsx': PAGE.replace('        <Gallery />\n', '        <Gallery />\n        {more && <Gallery />}\n'),
    'views/Panel.tsx': `export function Panel() { return <aside className="p"><b>p</b></aside> }\n`,
  })
  const twin = w.plan({ what: from(PMAIN, 'Gallery'), to: { container: NAV, end: true } })
  assert.ok(!twin.result.ok && /cannot tell them apart/.test(twin.result.error))

  const w2 = world({ ...PAGES(), 'views/Page.tsx': PAGE.replace('        <Gallery />\n', '        <Gallery />\n        <Panel />\n').replace("import { TopBar }", "import { Panel } from './Panel'\nimport { TopBar }"), 'views/Panel.tsx': `export function Panel() { return <aside className="p"><b>p</b></aside> }\n` })
  const self = w2.plan({ what: from(PMAIN, 'Panel'), to: { container: 'Panel.aside.p', end: true } })
  assert.ok(!self.result.ok && /into itself/.test(self.result.error))
})

test('every original line of both files survives a move; stamps travel inside the block', () => {
  const stamped = {
    ...PAGES(),
    'views/Page.tsx': PAGE.replace('<main className="page__main">', '<main data-sid="Page.main.page__main" className="page__main">'),
    'views/Filters.tsx': FILTERS.replace('<form', '<form data-sid="Filters.form.filters" data-region="Filters"'),
  }
  const w = world(stamped)
  ok(w.apply({ what: from(PMAIN, 'Filters'), to: { container: NAV, end: true } }))
  for (const line of stamped['views/Page.tsx'].split('\n'))
    if (!/Filters/.test(line)) assert.ok(w.get('views/Page.tsx').includes(line), `lost: ${line}`)
  for (const line of TOPBAR.split('\n')) assert.ok(w.get('views/TopBar.tsx').includes(line), `lost: ${line}`)
  assert.equal(w.get('views/Filters.tsx'), stamped['views/Filters.tsx'], 'the region file itself is untouched')
})

/* ---------------- on disk ---------------- */

test('applyMove writes only the files that changed, and a dry run writes nothing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'malleable-move-'))
  for (const [f, t] of Object.entries(PAGES())) {
    fs.mkdirSync(path.dirname(path.join(dir, 'app', f)), { recursive: true })
    fs.writeFileSync(path.join(dir, 'app', f), t)
  }
  const cwd = process.cwd()
  process.chdir(dir)
  try {
    const req: MoveRequest = { what: from(PMAIN, 'Filters'), to: { container: NAV, end: true } }
    const dry = applyMove('app', req, 'agent', 'now', { root: dir, dryRun: true })
    assert.ok(dry.ok)
    assert.deepEqual(dry.written, [])
    assert.equal(fs.readFileSync(path.join(dir, 'app/views/Page.tsx'), 'utf8'), PAGE)

    const real = applyMove('app', req, 'agent', 'now', { root: dir })
    assert.ok(real.ok)
    assert.deepEqual(real.written.sort(), ['app/views/Page.tsx', 'app/views/TopBar.tsx'])
    assert.equal(fs.readFileSync(path.join(dir, 'app/views/Gallery.tsx'), 'utf8'), GALLERY)
    assert.deepEqual([real.record.by, real.record.what], ['agent', 'Filters'])

    const again = applyMove('app', { what: from(NAV, 'Filters'), to: { container: NAV, end: true } }, 'agent', 'now', { root: dir })
    assert.ok(again.ok && again.unchanged)
    assert.deepEqual(again.written, [])

    // Moving it back restores both files byte for byte.
    const back = applyMove('app', { what: from(NAV, 'Filters'), to: { container: PMAIN, before: at('Gallery') } }, 'agent', 'now', { root: dir })
    assert.ok(back.ok && !back.unchanged)
    assert.equal(fs.readFileSync(path.join(dir, 'app/views/Page.tsx'), 'utf8'), PAGE)
    assert.equal(fs.readFileSync(path.join(dir, 'app/views/TopBar.tsx'), 'utf8'), TOPBAR)
  } finally {
    process.chdir(cwd)
  }
})
