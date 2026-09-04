/**
 * STALE PROSE — the class of drift nothing else here catches.
 *
 * The record catches a token that disagrees with its projection, because a
 * projection can be rebuilt and compared. Nothing compares a *sentence* with
 * the system it describes, and a day of reading turned up what that costs:
 * `decision.ts` opened by explaining a field removed that morning; the hub told
 * readers a validator enforced Layer 0 years after nothing did; the `retheme`
 * skill instructed agents to run `strata decide seed …`, a command that has
 * never existed, which made the one skill whose whole subject is retheming
 * unperformable from a terminal.
 *
 * Most of those were made by fixing something else. A change leaves ghosts in
 * whatever described the thing it changed, and the further the prose is from
 * the code, the longer it survives.
 *
 * WHAT THIS CAN CHECK. Prose that names something the system either has or
 * does not: a command, a script, a file, a rule id, a state provider, a
 * decision kind. Those are decidable, and three of today's ghosts were exactly
 * that shape.
 *
 * WHAT IT CANNOT. A sentence that is false but names nothing. "A validator
 * reviews every diff" contains no identifier to resolve, and no test will ever
 * catch it — that one needs a person who knows what is true reading a line
 * that says otherwise. This closes the mechanical half and says plainly that
 * the other half is still a person's job.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { loadRules } from '@strata/substrate/grammar'
import { byId, readAll } from '@strata/substrate/log'
import { registeredKinds } from '@strata/substrate/decide'
import { loadSkills, registeredState } from '@strata/substrate/skills'
import { SUBSTRATE_COMMANDS } from '@strata/substrate/cli'
import { THEME_COMMANDS } from '../src/theme/cli'
import { MALLEABLE_COMMANDS } from '../strata-malleable/src/cli'
import { registerTheme } from '../src/theme/handlers'
import { registerMalleable } from '../strata-malleable/src/decide/index'

const REPO = path.join(path.dirname(new URL(import.meta.url).pathname), '..')

/** Prose is documentation and comments alike — the ghosts lived in both. */
const PROSE_DIRS = ['.', 'skills', 'substrate/src', 'src', 'engine/src', 'strata-malleable/src', 'bin', 'mcp', 'scripts', 'bench']
const SKIP = new Set(['node_modules', 'runs', 'dist', '.git', 'fixtures'])

function proseFiles(): string[] {
  const out: string[] = []
  const walk = (dir: string, depth: number) => {
    for (const entry of fs.readdirSync(path.join(REPO, dir), { withFileTypes: true })) {
      if (SKIP.has(entry.name) || entry.name.startsWith('.') === false === false) continue
      if (SKIP.has(entry.name) || entry.name === '.git') continue
      const rel = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (depth > 0) walk(rel, depth - 1)
      } else if (/\.(md|ts|tsx|mjs)$/.test(entry.name) && !/\.test\.ts$/.test(entry.name)) out.push(rel)
    }
  }
  for (const d of PROSE_DIRS) if (fs.existsSync(path.join(REPO, d))) walk(d, 3)
  return [...new Set(out)]
}

const read = (rel: string) => fs.readFileSync(path.join(REPO, rel), 'utf8')

/** The English of a file: markdown whole, source only inside its comments. */
function prose(rel: string): string {
  const text = read(rel)
  if (rel.endsWith('.md')) return text
  return [...text.matchAll(/\/\*\*[\s\S]*?\*\/|\/\/[^\n]*/g)].map((m) => m[0]).join('\n')
}

const FILES = proseFiles()
const where = (needle: string) => FILES.filter((f) => prose(f).includes(needle)).join(', ')

test('every `npm run …` named in prose is a script that exists', () => {
  const scripts = {
    '.': new Set(Object.keys(JSON.parse(read('package.json')).scripts ?? {})),
    'strata-malleable': new Set(Object.keys(JSON.parse(read('strata-malleable/package.json')).scripts ?? {})),
    substrate: new Set(Object.keys(JSON.parse(read('substrate/package.json')).scripts ?? {})),
  }
  const known = new Set([...scripts['.'], ...scripts['strata-malleable'], ...scripts.substrate])
  const missing = new Set<string>()
  for (const f of FILES)
    for (const m of prose(f).matchAll(/npm run ([a-z][a-z0-9:-]*)/g)) if (!known.has(m[1])) missing.add(`${m[1]} (${f})`)
  assert.deepEqual([...missing], [], 'prose names an npm script nothing defines — `npm run validate` outlived its script by months')
})

