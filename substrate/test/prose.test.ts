/**
 * The scan, on a repository built to contain exactly one of each ghost. Each
 * test writes the ghost and then removes it, because a scanner that only ever
 * sees failures is not shown to be quiet when it should be.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { registerHandler, resetHandlers } from '../src/decide.ts'
import { registerEvaluator, resetEvaluators, evalContext, findings } from '../src/evidence.ts'
import { RULES_PATH } from '../src/grammar.ts'
import { brokenCitations, ghosts, proseFiles, proseOf, registerProse } from '../src/prose.ts'
import { registerState, resetState } from '../src/skills.ts'

function repo(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prose-'))
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true })
    fs.writeFileSync(path.join(root, rel), text)
  }
  return root
}

const BASE = {
  'package.json': JSON.stringify({ name: 'p', scripts: { build: 'x', test: 'y' } }),
  'src/keep.ts': '// nothing to see\nexport const x = 1\n',
}

const messages = (root: string, opts = {}) => ghosts(root, { commands: ['cut', 'keep'], ...opts }).map((g) => `${g.file}: ${g.message}`)

test('a named npm script that exists is quiet; one that does not is a ghost', () => {
  const ok = repo({ ...BASE, 'README.md': 'Run `npm run build` first.' })
  assert.deepEqual(messages(ok), [])

  const bad = repo({ ...BASE, 'README.md': 'Run `npm run validate` first.' })
  assert.deepEqual(messages(bad), ['README.md: `npm run validate` — nothing defines that script'])
})

test('a command is checked where it is invoked and left alone where it is English', () => {
  const invoked = repo({ ...BASE, 'README.md': 'Run `strata retheme` to start.' })
  assert.deepEqual(messages(invoked), ['README.md: `strata retheme` — no command by that name; the prose tells someone to run something that is not there'])

  // The distinction the scan turns on: prose that happens to contain the word.
  const english = repo({ ...BASE, 'README.md': 'The strata layer sits under it, and code is malleable to the design.' })
  assert.deepEqual(messages(english), [])

  const known = repo({ ...BASE, 'README.md': 'Run `strata cut --token x` when it stops earning its place.' })
  assert.deepEqual(messages(known), [])
})

test('a remembered command is one file remembering one verb, not a trusted file', () => {
  const files = { ...BASE, 'README.md': 'The old `strata decide` became cut.', 'docs/other.md': 'Run `strata decide` now.' }
  const found = messages(repo(files), { remembered: ['decide (README.md)'] })
  assert.deepEqual(found.length, 1, 'the exemption covered the other file too')
  assert.match(found[0], /^docs\/other\.md/)
})

test('a path is resolved from the root, from a package, and from the file that names it', () => {
  const root = repo({
    ...BASE,
    'README.md': 'See `src/keep.ts`.',
    'src/README.md': 'See `src/keep.ts` — this one resolves beside itself.',
    'docs/README.md': 'See `src/gone.ts`.',
  })
  const found = messages(root)
  assert.deepEqual(found, ['docs/README.md: `src/gone.ts` — no such file'])
})

test('a path that names nothing decidable is left alone rather than guessed at', () => {
  // No leading directory that exists, a glob, a placeholder, a bare directory.
  const root = repo({ ...BASE, 'README.md': 'Try `some/other/thing`, `src/*.ts`, `src/<name>.ts` and `src/`.' })
  assert.deepEqual(messages(root), [])
})

test('a retired phrase is caught, and the "old X" convention is how prose remembers it', () => {
  const retired = [{ pattern: /(?<!old )\bwidget\b/i, why: 'widgets were removed' }]
  const back = repo({ ...BASE, 'README.md': 'The widget renders first.' })
  assert.deepEqual(messages(back, { retired }), ['README.md: a retired phrase is back — widgets were removed'])

  const remembered = repo({ ...BASE, 'README.md': 'The old widget rendered first, and was removed.' })
  assert.deepEqual(messages(remembered, { retired }), [])
})

test('source is read only inside its comments, and markdown whole', () => {
  const root = repo({
    ...BASE,
    // The string is code, not prose: a fixture, an argv, a message.
    'src/code.ts': 'export const cmd = "npm run validate"\n',
    'src/commented.ts': '// Run `npm run validate` first.\nexport const y = 2\n',
  })
  assert.deepEqual(messages(root), ['src/commented.ts: `npm run validate` — nothing defines that script'])
  assert.equal(proseOf(root, 'src/code.ts').trim(), '')
})

test('test files and dot-directories are not prose', () => {
  const root = repo({
    ...BASE,
    'src/a.test.ts': '// `npm run validate` stays named here, as the thing asserted gone\n',
    '.hidden/b.md': 'Run `npm run validate`.',
    'skipped/c.md': 'Run `npm run validate`.',
  })
  assert.deepEqual(messages(root, { skip: ['skipped'] }), [])
  assert.deepEqual(proseFiles(root, { skip: ['skipped'] }), ['README.md', 'src/keep.ts'].filter((f) => fs.existsSync(path.join(root, f))))
})

test('a skill citing a rule, a state provider, an example or a kind that is gone', () => {
  resetState()
  resetHandlers()
  registerState('tokens', () => ({}))
  registerHandler('token', (() => ({ body: {}, consequence: {} })) as never)
  const root = repo({
    ...BASE,
    [RULES_PATH]: JSON.stringify({ rules: [{ id: 'a.real-rule', authority: 'policy', statement: 's', reason: 'r', source: 'x', check: 'none' }] }),
    'skills/broken/SKILL.md': `---
name: broken
purpose: cite four things, three of which are gone
inputs: []
context:
  state: [tokens, gone]
  rules: [a.real-rule, a.renamed-rule]
constraints: []
evidenceRequired: []
typicalDecisions: [token/cut, sculpture/carve]
examples: [d-never-written]
reasons: |
  none
---
Do the thing.
`,
  })
  const found = brokenCitations(root).map((g) => g.message)
  assert.deepEqual(found, [
    'broken cites rule `a.renamed-rule`, which the grammar does not have',
    'broken cites state `gone`, which no projection provides',
    'broken cites example `d-never-written`, which is not on the record',
    'broken names decision `sculpture/carve`, whose kind nothing registers',
  ])
})

test('registered, it reports under policy — it never speaks as an invariant', () => {
  resetEvaluators()
  const root = repo({
    ...BASE,
    [RULES_PATH]: JSON.stringify({ rules: [] }),
    'README.md': 'Run `npm run validate`.',
  })
  registerProse(root, { commands: ['cut'] })
  const found = findings(evalContext(root, []))
  assert.equal(found.length, 1)
  assert.equal(found[0].authority, 'policy', 'prose is not the artifact; it must never fail a build')
  assert.equal(found[0].rule, 'prose.names-what-exists')
  assert.equal(found[0].where, 'README.md')
  resetEvaluators()
})
