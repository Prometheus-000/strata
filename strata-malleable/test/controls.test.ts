import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import ts from 'typescript'
import { applyProp, resolveCallSite, siteFor } from '../src/controls/apply'
import { callSitesOf, readControls, setProp } from '../src/controls/read'
import { buildManifest } from '../src/identity/manifest'
import { specFor } from '../src/resolve/properties'

const parse = (text: string) => ts.createSourceFile('X.tsx', text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)

const BADGE = `import { defineControls } from '../../../src/controls/define'
export function Badge({ tone = 'neutral' }: { tone?: string }) {
  return <span className="st-badge">{tone}</span>
}
export const controls = defineControls(Badge, {
  tone: { options: ['neutral', 'accent', 'positive'] },
  radius: { range: [0, 24], snap: ['--radius-pill'] },
  padding: false,
})
`

test('a component declares its controls beside itself, and the reader keeps the two kinds apart', () => {
  const problems: string[] = []
  const c = readControls(parse(BADGE), problems).get('Badge')!
  assert.deepEqual(problems, [])
  assert.deepEqual(c.props, { tone: { kind: 'options', options: ['neutral', 'accent', 'positive'] } })
  assert.deepEqual(c.css, { radius: { range: [0, 24], snap: ['--radius-pill'] }, padding: false })
})

test('a declaration that is not data, or names nothing the layer knows, is reported by name', () => {
  const problems: string[] = []
  readControls(parse(`defineControls(A, { tone: { options: ['x'] }, colour: { snap: [] }, radius: false, gap: 3 })`), problems)
  assert.equal(problems.length, 3)
  assert.match(problems[0], /at least two/)
  assert.match(problems[1], /neither a CSS property nor a prop/)
  assert.match(problems[2], /A\.gap: expected an object or false/)
})

test('a boolean prop is a toggle with a declared default; a numeric prop is a range with a step', () => {
  const c = readControls(parse(`defineControls(Card, { interactive: { toggle: true }, open: { toggle: true, default: true }, lines: { range: [1, 6] }, weight: { range: [0, 1], step: 0.1 } })`)).get('Card')!
  assert.deepEqual(c.props, {
    interactive: { kind: 'toggle', default: false },
    open: { kind: 'toggle', default: true },
    lines: { kind: 'number', range: [1, 6], step: 1 },
    weight: { kind: 'number', range: [0, 1], step: 0.1 },
  })
  assert.deepEqual(c.css, {})
})

test('a CSS control narrows the registry spec; false takes the handle away; nothing declared means the registry', () => {
  assert.equal(specFor('radius', false), null)
  assert.equal(specFor('radius', undefined)!.range[1], 64)
  const s = specFor('radius', { range: [0, 24], snap: ['--radius-pill'] })!
  assert.deepEqual(s.range, [0, 24])
  assert.deepEqual(s.snapTo, ['--radius-pill'])
  assert.equal(s.handle, 'corner')
  assert.equal(specFor('colour', {}), null)
})

const GALLERY = `export function Gallery() {
  return (
    <section>
      <Badge tone="accent">six</Badge>
      <Badge>plain</Badge>
      {items.map((i) => <Card key={i} title={i} />)}
    </section>
  )
}
export function Foot() {
  return <footer><Badge tone={dynamic} /></footer>
}
`

test('call sites are found in source order, with ordinals per enclosing component and their literal attributes', () => {
  const sites = callSitesOf(parse(GALLERY), 'Badge')
  assert.deepEqual(
    sites.map((s) => [s.parent, s.ordinal, s.attrs.tone === undefined ? 'absent' : s.attrs.tone, s.list]),
    [['Gallery', 0, 'accent', false], ['Gallery', 1, 'absent', false], ['Foot', 0, null, false]],
  )
  assert.equal(callSitesOf(parse(GALLERY), 'Card')[0].list, true)
  // A component passed as a prop inside a mapped element is still in the list.
  const nested = callSitesOf(parse(GALLERY.replace('<Card key={i} title={i} />', '<Card key={i} footer={<Button variant="ghost" />} />')), 'Button')
  assert.equal(nested[0].list, true)
  assert.equal(nested[0].parent, 'Gallery')
})

test('one call site rendered many times is one line; several with a list among them cannot be told apart', () => {
  const cards = callSitesOf(parse(GALLERY), 'Card')
  assert.equal(siteFor(cards, { component: 'Card', parent: 'Gallery', ordinal: 4 }), cards[0])
  const two = callSitesOf(parse(GALLERY.replace('{items.map', '<Card />\n      {items.map')), 'Card')
  const r = siteFor(two, { component: 'Card', parent: 'Gallery', ordinal: 1 })
  assert.ok('error' in r && /cannot be told apart/.test(r.error))
  const none = siteFor(cards, { component: 'Card', parent: 'Foot', ordinal: 0 })
  assert.ok('error' in none && /no <Card> inside Foot/.test(none.error))
})

test('a pick replaces a literal, adds a missing attribute, drops one, and leaves an expression to the code', () => {
  const sf = parse(GALLERY)
  const [first, second, dynamic] = callSitesOf(sf, 'Badge')
  const replaced = setProp(GALLERY, sf, first, 'tone', 'positive')
  assert.ok(!('error' in replaced))
  assert.equal(replaced.text, GALLERY.replace('<Badge tone="accent">', '<Badge tone="positive">'))
  assert.match(replaced.what, /tone: accent → positive/)

  const added = setProp(GALLERY, sf, second, 'tone', 'accent')
  assert.ok(!('error' in added))
  assert.equal(added.text, GALLERY.replace('<Badge>plain', '<Badge tone="accent">plain'))

  const dropped = setProp(GALLERY, sf, first, 'tone', null)
  assert.ok(!('error' in dropped))
  assert.equal(dropped.text, GALLERY.replace('<Badge tone="accent">', '<Badge>'))

  const same = setProp(GALLERY, sf, first, 'tone', 'accent')
  assert.ok(!('error' in same) && same.text === GALLERY)

  const expr = setProp(GALLERY, sf, dynamic, 'tone', 'accent')
  assert.ok('error' in expr && /the code decides it/.test(expr.error))
})

