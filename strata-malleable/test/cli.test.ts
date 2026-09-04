/**
 * The CLI's own commands, exercised through `runMalleable` rather than a
 * shell, so a crash in the printing path is caught here rather than by
 * whoever runs the command next.
 *
 * This file exists because of one: `footer` was a `const` arrow declared
 * after the `return run()` that reaches it, so every write command threw
 * `Cannot access 'footer' before initialization` — after the write had
 * landed. The record was correct and the process exited 1 with a stack trace,
 * which is the worst arrangement of those two facts. A dry run is enough to
 * catch it, and a dry run writes nothing.
 */
import assert from 'node:assert/strict'
import path from 'node:path'
import { test } from 'node:test'
import { runMalleable } from '../src/cli'

const LIB = path.join(path.dirname(new URL(import.meta.url).pathname), '..')
const home = { root: LIB, logRoot: LIB, source: 'fixtures/app' }

/** Run a command with output captured, writing nothing. */
function run(argv: string[]) {
  const out: string[] = []
  const err: string[] = []
  const code = runMalleable([...argv, '--dry'], home, { STRATA_DECIDED_BY: 'agent' }, { out: (s) => out.push(s), err: (s) => err.push(s) })
  return { code, out: out.join('\n'), err: err.join('\n') }
}

test('every write command prints its footer instead of throwing on the way to it', () => {
  const prop = run(['prop', 'Badge', 'tone', 'positive', '--in', 'fixtures/app/views/Gallery.tsx', '--why', 'a pick'])
  assert.equal(prop.code, 0, prop.err)
  assert.match(prop.out, /dry run — nothing written/)
  assert.match(prop.out, /decided by agent/, 'the sentence that decided the author is printed at the write')

  const move = run(['move', 'Filters', '--to', 'TopBar.nav.topbar__nav', '--why', 'a move'])
  assert.equal(move.code, 0, move.err)
  assert.match(move.out, /dry run — nothing written/)
})

test('a usage error is a message, not a stack trace', () => {
  const bad = run(['move'])
  assert.equal(bad.code, 1)
  assert.match(bad.err, /usage: move/)
})

test('retheme moves the seeds from a terminal, and clamps what the engine would clamp', () => {
  // The `seed` kind had a handler, a projection and a slider, and no CLI verb:
  // the only way to move a theme was to drag it in a browser. That made the
  // agent's reach *smaller* than a person's, which is the one asymmetry this
  // system says it does not have — and the retheme skill named a command
  // (`strata decide seed …`) that never existed to do it with.
  const one = run(['retheme', '--hue', '20', '--why', 'a warmer accent'])
  assert.equal(one.code, 0, one.err)
  assert.match(one.out, /hue 250 → 20/)
  assert.doesNotMatch(one.out, /chroma|warmth|energy|density/, 'an unnamed seed stays where it is')

  const flip = run(['retheme', '--appearance', 'light', '--why', 'paper'])
  assert.equal(flip.code, 0, flip.err)
  assert.match(flip.out, /appearance dark → light/)

  const same = run(['retheme', '--why', 'nothing'])
  assert.match(same.out, /nothing moved/, 'saying nothing moves nothing')

  // The engine clamps chroma to 0.25; a value it cannot hold is refused with
  // the range rather than silently pinned.
  const far = run(['retheme', '--chroma', '5', '--why', 'electric'])
  assert.equal(far.code, 1)
  assert.match(far.err, /clamps it to 0–0\.25/)

  const bad = run(['retheme', '--appearance', 'sepia', '--why', 'x'])
  assert.equal(bad.code, 1)
  assert.match(bad.err, /dark or light/)
})
