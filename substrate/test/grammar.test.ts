import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { byAuthority, byScope, isCitedOnly, layerOf, loadLayers, loadRules, preference, problemsWithLayer, problemsWithRule, rulesFor, rulesInLayer, rulesOutsideLayers, RULES_PATH } from '../src/grammar.ts'

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
  // Every rule says whether an evaluator speaks for it. Where none can, it
  // says `none`, so a silent rule is never read as a passing one.
  assert.ok(rules.every((r) => r.authority === 'invariant' || r.check), 'every rule names its evaluator, or says none')
  assert.ok(byScope(rules, 'product').every((r) => r.id.startsWith('voice.')), "only the voice is this product's own")
  assert.ok(byScope(rules, 'system').length > byScope(rules, 'product').length)
  assert.ok(rules.filter(isCitedOnly).length > 0, 'and the ones nothing evaluates are countable')
})

test('a malformed grammar is refused by name', () => {
  assert.deepEqual(problemsWithRule({ id: 'x', authority: 'law', statement: 's', reason: 'r', source: 'g', check: 'none' }), ['x: authority must be invariant, policy, preference or knowledge'])
  assert.deepEqual(problemsWithRule({ id: 'p', authority: 'preference', statement: 's', reason: 'r', source: 'g', check: 'none' }), ['p: a preference carries its value'])
  assert.deepEqual(problemsWithRule({ id: 's', authority: 'policy', statement: 's', reason: 'r', source: 'g', scope: 'house', check: 'none' }), ['s: scope is system or product'])
  assert.deepEqual(problemsWithRule({ id: 'q', authority: 'policy', statement: 's', reason: 'r', source: 'g' }), ['q: say which evaluator speaks for this rule, or "check": "none" — a rule nothing evaluates is cited, and check says so'])
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'strata-grammar-'))
  assert.deepEqual(loadRules(dir), [])
  fs.mkdirSync(path.join(dir, 'grammar'))
  fs.writeFileSync(path.join(dir, RULES_PATH), JSON.stringify({ rules: [{ id: 'bad' }] }))
  assert.throws(() => loadRules(dir), /bad: authority/)
})

test('every layer is data, and every layered rule has a layer to belong to', () => {
  // The hub used to hand-write this table in JSX, and it drifted exactly as
  // knowledge.drift-by-transcription predicts — claiming a validator enforced
  // Layer 0 long after nothing did. The table is projected now, so the failure
  // that remains is a rule in a layer nothing displays. This is that failure.
  const layers = loadLayers(REPO)
  const rules = loadRules(REPO)
  assert.ok(layers.length >= 4, 'the layers are in the grammar, not in the markup')

  const ids = new Set(layers.map((l) => l.id))
  const orphans = rules
    .map((r) => r.id.split('.')[0])
    .filter((prefix) => /^layer\d+$/.test(prefix) && !ids.has(prefix))
  assert.deepEqual([...new Set(orphans)], [], 'a rule names a layer the table cannot show')

  // And every layer that claims to govern something actually governs something.
  for (const layer of layers) assert.ok(rulesInLayer(rules, layer, layers).length > 0, `${layer.id} is displayed but carries no rules`)
})

test('a layer is declared or read from the id, and what belongs to neither is returned rather than dropped', () => {
  const layers = loadLayers(REPO)
  const rules = loadRules(REPO)

  // The id says it, when the id was named for a layer.
  const byPrefix = rules.find((r) => r.id.startsWith('layer0.'))!
  assert.equal(layerOf(byPrefix, layers), 'layer0')
  // And a rule whose id was named before the layers existed says so in a field.
  const declared = rules.find((r) => r.layer !== undefined)!
  assert.equal(layerOf(declared, layers), declared.layer)

  // The count the hub shows is every rule, once. It used to be the thirteen
  // whose ids happened to start with `layerN`, out of thirty-odd — the Machine
  // row rendering `check --enforce` above no rules at all, while the four
  // invariants it exists to describe sat outside the table.
  const placed = layers.flatMap((l) => rulesInLayer(rules, l, layers))
  const outside = rulesOutsideLayers(rules, layers)
  assert.equal(placed.length + outside.length, rules.length, 'a rule is in two layers, or in none and uncounted')
  assert.equal(new Set([...placed, ...outside].map((r) => r.id)).size, rules.length)
  assert.ok(outside.length > 0, 'the record’s own rules govern no tier of the artifact, and that is not a gap')
})

test('a rule declaring a layer that is not there is refused, like any other broken citation', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'strata-layer-'))
  fs.mkdirSync(path.join(dir, path.dirname(RULES_PATH)), { recursive: true })
  const write = (layer: string) =>
    fs.writeFileSync(
      path.join(dir, RULES_PATH),
      JSON.stringify({ layers: [{ id: 'machine', name: 'Machine', what: 'x', governance: 'y' }], rules: [{ id: 'a.rule', authority: 'policy', statement: 's', reason: 'r', source: 'x', check: 'none', layer }] }),
    )
  write('machine')
  assert.equal(loadRules(dir).length, 1)
  write('layer9')
  assert.throws(() => loadRules(dir), /layer "layer9" is not one of the layers/)
})

test('a malformed layer is refused by name', () => {
  assert.deepEqual(problemsWithLayer({ id: 'layer9', name: 'X', what: 'y' }), ['layer9: governance is missing'])
  assert.deepEqual(problemsWithLayer({}), ['a layer has no id', 'undefined: name is missing', 'undefined: what is missing', 'undefined: governance is missing'])
})
