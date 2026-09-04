import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { decide, resetHandlers } from '@strata/substrate/decide'
import { importAll, rebuild, resetProjections } from '@strata/substrate/projection'
import { resetEvaluators } from '@strata/substrate/evidence'
import { explain, formatExplanation, runCheck } from '@strata/substrate/check'
import { readAll } from '@strata/substrate/log'
import { registerProse } from '@strata/substrate/prose'
import { registerTheme } from '../src/theme/handlers'
import { PROSE } from './prose'
import { readLedger, LEDGER_PATH, SEMANTIC_PATH, TOKENS_PATH } from '../src/theme/emit'
import { runTheme } from '../src/theme/cli'

const REPO = path.join(path.dirname(new URL(import.meta.url).pathname), '..')

/** A product root with the real ledger and empty projections. */
function world() {
  resetHandlers()
  resetProjections()
  resetEvaluators()
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'strata-theme-'))
  fs.mkdirSync(path.join(dir, 'src/theme'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'src/tokens'), { recursive: true })
  fs.copyFileSync(path.join(REPO, LEDGER_PATH), path.join(dir, LEDGER_PATH))
  registerTheme({ root: dir })
  let t = Date.parse('2026-09-03T12:00:00.000Z')
  const ctx = (by: 'human' | 'agent' = 'human', dryRun = false) => ({ root: dir, decided: { kind: by }, written: { kind: by }, via: 'test', at: new Date((t += 1000)).toISOString(), dryRun })
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
  assert.deepEqual(line, { status: 'cut', decided: { kind: 'human' }, written: { kind: 'human' }, reason: 'one filled action per surface', id: cut.decision.id })
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
  // The hands are stated by whoever runs the import; the old ledger's `by`
  // recorded a channel, and a channel is not a judgement.
  const hands = { decided: { kind: 'human' as const, actor: 'prometheus-000' }, written: { kind: 'agent' as const, actor: 'claude-code' } }
  const { imported, skipped } = importAll(dir, hands)
  // Every decided token in the ledger this world copied — the count follows
  // the repo rather than a number written down here and left behind.
  const decidedInLedger = Object.values(readLedger(dir).tokens).filter((d) => d.status !== 'proposed').length
  assert.equal(imported.length, decidedInLedger, 'every decided token')
  assert.deepEqual(skipped, [])
  assert.ok(imported.every((d) => d.kind === 'token' && d.via === LEDGER_PATH.replace(/^/, 'import:')))
  assert.ok(imported.every((d) => d.decided.actor === 'prometheus-000' && d.written.actor === 'claude-code'))
  assert.equal(imported.filter((d) => d.kind === 'token' && d.action === 'cut').length, 3)
  assert.deepEqual(importAll(dir).skipped, [LEDGER_PATH])

  const check = rebuild(dir, { dryRun: true })
  assert.deepEqual(check.changed, [LEDGER_PATH, SEMANTIC_PATH, TOKENS_PATH], 'the ledger gains ids; the projections did not exist yet')
  rebuild(dir)
  const ledger = readLedger(dir)
  // Every *decided* line points at the decision that set it. The ten roles the
  // engine holds against a primitive arrived unreviewed, so they are proposals
  // with no decision to point at, which is what a proposal is.
  const decided = Object.values(ledger.tokens).filter((l) => l.status !== 'proposed')
  assert.equal(decided.length, decidedInLedger)
  assert.ok(decided.every((l) => l.id && imported.some((d) => d.id === l.id)))
  assert.deepEqual(rebuild(dir, { dryRun: true }).changed, [])
  assert.equal(fs.readFileSync(path.join(dir, SEMANTIC_PATH), 'utf8'), fs.readFileSync(path.join(REPO, SEMANTIC_PATH), 'utf8'), 'the same record projects the same stylesheet')

  decide({ kind: 'token', token: '--accent-strong', action: 'cut', reason: 'one filled action per surface' }, { root: dir, decided: { kind: 'human' }, written: { kind: 'human' }, via: 'test' })
  assert.deepEqual(rebuild(dir, { dryRun: true }).changed, [], 'a decision through decide() leaves the projections already rebuilt')
  fs.appendFileSync(path.join(dir, SEMANTIC_PATH), '/* by hand */\n')
  assert.deepEqual(rebuild(dir, { dryRun: true }).changed, [SEMANTIC_PATH], 'a hand edit is drift from the record')
})

