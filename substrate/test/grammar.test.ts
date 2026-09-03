import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { byAuthority, loadRules, preference, problemsWithRule, rulesFor, RULES_PATH } from '../src/grammar.ts'

const REPO = path.join(path.dirname(new URL(import.meta.url).pathname), '../..')

test("the product's grammar loads, every rule carries its authority, and only mechanical truths are invariants", () => {
  const rules = loadRules(REPO)
  assert.ok(rules.length > 20)
  assert.deepEqual(byAuthority(rules, 'invariant').map((r) => r.id).sort(), ['css.vars-defined', 'fallbacks.total-acyclic', 'projections.match-record', 'record.parses'])
  assert.ok(byAuthority(rules, 'invariant').every((r) => r.check), 'an invariant has an evaluator')
  assert.equal(preference(rules, 'promotion.candidate-at', 99), 3)
  assert.equal(preference(rules, 'nope', 99), 99)
  assert.deepEqual(rulesFor(rules, ['layer2.one-filled-action', 'nope', 'voice.mono-for-data']).map((r) => r.id), ['layer2.one-filled-action', 'voice.mono-for-data'])
  assert.ok(rules.every((r) => r.reason.length > 20), 'rules ship with reasons')
})

test('a malformed grammar is refused by name', () => {
  assert.deepEqual(problemsWithRule({ id: 'x', authority: 'law', statement: 's', reason: 'r', source: 'g' }), ['x: authority must be invariant, policy, preference or knowledge'])
  assert.deepEqual(problemsWithRule({ id: 'p', authority: 'preference', statement: 's', reason: 'r', source: 'g' }), ['p: a preference carries its value'])
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'strata-grammar-'))
  assert.deepEqual(loadRules(dir), [])
  fs.mkdirSync(path.join(dir, 'grammar'))
  fs.writeFileSync(path.join(dir, RULES_PATH), JSON.stringify({ rules: [{ id: 'bad' }] }))
  assert.throws(() => loadRules(dir), /bad: authority/)
})
