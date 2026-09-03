import { test } from 'node:test'
import assert from 'node:assert/strict'
import { authorFrom } from '../src/author.ts'

const ok = (r: ReturnType<typeof authorFrom>) => {
  assert.ok(!('error' in r), 'error' in r ? r.error : '')
  return r as Exclude<typeof r, { error: string }>
}

test('--decided-by names the hand that chose; --by is the same flag', () => {
  const explicit = ok(authorFrom(['--decided-by', 'agent'], {}))
  assert.deepEqual(explicit.decided, { kind: 'agent' })
  assert.match(explicit.because, /--decided-by agent on the command line/)
  assert.deepEqual(ok(authorFrom(['--by', 'agent'], {})).decided, { kind: 'agent' })
})

test('an actor is opaque, optional, and its absence is said out loud', () => {
  const named = ok(authorFrom(['--by', 'human', '--actor', 'prometheus-000'], {}))
  assert.deepEqual(named.decided, { kind: 'human', actor: 'prometheus-000' })
  assert.doesNotMatch(named.because, /no actor named/)
  assert.match(ok(authorFrom(['--by', 'human'], {})).because, /no actor named/)
  assert.deepEqual(ok(authorFrom([], { STRATA_ACTOR: 'ada' })).decided, { kind: 'human', actor: 'ada' })
})

test('CLAUDECODE says who wrote and never who decided', () => {
  // The whole point: an agent's shell is evidence about the hand on the
  // keyboard, and no evidence at all about the judgement.
  const alone = authorFrom([], { CLAUDECODE: '1' })
  assert.ok('error' in alone)
  assert.match(alone.error, /who could have chosen otherwise/)

  const stated = ok(authorFrom(['--decided-by', 'human', '--actor', 'prometheus-000'], { CLAUDECODE: '1' }))
  assert.deepEqual(stated.decided, { kind: 'human', actor: 'prometheus-000' })
  assert.deepEqual(stated.written, { kind: 'agent', actor: 'claude-code' })
  assert.match(stated.because, /CLAUDECODE in the environment/)
})

test('an agent that chose says so, and is still recorded as the writer', () => {
  const r = ok(authorFrom(['--decided-by', 'agent', '--actor', 'claude-code'], { CLAUDECODE: '1' }))
  assert.deepEqual(r.decided, { kind: 'agent', actor: 'claude-code' })
  assert.deepEqual(r.written, { kind: 'agent', actor: 'claude-code' })
})

test('the environment can say either hand, and the flag outranks it', () => {
  assert.deepEqual(ok(authorFrom([], { STRATA_DECIDED_BY: 'agent' })).decided, { kind: 'agent' })
  const split = ok(authorFrom([], { STRATA_DECIDED_BY: 'human', STRATA_WRITTEN_BY: 'agent' }))
  assert.deepEqual([split.decided.kind, split.written.kind], ['human', 'agent'])
  const both = ok(authorFrom([], { STRATA_AUTHOR: 'agent' }))
  assert.deepEqual([both.decided.kind, both.written.kind], ['agent', 'agent'])
  assert.deepEqual(ok(authorFrom([], { MALLEABLE_AUTHOR: 'agent' })).decided, { kind: 'agent' })
  assert.deepEqual(ok(authorFrom(['--by', 'human'], { STRATA_AUTHOR: 'agent' })).decided, { kind: 'human' })
})

test('with no signal at all, a person at a terminal decided and wrote it', () => {
  const none = ok(authorFrom([], {}))
  assert.deepEqual([none.decided, none.written], [{ kind: 'human' }, { kind: 'human' }])
  assert.match(none.because, /a person at a terminal is the base case/)
})

test('a hand is human or agent, and anything else is an error rather than a guess', () => {
  assert.ok('error' in authorFrom(['--by', 'robot'], {}))
  assert.ok('error' in authorFrom(['--written-by', 'robot'], {}))
  assert.ok('error' in authorFrom([], { STRATA_AUTHOR: 'robot' }))
  assert.ok('error' in authorFrom([], { STRATA_DECIDED_BY: 'robot' }))
})
