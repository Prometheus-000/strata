/**
 * `strata init` — the first minute, on an empty repository and on a full one.
 *
 * This is the test the release turned on: a product Strata has just started
 * must hold every invariant, report nothing that names a file outside itself,
 * and hand back something a person can act on. The failure it exists to catch
 * is the one the first run actually had — the policy that reads a product's
 * source pointed at Strata's own generated stylesheet and reported it back as
 * forty-eight raw colours.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { resetHandlers } from '@strata/substrate/decide'
import { resetEvaluators } from '@strata/substrate/evidence'
import { resetProjections, rebuild } from '@strata/substrate/projection'
import { resetState, loadSkills, assemblePacket } from '@strata/substrate/skills'
import { runCheck, enforced } from '@strata/substrate/check'
import { loadRules, byScope } from '@strata/substrate/grammar'
import { readAll, seedsInForce } from '@strata/substrate/log'
import { loadConfig, CONFIG_PATH } from '@strata/substrate/config'
import { init, formatInit, ADOPTER_SKILLS, MALLEABLE_SKILLS } from '../src/init'
import { registerTheme } from '../src/theme/handlers'
import { runTheme } from '../src/theme/cli'
import { OBSIDIAN } from '../src/theme/generateTheme'

const REPO = path.join(path.dirname(new URL(import.meta.url).pathname), '..')

function fresh() {
  resetHandlers()
  resetProjections()
  resetEvaluators()
  resetState()
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'strata-init-')))
}

const started = (dir: string) => {
  const r = init(dir, REPO)
  registerTheme({ root: dir })
  return r
}

test('an empty repository becomes a product: the record, the frame, the system’s rules, the skills, and tokens projected from a record with nothing on it', () => {
  const dir = fresh()
  const r = started(dir)

  for (const f of ['.strata/decisions.jsonl', CONFIG_PATH, 'grammar/rules.json', 'GRAMMAR.md', 'src/tokens/primitives.css', 'src/tokens/semantic.css', 'src/tokens/tokens.json', 'src/tokens/ledger.json'])
    assert.ok(fs.existsSync(path.join(dir, f)), `${f} is not there`)
  assert.equal(fs.readFileSync(path.join(dir, '.strata/decisions.jsonl'), 'utf8'), '', 'the record starts empty; nothing has been decided')
  assert.ok(r.fresh, 'a repository with no stylesheet is a product that starts from nothing')

  // The grammar it inherits is the system's, and none of it is anyone's taste.
  const rules = loadRules(dir)
  assert.ok(rules.length > 20)
  assert.deepEqual(byScope(rules, 'product'), [], "the voice is the product's to write; init writes none of it")
  assert.deepEqual(
    byScope(rules, 'system').map((x) => x.id).sort(),
    byScope(loadRules(REPO), 'system').map((x) => x.id).sort(),
    'every system rule, and only those',
  )
  // Each rule's prose is cited where it can actually be read.
  for (const rule of rules) assert.match(rule.source, /^node_modules\/strata-design\//, `${rule.id} cites prose that is not in the package`)

  // The skills an agent performs here, with this product's own record to cite.
  assert.deepEqual(loadSkills(dir).map((s) => s.name).sort(), [...ADOPTER_SKILLS].sort())
  for (const s of loadSkills(dir)) assert.deepEqual(s.examples, [], `${s.name} cites an example from the product it shipped from`)

  // The theme in force is the engine's default until a hand moves it.
  assert.deepEqual(seedsInForce(readAll(dir), OBSIDIAN), OBSIDIAN)
  assert.deepEqual(rebuild(dir, { dryRun: true }).changed, [], 'every projection is what the record says')

  const text = formatInit(r)
  assert.match(text, /Strata is here\./)
  assert.match(text, /Nothing here has been decided yet/)
  assert.match(text, /npx strata retheme/)
  assert.match(text, /write-grammar/)
})

test('the first check on a new product holds every invariant and reports nothing about a file the product does not have', () => {
  const dir = fresh()
  started(dir)
  const r = runCheck(dir)

  assert.ok(enforced(r), 'an invariant does not hold on a product where nothing has been decided')
  assert.equal(r.decisions, 0)

  // The finding that made this test necessary: `layer0.semantic-names-only`
  // read the tokens directory — Strata's own projection, inside the source
  // directory in the ordinary layout — and reported every generated oklch()
  // back to the product as a raw colour it should declare.
  assert.deepEqual(r.findings.filter((f) => f.rule === 'layer0.semantic-names-only'), [], 'the projections are not source, and the policy that governs source must not read them')

  // Nothing names a path outside the product, and nothing names another
  // product's taste.
  for (const f of r.findings) {
    if (!f.where || !/[/\\]/.test(f.where) || f.where.includes(' ')) continue
    assert.ok(fs.existsSync(path.join(dir, f.where.split(':')[0])), `${f.rule} names ${f.where}, which this product does not have`)
  }
  assert.deepEqual(r.findings.filter((f) => f.rule.startsWith('voice.')), [], "a product that has expressed no taste is not measured against another product's")
  assert.deepEqual(r.findings.filter((f) => f.rule === 'skills.cite-what-exists'), [], 'a shipped skill cites a rule this product does not have')

  // What it does say is true and worth knowing on day one.
  assert.ok(r.findings.some((f) => f.rule === 'token.unused' && /nothing reads a token yet/.test(f.message)), 'the roles exist and nothing consumes them — said once, not once per role')
  assert.ok(r.findings.some((f) => f.rule === 'token.unreviewed' && /still a proposal/.test(f.message)))
  assert.ok(r.findings.some((f) => f.rule === 'safety.contrast'), 'the default palette is measured, and what falls short is reported rather than refused')
  assert.ok(r.cited.length > 0, 'and the rules nothing evaluates are counted rather than passed over')
})

test('init is idempotent, never overwrites, and writes nothing on a dry run', () => {
  const dir = fresh()
  started(dir)
  fs.writeFileSync(path.join(dir, 'GRAMMAR.md'), '# mine\n')
  const again = init(dir, REPO)
  assert.equal(fs.readFileSync(path.join(dir, 'GRAMMAR.md'), 'utf8'), '# mine\n', 'a file that exists is left exactly as it is')
  assert.deepEqual(again.wrote, [], 'a second init writes nothing')
  assert.ok(again.lines.every((l) => l.mark === '·'))

  const empty = fresh()
  const dry = init(empty, REPO, { dry: true })
  assert.ok(dry.wrote.length > 0, 'and says what it would write')
  assert.deepEqual(fs.readdirSync(empty), [], 'while writing none of it')
  assert.match(formatInit(dry, { dry: true }), /dry run — nothing written/)
})

test('a product that already has stylesheets is surveyed rather than assumed empty, and its literals are the ones reported', () => {
  const dir = fresh()
  fs.mkdirSync(path.join(dir, 'src/ui'), { recursive: true })
  fs.writeFileSync(
    path.join(dir, 'src/ui/app.css'),
    `.a { color: #336699; font-family: Inter, sans-serif; border-radius: 4px; }
.b { background: #fff; font-family: 'Fira Code', monospace; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
.c { color: #336699; border-radius: 12px; transition: opacity 200ms; }
`,
  )
  const r = started(dir)
  assert.ok(!r.fresh, 'a product with a stylesheet did not start from nothing')
  assert.match(r.survey, /3 raw colour/)
  assert.match(r.survey, /2 font famil/)
  assert.match(r.survey, /3 radi/)
  assert.match(r.survey, /1 shadow/)
  assert.match(r.survey, /2 × #336699/, 'the value reached for twice is the one a voice is usually made of')
  assert.match(formatInit(r), /What the stylesheets already decided is where the voice starts/)

  // And the policy speaks about the product's own file, not about Strata's.
  const found = runCheck(dir).findings.filter((f) => f.rule === 'layer0.semantic-names-only')
  assert.ok(found.length > 0 && found.every((f) => f.where?.startsWith('src/ui/app.css')))

  // The packet a hand reads before writing the voice carries all three.
  const skill = loadSkills(dir).find((s) => s.name === 'write-grammar')!
  const packet = assemblePacket(skill, {}, dir)
  assert.deepEqual(packet.missing, [])
  assert.match(String(packet.state.grammar), /27 rule\(s\) the system brings · 0 this product's own/)
  assert.match(String(packet.state.survey), /2 × #336699/)
  assert.ok(String(packet.state.tokens).includes('--surface-page'))
})

test('the first decision moves the theme, and every projection follows it in the same call', () => {
  const dir = fresh()
  started(dir)
  const out: string[] = []
  const io = { out: (s: string) => out.push(s), err: (s: string) => out.push(s) }
  assert.equal(runTheme(['retheme', '--hue', '20', '--chroma', '0.12', '--why', 'warm, and a colour for the one filled action'], { root: dir }, { STRATA_DECIDED_BY: 'human', STRATA_ACTOR: 'kenan' }, io), 0, out.join('\n'))

  const seeds = seedsInForce(readAll(dir), OBSIDIAN)
  assert.equal(seeds.hue, 20)
  assert.equal(seeds.chroma, 0.12)
  const css = fs.readFileSync(path.join(dir, loadConfig(dir).tokens + '/semantic.css'), 'utf8')
  assert.match(css, /--accent: oklch\([\d.]+ 0\.1\d+ 20\.0\)/, 'the stylesheet is the seeds, compiled')
  assert.deepEqual(rebuild(dir, { dryRun: true }).changed, [])
  assert.ok(enforced(runCheck(dir)))
})

test('--malleable adds that layer’s skills and commands, and installs nothing that overwrites what init already wrote', () => {
  const dir = fresh()
  const r = init(dir, REPO, { malleable: true })
  registerTheme({ root: dir })

  // The four this layer adds to the catalogue, plus `malleable` itself — the
  // skill that teaches the loop, which lives with the integration.
  assert.deepEqual(loadSkills(dir).map((s) => s.name).sort(), [...ADOPTER_SKILLS, ...MALLEABLE_SKILLS, 'malleable'].sort())
  assert.ok(fs.existsSync(path.join(dir, '.claude/commands/malleable-review.md')))
  assert.equal(loadConfig(dir).malleable?.source, 'src', 'the app tree is where the source is')

  // The failure this catches: the malleable layer used to copy Strata's whole
  // skill catalogue over `.claude/skills` after init had already written it —
  // verbatim, examples and all — so a new product's first check reported three
  // decision ids from the product the skills shipped from.
  for (const s of loadSkills(dir)) assert.deepEqual(s.examples, [], `${s.name} carries an example from another product's record`)
  const found = runCheck(dir).findings.filter((f) => f.rule === 'skills.cite-what-exists')
  assert.deepEqual(found, [], found.map((f) => f.message).join('; '))
  assert.ok(r.notes.some((n) => /overrides are design decisions/.test(n)))
})