test('every `strata …` verb named in prose is a command that exists', () => {
  const known = new Set<string>([...SUBSTRATE_COMMANDS, ...THEME_COMMANDS, ...MALLEABLE_COMMANDS, 'help'])
  // A command named as history rather than as instruction. The system keeps
  // what it removed on purpose — the slot layer in an incident, this one in
  // the comment on the verb built to replace it — so each exemption names the
  // file that is allowed to remember it.
  const REMEMBERED = new Set(['decide (strata-malleable/src/cli.ts)'])
  const missing = new Set<string>()
  for (const f of FILES) {
    for (const line of prose(f).split('\n')) {
      // An actual invocation: after a backtick, after a shell prompt, or
      // opening a line that carries flags — a fenced `strata cut --x …`.
      // "the malleable layer" and "code is malleable to the design" are
      // English, and a line-start match without flags is left alone.
      for (const m of line.matchAll(/(?:`|\$ |^\s*)(?:strata|malleable) ([a-z][a-z-]*)/g)) {
        const invocation = /[`$]/.test(m[0]) || line.includes('--')
        const hit = `${m[1]} (${f})`
        if (invocation && !known.has(m[1]) && !REMEMBERED.has(hit)) missing.add(hit)
      }
    }
  }
  assert.deepEqual(
    [...missing],
    [],
    'prose tells someone to run a command that does not exist — the retheme skill named `strata decide seed` for a seed change that had no CLI at all',
  )
})

test('every repo path named in prose is a file that exists', () => {
  // Only backticked strings that look like a path into this repository: a
  // slash, a known root, no spaces. Anything vaguer is not decidable and is
  // left alone rather than guessed at.
  const ROOTS = ['src/', 'substrate/', 'strata-malleable/', 'engine/', 'grammar/', 'skills/', 'bench/', 'mcp/', 'scripts/', 'bin/', '.strata/', '.claude/', '.malleable/', 'fixtures/']
  const missing = new Set<string>()
  for (const f of FILES) {
    for (const m of prose(f).matchAll(/`([^`\s]+\/[^`\s]*)`/g)) {
      const p = m[1].replace(/[.,;:]$/, '')
      if (!ROOTS.some((r) => p.startsWith(r))) continue
      if (p.includes('*') || p.includes('<') || p.endsWith('/')) continue
      // A path is resolved from the repo root, from the package roots, and
      // from the directory of the file that names it — a README beside a
      // folder says `skills/malleable`, and means the one next to it.
      const candidates = [p, path.join('strata-malleable', p), path.join('src', p), path.join(path.dirname(f), p)]
      if (!candidates.some((c) => fs.existsSync(path.join(REPO, c)))) missing.add(`${p} (${f})`)
    }
  }
  assert.deepEqual([...missing], [], 'prose names a file that is not there')
})

test('every skill cites a rule, a state provider, an example and a kind that exist', () => {
  registerTheme({ root: REPO })
  registerMalleable({ root: path.join(REPO, 'strata-malleable'), source: 'fixtures/app' })
  const rules = new Set(loadRules(REPO).map((r) => r.id))
  const state = new Set(registeredState())
  const kinds = new Set<string>(registeredKinds())
  const log = readAll(REPO)

  const broken: string[] = []
  for (const s of loadSkills(REPO)) {
    for (const r of s.context.rules ?? []) if (!rules.has(r)) broken.push(`${s.name}: rule ${r}`)
    for (const st of s.context.state ?? []) if (!state.has(st)) broken.push(`${s.name}: state ${st}`)
    for (const ex of s.examples) if (!byId(log, ex)) broken.push(`${s.name}: example ${ex}`)
    for (const td of s.typicalDecisions) if (!kinds.has(td.split('/')[0])) broken.push(`${s.name}: kind ${td}`)
  }
  assert.deepEqual(broken, [], 'a skill cites something that is not there — renaming a rule silently empties the packet that cited it')
})

test('the words for what was removed do not come back', () => {
  // Three phrases this repository retired, each of which survived in prose for
  // months after the thing it described was gone. They are allowed exactly
  // where the system remembers them on purpose: in a rule's `incident`, and in
  // the README's account of what was removed and why.
  const RETIRED: Array<[RegExp, string]> = [
    [/(?<!old )\bvalidator\b/i, 'there is no validator; evaluation replaced enforcement'],
    [/npm run validate/i, 'the script is gone'],
    [/correctness is not a taste question/i, 'a designer’s arrangement is the design; what breaks under it is code'],
  ]
  // No file is exempt, and the convention is one word: a retired thing is named
  // as "the old X" when the point is that it is gone. The lookbehind above is
  // the whole mechanism, which is narrower and more honest than trusting whole
  // files — an allowlisted file goes on being trusted long after the reason
  // for trusting it has expired, which is the failure this test exists for.
  const found: string[] = []
  for (const f of FILES) if (f !== 'scripts/prose.test.ts') for (const [re, why] of RETIRED) if (re.test(prose(f))) found.push(`${f}: ${why}`)
  assert.deepEqual(found, [], 'a retired phrase is back in the prose')
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
  const words: Record<string, number> = { four: 4, eleven: 11, seventeen: 17, six: 6, eight: 8 }
  assert.equal(Number(m[1]), rules.length, 'total rules')
  assert.equal(words[m[2]] ?? Number(m[2]), invariants, 'invariants')
  assert.equal(Number(m[3]), rest, 'non-invariant rules')
  assert.equal(words[m[4]] ?? Number(m[4]), rest - cited, 'rules with an evaluator')
  assert.ok(readme.includes(`the other ${Object.keys(words).find((k) => words[k] === cited) ?? cited} say`), 'cited count')
})
