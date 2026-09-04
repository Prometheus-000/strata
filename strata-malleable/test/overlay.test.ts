/**
 * ONE DRAG, ONE DECISION.
 *
 * A handle drag repaints the element sixty times a second so the object
 * tracks the cursor. If any one of those frames wrote through `decide()`, a
 * single drag would leave sixty lines on the record, precedent would count a
 * habit as a convergence, and the log would stop being readable — which is
 * the failure the whole "evidence is never computed on the write path" rule
 * is guarding against, arriving from the other direction.
 *
 * The property is: the intermediate values are painted as inline styles, and
 * the write happens once, on release. This reads the source for it, because
 * the alternative is a DOM harness for a property that a grep can state
 * exactly.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

const SRC = path.join(path.dirname(new URL(import.meta.url).pathname), '../src/manipulate/Overlay.tsx')
const source = fs.readFileSync(SRC, 'utf8')

/** Every `const <name> = (…) => { … }` body in the file, by name. */
function bodies(name: string): string[] {
  const out: string[] = []
  const re = new RegExp(`const ${name} = `, 'g')
  for (let m = re.exec(source); m; m = re.exec(source)) {
    let depth = 0
    let i = source.indexOf('{', m.index)
    const from = i
    for (; i < source.length; i++) {
      if (source[i] === '{') depth++
      else if (source[i] === '}' && --depth === 0) break
    }
    out.push(source.slice(from, i))
  }
  return out
}

test('no pointermove handler in the overlay writes a decision', () => {
  // The strong form of the property, and the one that cannot be dodged by
  // moving code between handlers: whatever a move handler does, it does not
  // reach the record. Sixty frames would be sixty lines, and precedent would
  // read one hand's drag as a convergence.
  const moves = bodies('onMove')
  assert.ok(moves.length >= 2, 'the overlay tracks the pointer in more than one place')
  for (const body of moves) assert.ok(!/\bwrite\(/.test(body), `a pointermove handler writes:\n${body.slice(0, 300)}`)
})

test('a handle drag paints while it moves and writes once, on release', () => {
  // Two handlers paint: the property drag tracks the cursor with the value it
  // would write, and a region drag fades the thing being moved. Painting is
  // how a drag stays live without recompiling the stylesheet sixty times a
  // second, and neither of them reaches the record.
  const painting = bodies('onMove').filter((b) => /setProperty\(/.test(b))
  assert.ok(painting.length >= 1, 'a drag paints the element directly so it tracks the cursor')

  const committing = bodies('onUp').filter((b) => /\bwrite\(/.test(b))
  assert.equal(committing.length, 1, 'and exactly one release writes the decision')
  assert.ok(/removeProperty\(/.test(committing[0]), 'the painted preview comes off — the store is the only lasting authority')
})

test('the scrub control commits once, on release, and only if it moved', () => {
  // A click that never moved is a different intent — drop back to the default —
  // and it must not land as a value the record then holds as a decision.
  const scrub = source.slice(source.indexOf('mv__seg--scrub'))
  const onUp = scrub.slice(scrub.indexOf('onPointerUp'), scrub.indexOf('</button>'))
  assert.ok(/onCommit\(/.test(onUp) && /onClear\(/.test(onUp))
  const onMove = scrub.slice(scrub.indexOf('onPointerMove'), scrub.indexOf('onPointerUp'))
  assert.ok(/setLive\(/.test(onMove), 'moving updates local state')
  assert.ok(!/onCommit\(/.test(onMove), 'and commits nothing until the pointer is released')
})