test('the theme evaluators: invariants hold on this repo, a raw colour is a policy finding with the way to declare it, and a token explains itself', () => {
  const { dir, ctx } = world()
  importAll(dir, { decided: { kind: 'human', actor: 'prometheus-000' }, written: { kind: 'agent', actor: 'claude-code' } })
  rebuild(dir)
  fs.mkdirSync(path.join(dir, 'src/site'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'src/site/site.css'), '.a { color: var(--accent-strong); background: #fff; }\n.b { color: var(--ink); }\n.c {\n  /* deviation: the wheel paints itself */\n  color: oklch(0.5 0 0);\n}\n.d { border: 1px solid var(--nope); }\n')
  fs.mkdirSync(path.join(dir, 'grammar'))
  fs.copyFileSync(path.join(REPO, 'grammar/rules.json'), path.join(dir, 'grammar/rules.json'))
  const r = runCheck(dir)
  assert.deepEqual(r.invariants.map((i) => [i.rule, i.ok]), [['record.parses', true], ['projections.match-record', true], ['fallbacks.total-acyclic', true], ['css.vars-defined', false]])
  assert.match(r.invariants[3].findings[0].message, /var\(--nope\) names a custom property nothing defines/)
  const policy = r.findings.filter((f) => f.rule === 'layer0.semantic-names-only')
  assert.equal(policy.length, 1, 'the declared one is not a violation')
  assert.match(policy[0].message, /strata deviate src\/site\/site\.css:1 --why/)
  assert.ok(r.findings.some((f) => f.rule === 'deviation.declared' && /wheel/.test(f.message)))
  assert.ok(r.findings.some((f) => f.rule === 'token.unused' && f.where === '--positive'))

  const cut = decide({ kind: 'token', token: '--accent-strong', action: 'cut', reason: 'one filled action per surface' }, ctx())
  assert.ok(cut.ok)
  const e = explain(dir, 'token:--accent-strong')!
  const names = e.evidence.map((f) => f.name)
  assert.ok(names.includes('consumers') && names.includes('usage concentration') && names.includes('duplicate visual role'))
  assert.equal(e.evidence.find((f) => f.name === 'consumers')!.value, 1)
  assert.ok(e.evidence.some((f) => /contrast on dark/.test(f.name) && /:1 · (pass|fail)/.test(String(f.value))))
  assert.ok(e.context.some((f) => f.name === 'superseded' && /keep --accent-strong/.test(String(f.value))))
  const text = formatExplanation(e)
  assert.match(text, /DECISION[\s\S]*Token: --accent-strong\nAction: cut[\s\S]*CONTEXT[\s\S]*EVIDENCE[\s\S]*consumers: 1[\s\S]*CONSEQUENCE[\s\S]*fallback → --accent/)

  resetEvaluators()
  resetProjections()
  registerTheme({ root: REPO })
  // The same registration `bin/strata.mjs` performs: the cited count below is
  // a claim about the product, not about whichever evaluators a test loaded.
  registerProse(REPO, PROSE)
  const real = runCheck(REPO)
  assert.deepEqual(real.invariants.filter((i) => !i.ok && i.rule !== 'projections.match-record').map((i) => i.rule), [], 'the real repo holds every invariant this projection can speak for')

  // One engine, imported by both consumers. This is the rule that was cited
  // and unevaluated while a vendored copy sat 134 diff lines away from it.
  assert.deepEqual(real.findings.filter((f) => f.rule === 'layer0.engine-only-author'), [])
  assert.deepEqual(real.findings.filter((f) => f.rule === 'layer1.reduced-motion-both-layers'), [])
  assert.deepEqual(real.findings.filter((f) => f.rule === 'voice.two-radii'), [], 'two radius scales are live; the third is cut')
  // And the rules nothing can speak for are counted rather than passed over.
  assert.ok(real.cited.length > 0)
  // Cited means one of two things, and both are said out loud: the rule names
  // no evaluator, or it names one nothing here registered.
  assert.ok(real.cited.every((r) => r.check === 'none' || !r.check), 'every cited rule says so, rather than naming an evaluator that never ran')
  assert.ok(!real.cited.some((r) => r.id === 'layer0.engine-only-author'), 'a rule with an evaluator is not cited-only')
})

