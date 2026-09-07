/**
 * `strata init` — the door.
 *
 * One verb for two cases, and it does not ask which: a repository with a
 * product in it, and an empty one. Both get the same things — the record,
 * the frame file, the system's rules, a place for the voice, the skills an
 * agent performs here, and the tokens projected from a record that has
 * nothing on it yet — and the difference is what the survey finds in the
 * stylesheets afterwards, which is where the message at the end diverges.
 *
 * Everything it writes is additive and shown. Nothing that exists is
 * overwritten, ever: a second `init` writes nothing and says so. And it
 * decides nothing — the first decision is the person's, and the message says
 * what it usually is.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { stdin, stdout } from 'node:process'
import { createInterface } from 'node:readline/promises'
import { CONFIG_PATH, DEFAULT_CONFIG, loadConfig, writeConfig, type ProductConfig } from '@strata/substrate/config'
import { RULES_PATH, type Layer, type Rule } from '@strata/substrate/grammar'
import { COLUMNS, fold, hang } from '@strata/substrate/format'
import { LOG_PATH } from '@strata/substrate/log'
import { registerTheme } from './theme/handlers'
import { initTheme } from './theme/init'
import { formatSurvey, survey } from './theme/survey'
import { resolveVoice } from './voices'
import { init as initMalleable } from '../strata-malleable/src/init'

export const INIT_COMMANDS = ['init'] as const

/** The skills every product can perform: the ones whose state and kinds the theme projection provides. */
export const ADOPTER_SKILLS = ['cut-token', 'retheme', 'write-grammar'] as const
/** The skills the malleable layer adds, when a product mounts it. */
export const MALLEABLE_SKILLS = ['move-region', 'pick-prop', 'promote', 'review-handoff'] as const

export const TEMPLATE_GRAMMAR = 'templates/GRAMMAR.md'

export interface InitOptions {
  source?: string[]
  /** Where to take a voice from: a name in the store, a path, or a git URL. */
  voice?: string
  /** The home the voice store sits under. Given only by tests, so they never read the machine they run on. */
  voiceHome?: string
  /**
   * Take the voice in as this product's house rules rather than as a person's.
   *
   * Two real cases, and the tool should not pick. A designer starting their own
   * next project keeps the rules `personal`, and a voice carried on from here
   * carries them further. A team adopting someone's voice as the house style
   * makes them `product`: the product works under them after that person has
   * gone, and they stop travelling.
   */
  house?: boolean
  /** null: the product keeps its own tokens. */
  tokens?: string | null
  skills?: boolean
  malleable?: boolean
  mcp?: boolean
  dry?: boolean
}

export interface InitLine {
  mark: '+' | '·'
  file: string
  note: string
}

export interface InitReport {
  lines: InitLine[]
  wrote: string[]
  skipped: string[]
  notes: string[]
  config: ProductConfig
  skills: string[]
  survey: string
  /** The voice carried in, when one was. */
  voice?: Voice
  /** Whether that voice was taken in as this product's own rather than a person's. */
  house?: boolean
  /** No stylesheet, no component: a product that starts from nothing. */
  fresh: boolean
}

const packageName = (pkg: string): string => {
  try {
    return (JSON.parse(fs.readFileSync(path.join(pkg, 'package.json'), 'utf8')) as { name?: string }).name ?? 'strata-design'
  } catch {
    return 'strata-design'
  }
}

/**
 * Where a system rule's prose lives, seen from the product: inside the
 * installed package, so a citation resolves and a reader lands on the
 * canonical text rather than on a second copy of it. The substrate is
 * bundled beneath the package, so its files sit one `node_modules` deeper.
 */
export function sourceInPackage(source: string, name: string): string {
  const [file, ...rest] = source.split('›').map((s) => s.trim())
  const mapped = file.startsWith('substrate/') ? `node_modules/${name}/node_modules/@strata/${file}` : `node_modules/${name}/${file}`
  return [mapped, ...rest].join(' › ')
}

/** A voice carried in: a person's own rules, and the prose they cite. */
export interface Voice {
  /** The source, as it was given. */
  from: string
  rules: Rule[]
  grammar: string | null
  /** The seeds that product has in force, if its record holds any. */
  seeds: Record<string, number | string> | null
}

const isRemote = (s: string) => /^(https?:\/\/|git@|ssh:\/\/|git:\/\/)/.test(s)

