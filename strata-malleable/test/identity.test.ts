import assert from 'node:assert/strict'
import { test } from 'node:test'
import { scan, stamp } from '../src/identity/codemod'
import { parseRules, readValue, simpleClass } from '../src/identity/css'

const SRC = `
export function Card({ interactive }: { interactive?: boolean }) {
  return (
    <div className={\`st-card \${interactive ? 'st-card--interactive' : ''}\`}>
      <h3 className="st-card__title">Title</h3>
      <Badge tone="accent">not a styled node</Badge>
      <span>no className, not addressable</span>
    </div>
  )
}
`

const stampAll = (src: string, isView = false, taken = new Set<string>()) =>
  stamp('Card.tsx', src, isView, taken)

test('identity lands on styled nodes only', () => {
  const { assigned, source } = stampAll(SRC)
  assert.deepEqual(
    assigned.map((a) => a.nodeId),
    ['Card.div.st-card', 'Card.h3.st-card__title'],
  )
  // A component element and a class-less element are both left alone.
  assert.ok(!/Badge[^>]*data-sid/.test(source))
  assert.ok(!/<span data-sid/.test(source))
})

test('a modifier class never becomes the id', () => {
  const { assigned } = stampAll(SRC)
  assert.ok(assigned.every((a) => !a.nodeId.includes('--')))
})

test('stamping twice changes nothing', () => {
  const once = stampAll(SRC).source
  const twice = stampAll(once, false, new Set(['Card.div.st-card', 'Card.h3.st-card__title'])).source
  assert.equal(once, twice)
})

test('an assigned id survives the edit that would have changed it', () => {
  // Rename the class the id was derived from. The id must not follow, or every
  // override written against it is orphaned by a rename. (Rename the class, not
  // the attribute — a blind project-wide find-and-replace across `data-sid`
  // strings would rewrite identity itself, which is why they are quoted
  // attributes and not string-interpolated.)
  const stamped = stampAll(SRC).source
  const renamed = stamped.replace('className="st-card__title"', 'className="st-card__heading"')
  const after = scan('Card.tsx', renamed, false).nodes.map((n) => n.nodeId)
  assert.ok(after.includes('Card.h3.st-card__title'))
})

test('a colliding id is disambiguated, not silently shared', () => {
  const taken = new Set(['Card.div.st-card'])
  const { assigned } = stampAll(SRC, false, taken)
  assert.equal(assigned[0].nodeId, 'Card.div.st-card#2')
})

test('a view root carries the view id; nothing else does', () => {
  const { source } = stampAll(SRC, true)
  assert.match(source, /<div data-sid="Card.div.st-card" data-view="card"/)
  assert.equal(source.match(/data-view=/g)!.length, 1)
})

test('splicing preserves the rest of the file byte for byte', () => {
  const { source } = stampAll(SRC)
  assert.equal(source.replace(/ data-(sid|region)="[^"]*"/g, ''), SRC)
})

/* ---------------- regions and landmarks ---------------- */

const PAGE = `
import { useState } from 'react'
export function Page() {
  return (
    <div className="page">
      <TopBar />
      <main>
        <Filters />
      </main>
      <div role="dialog" aria-modal="true">
        <p>dialog</p>
      </div>
    </div>
  )
}
function TopBar() {
  return <header className="top">top</header>
}
const Frag = () => <><p>a</p></>
const Wrapped = () => <TopBar />
function Plain() {
  return <span>no class, no landmark</span>
}
`

test('data-region lands on the root host element of every component, once', () => {
  const { source, regions } = stamp('Page.tsx', PAGE, false, new Set())
  assert.deepEqual(regions, ['Page', 'TopBar', 'Plain'])
  assert.match(source, /<div data-sid="Page.div.page" data-region="Page" className="page">/)
  assert.match(source, /<header data-sid="TopBar.header.top" data-region="TopBar" className="top">/)
  assert.match(source, /<span data-region="Plain">/)
  // A fragment root and a component root have no host element to carry it.
  assert.ok(!/data-region="Frag"/.test(source))
  assert.ok(!/data-region="Wrapped"/.test(source))
  assert.equal(source.match(/data-region=/g)!.length, 3)
})

test('a landmark is identified without a className; a plain element still is not', () => {
  const { source, assigned } = stamp('Page.tsx', PAGE, false, new Set())
  assert.ok(assigned.some((a) => a.nodeId === 'Page.main'))
  assert.match(source, /<main data-sid="Page.main">/)
  assert.match(source, /<div data-sid="Page.div" role="dialog"/)
  assert.ok(!/<span data-sid/.test(source))
  assert.ok(!/<p data-sid/.test(source))
})

test('the three attributes land in one order, and stamping twice changes nothing', () => {
  const once = stamp('Page.tsx', PAGE, true, new Set()).source
  assert.match(once, /<div data-sid="Page.div.page" data-view="page" data-region="Page" className="page">/)
  const taken = new Set(scan('Page.tsx', once, true).pinned)
  const twice = stamp('Page.tsx', once, true, taken)
  assert.equal(twice.source, once)
  assert.deepEqual(twice.regions, [])
  assert.deepEqual(twice.assigned, [])
})

test('the stylesheet reader accepts only what ship can write back', () => {
  assert.deepEqual(readValue('var(--radius-surface)'), { token: '--radius-surface' })
  assert.deepEqual(readValue('12px'), { literal: '12px' })
  assert.deepEqual(readValue('0'), { literal: '0' })
  assert.equal(readValue('0 var(--control-pad-x)'), null, 'two-value shorthand')
  assert.equal(readValue('calc(1rem * var(--density))'), null, 'calc')
  assert.equal(simpleClass('.st-card'), 'st-card')
  assert.equal(simpleClass('.st-card--interactive:hover'), null)
  assert.equal(simpleClass('.a .b'), null)
})

test('rules inside an at-rule are visible but ineligible', () => {
  const rules = parseRules(`
    .st-card { border-radius: var(--radius-surface); }
    @media (prefers-reduced-motion: reduce) {
      .st-card { border-radius: 0; }
    }
  `)
  assert.equal(rules.length, 2)
  assert.equal(rules[0].condition, undefined)
  assert.match(rules[1].condition!, /@media/)
})

test('declaration offsets address the value text exactly', () => {
  const css = `.st-card {\n  border-radius: var(--radius-surface);\n}`
  const d = parseRules(css)[0].decls[0]
  assert.equal(css.slice(d.valueStart, d.valueEnd), 'var(--radius-surface)')
})

test('a comment cannot shift an offset', () => {
  const css = `/* a comment exactly here */\n.st-card { border-radius: 4px; }`
  const d = parseRules(css)[0].decls[0]
  assert.equal(css.slice(d.valueStart, d.valueEnd), '4px')
})
