import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { formatStructure, readStructureFrom } from '../src/structure/read'

/** In-memory files, addressed like a tree rooted at /app. */
const from = (files: Record<string, string>) => {
  const map = new Map(Object.entries(files).map(([k, v]) => [path.join('/app', k), v]))
  return readStructureFrom([...map.keys()], { read: (f) => map.get(f) ?? null, relative: (f) => path.relative('/app', f) })
}
const ids = (s: ReturnType<typeof from>) => s.containers.map((c) => `${c.sid}:${c.landmark}`)
const kids = (s: ReturnType<typeof from>, sid: string) =>
  s.containers.find((c) => c.sid === sid)!.children.map((k) => `${k.component}#${k.ordinal}`)

test('landmarks at the composition site are containers, and the root element is one too', () => {
  const s = from({
    'Site.tsx': `
export function Site() {
  return (
    <div className="site">
      <header className="top"><Logo /></header>
      <main><Body /></main>
      <aside className="side"><Notes /></aside>
      <footer><span>fine print</span></footer>
    </div>
  )
}
function Logo() { return <b className="logo">S</b> }
function Body() { return <p>body</p> }
function Notes() { return <p>notes</p> }
`,
  })
  assert.deepEqual(s.roots.map((r) => r.component), ['Site'])
  assert.deepEqual(ids(s), [
    'Site.div.site:root',
    'Site.header.top:banner',
    'Site.main:main',
    'Site.aside.side:complementary',
    'Site.footer:contentinfo',
  ])
  assert.deepEqual(kids(s, 'Site.header.top'), ['Logo#0'])
  assert.deepEqual(kids(s, 'Site.footer'), [])
  const main = s.containers.find((c) => c.sid === 'Site.main')!
  assert.equal(main.file, 'Site.tsx')
  assert.equal(main.line, 6)
  assert.equal(main.tag, 'main')
})

test('a container is found through the component that renders it, one import away — and its nested landmark too', () => {
  const s = from({
    'Page.tsx': `import { TopBar } from './TopBar'
export function Page() {
  return (
    <div className="page">
      <TopBar />
      <main className="page__main"><Body /></main>
    </div>
  )
}
function Body() { return <p>body</p> }
`,
    'TopBar.tsx': `import { Badge } from '../recipes/Badge'
export function TopBar() {
  return (
    <header className="topbar">
      <a href="#">Logo</a>
      <nav className="topbar__nav"><Badge /></nav>
    </header>
  )
}
`,
    '../recipes/Badge.tsx': `export function Badge() { return <span className="st-badge">b</span> }`,
  })
  assert.deepEqual(ids(s), [
    'Page.div.page:root',
    'TopBar.header.topbar:banner',
    'TopBar.nav.topbar__nav:navigation',
    'Page.main.page__main:main',
  ])
  const header = s.containers.find((c) => c.sid === 'TopBar.header.topbar')!
  assert.equal(header.file, 'TopBar.tsx')
  assert.equal(header.component, 'TopBar')
  assert.deepEqual(kids(s, 'TopBar.nav.topbar__nav'), ['Badge#0'])
  const badge = s.containers.find((c) => c.sid === 'TopBar.nav.topbar__nav')!.children[0]
  assert.equal(badge.importedFrom, '../recipes/Badge')
  assert.equal(badge.host, 'Badge')
  // TopBar itself is a region of the root, with a host element to carry data-region.
  assert.deepEqual(kids(s, 'Page.div.page'), ['TopBar#0'])
})

test('children are call sites in source order with per-name ordinals; wrappers are transparent', () => {
  const s = from({
    'S.tsx': `
export function S() {
  return (<main>
    <div className="wrap"><A /><B /></div>
    <A />
  </main>)
}
function A() { return <p>a</p> }
function B() { return <p>b</p> }
`,
  })
  assert.deepEqual(kids(s, 'S.main'), ['A#0', 'B#0', 'A#1'])
})

test('a conditional child records its condition and its range is the whole expression', () => {
  const src = `
export function S() {
  return (<main>
    {open && <Dialog />}
    {busy ? <Spinner /> : null}
  </main>)
}
function Dialog() { return <div className="d">d</div> }
function Spinner() { return <i>…</i> }
`
  const s = from({ 'S.tsx': src })
  const [dialog, spinner] = s.containers.find((c) => c.sid === 'S.main')!.children
  assert.equal(dialog.condition, 'open')
  assert.equal(src.slice(dialog.range[0], dialog.range[1]), '{open && <Dialog />}')
  assert.equal(spinner.condition, 'busy')
  assert.equal(src.slice(spinner.range[0], spinner.range[1]), '{busy ? <Spinner /> : null}')
})