/**
 * Read a voice.
 *
 * A voice is frame, not decisions: the rules marked `personal` and the
 * GRAMMAR.md they cite. Every voice rule's source points at a section of that
 * file, so the two travel together or neither resolves.
 *
 * `product` rules are deliberately not taken. They are the taste of the thing
 * that was built, not of the person who built it, and carrying them would hand
 * a designer's next project whatever the last one happened to prefer.
 *
 * The seeds are read but not applied. A seed change is a decision, and `init`
 * makes none — they are reported with the one command that adopts them.
 */
export function readVoice(source: string, home?: string): Voice {
  // A name reaches the store; a path and a URL are left as they are.
  const given = resolveVoice(source, home)
  let dir = given
  let clone: string | null = null
  try {
    if (isRemote(given)) {
      clone = fs.mkdtempSync(path.join(os.tmpdir(), 'strata-voice-'))
      execFileSync('git', ['clone', '--depth', '1', '--quiet', given, clone], { stdio: ['ignore', 'ignore', 'pipe'] })
      dir = clone
    }
    const rulesAt = path.join(dir, RULES_PATH)
    if (!fs.existsSync(rulesAt)) throw new Error(`no ${RULES_PATH} in ${source} — a voice comes from a product that has one`)
    const theirs = JSON.parse(fs.readFileSync(rulesAt, 'utf8')) as { rules: Rule[] }
    const rules = (theirs.rules ?? []).filter((r) => r.scope === 'personal')
    const grammarAt = path.join(dir, 'GRAMMAR.md')
    const grammar = fs.existsSync(grammarAt) ? fs.readFileSync(grammarAt, 'utf8') : null

    // The last seed decision on their record is the theme they have in force.
    let seeds: Voice['seeds'] = null
    const logAt = path.join(dir, LOG_PATH)
    if (fs.existsSync(logAt))
      for (const line of fs.readFileSync(logAt, 'utf8').split('\n')) {
        if (!line.trim()) continue
        try {
          const d = JSON.parse(line) as { kind?: string; seeds?: Voice['seeds'] }
          if (d.kind === 'seed' && d.seeds) seeds = d.seeds
        } catch {
          // A line this product cannot parse is its own problem, not the voice's.
        }
      }
    return { from: source, rules, grammar, seeds }
  } finally {
    if (clone) fs.rmSync(clone, { recursive: true, force: true })
  }
}

/** The command that adopts a set of seeds, printed rather than run. */
const rethemeFrom = (seeds: NonNullable<Voice['seeds']>): string =>
  'npx strata retheme ' +
  Object.entries(seeds)
    .map(([k, v]) => `--${k} ${v}`)
    .join(' ')

