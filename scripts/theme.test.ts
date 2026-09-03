import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { decide, resetHandlers } from '@strata/substrate/decide'
import { importAll, rebuild, resetProjections } from '@strata/substrate/projection'
import { readAll } from '@strata/substrate/log'
import { registerTheme } from '../src/theme/handlers'
import { readLedger, LEDGER_PATH, SEMANTIC_PATH, TOKENS_PATH } from '../src/theme/emit'
import { runTheme } from '../src/theme/cli'

const REPO = path.join(path.dirname(new URL(import.meta.url).pathname), '..')

/** A product root with the real ledger and empty projections. */
function world() {
  resetHandlers()
  resetProjections()
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'strata-theme-'))
  fs.mkdirSync(path.join(dir, 'src/theme'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'src/tokens'), { recursive: true })
  fs.copyFileSync(path.join(REPO, LEDGER_PATH), path.join(dir, LEDGER_PATH))
  registerTheme({ root: dir })
  let t = Date.parse('2026-09-03T12:00:00.000Z')
  const ctx = (by: 'human' | 'agent' = 'human', dryRun = false) => ({ root: dir, by, via: 'test', at: new Date((t += 1000)).toISOString(), dryRun })
  return { dir, ctx }
}

test('a cut lands in the ledger with its id, re-emits the projections with the decision beside the token, and is on the record', () => {
  const { dir, ctx } = world()
  const dry = decide({ kind: 'token', token: '--accent-strong', action: 'cut', reason: 'one filled action per surface' }, ctx('human', true))
  assert.ok(dry.ok && dry.written.length === 0 && !fs.existsSync(path.join(dir, SEMANTIC_PATH)))

  const cut = decide({ kind: 'token', token: '--accent-strong', action: 'cut', reason: 'one filled action per surface' }, ctx())
  assert.ok(cut.ok, cut.ok ? '' : cut.error)
  assert.equal(cut.decision.consequence.collapsesTo, '--accent')
  assert.deepEqual(cut.written, [LEDGER_PATH, SEMANTIC_PATH, TOKENS_PATH])
  const line = readLedger(dir).tokens['--accent-strong']
  assert.deepEqual(line, { status: 'cut', by: 'human', reason: 'one filled action per surface', id: cut.decision.id })
  assert.match(fs.readFileSync(path.join(dir, SEMANTIC_PATH), 'utf8'), /--accent-strong: var\(--accent\); \/\* cut by human: one filled action per surface \*\//)
  const contract = JSON.parse(fs.readFileSync(path.join(dir, TOKENS_PATH), 'utf8'))
  assert.equal(contract.strata.color.dark['accent-strong'].$extensions['strata.ledger'].status, 'cut')

  const again = decide({ kind: 'token', token: '--accent-strong', action: 'cut', reason: 'one filled action per surface' }, ctx('agent'))
  assert.ok(again.ok && again.unchanged)
  const keep = decide({ kind: 'token', token: '--accent-strong', action: 'keep' }, ctx('agent'))
  assert.ok(keep.ok && keep.decision.supersedes === again.decision.id)
  assert.equal(readLedger(dir).tokens['--accent-strong'].status, 'kept')

  const nope = decide({ kind: 'token', token: '--nope', action: 'cut' }, ctx())
  assert.ok(!nope.ok && /does not emit --nope/.test(nope.error) && !nope.decision)
  assert.equal(readAll(dir).length, 3)
})

test('a deviation writes its comment beside the literal and records it; an existing comment is recorded, not doubled', () => {
  const { dir, ctx } = world()
  fs.mkdirSync(path.join(dir, 'src/site'), { recursive: true })
  const css = '.hue { background: linear-gradient(#f00, oklch(0.7 0.2 30)); }\n.x { color: var(--ink); }\n'
  fs.writeFileSync(path.join(dir, 'src/site/site.css'), css)
  const bare = decide({ kind: 'deviation', file: 'src/site/site.css', line: 1 }, ctx())
  assert.ok(!bare.ok && /--why/.test(bare.error) && bare.decision, 'a deviation without a reason is refused, on the record')
  const declared = decide({ kind: 'deviation', file: 'src/site/site.css', line: 1, reason: 'the hue wheel paints itself' }, ctx())
  assert.ok(declared.ok && declared.decision.kind === 'deviation' && declared.decision.value === '#f00')
  assert.equal(fs.readFileSync(path.join(dir, 'src/site/site.css'), 'utf8'), css.replace('30)); }', '30)); } /* deviation: the hue wheel paints itself */'))
  const twice = decide({ kind: 'deviation', file: 'src/site/site.css', line: 1, reason: 'again' }, ctx())
  assert.ok(twice.ok && twice.unchanged)
  assert.equal((fs.readFileSync(path.join(dir, 'src/site/site.css'), 'utf8').match(/deviation:/g) ?? []).length, 1)
  const missing = decide({ kind: 'deviation', file: 'src/site/site.css', line: 9, reason: 'x' }, ctx())
  assert.ok(!missing.ok && /no line 9/.test(missing.error))
})

test('the token CLI is a thin layer over decide and prints who decided', () => {
  const { dir } = world()
  const out: string[] = []
  const io = { out: (s: string) => out.push(s), err: (s: string) => out.push(s) }
  assert.equal(runTheme(['cut', '--accent-strong', '--why', 'one filled action', '--by', 'agent'], { root: dir }, {}, io), 0)
  assert.match(out.join('\n'), /--accent-strong: kept → cut[\s\S]*collapses to --accent[\s\S]*by agent — --by agent on the command line/)
  assert.equal(readAll(dir).length, 1)
  assert.equal(runTheme(['list'], { root: dir }, {}, io), 0)
  assert.match(out.join('\n'), /✂ --accent-strong\s+cut\s+→ --accent · agent · one filled action/)
  assert.equal(runTheme(['cut', 'accent'], { root: dir }, {}, io), 1)
  assert.equal(runTheme(['cut', '--accent', '--by', 'robot'], { root: dir }, {}, io), 1)
})

test('the ledger imports onto the record once and rebuilds from it byte for byte, every line pointing at its decision', () => {
  const { dir } = world()
  const { imported, skipped } = importAll(dir)
  assert.equal(imported.length, 34, 'every decided token')
  assert.deepEqual(skipped, [])
  assert.ok(imported.every((d) => d.kind === 'token' && d.via === LEDGER_PATH.replace(/^/, 'import:') && d.by === 'agent'))
  assert.equal(imported.filter((d) => d.kind === 'token' && d.action === 'cut').length, 3)
  assert.deepEqual(importAll(dir).skipped, [LEDGER_PATH])

  const check = rebuild(dir, { dryRun: true })
  assert.deepEqual(check.changed, [LEDGER_PATH, SEMANTIC_PATH, TOKENS_PATH], 'the ledger gains ids; the projections did not exist yet')
  rebuild(dir)
  const ledger = readLedger(dir)
  assert.ok(Object.values(ledger.tokens).every((l) => l.id && imported.some((d) => d.id === l.id)))
  assert.deepEqual(rebuild(dir, { dryRun: true }).changed, [])
  assert.equal(fs.readFileSync(path.join(dir, SEMANTIC_PATH), 'utf8'), fs.readFileSync(path.join(REPO, SEMANTIC_PATH), 'utf8'), 'the same record projects the same stylesheet')

  decide({ kind: 'token', token: '--accent-strong', action: 'cut', reason: 'one filled action per surface' }, { root: dir, by: 'human', via: 'test' })
  assert.deepEqual(rebuild(dir, { dryRun: true }).changed, [], 'a decision through decide() leaves the projections already rebuilt')
  fs.appendFileSync(path.join(dir, SEMANTIC_PATH), '/* by hand */\n')
  assert.deepEqual(rebuild(dir, { dryRun: true }).changed, [SEMANTIC_PATH], 'a hand edit is drift from the record')
})
