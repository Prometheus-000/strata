/**
 * STALE PROSE, AS THIS PRODUCT CHECKS IT.
 *
 * The scan lives in `substrate/src/prose.ts` and ships with Strata, which
 * reports ghosts under `policy` and blocks nothing — prose is not the
 * artifact, and a build that fails because a README mentions a deleted
 * command is policing documentation.
 *
 * This repository chooses otherwise for itself, which is what the first test
 * is: the same evaluator, run as an assertion. The rest are the four checks
 * that cannot ship, because they are about artifacts only this repository has
 * — its README's counts, its MCP server, its bench.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { loadRules } from '@strata/substrate/grammar'
import { brokenCitations, ghosts } from '@strata/substrate/prose'
import { registerTheme } from '../src/theme/handlers'
import { registerMalleable } from '../strata-malleable/src/decide/index'
import { PROSE } from './prose'

const REPO = path.join(path.dirname(new URL(import.meta.url).pathname), '..')
const read = (rel: string) => fs.readFileSync(path.join(REPO, rel), 'utf8')

test('no sentence in this repository names something that is not there', () => {
  const found = ghosts(REPO, PROSE).map((g) => `${g.file}: ${g.message}`)
  assert.deepEqual(found, [], 'prose names a script, a command or a file that does not exist')
})

test('every skill cites a rule, a state provider, an example and a kind that exist', () => {
  // The citations resolve against what is registered, so the projections have
  // to be registered first — the same order `bin/strata.mjs` uses.
  registerTheme({ root: REPO })
  registerMalleable({ root: path.join(REPO, 'strata-malleable'), source: 'fixtures/app' })
  const found = brokenCitations(REPO).map((g) => `${g.file}: ${g.message}`)
  assert.deepEqual(found, [], 'a skill cites something that is not there — renaming a rule silently empties the packet that cited it')
})

test('the count the README claims about the grammar is the count the grammar has', () => {
  // The README states how much of the grammar is machine-checked. That number
  // moved twice today — adding evaluators moves rules out of the cited list —
  // and the sentence did not follow it either time.
  const rules = loadRules(REPO)
  const invariants = rules.filter((r) => r.authority === 'invariant').length
  const rest = rules.length - invariants
  const cited = rules.filter((r) => r.authority !== 'invariant' && (r.check === undefined || r.check === 'none')).length
  const readme = read('README.md')
  const m = readme.match(/Of (\d+) rules, (\w+) are invariants and (\d+) are not; (\w+) of those \d+\s*\n?\s*have an evaluator/)
  assert.ok(m, 'the README sentence that states the counts has been reworded; teach this test its new shape')
  // The sentence spells its numbers, so the test has to read English ones.
  const WORDS = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty'.split(' ')
  const words = Object.fromEntries(WORDS.map((w, i) => [w, i]))
  assert.equal(Number(m[1]), rules.length, 'total rules')
  assert.equal(words[m[2]] ?? Number(m[2]), invariants, 'invariants')
  assert.equal(Number(m[3]), rest, 'non-invariant rules')
  assert.equal(words[m[4]] ?? Number(m[4]), rest - cited, 'rules with an evaluator')
  assert.ok(readme.includes(`the other ${WORDS[cited] ?? cited} say`), 'cited count')
})

test('the tools the MCP README lists are the tools the server has', () => {
  // Two homes for one roster. The README's one-line summaries are for a person
  // and the server's descriptions are for a model, so those may differ — but a
  // seventh tool, or a renamed one, must not leave the human-facing page
  // describing a surface that is not there.
  const server = new Set([...read('mcp/server.mjs').matchAll(/name: '(strata_[a-z_]+)'/g)].map((m) => m[1]))
  const readme = new Set([...read('mcp/README.md').matchAll(/`(strata_[a-z_]+)`/g)].map((m) => m[1]))
  assert.deepEqual([...readme].sort().filter((t) => !server.has(t)), [], 'the README lists a tool the server does not serve')
  assert.deepEqual([...server].sort().filter((t) => !readme.has(t)), [], 'the server serves a tool the README never mentions')
})

test("the bench README's scorecards are what the record says, byte for byte", () => {
  // The tables used to be pasted from a terminal into prose, and the arms that
  // produced them were then deleted — numbers with no source, in the one file
  // whose whole argument is that nothing should be. They are generated from
  // `bench/RESULTS.jsonl` now, and this is the `rebuild --check` of that: the
  // same shape the record already holds every other projection to.
  const out = execFileSync('node', [path.join(REPO, 'bench/run.mjs'), 'docs', '--check'], { cwd: REPO, encoding: 'utf8' })
  assert.match(out, /matches the record/)
})

test("the bench README's measures and terms are the ones the bench runs", () => {
  // The README explains the experiment in prose and `run.mjs` performs it. The
  // wording is allowed to differ; the *set* of measures and the *count* of
  // terms are not, because a scorecard pasted into a README is a copy of a run
  // that will not be made again.
  const src = read('bench/run.mjs')
  const measures = [...src.matchAll(/^\s*\['([a-z][a-z -]+)', \(r\)/gm)].map((m) => m[1])
  assert.ok(measures.length >= 8, 'the measures moved; teach this test where')

  const doc = read('bench/README.md')
  const quoted = new Set(
    doc
      .split('\n')
      // A measure row, not the header row above it: the value column starts
      // with a number or a yes/no, where the header carries arm names.
      .map((l) => l.match(/^([a-z][a-z -]+?)\s{2,}(?=\d|yes\b|no\b)/)?.[1])
      .filter((x): x is string => !!x),
  )
  assert.deepEqual([...quoted].filter((q) => !measures.includes(q)), [], 'the README shows a measure the bench does not compute')

  const terms = (src.match(/const TERMS = \[([\s\S]*?)\]\.join/)?.[1] ?? '').match(/^\s*'\d\./gm)?.length ?? 0
  assert.ok(terms > 0, 'the terms moved; teach this test where')
  const claimed = doc.match(/The `held` terms are: ([^]*?)\n\n/)?.[1] ?? ''
  assert.equal(claimed.split(',').length, terms, `the README summarises ${claimed.split(',').length} terms; the bench states ${terms}`)
})