export function init(root: string, pkg: string, opts: InitOptions = {}): InitReport {
  if (root.split(path.sep).includes('node_modules')) throw new Error('refusing to start a product inside node_modules — run this in the product’s own directory')
  const name = packageName(pkg)
  const lines: InitLine[] = []
  const notes: string[] = []
  const wrote: string[] = []
  const skipped: string[] = []
  const line = (mark: InitLine['mark'], file: string, note: string) => {
    lines.push({ mark, file, note })
    ;(mark === '+' ? wrote : skipped).push(file)
  }
  /** Write a file that is not there; a file that is there is left exactly as it is. */
  const put = (rel: string, text: string, note: string) => {
    const abs = path.join(root, rel)
    if (fs.existsSync(abs)) return line('·', rel, note)
    if (!opts.dry) {
      fs.mkdirSync(path.dirname(abs), { recursive: true })
      fs.writeFileSync(abs, text)
    }
    line('+', rel, note)
  }

  /* ---- the record ---- */
  put(LOG_PATH, '', 'the record — every decision from now on is a line in it')

  /* ---- the frame file ---- */
  const source = opts.source?.length ? opts.source : DEFAULT_CONFIG.source
  const tokens = opts.tokens === undefined ? DEFAULT_CONFIG.tokens : opts.tokens
  const fresh: Partial<ProductConfig> = {
    source,
    tokens,
    ...(tokens ? { ledger: path.posix.join(tokens, 'ledger.json') } : {}),
    ...(opts.malleable ? { malleable: { source: source[0] } } : {}),
  }
  if (!fs.existsSync(path.join(root, CONFIG_PATH))) {
    if (!opts.dry) writeConfig(root, fresh)
    line('+', CONFIG_PATH, `where your source and tokens live (${source.join(', ')}${tokens ? `; ${tokens}` : '; you keep your own tokens'})`)
  } else line('·', CONFIG_PATH, 'kept as it is')
  const config = opts.dry && !fs.existsSync(path.join(root, CONFIG_PATH)) ? loadConfigFrom(fresh) : loadConfig(root)

  /* ---- the grammar: the system's rules, and a place for the voice ---- */
  const canon = JSON.parse(fs.readFileSync(path.join(pkg, RULES_PATH), 'utf8')) as { $description?: string; $layers?: string; layers: Layer[]; rules: Rule[] }
  const system = canon.rules.filter((r) => (r.scope ?? 'system') === 'system').map((r) => ({ ...r, source: sourceInPackage(r.source, name) }))
  // A voice is frame, so init carries it the way it carries the system's rules.
  // The seeds it finds are a decision, and are reported rather than applied.
  const voice = opts.voice ? readVoice(opts.voice, opts.voiceHome) : undefined
  // Whose the carried rules are once they are here. `personal` by default: a
  // product works under a voice and does not come to own it.
  const carriedRules = voice ? (opts.house ? voice.rules.map((r) => ({ ...r, scope: 'product' as const })) : voice.rules) : []
  const grammar = {
    $description: `The rules this product works under, as data. The ${system.length} rules here are the system's — they arrive with Strata, and their prose lives in the package each source names. Rules this product adds carry "scope": "product" and sit beside them; every rule says which evaluator speaks for it, or "check": "none". npx strata check reads every one.`,
    ...(canon.$layers ? { $layers: canon.$layers } : {}),
    layers: canon.layers,
    rules: [...system, ...carriedRules],
  }
  put(
    RULES_PATH,
    JSON.stringify(grammar, null, 2) + '\n',
    voice?.rules.length
      ? `the system's ${system.length} rules, and ${voice.rules.length} ${opts.house ? "carried in as this product's own" : 'from your voice'}`
      : `the system's ${system.length} rules; none of them is your taste yet`,
  )
  const template = fs.readFileSync(path.join(pkg, TEMPLATE_GRAMMAR), 'utf8').replaceAll('{{package}}', `node_modules/${name}`).replaceAll('{{product}}', path.basename(root))
  put('GRAMMAR.md', voice?.grammar ?? template, voice?.grammar ? `your voice, carried from ${voice.from}` : 'your voice — nothing written yet')

  /* ---- the skills ---- */
  const skills: string[] = []
  if (opts.skills !== false) {
    const names = [...ADOPTER_SKILLS, ...(opts.malleable ? MALLEABLE_SKILLS : [])]
    for (const n of names) {
      const from = path.join(pkg, 'skills', n, 'SKILL.md')
      if (!fs.existsSync(from)) continue
      // The examples a shipped skill cites are from the product it shipped
      // from; this product's are on its own record, and there are none yet.
      const text = fs.readFileSync(from, 'utf8').replace(/^examples: .*$/m, 'examples: []')
      const rel = path.posix.join('.claude/skills', n, 'SKILL.md')
      const abs = path.join(root, rel)
      if (fs.existsSync(abs)) skipped.push(rel)
      else {
        if (!opts.dry) {
          fs.mkdirSync(path.dirname(abs), { recursive: true })
          fs.writeFileSync(abs, text)
        }
        wrote.push(rel)
      }
      skills.push(n)
    }
    lines.push({ mark: wrote.some((w) => w.startsWith('.claude/skills')) ? '+' : '·', file: `.claude/skills (${skills.length})`, note: `what an agent performs here: ${skills.join(' · ')}` })
  }

  /* ---- the tokens ---- */
  if (config.tokens) {
    registerTheme({ root })
    const t = initTheme(root, pkg, { dry: opts.dry })
    wrote.push(...t.wrote)
    skipped.push(...t.skipped)
    lines.push({
      mark: t.wrote.length ? '+' : '·',
      file: `${config.tokens}/`,
      note: t.wrote.length
        ? 'the primitives, and three files projected from the record: every role proposed, the engine’s default theme in force until you retheme'
        : 'the primitives and the three projections, as they were',
    })
  }

  /* ---- the malleable layer, when asked for ---- */
  if (opts.malleable) {
    const m = initMalleable(root, path.join(pkg, 'strata-malleable'), { dry: opts.dry })
    wrote.push(...m.wrote)
    skipped.push(...m.skipped)
    notes.push(...m.notes)
    lines.push({ mark: m.wrote.length ? '+' : '·', file: '.claude/commands', note: '/malleable-preview and /malleable-review, for the layer a designer changes by hand' })
  }

  /* ---- the MCP server, when asked for: standing configuration, so only on request ---- */
  if (opts.mcp) {
    const rel = '.mcp.json'
    const abs = path.join(root, rel)
    const existing = fs.existsSync(abs) ? (JSON.parse(fs.readFileSync(abs, 'utf8')) as { mcpServers?: Record<string, unknown> }) : {}
    if (existing.mcpServers?.strata) line('·', rel, 'already reaches the record over MCP')
    else {
      const next = { ...existing, mcpServers: { ...(existing.mcpServers ?? {}), strata: { command: 'npx', args: ['strata-mcp'] } } }
      if (!opts.dry) fs.writeFileSync(abs, JSON.stringify(next, null, 2) + '\n')
      line('+', rel, 'the record over MCP: strata_skill, strata_precedent, strata_explain, strata_decide, strata_check, strata_log')
    }
  }

  // No backticks: this prints in a terminal, not in a README.
  notes.push('commit .strata/decisions.jsonl — it is the record. Everything the tokens directory holds besides primitives.css is projected from it, and strata rebuild writes it again.')
  // The theme that product has in force. Applying it here would be this
  // product's first decision, and init does not make it.
  const s = survey(root)
  return { lines, wrote, skipped, notes, config, skills, survey: formatSurvey(s), fresh: s.sources === 0, ...(voice ? { voice, house: !!opts.house } : {}) }
}

