import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { collapseWheres, enforced, explain, formatCheck, formatExplanation, runCheck } from '../src/check.ts'
import { decide, registerHandler, resetHandlers, type Request } from '../src/decide.ts'
import { registerEvaluator, resetEvaluators } from '../src/evidence.ts'
import { RULES_PATH } from '../src/grammar.ts'
import { LOG_PATH } from '../src/log.ts'
import { registerProjection, resetProjections } from '../src/projection.ts'

const RULES = {
  rules: [
    { id: 'record.parses', authority: 'invariant', statement: 's', reason: 'the record is the source of everything', source: 'x', check: 'record.parses' },
    { id: 'projections.match-record', authority: 'invariant', statement: 's', reason: 'a projection that differs is a decision nobody made', source: 'x', check: 'projections.match-record' },
    { id: 'floors.exist', authority: 'invariant', statement: 's', reason: 'every chain must end somewhere honest', source: 'x', check: 'floors.exist' },
    { id: 'names.semantic', authority: 'policy', statement: 's', reason: 'predictability of meaning, not sameness', source: 'x', check: 'names.semantic' },
    { id: 'promotion.candidate-at', authority: 'preference', statement: 's', reason: 'one is taste; nine is a missing token', source: 'x', value: 2, check: 'none' },
  ],
}

function world() {
  resetHandlers()
  resetEvaluators()
  resetProjections()
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'strata-check-'))
  fs.mkdirSync(path.join(dir, 'grammar'))
  fs.writeFileSync(path.join(dir, RULES_PATH), JSON.stringify(RULES))
  registerHandler<Request & { kind: 'token'; token: string; action: 'cut' | 'keep' }>('token', (req) => ({
    body: { kind: 'token', token: req.token, action: req.action },
    consequence: req.action === 'cut' ? { collapsesTo: '--accent' } : {},
  }))
  registerProjection({ name: 'tokens.txt', project: (_r, log) => ({ 'tokens.txt': log.map((d) => d.kind === 'token' && `${d.token}=${d.action}`).join('\n') + '\n' }) })
  let t = Date.parse('2026-09-03T12:00:00.000Z')
  const ctx = () => ({ root: dir, decided: { kind: 'human' as const }, written: { kind: 'human' as const }, via: 'test', at: new Date((t += 1000)).toISOString() })
  return { dir, ctx }
}

