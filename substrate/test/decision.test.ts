import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ID_PATTERN, isDecision, newId, problemsWith, targetKey, type Decision } from '../src/decision.ts'

export const base = (at = '2026-09-03T12:00:00.000Z'): Pick<Decision, 'id' | 'by' | 'at' | 'via' | 'consequence'> => ({
  id: newId(Date.parse(at)),
  by: 'human',
  at,
  via: 'test',
  consequence: {},
})

test('an id sorts by time as a string and matches its pattern', () => {
  const a = newId(1_000)
  const b = newId(2_000)
  assert.ok(a < b)
  assert.match(a, ID_PATTERN)
  assert.notEqual(newId(1_000), newId(1_000))
})

test('the target key is stable per kind and ignores provenance', () => {
  const token: Decision = { ...base(), kind: 'token', token: '--accent-strong', action: 'cut' }
  assert.equal(targetKey(token), 'token:--accent-strong')
  assert.equal(targetKey({ ...token, by: 'agent', reason: 'x' } as Decision), 'token:--accent-strong')
  assert.equal(
    targetKey({ ...base(), kind: 'override', action: 'set', scope: 'view', selector: 'gallery::Card.div.st-card', property: 'radius' }),
    'override:view:gallery::Card.div.st-card:radius',
  )
  assert.equal(
    targetKey({ ...base(), kind: 'move', region: 'Filters', from: { container: 'a', file: 'A.tsx', line: 1 }, to: { container: 'b', file: 'B.tsx', line: 2, index: 0 } }),
    'move:Filters',
  )
  assert.equal(targetKey({ ...base(), kind: 'prop', component: 'Badge', prop: 'tone', file: 'G.tsx', line: 9, from: null, to: 'accent' }), 'prop:G.tsx:9:Badge.tone')
  assert.equal(targetKey({ ...base(), kind: 'ready' }), 'ready')
})

test('every way a line can fail to be a decision is named', () => {
  assert.deepEqual(problemsWith({ ...base(), kind: 'token', token: '--x', action: 'cut' }), [])
  assert.ok(problemsWith({ ...base(), kind: 'token', token: 'x', action: 'cut' }).some((p) => /custom property/.test(p)))
  assert.ok(problemsWith({ ...base(), by: 'robot', kind: 'ready' }).some((p) => /human or agent/.test(p)))
  assert.ok(problemsWith({ ...base(), kind: 'nope' }).some((p) => /unknown kind/.test(p)))
  assert.ok(problemsWith({ ...base(), id: '1', kind: 'ready' }).some((p) => /id/.test(p)))
  assert.ok(problemsWith({ ...base(), kind: 'override', action: 'set', scope: 'galaxy', selector: 's', property: 'p' }).some((p) => /scope/.test(p)))
  assert.ok(problemsWith('nope').includes('not an object'))
  assert.ok(isDecision({ ...base(), kind: 'seed', seeds: { hue: 1, chroma: 0, warmth: 0, energy: 0.5, density: 1, appearance: 'dark' } }))
})