test('a .map is a list — its data is its order, so it is not moved', () => {
  const s = from({
    'S.tsx': `
export function S() {
  return (<main>{items.map((i) => <Card key={i} />)}<Foot /></main>)
}
function Card() { return <div className="c">c</div> }
function Foot() { return <p>f</p> }
`,
  })
  const [card, foot] = s.containers.find((c) => c.sid === 'S.main')!.children
  assert.equal(card.kind, 'list')
  assert.equal(card.component, 'Card')
  assert.equal(foot.kind, 'component')
})

test('a component without a host root is listed as unaddressable, with the reason', () => {
  const s = from({
    'S.tsx': `
export function S() {
  return (<main><Frag /><Wrapped /><Plain /></main>)
}
function Frag() { return <><p>a</p></> }
function Wrapped() { return <Plain /> }
function Plain() { return <p className="plain">p</p> }
`,
  })
  const main = s.containers.find((c) => c.sid === 'S.main')!
  assert.deepEqual(main.children.map((k) => [k.component, k.host]), [
    ['Frag', null],
    ['Wrapped', null],
    ['Plain', 'Plain'],
  ])
  assert.deepEqual(
    s.unaddressable.map((u) => u.component),
    ['Frag', 'Wrapped'],
  )
  assert.match(s.unaddressable[0].why, /fragment/)
  assert.match(s.unaddressable[1].why, /<Plain \/>/)
})

test('ranges slice to the exact text, and a cycle between components terminates', () => {
  const src = `
export function S() {
  return (<main><A /></main>)
}
function A() { return <header className="a"><B /></header> }
function B() { return <nav className="b"><A /></nav> }
`
  const s = from({ 'S.tsx': src })
  const main = s.containers.find((c) => c.sid === 'S.main')!
  assert.equal(src.slice(main.range[0], main.range[1]), '<main><A /></main>')
  assert.equal(src.slice(main.open[0], main.open[1]), '<main>')
  assert.equal(src.slice(main.close!, main.close! + 7), '</main>')
  assert.equal(src.slice(main.children[0].range[0], main.children[0].range[1]), '<A />')
  assert.ok(s.containers.length < 10, 'the A ↔ B cycle did not recurse forever')
})

test('an existing data-sid is the container id; a derived one is used before stamping', () => {
  const s = from({
    'S.tsx': `
export function S() {
  return (<main data-sid="S.main#2"><A /></main>)
}
function A() { return <p>a</p> }
`,
  })
  assert.ok(s.containers.some((c) => c.sid === 'S.main#2'))
})

test('the fixtures read as one page: a root, four landmarks through two files', () => {
  const root = path.resolve('fixtures/app')
  const files = fs.readdirSync(path.join(root, 'views')).filter((f) => f.endsWith('.tsx')).map((f) => path.join(root, 'views', f))
  const s = readStructureFrom(files, {
    read: (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null),
    relative: (f) => path.relative(root, f),
  })
  assert.deepEqual(s.roots.map((r) => r.component), ['Page'])
  // Filters' root is a search form, so it is a region of main and a container
  // of its own; PublishDialog renders a dialog inside itself. Gallery's inner
  // <header> is not a landmark — it sits inside a <section>, HTML's own rule.
  assert.deepEqual(
    s.containers.map((c) => c.landmark),
    ['root', 'banner', 'navigation', 'main', 'search', 'complementary', 'dialog', 'contentinfo'],
  )
  assert.ok(!s.containers.some((c) => c.sid.startsWith('Gallery.') || c.sid.startsWith('Settings.')))
  const byLandmark = (lm: string) => s.containers.find((c) => c.landmark === lm)!.children.map((k) => k.component)
  assert.deepEqual(byLandmark('main'), ['Filters', 'Gallery', 'Settings'])
  assert.deepEqual(byLandmark('complementary'), ['Notes', 'PublishDialog'])
  assert.deepEqual(byLandmark('navigation'), ['Badge'])
  assert.deepEqual(byLandmark('root'), ['TopBar'])
  assert.deepEqual(s.unaddressable, [])
  const text = formatStructure(s)
  assert.match(text, /<main> main · views\/Page\.tsx:\d+/)
  assert.match(text, /<Filters \/>/)
})
