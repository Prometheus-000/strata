/**
 * THE THEME PROJECTION'S EVALUATORS — what this layer can find out about a
 * token decision, and about the product, when asked.
 *
 * Two invariants are mechanical truths about the stylesheet: every fallback
 * chain ends, every var() resolves. Everything else is evaluation — a raw
 * colour where a semantic name belongs is reported under the policy it bends,
 * with the way to declare it; a token nothing uses is knowledge, not a fault.
 * None of it runs while someone is designing.
 *
 * Which directories are read, and where the stylesheet is, come from the
 * product's frame file. An evaluator that speaks for a rule says so, and is
 * silent where the product's grammar does not declare that rule.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import type { Decision } from '@strata/substrate/decision'
import { handText } from '@strata/substrate/decision'
import { registerEvaluator, type EvalContext, type Finding } from '@strata/substrate/evidence'
import type { Fact } from '@strata/substrate/format'
import { seedsInForce } from '@strata/substrate/fold'
import { loadConfig } from '@strata/substrate/config'
import { contrastRatio } from './color'
import { generateTheme, OBSIDIAN } from './generateTheme'
import { fallbacksFor, themeTokens } from './ledger'
import { grounds, mintedRoles, readLedger, themePaths } from './emit'
import { COLOR_LITERAL } from './handlers'

const EXTS = ['.css', '.tsx', '.ts']

/** The directories the evaluators read: the product's source, from its frame file. */
export const scanDirs = (root: string): string[] => loadConfig(root).source

/** Where the token projections live, or nothing for a product that keeps its own tokens. */
const tokensDir = (root: string): string | null => loadConfig(root).tokens

function walk(dir: string, out: string[]) {
  if (!existsSync(dir)) return
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (EXTS.some((e) => p.endsWith(e))) out.push(p)
  }
}

/**
 * The product's source files. The token projections are never among them: a
 * projection is what the record says, written out, and every value in it is
 * the engine's. The ordinary adopter layout puts the tokens directory inside
 * the source directory, and without this the first `check` a new product ever
 * ran reported its own generated stylesheet back to it as forty-eight raw
 * colours — the policy pointed at the one file that cannot bend it.
 *
 * Asking for the tokens directory by name still reads it: `definedVars` needs
 * to know what the primitives define.
 */
export const scanFiles = (root: string, dirs: readonly string[] = scanDirs(root)): string[] => {
  const out: string[] = []
  for (const d of dirs) walk(join(root, d), out)
  const tokens = tokensDir(root)
  const asked = tokens !== null && dirs.some((d) => join(root, d) === join(root, tokens))
  const projections = tokens !== null && !asked ? join(root, tokens) + sep : null
  return out
    .filter((f) => !projections || !f.startsWith(projections))
    .map((f) => relative(root, f))
    .sort()
}

const read = (root: string, rel: string) => readFileSync(join(root, rel), 'utf8')

/* ---- literals: the deviation rule ---- */

export interface Literal {
  file: string
  line: number
  snippet: string
  /** Set when a `deviation:` comment covers it. */
  reason?: string
}

/** Every raw colour in the scanned files; a `deviation:` comment covers to the end of the CSS rule, or one line in TS. */
export function literals(root: string): { undeclared: Literal[]; declared: Literal[] } {
  const undeclared: Literal[] = []
  const declared: Literal[] = []
  for (const file of scanFiles(root)) {
    const isCss = file.endsWith('.css')
    let active: { reason: string; line: number } | null = null
    read(root, file)
      .split('\n')
      .forEach((line, i) => {
        const dev = line.match(/deviation:\s*(.*?)(?:\*\/|$)/)
        if (dev) active = { reason: dev[1].trim(), line: i + 1 }
        if (COLOR_LITERAL.test(line) && !line.includes('deviation:') && !line.includes('data:image/')) {
          const hit = { file, line: i + 1, snippet: line.trim().slice(0, 90) }
          if (active) declared.push({ ...hit, reason: active.reason })
          else undeclared.push(hit)
        }
        if (active && (isCss ? line.includes('}') : i + 1 > active.line)) active = null
      })
  }
  return { undeclared, declared }
}

