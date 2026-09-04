/**
 * PROSE — the drift nothing else here catches.
 *
 * `rebuild --check` catches a projection that disagrees with the record,
 * because a projection can be regenerated and compared. Nothing regenerates a
 * *sentence*. So prose is the one thing in a Strata product that still drifts
 * the old way: a change leaves ghosts in whatever described the thing it
 * changed, and the further the prose is from the code, the longer they live.
 *
 * That is the same claim the epigraph makes, pointed at documentation. An
 * artifact you can regenerate stops carrying the thinking; a sentence you
 * cannot regenerate goes on asserting whatever it asserted the day it was
 * written, and no build fails.
 *
 * WHAT THIS CAN CHECK. Prose that names something the system either has or
 * does not: an npm script, a CLI verb, a repo path, a rule id, a state
 * provider, a decision kind. Those are decidable.
 *
 * WHAT IT CANNOT. A sentence that is false but names nothing. "Every change
 * is reviewed before it ships" contains no identifier to resolve, and no
 * evaluator will ever catch it — that one needs a person who knows what is true reading a
 * line that says otherwise. This closes the mechanical half and says plainly
 * that the other half is a person's job.
 *
 * IT REPORTS, IT DOES NOT POLICE. Stale prose is not an invariant: prose is
 * not the artifact, and a build that fails because a README mentions a
 * deleted command is policing documentation. `check` names these under
 * `policy`, and a product that wants them to block wraps them in its own test
 * — which is what this repository does.
 */
import fs from 'node:fs'
import path from 'node:path'
import { registeredKinds } from './decide.ts'
import { registerEvaluator, type EvalContext, type Finding } from './evidence.ts'
import { loadRules } from './grammar.ts'
import { byId, readAll } from './log.ts'
import { loadSkills, registeredState } from './skills.ts'

/** A word this product retired, and the sentence saying why it stays retired. */
export interface Retired {
  pattern: RegExp
  why: string
}

export interface ProseOptions {
  /** Directories to read prose from, relative to the root. */
  dirs?: readonly string[]
  /** Directory names never descended into. Dot-directories are always skipped. */
  skip?: readonly string[]
  /**
   * Package roots: their `package.json` scripts count as existing, and a path
   * named in prose is resolved against each of them as well as the root.
   */
  packages?: readonly string[]
  /** Every verb the CLI answers to, from every projection registered. */
  commands?: readonly string[]
  /** Words this product retired. Empty by default — each product names its own. */
  retired?: readonly Retired[]
  /**
   * `verb (file)` pairs a file is allowed to remember: a command named as
   * history rather than as instruction. Naming the file keeps the exemption
   * from spreading, which a whole-file allowlist cannot do.
   */
  remembered?: readonly string[]
  /** How deep to walk each directory. */
  depth?: number
}

const DEFAULTS = {
  dirs: ['.'],
  skip: ['node_modules', 'dist', 'build', 'coverage'],
  packages: ['.'],
  commands: [] as string[],
  retired: [] as Retired[],
  remembered: [] as string[],
  depth: 3,
}

type Settled = typeof DEFAULTS

const settle = (o: ProseOptions = {}): Settled => ({ ...DEFAULTS, ...Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) }) as Settled

/**
 * Every file whose English is worth reading: markdown, and source that
 * carries comments. Test files are excluded — a test that names a removed
 * command is usually the test asserting it stays removed.
 */
export function proseFiles(root: string, opts: ProseOptions = {}): string[] {
  const { dirs, skip, depth } = settle(opts)
  const skipped = new Set(skip)
  const out: string[] = []
  const walk = (dir: string, left: number) => {
    for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      if (skipped.has(entry.name) || entry.name.startsWith('.')) continue
      const rel = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (left > 0) walk(rel, left - 1)
      } else if (/\.(md|ts|tsx|mjs|js)$/.test(entry.name) && !/\.test\.[jt]sx?$/.test(entry.name)) out.push(rel)
    }
  }
  for (const d of dirs) if (fs.existsSync(path.join(root, d))) walk(d, depth)
  return [...new Set(out)].sort()
}

/** The English of a file: markdown whole, source only inside its comments. */
export function proseOf(root: string, rel: string): string {
  const text = fs.readFileSync(path.join(root, rel), 'utf8')
  if (rel.endsWith('.md')) return text
  return [...text.matchAll(/\/\*\*[\s\S]*?\*\/|\/\/[^\n]*/g)].map((m) => m[0]).join('\n')
}

/** One ghost: a sentence naming something that is not there. */
export interface Ghost {
  /** The rule it speaks for. */
  rule: string
  /** The file the sentence is in. */
  file: string
  message: string
}

const NAMES_WHAT_EXISTS = 'prose.names-what-exists'
const CITE_WHAT_EXISTS = 'skills.cite-what-exists'

const scriptsOf = (root: string, pkg: string): string[] => {
  const p = path.join(root, pkg, 'package.json')
  if (!fs.existsSync(p)) return []
  try {
    return Object.keys((JSON.parse(fs.readFileSync(p, 'utf8')) as { scripts?: object }).scripts ?? {})
  } catch {
    return []
  }
}

/**
 * The four scans over English. Each looks for one shape of identifier and
 * asks whether the thing it names is there.
 */
