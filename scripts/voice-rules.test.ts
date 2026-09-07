/**
 * A VOICE, AS CHECKS RATHER THAN LESSONS.
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

/* ---------------- the other three that a machine can hold ---------------- */

const rule = (id: string) => ({
  rules: [{ id, authority: 'policy', scope: 'personal', statement: `${id} says so.`, reason: 'Earned.', source: 'GRAMMAR.md › x', check: id }],
})

function under(id: string, file: string, body: string): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'strata-voice-eval-')))
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'grammar'), { recursive: true })
  fs.mkdirSync(path.join(dir, '.strata'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'grammar/rules.json'), JSON.stringify(rule(id)))
  fs.writeFileSync(path.join(dir, '.strata/config.json'), JSON.stringify({ source: ['src'], tokens: null }))
  fs.writeFileSync(path.join(dir, 'src', file), body)
  return dir
}

const of = (id: string, dir: string) => {
  resetEvaluators()
  registerGrammarEvaluators({ root: dir })
  return findings(evalContext(dir, [])).filter((f) => f.rule === id)
}

test('tracking and weight are numbers, so they are held', () => {
  const id = 'voice.mono-and-weight'
  assert.equal(of(id, under(id, 'a.css', '.x { letter-spacing: -0.04em; }\n')).length, 1)
  assert.equal(of(id, under(id, 'a.css', '.x { font-weight: 800; }\n')).length, 1)
  assert.equal(of(id, under(id, 'a.css', '.x { font-weight: bolder; }\n')).length, 1)
  // The rule's own numbers are the rule being kept.
  assert.deepEqual(of(id, under(id, 'a.css', '.x { letter-spacing: -0.01em; font-weight: 700; }\n')), [])
  assert.deepEqual(of(id, under(id, 'a.css', '.x { letter-spacing: 0.08em; font-weight: 500; }\n')), [])
})

test('a drawer is reported, and can say why it is an index rather than a drawer', () => {
  const id = 'voice.plain-view'
  assert.equal(of(id, under(id, 'a.tsx', 'const A = () => <details><summary>x</summary></details>\n')).length, 1)
  assert.equal(of(id, under(id, 'a.tsx', 'const A = () => <video autoPlay />\n')).length, 1)
  const declared = of(id, under(id, 'a.tsx', '/* deviation: the summary is the index and the body is the drill-down */\nconst A = () => <details><summary>x</summary></details>\n'))
  assert.equal(declared.length, 1, 'declared is reported, not exempt')
  assert.match(declared[0].message, /Declared: the summary is the index/)
})

test('copy is measured by length, and code is not copy', () => {
  const id = 'voice.hemingway-economy'
  const long = 'Here it is a trial and what you set paints the live field and the frame around it and the whole page recompiles on every drag of every one of the seven.'
  assert.equal(of(id, under(id, 'a.tsx', `const A = () => <p>${long}</p>\n`)).length, 1)
  assert.deepEqual(of(id, under(id, 'a.tsx', 'const A = () => <p>An audio landscape shaped by emotion.</p>\n')), [], 'the anchor line is the rule being kept')

  // Commas are not the signal: both pieces of copy in the real product with
  // three of them are lists, which is what commas are for. And a first pass
  // read a destructuring as a sentence with two commas in it.
  const list = 'Hue, chroma, lightness, warmth, energy and density recompute the theme.'
  assert.deepEqual(of(id, under(id, 'a.tsx', `const A = () => <p>${list}</p>\n`)), [], 'a list is not a multi-beat sentence')
  assert.deepEqual(of(id, under(id, 'a.tsx', 'const [temperature, setTemperature] = useState(0.4)\n')), [], 'and code is not copy')
})