/* ---- consumers: who reaches for each token ---- */

export function consumers(root: string): Map<string, string[]> {
  const usage = new Map<string, string[]>()
  const count = (text: string, where: string) =>
    text.split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/var\((--[\w-]+)/g)) {
        const sites = usage.get(m[1]) ?? []
        sites.push(`${where}:${i + 1}`)
        usage.set(m[1], sites)
      }
    })
  for (const file of scanFiles(root)) count(read(root, file), file)
  const semantic = tokensDir(root) ? themePaths(root).semantic : null
  if (semantic && existsSync(join(root, semantic))) {
    // The static roles are the one place the generated file itself spends a token (--shadow-color, in the elevation shadows).
    const text = read(root, semantic)
    const at = text.indexOf('Static roles')
    if (at !== -1) {
      const before = text.slice(0, at).split('\n').length - 1
      text
        .slice(at)
        .split('\n')
        .forEach((line, i) => {
          for (const m of line.matchAll(/var\((--[\w-]+)/g)) {
            const sites = usage.get(m[1]) ?? []
            sites.push(`${semantic}:${before + i + 1}`)
            usage.set(m[1], sites)
          }
        })
    }
  }
  return usage
}

/**
 * Every custom property something defines: the engine's; every `--name:`
 * declaration in the token files and the scanned files; and the ones a
 * component sets from code — `'--name': value` in a style object, or
 * `setProperty('--name', …)`.
 */
