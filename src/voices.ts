/**
 * THE VOICE STORE — a person's voices, kept once, outside every repository.
 *
 * A voice belongs to a designer rather than to anything they built, so keeping
 * a copy inside each product would put the same nine rules in three places and
 * sharpen one of them: "a value is a decision, and a decision typed twice is a
 * decision that will diverge." That failure is the reason this exists. The
 * store holds one copy, `--voice <name>` reaches it from any project, and what
 * lands in a product is the adoption rather than a second original.
 *
 * Plural, because a person holds more than their own: a client's voice and a
 * team's house style are voices too, belonging to other people, and a name is
 * how they are told apart.
 *
 * `~/.strata/voices/<name>/` — a DESIGN.md and a grammar/rules.json, which is
 * exactly what `--voice` reads from a path. A voice in the store and a voice in
 * a directory are the same thing; the store only says where to look.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { RULES_PATH, type Rule } from '@strata/substrate/grammar'

/**
 * A person's design document, and the name is the point.
 *
 * `GRAMMAR.md` is a product's own rules. A designer's voice is a different
 * document with a different owner, and a product that carries one needs both:
 * a place for what it decided, and the taste it works under.
 */
export const VOICE_PROSE = 'DESIGN.md'

export const VOICE_COMMANDS = ['voice'] as const

/** Where a person's voices live. Outside every repository, so cloning one changes nothing. */
export const voicesDir = (home = os.homedir()) => path.join(home, '.strata', 'voices')

/** A name is a name and not a path: no separators, no walking out of the store. */
export const isVoiceName = (s: string) => /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(s) && s !== '.' && s !== '..'

export interface StoredVoice {
  name: string
  dir: string
  rules: number
  grammar: boolean
}

/** Every voice in the store, in the order a person would read them. */
export function voices(home = os.homedir()): StoredVoice[] {
  const root = voicesDir(home)
  if (!fs.existsSync(root)) return []
  const out: StoredVoice[] = []
  for (const name of fs.readdirSync(root).sort()) {
    const dir = path.join(root, name)
    try {
      if (!fs.statSync(dir).isDirectory()) continue
    } catch {
      continue
    }
    let rules = 0
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(dir, RULES_PATH), 'utf8')) as { rules?: Rule[] }
      rules = (parsed.rules ?? []).filter((r) => r.scope === 'personal').length
    } catch {
      // A directory in the store that is not a voice is listed with nothing in it.
    }
    out.push({ name, dir, rules, grammar: fs.existsSync(path.join(dir, VOICE_PROSE)) })
  }
  return out
}

/**
 * What `--voice` was given: a name in the store, or a path, or a URL.
 *
 * A bare name is looked for in the store first, because that is what a name is
 * for. It falls through to a path so `--voice ../their-project` keeps working,
 * and a remote is left alone for the caller to clone.
 */
export function resolveVoice(given: string, home = os.homedir()): string {
  if (/^(https?:\/\/|git@|ssh:\/\/|git:\/\/)/.test(given)) return given
  if (isVoiceName(given)) {
    const stored = path.join(voicesDir(home), given)
    if (fs.existsSync(path.join(stored, RULES_PATH))) return stored
    // A bare name that is also a directory here is a path someone meant.
    if (!fs.existsSync(given)) throw new Error(`no voice called "${given}" in ${voicesDir(home)}, and no directory of that name here — npx strata voice lists what is there`)
  }
  return given
}

/**
 * Save a voice into the store, under a name.
 *
 * Only the `personal` rules and the prose they cite. A product's own taste is
 * not a voice, and copying it here would let the last thing built decide what
 * the next one inherits.
 */
export function saveVoice(from: string, name: string, home = os.homedir()): StoredVoice {
  if (!isVoiceName(name)) throw new Error(`"${name}" is not a name — letters, digits, dot, dash and underscore, starting with a letter or a digit`)
  const parsed = JSON.parse(fs.readFileSync(path.join(from, RULES_PATH), 'utf8')) as { rules?: Rule[] }
  const rules = (parsed.rules ?? []).filter((r) => r.scope === 'personal')
  if (!rules.length) throw new Error(`${from} has no personal rules — a voice is what a person marked as their own, and this has none`)
  const dir = path.join(voicesDir(home), name)
  fs.mkdirSync(path.join(dir, path.dirname(RULES_PATH)), { recursive: true })
  fs.writeFileSync(
    path.join(dir, RULES_PATH),
    JSON.stringify({ $description: `The voice "${name}", saved from ${from}. Its rules belong to a person; a product works under them and does not come to own them.`, rules }, null, 2) + '\n',
  )
  // Saved from a product, the prose is whichever file the rules cite.
  const prose = [VOICE_PROSE, 'GRAMMAR.md'].map((f) => path.join(from, f)).find((f) => fs.existsSync(f))
  if (prose) fs.copyFileSync(prose, path.join(dir, VOICE_PROSE))
  return { name, dir, rules: rules.length, grammar: fs.existsSync(path.join(dir, VOICE_PROSE)) }
}

export interface VoiceIo {
  out: (s: string) => void
  err: (s: string) => void
}

/** `strata voice` — what is in the store, and putting one there. */
export function runVoice(argv: string[], here: string, io: VoiceIo = { out: console.log, err: console.error }, home = os.homedir()): number {
  const [, verb, name] = argv
  if (verb === 'save') {
    if (!name) {
      io.err('\n  npx strata voice save <name> — what to call it in the store\n')
      return 1
    }
    const saved = saveVoice(here, name, home)
    io.out(`\n  saved "${saved.name}" — ${saved.rules} rule(s)${saved.grammar ? ' and the prose they cite' : `, with no ${VOICE_PROSE} beside them`}`)
    io.out(`  ${saved.dir}`)
    io.out(`\n  npx strata init --voice ${saved.name}   in any project, from here on\n`)
    return 0
  }
  if (verb && verb !== 'list') {
    io.err(`\n  no such verb "${verb}" — npx strata voice [list] or npx strata voice save <name>\n`)
    return 1
  }
  const found = voices(home)
  io.out('')
  if (!found.length) {
    io.out(`  no voices yet in ${voicesDir(home)}`)
    io.out('  npx strata voice save <name> puts this product\'s personal rules there\n')
    return 0
  }
  const width = Math.max(...found.map((v) => v.name.length), 8)
  for (const v of found) io.out(`  ${v.name.padEnd(width)}  ${v.rules} rule(s)${v.grammar ? '' : `  (no ${VOICE_PROSE})`}`)
  io.out(`\n  ${voicesDir(home)}`)
  io.out('  npx strata init --voice <name>   carries one into a product\n')
  return 0
}