test('check evaluates everything and enforces only invariants; a policy finding never fails it', () => {
  const { dir, ctx } = world()
  registerEvaluator({ id: 'floors.exist', findings: () => [] })
  registerEvaluator({ id: 'names.semantic', findings: () => [{ rule: 'names.semantic', authority: 'policy', where: 'a.css:3', message: '#fff — undeclared' }] })
  registerEvaluator({ id: 'drift', findings: () => [{ rule: 'drift.convergence', authority: 'precedent', message: '3 instances converged on padding = 12px' }] })
  decide({ kind: 'token', token: '--a', action: 'cut', reason: 'one filled action' }, ctx())
  fs.writeFileSync(path.join(dir, 'tokens.txt'), '--a=cut\n')

  const r = runCheck(dir)
  assert.ok(enforced(r))
  assert.deepEqual(r.invariants.map((i) => [i.rule, i.ok]), [['record.parses', true], ['projections.match-record', true], ['floors.exist', true]])
  assert.deepEqual(r.findings.map((f) => [f.authority, f.rule]), [['policy', 'names.semantic'], ['precedent', 'drift.convergence']])
  const text = formatCheck(r)
  // The verdict is the first line: whether anything needs the reader should
  // not take reaching the last one.
  assert.match(text, /^\n  1 decision\(s\) on the record  ·  every invariant holds  ·  2 finding\(s\), none of them blocking\n/)
  // Each band says what it obliges, where the band is.
  assert.match(text, /INVARIANTS  ·  [^\n]*\n──────────────\n✓ record\.parses — 1 decision\(s\)\n✓ projections\.match-record\n✓ floors\.exist/)
  assert.match(text, /POLICY  ·  [^\n]*\n──────────────\nnames\.semantic  a\.css:3\n    #fff — undeclared/)
  assert.match(text, /PRECEDENT  ·  computed from the record[^\n]*\n──────────────\ndrift\.convergence/)
  assert.match(text, /HANDOFF[\s\S]*cut --a → --accent · human · one filled action[\s\S]*not yet handed off/)
  assert.match(text, /every invariant holds; the rest is evaluation/)
})

test('an invariant fails on a hand-edited projection, a malformed record, or an invariant nobody can speak for', () => {
  const { dir, ctx } = world()
  registerEvaluator({ id: 'floors.exist', findings: () => [{ rule: 'floors.exist', authority: 'invariant', where: '--b', message: 'no fallback' }] })
  decide({ kind: 'token', token: '--a', action: 'cut' }, ctx())
  fs.writeFileSync(path.join(dir, 'tokens.txt'), '--a=cut by hand\n')
  const r = runCheck(dir)
  assert.ok(!enforced(r))
  assert.deepEqual(r.invariants.map((i) => [i.rule, i.ok]), [['record.parses', true], ['projections.match-record', false], ['floors.exist', false]])
  assert.match(formatCheck(r), /✗ projections\.match-record\n    tokens\.txt  tokens\.txt differs from what the record projects — strata rebuild\n✗ floors\.exist\n    --b  no fallback/)

  resetEvaluators()
  const r2 = runCheck(dir)
  assert.ok(r2.invariants.find((i) => i.rule === 'floors.exist')!.findings[0].message.includes('no evaluator here can speak for'))

  fs.appendFileSync(path.join(dir, LOG_PATH), 'not json\n')
  const r3 = runCheck(dir)
  assert.deepEqual(r3.invariants.map((i) => [i.rule, i.ok]), [['record.parses', false]])
  assert.match(r3.invariants[0].findings[0].message, /decisions\.jsonl:2 is not JSON/)
})

test('explain assembles the four blocks: the record supplies context, evaluators supply evidence', () => {
  const { dir, ctx } = world()
  registerEvaluator({ id: 'token.usage', kinds: ['token'], evidence: (d) => (d.kind === 'token' ? [{ name: 'consumers', value: 34 }, { name: 'usage concentration', value: 'high' }] : []) })
  registerEvaluator({ id: 'ignored', kinds: ['move'], evidence: () => [{ name: 'nope', value: 1 }] })
  decide({ kind: 'token', token: '--a', action: 'keep' }, ctx())
  decide({ kind: 'token', token: '--a', action: 'cut', reason: 'one filled action per surface' }, ctx())
  decide({ kind: 'token', token: '--a', action: 'keep' }, ctx())
  const e = explain(dir, 'token:--a')!
  assert.equal(e.decision.kind === 'token' && e.decision.action, 'keep', 'a target key explains its current decision')
  const mid = explain(dir, e.history[1].id)!
  assert.equal(mid.decision.reason, 'one filled action per surface')
  const text = formatExplanation(mid)
  assert.match(text, /DECISION  ·  [^\n]*\n──────────────\nToken: --a\nAction: cut\nDecided by: human\nWritten by: human\nReason: one filled action per surface/)
  assert.match(text, /CONTEXT  ·  [^\n]*\n──────────────\ntarget: token:--a  \(record\)\ndecisions on this target before it: 1  \(record\)\nsuperseded: keep --a · human  \(record\)\nsince superseded by: keep --a · human  \(record\)\nprecedent: 2 other decision\(s\) about the same thing  \(precedent\)/)
  assert.match(text, /EVIDENCE  ·  [^\n]*\n──────────────\nconsumers: 34  \(token\.usage\)\nusage concentration: high  \(token\.usage\)/)
  assert.doesNotMatch(text, /nope/)
  assert.match(text, /CONSEQUENCE  ·  [^\n]*\n──────────────\nfallback → --accent/)
  assert.match(text, /HISTORY\n──────────────\n· [^\n]*keep --a[^\n]*\n● [^\n]*cut --a[^\n]*\n· [^\n]*keep --a/)
  assert.equal(explain(dir, 'token:--zzz'), null)
})

test("an evaluator that speaks for a rule is silent where the product's grammar does not have it", () => {
  // A product inherits the system's rules and writes its own voice. An
  // evaluator for a rule it never adopted — another product's two radii —
  // would report a taste it never chose, in a report whose whole authority
  // rests on saying which rule is speaking.
  const { dir, ctx } = world()
  registerEvaluator({ id: 'floors.exist', findings: () => [] })
  registerEvaluator({ id: 'voice.two-radii', rule: 'voice.two-radii', findings: () => [{ rule: 'voice.two-radii', authority: 'policy', message: '3 radius scales are live' }] })
  registerEvaluator({ id: 'names.semantic', rule: 'names.semantic', findings: () => [{ rule: 'names.semantic', authority: 'policy', where: 'a.css:3', message: '#fff — undeclared' }] })
  registerEvaluator({ id: 'drift', findings: () => [{ rule: 'drift.convergence', authority: 'precedent', message: '3 instances converged on padding = 12px' }] })
  decide({ kind: 'token', token: '--a', action: 'cut' }, ctx())
  fs.writeFileSync(path.join(dir, 'tokens.txt'), '--a=cut\n')

  const r = runCheck(dir)
  assert.deepEqual(r.findings.filter((f) => f.rule === 'voice.two-radii'), [], 'the grammar here has no such rule, so nothing speaks for it')
  assert.equal(r.findings.filter((f) => f.rule === 'names.semantic').length, 1, 'a rule the grammar does have is evaluated as before')
  assert.equal(r.findings.filter((f) => f.rule === 'drift.convergence').length, 1, 'and an evaluator that names no rule is computed knowledge, always')
})

test('one judgement said in many places is one entry with its sites, not many entries', () => {
  // Seven declared deviations on seven consecutive lines of one stylesheet are
  // one judgement; printed seven times they bury everything under them.
  assert.equal(collapseWheres(['a.css:868', 'a.css:869', 'a.css:870', 'a.css:874']), 'a.css:868-870, 874')
  assert.equal(collapseWheres(['b.tsx:98', 'b.tsx:440', 'b.tsx:441', 'b.tsx:442', 'b.tsx:443']), 'b.tsx:98, 440-443')
  assert.equal(collapseWheres(['x.css:9', 'x.css:9']), 'x.css:9', 'the same site twice is one site')
  assert.equal(collapseWheres(['--a-token', 'a.css:2']), '--a-token · a.css:2', 'a where that is not file:line is kept as it is')
  assert.equal(collapseWheres(['a.css:5', 'a.css:6']), 'a.css:5, 6', 'a run of two is listed, not hyphenated — the range would be longer')

  const { dir, ctx } = world()
  registerEvaluator({
    id: 'dev',
    findings: () =>
      [868, 869, 870].map((n) => ({ rule: 'deviation.declared', authority: 'knowledge' as const, where: `s.css:${n}`, message: 'declared: the wheel is the value' })),
  })
  decide({ kind: 'token', token: '--a', action: 'cut' }, ctx())
  fs.writeFileSync(path.join(dir, 'tokens.txt'), '--a=cut\n')
  const text = formatCheck(runCheck(dir))
  assert.match(text, /deviation\.declared  s\.css:868-870  \(3×\)\n    declared: the wheel is the value/)
  assert.equal(text.match(/declared: the wheel is the value/g)?.length, 1, 'the sentence is said once, not once per site')
})
