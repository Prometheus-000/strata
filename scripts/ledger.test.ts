import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generateTheme, OBSIDIAN, PRESETS } from '../src/theme/generateTheme'
import {
  applyLedger,
  emptyLedger,
  FALLBACKS,
  reconcileLedger,
  summarise,
  type Ledger,
} from '../src/theme/ledger'

const ENGINE = Object.keys(generateTheme(OBSIDIAN))
const ledger = (tokens: Ledger['tokens']): Ledger => ({ tokens })

/* ---------------- the table ---------------- */

test('every token the engine emits has a fallback, and nothing else does', () => {
  for (const name of ENGINE) assert.ok(FALLBACKS[name], `${name} has no fallback`)
  for (const name of Object.keys(FALLBACKS)) assert.ok(ENGINE.includes(name), `${name} is not an engine token`)
  // Light and dark emit the same names — the table is total for both.
  assert.deepEqual(Object.keys(generateTheme(PRESETS.Gallery)), ENGINE)
})

test('the fallback chain is acyclic and every chain ends in a literal', () => {
  for (const start of ENGINE) {
    const seen = new Set<string>()
    let at = start
    while (at.startsWith('--')) {
      assert.ok(!seen.has(at), `${start} cycles through ${at}`)
      seen.add(at)
      const fb = FALLBACKS[at]
      assert.ok(fb, `${at} has no fallback`)
      at = fb.to
    }
    assert.ok(seen.size >= 1)
  }
})

test('every fallback carries its reason', () => {
  for (const [name, fb] of Object.entries(FALLBACKS)) assert.ok(fb.why.length > 10, `${name} has no why`)
})

/* ---------------- collapsing ---------------- */

test('nothing cut, nothing changed — the ledger is invisible until someone decides', () => {
  const tokens = generateTheme(OBSIDIAN)
  const proposed = reconcileLedger(ENGINE, emptyLedger()).ledger
  assert.deepEqual(applyLedger(tokens, proposed).tokens, tokens)
  assert.deepEqual(applyLedger(tokens, proposed).receipts, [])
})

test('a cut token collapses to var(--fallback) in the stylesheet and to a value for receipts', () => {
  const tokens = generateTheme(OBSIDIAN)
  const cut = ledger({ '--accent-strong': { status: 'cut', decided: { kind: 'human' }, reason: 'one accent' } })
  const css = applyLedger(tokens, cut, { mode: 'var' })
  assert.equal(css.tokens['--accent-strong'], 'var(--accent)')
  assert.equal(css.tokens['--accent'], tokens['--accent'], 'the fallback itself is untouched')
  assert.deepEqual(css.receipts, [{ token: '--accent-strong', to: '--accent', decided: { kind: 'human' }, reason: 'one accent' }])
  const value = applyLedger(tokens, cut, { mode: 'value' })
  assert.equal(value.tokens['--accent-strong'], tokens['--accent'])
})

test('a cut token whose fallback is also cut collapses further, to the first live one', () => {
  const tokens = generateTheme(OBSIDIAN)
  const both = ledger({
    '--ink-faint': { status: 'cut' },
    '--ink-muted': { status: 'cut' },
  })
  const out = applyLedger(tokens, both)
  assert.equal(out.tokens['--ink-faint'], 'var(--ink)')
  assert.equal(out.tokens['--ink-muted'], 'var(--ink)')
  assert.equal(applyLedger(tokens, both, { mode: 'value' }).tokens['--ink-faint'], tokens['--ink'])
})

test('a literal fallback is emitted as the literal, in both modes', () => {
  const tokens = generateTheme(OBSIDIAN)
  const cut = ledger({ '--shadow-color': { status: 'cut' }, '--radius-interactive': { status: 'cut' } })
  for (const mode of ['var', 'value'] as const) {
    const out = applyLedger(tokens, cut, { mode }).tokens
    assert.equal(out['--shadow-color'], 'transparent')
    assert.equal(out['--radius-interactive'], '0')
  }
})

test('the accent gate: cutting the accent collapses everything accent-derived to ink', () => {
  const tokens = generateTheme(OBSIDIAN)
  const cut = ledger({ '--accent': { status: 'cut' }, '--accent-strong': { status: 'cut' }, '--focus-ring': { status: 'cut' } })
  const out = applyLedger(tokens, cut, { mode: 'value' }).tokens
  assert.equal(out['--accent'], tokens['--ink'])
  assert.equal(out['--accent-strong'], tokens['--ink'])
  assert.equal(out['--focus-ring'], tokens['--ink'], 'focus stays visible')
})

test('kept and proposed tokens pass through untouched', () => {
  const tokens = generateTheme(OBSIDIAN)
  const l = ledger({ '--accent': { status: 'kept', decided: { kind: 'agent' } }, '--ink': { status: 'proposed' } })
  assert.deepEqual(applyLedger(tokens, l).tokens, tokens)
})

/* ---------------- reconciling ---------------- */

test('reconcile proposes what is new and never edits a decision', () => {
  const decided = ledger({ '--accent-strong': { status: 'cut', decided: { kind: 'human' }, reason: 'one accent' } })
  const { ledger: next, added, stale } = reconcileLedger(ENGINE, decided)
  assert.deepEqual(next.tokens['--accent-strong'], { status: 'cut', decided: { kind: 'human' }, reason: 'one accent' })
  assert.equal(added.length, ENGINE.length - 1)
  assert.ok(added.every((n) => next.tokens[n].status === 'proposed'))
  assert.deepEqual(stale, [])
  assert.ok(next.$description && next.$description.length > 0)
})

test('a decision about a token the engine no longer emits is reported, not removed', () => {
  const old = ledger({ '--gone': { status: 'cut', decided: { kind: 'human' }, reason: 'was never good' } })
  const { ledger: next, stale } = reconcileLedger(ENGINE, old)
  assert.deepEqual(stale, ['--gone'])
  assert.deepEqual(next.tokens['--gone'], { status: 'cut', decided: { kind: 'human' }, reason: 'was never good' })
})

test('reconcile is idempotent', () => {
  const once = reconcileLedger(ENGINE, emptyLedger()).ledger
  const twice = reconcileLedger(ENGINE, once)
  assert.deepEqual(twice.ledger, once)
  assert.deepEqual(twice.added, [])
})

test('the summary counts every status', () => {
  const l = reconcileLedger(ENGINE, ledger({ '--accent': { status: 'kept' }, '--danger': { status: 'cut' } })).ledger
  assert.deepEqual(summarise(l), { kept: 1, cut: 1, proposed: ENGINE.length - 2 })
})
