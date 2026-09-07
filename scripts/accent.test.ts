/**
 * THE ACCENT IS SURGICAL — as an evaluator rather than a lesson.
 *
 * The rule its owner has restated more often than any other: the accent paints
 * a state, never text. "When everything flashes red, it becomes a marketing
 * banner." Cited into a packet it has to be read and applied; here it is
 * checked, which is the difference between a taste that is remembered and one
 * that catches you.
 *
 * The fault it looks for is invisible while a theme is monochrome — a
 * monochrome accent compiles to ink and reads like every other word — and
 * appears the moment chroma goes above zero.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { evalContext, findings, resetEvaluators } from '@strata/substrate/evidence'
import { registerGrammarEvaluators } from '../src/theme/grammar'

const RULE = {
  rules: [
    { id: 'voice.surgical-accent', authority: 'policy', scope: 'personal', statement: 'The accent paints a state, never text.', reason: 'When everything flashes red, it becomes a marketing banner.', source: 'GRAMMAR.md › The voice › The accent is surgical', check: 'voice.surgical-accent' },
  ],
}

function product(css: string): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'strata-accent-')))
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'grammar'), { recursive: true })
  fs.mkdirSync(path.join(dir, '.strata'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'grammar/rules.json'), JSON.stringify(RULE))
  fs.writeFileSync(path.join(dir, '.strata/config.json'), JSON.stringify({ source: ['src'], tokens: null }))
  fs.writeFileSync(path.join(dir, 'src/app.css'), css)
  return dir
}

const said = (dir: string) => {
  resetEvaluators()
  registerGrammarEvaluators({ root: dir })
  return findings(evalContext(dir, [])).filter((f) => f.rule === 'voice.surgical-accent')
}

test('the accent as ink on prose is the finding', () => {
  const out = said(product('.readings em { color: var(--accent); }\n'))
  assert.equal(out.length, 1)
  assert.match(out[0].message, /the accent is ink here, on \.readings em/)
  assert.match(out[0].message, /Monochrome hides this/, 'and says why it is invisible today')
})

test('the accent on a state is the rule being kept, not broken', () => {
  // What the rule allows in its own words: an active dot, a slider thumb, a
  // hovered row. An evaluator that flagged these would cry wolf on the eight
  // correct uses in one stylesheet and be switched off.
  const css = [
    '.mood--active { color: var(--accent); }',
    '.preset--selected { color: var(--accent-strong); }',
    '.row:hover .rule { color: var(--accent); }',
    '.tab[aria-current] { color: var(--accent); }',
    '.box:focus { color: var(--accent); }',
    '.step[data-state="on"] { color: var(--accent); }',
  ].join('\n')
  assert.deepEqual(said(product(css)), [])
})

test('the accent as a mark rather than a word is not ink', () => {
  // A fill, a border, a wash — the accent being a thing rather than a sentence.
  // And `--accent-ink` is the label *on* a fill, which is the rule working.
  const css = [
    '.btn { background: var(--accent); color: var(--accent-ink); }',
    '.card { border-color: var(--accent-line); }',
    '.sel { background: var(--accent-soft); }',
    '.dot { fill: var(--accent); }',
  ].join('\n')
  assert.deepEqual(said(product(css)), [])
})

test('a declaration is a reason, and the finding carries it', () => {
  const out = said(product('.wheel { color: var(--accent); /* deviation: the picker paints the wheel it selects from */ }\n'))
  assert.equal(out.length, 1, 'declared is reported, not exempt')
  assert.match(out[0].message, /Declared: the picker paints the wheel it selects from/)
})

test('a light-mode override of a state is still a state', () => {
  // Every accent rule here is written twice, once per ground. The selector a
  // reader sees is the compound one, and the state is at its end.
  assert.deepEqual(said(product("[data-theme='light'] .mood--active { color: var(--accent-strong); }\n")), [])
  assert.equal(said(product("[data-theme='light'] .readings em { color: var(--accent); }\n")).length, 1)
})
