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