test('minting coins a name for a value usage kept reaching: the record is its source, rebuild emits it, and check sees it', () => {
  const { dir, ctx } = world()
  importAll(dir, { decided: { kind: 'human', actor: 'prometheus-000' }, written: { kind: 'agent', actor: 'claude-code' } })
  rebuild(dir)

  // A name no seed produces. The engine cannot derive it, so the record is
  // where it lives — which is the whole point of the edge.
  const mint = decide({ kind: 'token', token: '--radius-card', action: 'mint', value: { literal: '12px' }, from: ['d0mtlvzac0-ed0m'], reason: 'nine cards reached 12px independently; the value has a job and no name' }, ctx())
  assert.ok(mint.ok, mint.ok ? '' : mint.error)
  assert.equal(mint.decision.kind === 'token' && mint.decision.action, 'mint')

  const css = fs.readFileSync(path.join(dir, SEMANTIC_PATH), 'utf8')
  assert.match(css, /--radius-card: 12px;/)
  assert.equal(readLedger(dir).tokens['--radius-card'].status, 'kept', 'coining it was the review')
  assert.deepEqual(rebuild(dir, { dryRun: true }).changed, [], 'the record projects the minted role too')

  // It is a role like any other from here: it can be cut, and it collapses to
  // the value it named, so nothing on the screen moves.
  const cut = decide({ kind: 'token', token: '--radius-card', action: 'cut', reason: 'the group it was for went away' }, ctx())
  assert.ok(cut.ok)
  assert.equal(cut.decision.consequence.collapsesTo, '12px')

  // And the invariant counts it: a minted role with no fallback would be a
  // name the stylesheet could not collapse.
  fs.mkdirSync(path.join(dir, 'grammar'), { recursive: true })
  fs.copyFileSync(path.join(REPO, 'grammar/rules.json'), path.join(dir, 'grammar/rules.json'))
  const r = runCheck(dir)
  assert.deepEqual(r.invariants.filter((i) => i.rule === 'fallbacks.total-acyclic').map((i) => i.ok), [true])

  // What the engine already derives cannot be minted; that is a keep or a cut.
  const twice = decide({ kind: 'token', token: '--accent', action: 'mint', value: { literal: 'red' }, reason: 'x' }, ctx())
  assert.equal(twice.ok, false)
  assert.match(twice.ok ? '' : twice.error, /already derived from the seeds/)
})

test('contrast is swept and reported, never enforced, and every read token is measured against something', () => {
  resetEvaluators()
  registerTheme({ root: REPO })
  const r = runCheck(REPO)
  const contrast = r.findings.filter((f) => f.rule === 'safety.contrast')

  // Policy, always. A build that refused a design over a threshold would be
  // policing, and the whole point of reporting it is that it does not.
  assert.ok(contrast.every((f) => f.authority === 'policy'), 'contrast spoke with an authority that can fail a build')
  assert.ok(!r.invariants.some((i) => i.rule === 'safety.contrast'), 'contrast is not an invariant')

  // Nothing that is read is silently unmeasured. This finding exists so that
  // an empty contrast report means "measured and fine" rather than "nobody
  // looked" — which is what the report was for months.
  assert.deepEqual(contrast.filter((f) => /measured against nothing/.test(f.message)), [], 'a token is read and no pairing covers it — add it to CONTRAST_PAIRS')

  // And it is not vacuous: the pairings resolve to real numbers on this palette.
  assert.ok(contrast.length > 0, 'the sweep found nothing at all, which on this palette means it did not run')
  assert.ok(contrast.every((f) => /^\d+\.\d{2}:1 on (dark|light)/.test(f.message)))
})
