import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { decide, registerHandler, resetHandlers, type Request } from '../src/decide'
import { readAll } from '../src/log'

const fresh = () => {
  resetHandlers()
  return fs.mkdtempSync(path.join(os.tmpdir(), 'strata-decide-'))
}
type TokenReq = Request & { kind: 'token'; token: string; action: 'keep' | 'cut' }
const ctx = (root: string, extra: Partial<Parameters<typeof decide>[1]> = {}) => ({ root, by: 'human' as const, via: 'test', at: '2026-09-03T12:00:00.000Z', ...extra })

test('a decision is applied by its projection, then appended with provenance and a supersedes chain', () => {
  const root = fresh()
  const seen: string[] = []
  registerHandler<TokenReq>('token', (req, c) => {
    seen.push(`${req.token}:${req.action}:${c.id}`)
    return { body: { kind: 'token', token: req.token, action: req.action }, consequence: { collapsesTo: '--accent' }, written: ['ledger.json'] }
  })
  const first = decide({ kind: 'token', token: '--x', action: 'keep', reason: 'wanted' }, ctx(root, { because: 'by human — test' }))
  assert.ok(first.ok)
  const second = decide({ kind: 'token', token: '--x', action: 'cut' }, ctx(root, { by: 'agent', at: '2026-09-03T12:00:01.000Z' }))
  assert.ok(second.ok)
  const log = readAll(root)
  assert.equal(log.length, 2)
  assert.equal(log[0].reason, 'wanted')
  assert.equal(log[0].because, 'by human — test')
  assert.equal(log[1].supersedes, log[0].id)
  assert.equal(log[1].by, 'agent')
  assert.deepEqual(log[1].consequence, { collapsesTo: '--accent', written: ['ledger.json'] })
  assert.equal(seen.length, 2)
  assert.ok(seen[0].endsWith(log[0].id), 'the handler saw the id the decision would carry')
})

test('a refusal with a target is on the record and changes nothing; without one it is only returned', () => {
  const root = fresh()
  registerHandler<TokenReq>('token', (req) =>
    req.token === '--nope' ? { refused: 'the engine does not emit --nope' } : { refused: 'already cut', body: { kind: 'token', token: req.token, action: req.action } },
  )
  const r1 = decide({ kind: 'token', token: '--nope', action: 'cut' }, ctx(root))
  assert.deepEqual(r1, { ok: false, error: 'the engine does not emit --nope' })
  assert.equal(readAll(root).length, 0)
  const r2 = decide({ kind: 'token', token: '--x', action: 'cut' }, ctx(root))
  assert.ok(!r2.ok && r2.decision?.consequence.refused === 'already cut')
  assert.equal(readAll(root).length, 1)
})

test('an unknown kind is an error, a handler that throws is an error, and a dry run appends nothing', () => {
  const root = fresh()
  const r = decide({ kind: 'move' }, ctx(root))
  assert.ok(!r.ok && /no projection handles "move"/.test(r.error))
  registerHandler<TokenReq>('token', () => {
    throw new Error('disk on fire')
  })
  const boom = decide({ kind: 'token', token: '--x', action: 'cut' }, ctx(root))
  assert.ok(!boom.ok && boom.error === 'disk on fire')
  registerHandler<TokenReq>('token', (req) => ({ body: { kind: 'token', token: req.token, action: req.action } }))
  const dry = decide({ kind: 'token', token: '--x', action: 'cut' }, ctx(root, { dryRun: true }))
  assert.ok(dry.ok)
  assert.equal(readAll(root).length, 0)
})

test('ready is built in: it records only, and counts what it hands off', () => {
  const root = fresh()
  registerHandler<TokenReq>('token', (req) => ({ body: { kind: 'token', token: req.token, action: req.action } }))
  decide({ kind: 'token', token: '--a', action: 'keep' }, ctx(root))
  decide({ kind: 'token', token: '--b', action: 'keep' }, ctx(root, { at: '2026-09-03T12:00:01.000Z' }))
  const ready = decide({ kind: 'ready' }, ctx(root, { by: 'agent', at: '2026-09-03T12:00:02.000Z' }))
  assert.ok(ready.ok && ready.decision.kind === 'ready' && ready.decision.consequence.affected === 2)
  const unchanged = decide({ kind: 'token', token: '--a', action: 'keep' }, ctx(root, { at: '2026-09-03T12:00:03.000Z' }))
  assert.ok(unchanged.ok)
})
