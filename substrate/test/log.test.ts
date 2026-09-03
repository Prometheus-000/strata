import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { newId, type Decision } from '../src/decision'
import { append, collapseReversals, current, history, parseLog, readAll, since, LOG_PATH } from '../src/log'

let clock = Date.parse('2026-09-03T12:00:00.000Z')
const next = () => new Date((clock += 1000)).toISOString()
const d = (body: Omit<Decision, 'id' | 'at' | 'by' | 'via' | 'consequence'> & Partial<Decision>): Decision => {
  const at = body.at ?? next()
  return { id: newId(Date.parse(at)), by: 'human', via: 'test', consequence: {}, ...body, at } as Decision
}
const move = (region: string, from: string, to: string, line = 10, by: 'human' | 'agent' = 'human') =>
  d({ kind: 'move', region, from: { file: 'Page.tsx', line: 5, container: from }, to: { file: 'TopBar.tsx', line, container: to, index: 0 }, by })
const pick = (from: string | null, to: string | null) =>
  d({ kind: 'prop', component: 'Badge', prop: 'tone', file: 'G.tsx', line: 9, from, to })

test('append then readAll round-trips, oldest first, and a malformed line names itself', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'strata-log-'))
  const a = d({ kind: 'token', token: '--a', action: 'keep' })
  const b = d({ kind: 'token', token: '--b', action: 'cut', consequence: { collapsesTo: '--a' } })
  append(dir, a)
  append(dir, b)
  assert.deepEqual(readAll(dir), [a, b])
  assert.deepEqual(readAll(path.join(dir, 'nowhere')), [])
  fs.appendFileSync(path.join(dir, LOG_PATH), '{"kind":"token"}\n')
  assert.throws(() => readAll(dir), /decisions\.jsonl:3 is not a decision/)
  assert.throws(() => parseLog('nope'), /:1 is not JSON/)
  assert.throws(() => append(dir, { ...a, by: 'robot' as never }), /malformed/)
})

test('current is the latest non-refused decision per target; history keeps the path', () => {
  const keep = d({ kind: 'token', token: '--x', action: 'keep' })
  const cut = d({ kind: 'token', token: '--x', action: 'cut', supersedes: keep.id })
  const refused = d({ kind: 'token', token: '--x', action: 'keep', consequence: { refused: 'no' } })
  const other = d({ kind: 'token', token: '--y', action: 'keep' })
  const all = [keep, cut, refused, other]
  assert.equal(current(all).get('token:--x'), cut)
  assert.equal(current(all).get('token:--y'), other)
  assert.deepEqual(history(all, 'token:--x'), [keep, cut, refused])
})

test('since finds what happened after the last handoff', () => {
  const a = move('Filters', 'main', 'header')
  const ready = d({ kind: 'ready', by: 'agent' })
  const b = move('Badge', 'nav', 'main')
  assert.deepEqual(since([a, ready, b], 'ready'), [b])
  assert.deepEqual(since([a, b], 'ready'), [a, b])
})

test('moves keep their order and author; an exact reversal is a change of mind, not two moves', () => {
  const a = move('Filters', 'main', 'header')
  const b = move('Badge', 'nav', 'main', 12, 'agent')
  assert.deepEqual(collapseReversals([a, b]).map((m) => [m.kind === 'move' && m.region, m.by]), [['Filters', 'human'], ['Badge', 'agent']])
  const there = d({ kind: 'move', region: 'Filters', from: { file: 'Page.tsx', line: 5, container: 'main' }, to: { file: 'TopBar.tsx', line: 10, container: 'header', index: 0 } })
  const back = d({ kind: 'move', region: 'Filters', from: { file: 'TopBar.tsx', line: 10, container: 'header' }, to: { file: 'Page.tsx', line: 5, container: 'main', index: 0 } })
  assert.deepEqual(collapseReversals([there, back]), [])
  assert.deepEqual(collapseReversals([there, b, back]), [b])
})

test('picks on one attribute collapse to the last, keeping where it started; picking the start back drops the row', () => {
  const one = collapseReversals([pick('accent', 'positive')])
  assert.equal(one.length, 1)
  const two = collapseReversals([pick('accent', 'positive'), pick('positive', 'neutral')])
  assert.equal(two.length, 1)
  assert.deepEqual(two[0].kind === 'prop' && [two[0].from, two[0].to], ['accent', 'neutral'])
  assert.deepEqual(collapseReversals([pick('accent', 'positive'), pick('positive', 'accent')]), [])
  const refused = d({ kind: 'ready', consequence: { refused: 'nothing to hand off' } })
  assert.deepEqual(collapseReversals([refused]), [])
})
