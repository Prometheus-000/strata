/**
 * THE VOICE STORE — a person's voices, kept once.
 *
 * The failure this exists to prevent is the one this designer wrote about
 * thirty-four white alphas: a decision typed twice is a decision that will
 * diverge. A voice copied into each product is the same fault with rules
 * instead of colours, and worse, because a voice is the thing that is supposed
 * not to drift between projects.
 *
 * Every test here uses a temporary home, so none of them reads or writes the
 * store on the machine they run on.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { loadRules, byScope } from '@strata/substrate/grammar'
import { resetHandlers } from '@strata/substrate/decide'
import { resetEvaluators } from '@strata/substrate/evidence'
import { resetProjections } from '@strata/substrate/projection'
import { resetState } from '@strata/substrate/skills'
import { init, readVoice } from '../src/init'
import { isVoiceName, resolveVoice, runVoice, saveVoice, voices, voicesDir } from '../src/voices'

const REPO = path.join(path.dirname(new URL(import.meta.url).pathname), '..')
const tmp = (what: string) => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `strata-${what}-`)))

/** A product with a personal voice on it, and some taste of its own that is not one. */
function aProduct(): string {
  const at = tmp('product')
  fs.mkdirSync(path.join(at, 'grammar'), { recursive: true })
  fs.writeFileSync(
    path.join(at, 'grammar/rules.json'),
    JSON.stringify({
      rules: [
        { id: 'voice.surgical-accent', authority: 'policy', scope: 'personal', statement: 'The accent is surgical.', reason: 'When everything flashes red, it becomes a marketing banner.', source: 'GRAMMAR.md › The voice › The accent is surgical', check: 'none' },
        { id: 'voice.no-slogans', authority: 'policy', scope: 'personal', statement: 'A headline states a fact or it does not exist.', reason: 'A designer making a Statement About Design is the genus.', source: 'GRAMMAR.md › The voice › No slogans', check: 'none' },
        { id: 'house.two-radii', authority: 'policy', scope: 'product', statement: "This product's own taste.", reason: 'Kept to prove it is not saved as a voice.', source: 'GRAMMAR.md › x', check: 'none' },
      ],
    }),
  )
  fs.writeFileSync(path.join(at, 'GRAMMAR.md'), '# Voice\n\n## The voice\n\n### The accent is surgical\n\nColour is information.\n\n### No slogans\n\nA headline states a fact.\n')
  return at
}

const say = () => {
  const lines: string[] = []
  return { io: { out: (s: string) => lines.push(s), err: (s: string) => lines.push(s) }, text: () => lines.join('\n') }
}

test('a name is a name, and cannot walk out of the store', () => {
  assert.ok(isVoiceName('kenan'))
  assert.ok(isVoiceName('house-2026'))
  assert.ok(!isVoiceName('../elsewhere'), 'a name with a separator is a path, not a name')
  assert.ok(!isVoiceName('a/b'))
  assert.ok(!isVoiceName('..'))
  assert.ok(!isVoiceName(''))
})

test('a voice is saved under a name, and only the rules that belong to a person', () => {
  const home = tmp('home')
  const saved = saveVoice(aProduct(), 'kenan', home)
  assert.equal(saved.rules, 2)
  assert.ok(saved.grammar, 'the prose the rules cite is saved beside them')
  assert.equal(saved.dir, path.join(voicesDir(home), 'kenan'))

  const rules = (JSON.parse(fs.readFileSync(path.join(saved.dir, 'grammar/rules.json'), 'utf8')) as { rules: Array<{ id: string; scope: string }> }).rules
  assert.deepEqual(rules.map((r) => r.id), ['voice.surgical-accent', 'voice.no-slogans'])
  assert.ok(rules.every((r) => r.scope === 'personal'), "the product's own taste is not a voice and is not saved as one")
})

test('a product with no personal rules has no voice to save, and is told so', () => {
  const home = tmp('home')
  assert.throws(() => saveVoice(REPO, 'strata', home), /no personal rules/, 'this repository has taste, and none of it is a person\'s')
})

