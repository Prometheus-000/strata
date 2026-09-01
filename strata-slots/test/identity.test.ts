import assert from 'node:assert/strict'
import { test } from 'node:test'
import { scan, stamp, kebab } from '../src/identity/codemod'

const SRC = `
export function Gallery() {
  return (
    <View id="gallery">
      <Feature slot="masthead/1"><Masthead /></Feature>
      <Feature slot="lede/1" states="browse"><Filters /></Feature>
    </View>
  )
}
`

const run = (src: string, taken = new Set<string>()) => stamp('Gallery.tsx', src, taken)

test('every feature in a view is given an id', () => {
  const { assigned } = run(SRC)
  assert.deepEqual(assigned.map((a) => a.id), ['gallery.masthead', 'gallery.filters'])
  assert.deepEqual(assigned.map((a) => a.component), ['Masthead', 'Filters'])
})

test('the id names the view and the component — never the position', () => {
  const { assigned } = run(SRC)
  assert.ok(assigned.every((a) => !/masthead\/1|lede\/1|\d+$/.test(a.id)))
  assert.equal(kebab('PresetGrid'), 'preset-grid')
})

test('an id survives being moved to another slot', () => {
  // The edit this whole layer exists to make must not change what a thing is.
  const stamped = run(SRC).source
  const moved = stamped.replace('slot="masthead/1"', 'slot="body/3"')
  const after = scan('Gallery.tsx', moved).features
  assert.equal(after[0].existingId, 'gallery.masthead')
  assert.equal(after[0].slot, 'body/3')
})

test('an id survives being wrapped, reordered, and renamed around', () => {
  const stamped = run(SRC).source
  const wrapped = stamped.replace(
    /(<Feature fid="gallery.masthead"[^>]*>)([\s\S]*?)(<\/Feature>)/,
    '$1<div className="pad">$2</div>$3',
  )
  assert.deepEqual(
    scan('Gallery.tsx', wrapped).features.map((f) => f.existingId),
    ['gallery.masthead', 'gallery.filters'],
  )
  const reordered = [...scan('Gallery.tsx', stamped).features].reverse()
  assert.deepEqual(reordered.map((f) => f.existingId), ['gallery.filters', 'gallery.masthead'])
  // Renaming the surrounding component cannot reassign anything either.
  const renamed = stamped.replace('export function Gallery()', 'export function PresetBrowser()')
  assert.equal(run(renamed, new Set(['gallery.masthead', 'gallery.filters'])).assigned.length, 0)
})

test('stamping twice changes nothing', () => {
  const once = run(SRC).source
  const twice = run(once, new Set(['gallery.masthead', 'gallery.filters'])).source
  assert.equal(once, twice)
})

test('splicing preserves the rest of the file byte for byte', () => {
  assert.equal(run(SRC).source.replace(/ fid="[^"]*"/g, ''), SRC)
})

test('a colliding id is disambiguated rather than shared', () => {
  const { assigned } = run(SRC, new Set(['gallery.masthead']))
  assert.equal(assigned[0].id, 'gallery.masthead#2')
})

test('states are read as a node set, and absent means every state', () => {
  const f = scan('Gallery.tsx', SRC).features
  assert.equal(f[0].states, null)
  assert.deepEqual(f[1].states, ['browse'])
})

test('views do not nest', () => {
  const { problems } = scan(
    'x.tsx',
    `<View id="a"><View id="b"><Feature slot="s/1"><X /></Feature></View></View>`,
  )
  assert.match(problems.join('\n'), /views do not nest/)
})

test('a feature outside a view is refused', () => {
  const { problems } = scan('x.tsx', `<Feature slot="s/1"><X /></Feature>`)
  assert.match(problems.join('\n'), /belongs to exactly one view/)
})

test('a feature must be a composed region, not a leaf', () => {
  const { problems } = scan('x.tsx', `<View id="a"><Feature slot="s/1">text</Feature></View>`)
  assert.match(problems.join('\n'), /not a leaf/)
})

test('a feature without a literal slot is refused', () => {
  const { problems } = scan(
    'x.tsx',
    `<View id="a"><Feature slot={computed}><X /></Feature></View>`,
  )
  assert.match(problems.join('\n'), /without a literal slot/)
})