/** A config that is not on disk yet, with the defaults filled in the same way. */
function loadConfigFrom(partial: Partial<ProductConfig>): ProductConfig {
  const tokens = partial.tokens === undefined ? DEFAULT_CONFIG.tokens : partial.tokens
  return {
    source: partial.source ?? DEFAULT_CONFIG.source,
    tokens,
    ledger: partial.ledger ?? (tokens ? path.posix.join(tokens, 'ledger.json') : DEFAULT_CONFIG.ledger),
    ...(partial.malleable ? { malleable: partial.malleable } : {}),
  }
}

/**
 * A step: what to call it, the command to run, and what it does under both.
 *
 * A command is one line or it cannot be pasted, so one too long for the column
 * takes the margin instead — the note sits beside the label and the command
 * runs beneath it, where the terminal soft-wraps it at a space rather than
 * through the middle of a flag.
 */
function step(name: string, command: string, note: string, at: number): string[] {
  const said = fold(note, at)
  if (command.length <= COLUMNS - at) return [`  ${name.padEnd(at - 2)}${command}`, ...said.map((l) => ' '.repeat(at) + l)]
  return [`  ${name.padEnd(at - 2)}${said[0] ?? ''}`, ...said.slice(1).map((l) => ' '.repeat(at) + l), '', `  ${command}`]
}

/** The message: what is here now, and the one or two things to do next. */
export function formatInit(r: InitReport, opts: { dry?: boolean } = {}): string {
  const width = Math.max(...r.lines.map((l) => l.file.length), 24)
  const at = 2 + 2 + width + 2
  const out = [r.wrote.length ? 'Strata is here.' : 'Strata was already here; nothing changed.', '']
  for (const l of r.lines) out.push(`  ${l.mark} ${l.file.padEnd(width)}  ${hang(l.note, at).join('\n')}`)
  if (opts.dry) out.push('', '  (dry run — nothing written)')
  out.push('')
  // A voice that came in is already written, so the message stops offering to
  // write one. What remains is the theme, which is a decision and stays the
  // person's to make — with the seeds it arrived with, when it had them.
  const carried = r.voice?.rules.length ? r.voice : undefined
  if (carried) {
    out.push(
      ...fold(
        `Your voice is here: ${carried.rules.length} rules from ${carried.from}, and the prose they cite. ` +
          (r.house
            ? 'They are this product’s house rules now, so a voice carried on from here will not take them further.'
            : 'They stay yours — a product works under a voice and does not come to own it.'),
        0,
      ),
      '',
    )
    out.push(...fold('Nothing has been decided yet. The theme is a decision, so it is yours to make:', 0), '')
    out.push(
      ...step(
        'the theme',
        carried.seeds ? `${rethemeFrom(carried.seeds)} --why "…"` : 'npx strata retheme --hue 20 --chroma 0.12 --why "…"',
        carried.seeds ? `the seeds ${carried.from} has in force. Change any of them and every projection follows.` : 'seven numbers, on the record. The Theme Lab picks them by eye; pass the link with --link.',
        14,
      ),
      '',
    )
  } else if (r.fresh) {
    out.push('Nothing here has been decided yet. Two ways to start:', '')
    out.push(...step('the theme', 'npx strata retheme --hue 20 --chroma 0.12 --why "…"', 'seven numbers, on the record. The Theme Lab picks them by eye; pass the link with --link.', 14), '')
    out.push(
      ...(r.skills.includes('write-grammar')
        ? step('the voice', '/write-grammar in Claude Code', 'your rules, each with its reason. npx strata skill write-grammar assembles the same packet for any harness.', 14)
        : step('the voice', 'npx strata skill write-grammar', 'your rules, each with its reason', 14)),
      '',
    )
  } else {
    out.push(r.survey, '', 'What the stylesheets already decided is where the voice starts:', '')
    out.push(
      ...fold(
        r.skills.includes('write-grammar')
          ? '/write-grammar in Claude Code reads the survey and asks which of these were decided; npx strata skill write-grammar assembles the same packet for any harness'
          : 'npx strata skill write-grammar reads the survey and asks which of these were decided',
        2,
      ).map((l) => `  ${l}`),
      '',
    )
  }
  out.push('npx strata check reports what happened. It fails only on an invariant.')
  for (const n of r.notes) out.push('', ...hang(`note: ${n}`, 6))
  return out.join('\n')
}