test('a name reaches the store; a path still works; a name that is not there says where it looked', () => {
  const home = tmp('home')
  const from = aProduct()
  saveVoice(from, 'kenan', home)
  assert.equal(resolveVoice('kenan', home), path.join(voicesDir(home), 'kenan'), 'a bare name is looked for in the store')
  assert.equal(resolveVoice(from, home), from, 'a path is left as it is')
  assert.equal(resolveVoice('https://github.com/someone/voice', home), 'https://github.com/someone/voice', 'a URL is left for the caller to clone')
  assert.throws(() => resolveVoice('nobody', home), /no voice called "nobody"/)
  assert.throws(() => resolveVoice('nobody', home), /voice lists what is there/, 'and says how to find out what is')
})

test('a voice saved in the store is carried into a product by its name', () => {
  resetHandlers()
  resetProjections()
  resetEvaluators()
  resetState()
  const home = tmp('home')
  saveVoice(aProduct(), 'kenan', home)

  // The round trip: what `--voice kenan` reads is what was put there.
  const v = readVoice('kenan', home)
  assert.deepEqual(v.rules.map((r) => r.id), ['voice.surgical-accent', 'voice.no-slogans'])

  const dir = tmp('adopt')
  init(dir, REPO, { voice: 'kenan', voiceHome: home })
  const rules = loadRules(dir)
  assert.equal(byScope(rules, 'personal').length, 2, 'both rules arrived')
  for (const r of byScope(rules, 'personal')) assert.ok(fs.existsSync(path.join(dir, r.source.split('›')[0].trim())), `${r.id} cites prose that travelled with it`)
})

test('the store lists what is in it, and says so when it is empty', () => {
  const home = tmp('home')
  const empty = say()
  assert.equal(runVoice(['voice'], process.cwd(), empty.io, home), 0)
  assert.match(empty.text(), /no voices yet/)

  saveVoice(aProduct(), 'kenan', home)
  fs.mkdirSync(path.join(voicesDir(home), 'not-a-voice'), { recursive: true })
  const listed = say()
  runVoice(['voice', 'list'], process.cwd(), listed.io, home)
  assert.match(listed.text(), /kenan\s+2 rule\(s\)/)
  assert.match(listed.text(), /not-a-voice\s+0 rule\(s\)/, 'a directory that is not a voice is listed with nothing in it')
  assert.deepEqual(voices(home).map((v) => v.name), ['kenan', 'not-a-voice'])
})

test('a verb the store does not have is refused by name', () => {
  const home = tmp('home')
  const out = say()
  assert.equal(runVoice(['voice', 'wander'], process.cwd(), out.io, home), 1)
  assert.match(out.text(), /no such verb "wander"/)

  const nameless = say()
  assert.equal(runVoice(['voice', 'save'], process.cwd(), nameless.io, home), 1)
  assert.match(nameless.text(), /voice save <name>/, 'and says what it needed')
})

test('a voice keeps its prose in DESIGN.md, and a product gets both documents', () => {
  // Two voices, two documents. A carried voice used to land in GRAMMAR.md,
  // which is the product's own — so a product that adopted someone's taste had
  // nowhere left to write its own, and the two owners were one file.
  resetHandlers()
  resetProjections()
  resetEvaluators()
  resetState()
  const home = tmp('home')
  const from = aProduct()
  saveVoice(from, 'kenan', home)
  assert.ok(fs.existsSync(path.join(voicesDir(home), 'kenan', 'DESIGN.md')), 'the store keeps it as DESIGN.md')

  const dir = tmp('adopt')
  init(dir, REPO, { voice: 'kenan', voiceHome: home })
  const design = fs.readFileSync(path.join(dir, 'DESIGN.md'), 'utf8')
  const grammar = fs.readFileSync(path.join(dir, 'GRAMMAR.md'), 'utf8')
  assert.match(design, /The accent is surgical/, "the person's document is the voice")
  assert.doesNotMatch(grammar, /The accent is surgical/, "and the product's own is still a blank page for its own rules")
  assert.notEqual(design, grammar)
})

test('a voice whose prose is still GRAMMAR.md is read, and stored as DESIGN.md', () => {
  // A voice saved before the rename, or read straight out of a product that
  // keeps its rules and prose together.
  const home = tmp('home')
  const from = aProduct() // writes GRAMMAR.md
  assert.ok(fs.existsSync(path.join(from, 'GRAMMAR.md')))
  const saved = saveVoice(from, 'older', home)
  assert.ok(saved.grammar, 'the prose came across')
  assert.ok(fs.existsSync(path.join(saved.dir, 'DESIGN.md')), 'under the name it has now')
  assert.deepEqual(readVoice('older', home).rules.map((r) => r.id), ['voice.surgical-accent', 'voice.no-slogans'])
})