test('applyProp writes the attribute, returns the record, and a dry run writes nothing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'malleable-prop-'))
  fs.mkdirSync(path.join(dir, 'views'))
  fs.writeFileSync(path.join(dir, 'views/G.tsx'), GALLERY)
  const req = { file: 'views/G.tsx', component: 'Badge', parent: 'Gallery', ordinal: 0, prop: 'tone', value: 'positive' }
  const dry = applyProp(req, 'agent', 'now', { root: dir, dryRun: true })
  assert.ok(dry.ok && !dry.unchanged)
  assert.deepEqual(dry.written, [])
  assert.equal(fs.readFileSync(path.join(dir, 'views/G.tsx'), 'utf8'), GALLERY)
  const real = applyProp(req, 'agent', 'now', { root: dir })
  assert.ok(real.ok)
  assert.deepEqual(real.written, ['views/G.tsx'])
  assert.match(fs.readFileSync(path.join(dir, 'views/G.tsx'), 'utf8'), /<Badge tone="positive">six/)
  assert.deepEqual([real.record.from, real.record.to, real.record.by], ['accent', 'positive', 'agent'])
  const again = applyProp(req, 'agent', 'now', { root: dir })
  assert.ok(again.ok && again.unchanged)
})

test('the fixtures carry their controls into the manifest, on the root node only', () => {
  const m = buildManifest('fixtures/app')
  const badge = m.nodes.find((n) => n.nodeId === 'Badge.span.st-badge')!
  assert.deepEqual(badge.controls?.props, { tone: { kind: 'options', options: ['neutral', 'accent', 'positive'] } })
  const card = m.nodes.find((n) => n.nodeId === 'Card.div.st-card')!
  assert.deepEqual(card.controls?.props.interactive, { kind: 'toggle', default: false })
  assert.deepEqual(card.controls?.props.lines, { kind: 'number', range: [1, 6], step: 1 })
  assert.deepEqual(badge.controls?.css.radius, { range: [0, 24], snap: ['--radius-pill', '--radius-interactive', '--strata-radius-1'] })
  const button = m.nodes.find((n) => n.nodeId === 'Button.button.st-button')!
  assert.equal(button.controls?.css.padding, false)
  assert.equal(m.nodes.find((n) => n.nodeId === 'Card.h3.st-card__title')!.controls, undefined)
})

test('a call site is found in the nearest ancestor that actually wrote it — a footer Button lives in the Gallery, not the Card', () => {
  const files: Record<string, string> = {
    'recipes/Card.tsx': `export function Card({ footer }: { footer?: unknown }) { return <div className="st-card">{footer}</div> }`,
    'views/Gallery.tsx': `export function Gallery() { return <section>{items.map((i) => <Card key={i} footer={<Button variant="secondary">Apply</Button>} />)}</section> }`,
  }
  const r = resolveCallSite(
    'Button',
    [
      { parent: 'Card', file: 'recipes/Card.tsx', ordinal: 0 },
      { parent: 'Gallery', file: 'views/Gallery.tsx', ordinal: 3 },
    ],
    (f) => files[f] ?? null,
  )
  assert.ok(!('error' in r))
  assert.equal(r.parent, 'Gallery')
  assert.equal(r.site.attrs.variant, 'secondary')
  assert.equal(r.site.list, true)
  const none = resolveCallSite('Badge', [{ parent: 'Card', file: 'recipes/Card.tsx', ordinal: 0 }], (f) => files[f] ?? null)
  assert.ok('error' in none && /no <Badge> call site among Card/.test(none.error))
})

test('booleans and numbers are read as what they are, and written in the shortest form that says it', () => {
  const SRC = `export function G() {
  return (<section>
    <Card interactive lines={3} />
    <Card interactive={false} weight={-0.5} open={isOpen} />
  </section>)
}
`
  const sf = parse(SRC)
  const [a, b] = callSitesOf(sf, 'Card')
  assert.deepEqual(a.attrs, { interactive: true, lines: 3 })
  assert.deepEqual(b.attrs, { interactive: false, weight: -0.5, open: null })

  const off = setProp(SRC, sf, a, 'interactive', false)
  assert.ok(!('error' in off))
  assert.equal(off.text, SRC.replace('<Card interactive lines={3} />', '<Card interactive={false} lines={3} />'))
  assert.match(off.what, /interactive: true → false/)

  const on = setProp(SRC, sf, b, 'interactive', true)
  assert.ok(!('error' in on))
  assert.equal(on.text, SRC.replace('<Card interactive={false} weight', '<Card interactive weight'))

  const lines = setProp(SRC, sf, a, 'lines', 5)
  assert.ok(!('error' in lines))
  assert.equal(lines.text, SRC.replace('lines={3}', 'lines={5}'))

  const added = setProp(SRC, sf, b, 'lines', 2)
  assert.ok(!('error' in added))
  assert.equal(added.text, SRC.replace('<Card interactive={false}', '<Card lines={2} interactive={false}'))

  const dropped = setProp(SRC, sf, a, 'interactive', null)
  assert.ok(!('error' in dropped))
  assert.equal(dropped.text, SRC.replace('<Card interactive lines', '<Card lines'))

  const expr = setProp(SRC, sf, b, 'open', true)
  assert.ok('error' in expr && /the code decides it/.test(expr.error))
})