export function definedVars(root: string): Set<string> {
  const defined = new Set(Object.keys(generateTheme(OBSIDIAN)))
  const tokens = tokensDir(root)
  for (const file of [...(tokens ? scanFiles(root, [tokens]) : []), ...scanFiles(root)]) {
    const text = read(root, file)
    for (const m of text.matchAll(/(--[\w-]+)\s*:/g)) defined.add(m[1])
    // A quoted custom property in code is set by intent — a style object key, a setProperty call.
    if (!file.endsWith('.css')) for (const m of text.matchAll(/['"](--[\w-]+)['"]/g)) defined.add(m[1])
  }
  return defined
}

const SURFACES = ['--surface-page', '--surface-raised', '--surface-sunken', '--surface-overlay'] as const

/**
 * WHICH INK IS READ ON WHICH GROUND. Declared, because nothing else in the
 * system knows it: the engine emits values, the ledger holds decisions, and
 * neither says that `--ink-inverse` sits on a danger fill and a tooltip
 * rather than on a page. A sweep without this list is noise — it reported
 * inverse ink against every surface, where a low number is the token doing
 * its job — and noise about safety is how safety findings get ignored.
 *
 * Each entry was read off the stylesheet: the grounds are the backgrounds
 * the token is actually set as `color:` against. 4.5:1 where it is read as
 * text, 3:1 where it is a mark. A live token named in no entry is reported
 * as measured against nothing rather than passed over.
 */
export const CONTRAST_PAIRS: ReadonlyArray<{ token: string; on: readonly string[]; need: number; kind: string }> = [
  { token: '--ink', on: SURFACES, need: 4.5, kind: 'body text' },
  { token: '--ink-muted', on: SURFACES, need: 4.5, kind: 'secondary text' },
  // Faint ink is set as `color:` in three stylesheets, so it is read, and 4.5
  // is what reading costs. It is the entry most likely to be argued with.
  { token: '--ink-faint', on: SURFACES, need: 4.5, kind: 'text' },
  { token: '--ink-inverse', on: ['--ink', '--danger'], need: 4.5, kind: 'text on an inverted fill' },
  { token: '--accent-ink', on: ['--accent', '--accent-strong'], need: 4.5, kind: 'text on an accent fill' },
  { token: '--accent', on: SURFACES, need: 3, kind: 'a mark' },
  { token: '--accent-strong', on: SURFACES, need: 3, kind: 'a mark' },
  { token: '--positive', on: SURFACES, need: 3, kind: 'a status mark' },
  { token: '--warning', on: SURFACES, need: 3, kind: 'a status mark' },
  { token: '--danger', on: SURFACES, need: 3, kind: 'a status mark' },
  { token: '--focus-ring', on: SURFACES, need: 3, kind: 'a focus indicator' },
]

const concentration = (n: number) => (n === 0 ? 'none' : n <= 3 ? 'low' : n <= 10 ? 'medium' : 'high')

/** The two grounds of the theme the record has in force. */
const groundsOf = (log: readonly Decision[]) => grounds(seedsInForce(log, OBSIDIAN))

export function registerThemeEvaluators(home: { root: string }): void {
  const root = home.root

  registerEvaluator({
    id: 'fallbacks.total-acyclic',
    findings: (ctx) => {
      const out: Finding[] = []
      const minted = mintedRoles(ctx.log)
      const FALLBACKS = fallbacksFor(minted)
      const engine = Object.keys({ ...generateTheme(OBSIDIAN), ...minted })
      for (const t of engine) if (!FALLBACKS[t]) out.push({ rule: 'fallbacks.total-acyclic', authority: 'invariant', where: t, message: `${t} is emitted by the engine and has no fallback` })
      for (const t of Object.keys(FALLBACKS)) if (!engine.includes(t)) out.push({ rule: 'fallbacks.total-acyclic', authority: 'invariant', where: t, message: `${t} has a fallback but the engine does not emit it` })
      for (const t of engine) {
        const seen = new Set<string>()
        let cur = t
        while (FALLBACKS[cur]) {
          if (seen.has(cur)) {
            out.push({ rule: 'fallbacks.total-acyclic', authority: 'invariant', where: t, message: `the fallback chain from ${t} loops at ${cur}` })
            break
          }
          seen.add(cur)
          cur = FALLBACKS[cur].to
          if (!cur.startsWith('--')) break
        }
        if (cur.startsWith('--') && !FALLBACKS[cur]) out.push({ rule: 'fallbacks.total-acyclic', authority: 'invariant', where: t, message: `the chain from ${t} ends at ${cur}, which has no fallback` })
      }
      return out
    },
  })

  registerEvaluator({
    id: 'css.vars-defined',
    findings: () => {
      const defined = definedVars(root)
      const out: Finding[] = []
      const semantic = tokensDir(root) ? themePaths(root).semantic : null
      const files = [...scanFiles(root), ...(semantic && existsSync(join(root, semantic)) ? [semantic] : [])]
      for (const file of files)
        read(root, file)
          .split('\n')
          .forEach((line, i) => {
            for (const m of line.matchAll(/var\((--[\w-]+)\s*([,)$])/g)) {
              // A name built at runtime (`--space-${n}`) is not a name; a var() with a fallback is valid whether or not the property exists.
              if (m[2] !== ')') continue
              if (!defined.has(m[1])) out.push({ rule: 'css.vars-defined', authority: 'invariant', where: `${file}:${i + 1}`, message: `var(${m[1]}) names a custom property nothing defines, and has no fallback` })
            }
          })
      return out
    },
  })

  registerEvaluator({
    id: 'layer0.semantic-names-only',
    rule: 'layer0.semantic-names-only',
    findings: () => {
      const { undeclared, declared } = literals(root)
      const out: Finding[] = undeclared.map((l) => ({
        rule: 'layer0.semantic-names-only',
        authority: 'policy',
        where: `${l.file}:${l.line}`,
        message: `${l.snippet} — a raw colour where a semantic name belongs; if it must exist, declare it: strata deviate ${l.file}:${l.line} --why "…"`,
      }))
      for (const l of declared) out.push({ rule: 'deviation.declared', authority: 'knowledge', where: `${l.file}:${l.line}`, message: `declared: ${l.reason}` })
      return out
    },
  })

  registerEvaluator({
    id: 'token.unused',
    findings: () => {
      const usage = consumers(root)
      const ledger = readLedger(root)
      const out: Finding[] = []
      const live = Object.keys(generateTheme(OBSIDIAN)).filter((name) => ledger.tokens[name]?.status !== 'cut')
      const unused = live.filter((name) => !(usage.get(name) ?? []).length)
      // Nothing reads any token yet: one line, not one per role. A product
      // before its first stylesheet has not neglected forty-seven names.
      if (unused.length === live.length && ![...usage.values()].some((sites) => sites.length))
        out.push({ rule: 'token.unused', authority: 'knowledge', message: `${live.length} roles, and nothing reads a token yet — expected before the first stylesheet speaks the semantic tier` })
      else for (const name of unused) out.push({ rule: 'token.unused', authority: 'knowledge', where: name, message: 'never used — a cut candidate, or headroom; only you know which' })
      const all = Object.entries(ledger.tokens)
      const proposed = all.filter(([, d]) => d.status === 'proposed')
      // Naming them is useful while a few are outstanding. Where nothing has
      // been decided yet, every role is proposed by definition, and listing
      // all forty-seven says only that the product is new.
      if (proposed.length && proposed.length === all.length)
        out.push({ rule: 'token.unreviewed', authority: 'knowledge', message: `every one of the ${proposed.length} roles is still a proposal — nothing has been kept or cut here yet; they ship as generated until a hand decides them (strata list)` })
      else if (proposed.length)
        out.push({ rule: 'token.unreviewed', authority: 'knowledge', message: `${proposed.length} token(s) still proposed — unreviewed; they ship as generated (strata list)`, facts: proposed.map(([n]) => ({ name: 'token', value: n })) })
      return out
    },
  })

  registerEvaluator({
    id: 'token.usage',
    kinds: ['token'],
    evidence: (d) => {
      if (d.kind !== 'token') return []
      const sites = consumers(root).get(d.token) ?? []
      const facts: Fact[] = [
        { name: 'consumers', value: sites.length },
        { name: 'usage concentration', value: concentration(sites.length) },
      ]
      const files = [...new Set(sites.map((s) => s.split(':')[0]))]
      if (files.length) facts.push({ name: 'surfaces', value: files.length })
      for (const s of sites.slice(0, 3)) facts.push({ name: 'consumer', value: s })
      return facts
    },
  })

  /**
   * SAFETY IS REPORTED, NEVER ENFORCED — and reported means `check`, not a
   * fact you only see if you happen to explain the right token.
   *
   * This was the gap: `token.contrast` gives evidence about one token when a
   * hand asks about it, and for a long time that was the whole of it, while
   * the README said contrast was "evaluated and reported like every other
   * policy". Nothing swept the palette. A pairing could fail on light and
   * nobody would be told unless they explained that exact token on that exact
   * ground.
   *
   * It stays a policy. A threshold is a judgement — 4.5:1 is a rule about
   * text at a size — and a build that refused a design over it would be
   * policing, which `evaluation.report-not-police` rules out. But silence is
   * worse than either, and silence is what this replaces.
   *
   * A finding carries the standing decision beside it. A token a hand kept
   * with a reason — faint ink as microtype, say — is not an unnoticed
   * failure, and the reader should not have to go and look that up.
   */
  registerEvaluator({
    id: 'safety.contrast',
    rule: 'safety.contrast',
    findings: (ctx) => {
      const ledger = readLedger(root)
      const live = (n: string) => ledger.tokens[n]?.status !== 'cut'
      const standing = (n: string) => {
        const d = ledger.tokens[n]
        return d && d.status === 'kept' && d.reason ? ` Kept by ${d.decided ? handText(d.decided) : 'an unnamed hand'}: ${d.reason}` : ''
      }
      const out: Finding[] = []
      const declared = new Set(CONTRAST_PAIRS.map((p) => p.token))
      const g = groundsOf(ctx.log)
      const grounds = [
        ['dark', themeTokens(generateTheme(g.dark), ledger, 'value')],
        ['light', themeTokens(generateTheme(g.light), ledger, 'value')],
      ] as const

      /**
       * One finding per token, not one per pairing.
       *
       * Faint ink is set against four surfaces on two grounds, so it fell
       * short eight times and said so eight times, in eight lines that
       * differed by two decimal places — the loudest thing in the first
       * report a new product ever ran, for what is one fact about one token.
       * The pairings are the evidence, and evidence is what `facts` is for.
       */
      for (const pair of CONTRAST_PAIRS) {
        if (!live(pair.token)) continue
        const short: Array<{ ground: string; on: string; ratio: number }> = []
        let measured = 0
        for (const [ground, values] of grounds) {
          if (!values[pair.token]) continue
          for (const on of pair.on) {
            if (!values[on] || !live(on)) continue
            const ratio = contrastRatio(values[pair.token], values[on])
            if (ratio === null) continue
            measured++
            if (ratio < pair.need) short.push({ ground, on, ratio })
          }
        }
        if (!short.length) continue
        const ratios = short.map((x) => x.ratio)
        const lo = Math.min(...ratios)
        const hi = Math.max(...ratios)
        const span = lo === hi ? `at ${lo.toFixed(2)}:1` : `from ${lo.toFixed(2)}:1 to ${hi.toFixed(2)}:1`
        out.push({
          rule: 'safety.contrast',
          authority: 'policy',
          where: pair.token,
          message:
            `${short.length} of the ${measured} grounds it is set against fall under the ${pair.need}:1 this measures ${pair.kind} against, ${span}. ` +
            `Reported, not refused — move the seeds, or keep the token with the reason it stands (strata keep ${pair.token} --why "…") and the reason prints here.${standing(pair.token)}`,
          facts: short.map((x) => ({ name: `${x.ground}, on ${x.on}`, value: `${x.ratio.toFixed(2)}:1` })),
        })
      }

      // A token that is read but named in no pairing is measured against
      // nothing, and saying so is the whole difference between a check and
      // a check that happens to be empty.
      for (const t of Object.keys(grounds[0][1]))
        if (/^--(ink|accent|positive|warning|danger|focus-ring)/.test(t) && live(t) && !declared.has(t) && !/soft|line|ring-/.test(t))
          out.push({
            rule: 'safety.contrast',
            authority: 'policy',
            where: t,
            message: `is read somewhere and is measured against nothing — add it to CONTRAST_PAIRS with the ground it sits on, or this evaluator is silent about it`,
          })
      return out
    },
  })

  registerEvaluator({
    id: 'token.contrast',
    kinds: ['token'],
    evidence: (d, ctx) => {
      if (d.kind !== 'token') return []
      const ledger = readLedger(root)
      const facts: Fact[] = []
      const g = groundsOf(ctx.log)
      for (const [ground, seeds] of [['dark', g.dark], ['light', g.light]] as const) {
        const values = themeTokens(generateTheme(seeds), ledger, 'value')
        const mine = values[d.token]
        if (!mine) continue
        const against = /^--surface/.test(d.token) ? '--ink' : '--surface-page'
        const ratio = contrastRatio(mine, values[against])
        if (ratio === null) continue
        facts.push({ name: `contrast on ${ground} (vs ${against})`, value: `${ratio.toFixed(2)}:1 · ${ratio >= 4.5 ? 'pass' : ratio >= 3 ? 'pass for UI' : 'fail'}` })
      }
      return facts
    },
  })

  registerEvaluator({
    id: 'token.duplicate-role',
    kinds: ['token'],
    evidence: (d, ctx) => {
      if (d.kind !== 'token') return []
      const ledger = readLedger(root)
      const values = themeTokens(generateTheme(groundsOf(ctx.log).house), ledger, 'value')
      const mine = values[d.token]
      const twins = Object.entries(values).filter(([n, v]) => n !== d.token && v === mine && ledger.tokens[n]?.status !== 'cut').map(([n]) => n)
      return [{ name: 'duplicate visual role', value: twins.length ? `yes — ${twins.join(', ')}` : 'no' }]
    },
  })
}

export const isTokenDecision = (d: Decision): d is Extract<Decision, { kind: 'token' }> => d.kind === 'token'
export type { EvalContext }