export interface InitIo {
  out: (s: string) => void
  err: (s: string) => void
}

/** The verb: flags, three questions when a person is at the terminal, then `init` and the message. */
export async function runInit(argv: string[], home: { root: string; package: string }, env: Record<string, string | undefined> = process.env, io: InitIo = { out: console.log, err: console.error }): Promise<number> {
  const [, ...rest] = argv
  const flag = (n: string) => {
    const i = rest.indexOf(`--${n}`)
    return i === -1 ? undefined : rest[i + 1]
  }
  const has = (n: string) => rest.includes(`--${n}`)
  const opts: InitOptions = {
    dry: has('dry'),
    malleable: has('malleable'),
    mcp: has('mcp'),
    ...(has('no-skills') ? { skills: false } : {}),
    ...(has('no-theme') ? { tokens: null } : flag('tokens') ? { tokens: flag('tokens') } : {}),
    ...(flag('source') ? { source: flag('source')!.split(',').map((s) => s.trim()).filter(Boolean) } : {}),
    ...(flag('voice') ? { voice: flag('voice') } : {}),
    ...(has('house') ? { house: true } : {}),
  }
  const already = fs.existsSync(path.join(home.root, CONFIG_PATH))
  const interactive = !has('yes') && !opts.dry && !already && stdin.isTTY && stdout.isTTY && env.CI === undefined
  if (interactive) {
    const rl = createInterface({ input: stdin, output: stdout })
    try {
      io.out('')
      const src = (await rl.question(`  where does your source live? (${opts.source?.join(', ') ?? DEFAULT_CONFIG.source.join(', ')}) `)).trim()
      if (src) opts.source = src.split(',').map((s) => s.trim()).filter(Boolean)
      if (!opts.voice) {
        for (const l of fold('a voice is the rules a product wrote for itself and the prose they cite; another product can lend you its', 2)) io.out(`  ${l}`)
        const from = (await rl.question('  take a voice from a path or git URL? (none) ')).trim()
        if (from && from !== 'none') opts.voice = from
      }
      if (opts.tokens !== null) {
        // The explanation above the ask, rather than a ninety-three character
        // question that wraps in the middle of itself.
        for (const l of fold('the semantic tokens — primitives, semantic.css and tokens.json — are projected from the record', 2)) io.out(`  ${l}`)
        const yes = (await rl.question('  write them? (Y/n) ')).trim().toLowerCase()
        if (yes === 'n' || yes === 'no') opts.tokens = null
        else {
          const where = (await rl.question(`  where? (${opts.tokens ?? DEFAULT_CONFIG.tokens}) `)).trim()
          if (where) opts.tokens = where
        }
      }
      if (opts.skills !== false) {
        const yes = (await rl.question('  install the skills an agent performs here into .claude/skills? (Y/n) ')).trim().toLowerCase()
        if (yes === 'n' || yes === 'no') opts.skills = false
      }
      io.out('')
    } finally {
      rl.close()
    }
  }
  const report = init(home.root, home.package, opts)
  io.out(formatInit(report, { dry: opts.dry }))
  return 0
}