export function ghosts(root: string, opts: ProseOptions = {}): Ghost[] {
  const o = settle(opts)
  const files = proseFiles(root, opts)
  const text = new Map(files.map((f) => [f, proseOf(root, f)]))
  const found: Ghost[] = []
  const say = (file: string, message: string, rule = NAMES_WHAT_EXISTS) => found.push({ rule, file, message })

  // 1. An npm script. The one this repository retired outlived its
  //    definition, in three READMEs, by months.
  const scripts = new Set(o.packages.flatMap((p) => scriptsOf(root, p)))
  for (const [f, body] of text) for (const m of body.matchAll(/npm run ([a-z][a-z0-9:-]*)/g)) if (!scripts.has(m[1])) say(f, `\`npm run ${m[1]}\` — nothing defines that script`)

  // 2. A CLI verb, but only where the line is an invocation rather than
  //    English: after a backtick, after a shell prompt, or carrying flags.
  //    "the malleable layer" and "code is malleable to the design" are prose.
  const commands = new Set(o.commands)
  const remembered = new Set(o.remembered)
  if (commands.size)
    for (const [f, body] of text)
      for (const line of body.split('\n'))
        for (const m of line.matchAll(/(?:`|\$ |^\s*)(?:strata|malleable) ([a-z][a-z-]*)/g)) {
          const invocation = /[`$]/.test(m[0]) || line.includes('--')
          if (invocation && !commands.has(m[1]) && !remembered.has(`${m[1]} (${f})`)) say(f, `\`strata ${m[1]}\` — no command by that name; the prose tells someone to run something that is not there`)
        }

  // 3. A path into this repository: backticked, with a slash, first segment a
  //    directory that exists at the root or in one of the packages. Anything
  //    vaguer is not decidable and is left alone rather than guessed at.
  const dirsUnder = (pkg: string): string[] => {
    const p = path.join(root, pkg)
    if (!fs.existsSync(p)) return []
    return fs
      .readdirSync(p, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
  }
  const roots = new Set(o.packages.flatMap(dirsUnder))
  for (const [f, body] of text)
    for (const m of body.matchAll(/`([^`\s]+\/[^`\s]*)`/g)) {
      const p = m[1].replace(/[.,;:]$/, '')
      if (!roots.has(p.split('/')[0])) continue
      if (p.includes('*') || p.includes('<') || p.endsWith('/')) continue
      // Resolved from the root, from each package, and from the directory of
      // the file that names it: a README beside a folder names its sibling
      // directory bare, and means the one next to it rather than a path from
      // the root.
      const candidates = [p, ...o.packages.map((pkg) => path.join(pkg, p)), path.join(path.dirname(f), p)]
      if (!candidates.some((c) => fs.existsSync(path.join(root, c)))) say(f, `\`${p}\` — no such file`)
    }

  // 4. A word this product retired. The convention is one word: a retired
  //    thing is named as "the old X" when the point is that it is gone, which
  //    is narrower and more honest than trusting whole files — an allowlisted
  //    file goes on being trusted long after the reason for it has expired.
  for (const [f, body] of text) for (const r of o.retired) if (r.pattern.test(body)) say(f, `a retired phrase is back — ${r.why}`)

  return found
}

/**
 * The fifth: a skill's packet cites rules, state providers, examples and
 * kinds by id. Renaming a rule silently empties the packet that cited it,
 * which is the same drift as a stale sentence with none of the English.
 */
export function brokenCitations(root: string): Ghost[] {
  const rules = new Set(loadRules(root).map((r) => r.id))
  const state = new Set(registeredState())
  const kinds = new Set<string>(registeredKinds())
  const log = readAll(root)
  const out: Ghost[] = []
  for (const s of loadSkills(root)) {
    const say = (message: string) => out.push({ rule: CITE_WHAT_EXISTS, file: s.file, message })
    for (const r of s.context.rules ?? []) if (!rules.has(r)) say(`${s.name} cites rule \`${r}\`, which the grammar does not have`)
    for (const st of s.context.state ?? []) if (!state.has(st)) say(`${s.name} cites state \`${st}\`, which no projection provides`)
    for (const ex of s.examples) if (!byId(log, ex)) say(`${s.name} cites example \`${ex}\`, which is not on the record`)
    for (const td of s.typicalDecisions) if (!kinds.has(td.split('/')[0])) say(`${s.name} names decision \`${td}\`, whose kind nothing registers`)
  }
  return out
}

const asFinding = (g: Ghost): Finding => ({ rule: g.rule, authority: 'policy', where: g.file, message: g.message })

/**
 * Register both as `check` evaluators. Two rules rather than one, because
 * they are different mechanisms: a regex over English, and an id resolved
 * against a registry. A product can register one without the other.
 */
export function registerProse(root: string, opts: ProseOptions = {}): void {
  registerEvaluator({ id: NAMES_WHAT_EXISTS, findings: () => ghosts(root, opts).map(asFinding) })
  registerEvaluator({ id: CITE_WHAT_EXISTS, findings: (ctx: EvalContext) => brokenCitations(ctx.root).map(asFinding) })
}

export const PROSE_RULES = [NAMES_WHAT_EXISTS, CITE_WHAT_EXISTS] as const
