/**
 * THE THEME PROJECTION'S HANDLERS — how a token decision, a retheme and a
 * declared deviation are applied when someone decides them.
 *
 * A token decision lands in the ledger (a projection of the record, kept on
 * disk because the runtime imports it) and re-emits the stylesheet and the
 * contract, because a decision that is not in the stylesheet has not been
 * made yet. A retheme is the same: seven numbers on the record, and every
 * projection compiled from them in the same call. A deviation writes its
 * comment beside the literal it legalises — the decision and the thing
 * decided are one diff — and the record carries who declared it and why.
 *
 * Where the files live is the product's frame file's to say
 * (`.strata/config.json`); nothing here holds a path.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { registerHandler, type Applied, type Refused, type Request, type ResolvedContext } from '@strata/substrate/decide'
import type { Decision, DecisionBody, ThemeSeeds, Value } from '@strata/substrate/decision'
import { current, seedsInForce } from '@strata/substrate/log'
import { registerProjection, type Imported } from '@strata/substrate/projection'
import { generateTheme, OBSIDIAN, SEED_RANGE } from './generateTheme'
import { fallbacksFor, FALLBACKS, type Ledger, type TokenDecision, type TokenStatus } from './ledger'
import { emitTokens, mintedRoles, readLedger, themePaths, writeLedger } from './emit'
import { registerState } from '@strata/substrate/skills'
import { consumers, registerThemeEvaluators } from './evaluators'
import { registerGrammarEvaluators } from './grammar'
import { formatSurvey, survey } from './survey'
import { loadConfig, tokenPaths } from '@strata/substrate/config'

export type TokenRequest = Request & { kind: 'token'; token: string; action: 'propose' | 'keep' | 'cut' | 'mint'; value?: Value; from?: string[] }
export type DeviationRequest = Request & { kind: 'deviation'; file: string; line: number; value?: string }
export type SeedRequest = Request & { kind: 'seed'; seeds: ThemeSeeds }

/**
 * A minted name arrives `kept`: the engine did not propose it and nobody has
 * to review whether it earned its place, because coining it *was* that
 * decision, made with a reason and the convergence that argued for it.
 */
const STATUS: Record<TokenRequest['action'], TokenStatus> = { propose: 'proposed', keep: 'kept', cut: 'cut', mint: 'kept' }

/** Raw colour, as the evaluator also reads it: hex, oklch(), rgb()/rgba(), hsl()/hsla(). */
export const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\boklch\([^)]*\)|\brgba?\([^)]*\)|\bhsla?\([^)]*\)/

export function registerTheme(home: { root: string }): void {
  // A product that keeps its own tokens mounts no theme projection: the
  // record and the grammar are Strata's, the stylesheet stays theirs.
  if (!tokenPaths(loadConfig(home.root))) return
  registerHandler<TokenRequest>('token', (req, ctx, log) => tokenHandler(req, ctx, home.root, log))
  registerHandler<SeedRequest>('seed', (req, ctx, log) => seedHandler(req, ctx, home.root, log))
  registerHandler<DeviationRequest>('deviation', (req, ctx) => deviationHandler(req, ctx, home.root))
  registerProjection({ name: themePaths(home.root).ledger, import: importLedger, project: projectTheme })
  registerThemeEvaluators(home)
  registerGrammarEvaluators(home)
  registerState('tokens', () => {
    const ledger = readLedger(home.root)
    return Object.keys(generateTheme(OBSIDIAN))
      .map((name) => {
        const d = ledger.tokens[name] ?? { status: 'proposed' as const }
        return `${name.padEnd(24)} ${d.status.padEnd(9)}${d.status === 'cut' ? ` → ${FALLBACKS[name]?.to}` : ''}${d.reason ? ` · ${d.reason}` : ''}`
      })
      .join('\n')
  })
  registerState('consumers', () =>
    [...consumers(home.root)]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([name, sites]) => `${name.padEnd(24)} ${String(sites.length).padStart(3)} consumer(s)`)
      .join('\n'),
  )
  // What the stylesheets already decided, for a skill that writes rules.
  registerState('survey', () => formatSurvey(survey(home.root)))
  // What this projection writes, by path, so a skill can name them without a
  // constraint that carries another product's layout.
  registerState('projections', () => {
    const p = themePaths(home.root)
    return [
      `${p.ledger.padEnd(28)} the ledger — what the record says about each token`,
      `${p.semantic.padEnd(28)} the stylesheet — the semantic tier, compiled from the seeds in force`,
      `${p.tokens.padEnd(28)} the contract — the same, machine-readable`,
      'written by `strata rebuild` and by every token or seed decision; never edited by hand',
    ].join('\n')
  })
}

const ACTION: Record<TokenStatus, TokenRequest['action']> = { proposed: 'propose', kept: 'keep', cut: 'cut' }

/** When the ledger was last committed — the honest time for a decision nobody stamped. */
function ledgerTime(root: string): string {
  const ledger = themePaths(root).ledger
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', ledger], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    if (out) return new Date(out).toISOString()
  } catch {
    /* not a repo, or the file is untracked */
  }
  return statSync(join(root, ledger)).mtime.toISOString()
}

/**
 * Every decided line in the old ledger, as the decision that would have
 * written it. Proposed lines are the engine's, not anyone's.
 *
 * The old ledger recorded one `by`, and what it recorded there was the
 * channel that ran the command — so a token a person cut through an agent's
 * shell came back reading as the agent's judgement. That field is not
 * evidence of who chose, so it is not read as one: these rows leave both
 * hands unset and take the ones the import was run with, which is a claim
 * made once, out loud, by whoever runs it.
 */
function importLedger(root: string): Imported[] {
  if (!existsSync(join(root, themePaths(root).ledger))) return []
  const at = ledgerTime(root)
  return Object.entries(readLedger(root).tokens)
    .filter(([, d]) => d.status !== 'proposed')
    .map(([token, d]) => ({
      kind: 'token' as const,
      token,
      action: ACTION[d.status],
      at,
      ...(d.reason ? { reason: d.reason } : {}),
      ...(d.status === 'cut' ? { consequence: { collapsesTo: FALLBACKS[token]?.to } } : {}),
    }))
}

/** The ledger the record says, and the two files the engine emits through it. */
function projectTheme(root: string, log: readonly Decision[]): Record<string, string> {
  const now = current(log)
  const tokens: Record<string, TokenDecision> = {}
  for (const name of Object.keys({ ...generateTheme(OBSIDIAN), ...mintedRoles(log) })) {
    const d = now.get(`token:${name}`)
    tokens[name] = d && d.kind === 'token' ? { status: STATUS[d.action], decided: d.decided, written: d.written, ...(d.reason ? { reason: d.reason } : {}), id: d.id } : { status: 'proposed' }
  }
  const ledger: Ledger = { ...readLedger(root), tokens }
  return emitTokens(root, { dryRun: true, ledger, log }).files
}

function tokenHandler(req: TokenRequest, ctx: ResolvedContext, root: string, log: readonly Decision[]): Applied | Refused {
  const minted = mintedRoles(log)
  const engine = { ...generateTheme(OBSIDIAN), ...minted }
  const fallbacks = fallbacksFor(minted)
  if (typeof req.token !== 'string' || !req.token.startsWith('--')) return { refused: 'a token is a custom property name, like --accent-strong' }
  const status = STATUS[req.action]
  if (!status) return { refused: `a token is proposed, kept, cut or minted — not "${String(req.action)}"` }

  /* ---- minting: the one path that adds a name rather than deciding one ---- */
  if (req.action === 'mint') {
    if (req.token in engine)
      return {
        refused:
          req.token in minted
            ? `${req.token} was already minted. To change what it is worth, mint it again with the new value; the record keeps both.`
            : `${req.token} is already derived from the seeds — the engine emits it. Minting is for a name no seed produces; keep or cut this one instead.`,
      }
    if (!req.value || !('literal' in req.value || 'token' in req.value)) return { refused: 'a mint says what the name is worth: --value 12px, or --value --radius-surface to alias an existing role' }
    if ('token' in req.value && !(req.value.token in engine)) return { refused: `${req.value.token} is not a role this product has; a mint can alias one, not invent two at once` }
    if (!req.reason) return { refused: 'a minted name carries the argument for its existence — pass --why "…"; the convergence goes in --from' }
  } else if (!(req.token in engine)) {
    return {
      refused: `the engine does not emit ${req.token}, and nothing has minted it. It emits:\n    ${Object.keys(engine).join('\n    ')}\n  To coin a new name from a convergence: strata mint ${req.token} --value <v> --why "…"`,
    }
  }

  const ledger = readLedger(root)
  const prior = ledger.tokens[req.token]
  const body: DecisionBody =
    req.action === 'mint'
      ? { kind: 'token', token: req.token, action: 'mint', value: req.value!, ...(req.from?.length ? { from: req.from } : {}) }
      : { kind: 'token', token: req.token, action: req.action }
  const landing = () => (status === 'cut' ? { collapsesTo: fallbacks[req.token]?.to } : {})
  if (req.action !== 'mint' && prior && prior.status === status && (req.reason === undefined || prior.reason === req.reason)) return { body, unchanged: true, consequence: landing() }

  const next = {
    ...ledger,
    tokens: { ...ledger.tokens, [req.token]: { status, decided: ctx.decided, written: ctx.written, ...(req.reason ? { reason: req.reason } : {}), id: ctx.id } },
  }
  if (!ctx.dryRun) writeLedger(root, next)
  // The new decision is not on the record yet — the substrate appends after a
  // handler returns — so the emit is told about it here.
  const emitted = emitTokens(root, { dryRun: ctx.dryRun, log: [...log, { ...body, id: ctx.id, at: ctx.at, decided: ctx.decided, written: ctx.written, via: ctx.via, consequence: {} } as Decision] })
  const cut = emitted.cuts.find((r) => r.token === req.token)
  return {
    body,
    consequence:
      status === 'cut'
        ? { collapsesTo: cut?.to ?? fallbacks[req.token]?.to }
        : req.action === 'mint'
          ? {
              affected: req.from?.length ?? 0,
              note: `minted from ${req.from?.length ?? 0} converging decision(s); cut, it collapses to ${'token' in req.value! ? `var(${req.value!.token})` : req.value!.literal}`,
            }
          : {},
    written: emitted.written,
  }
}

const DIALS = ['hue', 'chroma', 'warmth', 'energy', 'density'] as const

/** Two seed sets that compile to the same theme: the seven values, with an absent lightness read as the zero it means. */
export const sameSeeds = (a: ThemeSeeds, b: ThemeSeeds): boolean =>
  DIALS.every((k) => a[k] === b[k]) && a.appearance === b.appearance && (a.lightness ?? 0) === (b.lightness ?? 0)

/** The dials a retheme moved, as one line. */
export const seedsMoved = (from: ThemeSeeds, to: ThemeSeeds): string[] =>
  ([...DIALS, 'lightness', 'appearance'] as const)
    .filter((k) => (k === 'lightness' ? (from.lightness ?? 0) !== (to.lightness ?? 0) : from[k] !== to[k]))
    .map((k) => `${k} ${String(from[k] ?? 0)} → ${String(to[k] ?? 0)}`)

/**
 * RETHEME — seven numbers on the record, and every projection compiled from
 * them in the same call. `from` is the theme that was in force, folded from
 * the record, so a reversal is two lines that read as one.
 */
function seedHandler(req: SeedRequest, ctx: ResolvedContext, root: string, log: readonly Decision[]): Applied | Refused {
  const seeds = req.seeds
  if (!seeds || typeof seeds !== 'object') return { refused: 'a retheme needs the seeds: hue, chroma, warmth, energy, density, appearance — and lightness, when it moves' }
  for (const k of DIALS) if (typeof seeds[k] !== 'number' || !Number.isFinite(seeds[k])) return { refused: `a retheme needs ${k}, as a number` }
  if (seeds.appearance !== 'dark' && seeds.appearance !== 'light') return { refused: `appearance is dark or light, not "${String(seeds.appearance)}"` }
  if (seeds.lightness !== undefined && (typeof seeds.lightness !== 'number' || !Number.isFinite(seeds.lightness))) return { refused: 'lightness is a number from −1 to 1' }
  for (const [k, [lo, hi]] of Object.entries(SEED_RANGE)) {
    const v = seeds[k as keyof ThemeSeeds]
    if (typeof v === 'number' && (v < lo || v > hi)) return { refused: `${k} is ${v}; the engine holds ${lo}–${hi}, so say a value it can` }
  }
  const from = seedsInForce(log, OBSIDIAN)
  const body: DecisionBody = { kind: 'seed', seeds, from }
  if (sameSeeds(from, seeds)) return { body, unchanged: true }
  const decision = { ...body, id: ctx.id, at: ctx.at, decided: ctx.decided, written: ctx.written, via: ctx.via, consequence: {} } as Decision
  const emitted = emitTokens(root, { dryRun: ctx.dryRun, log: [...log, decision] })
  return { body, consequence: { note: seedsMoved(from, seeds).join(' · ') }, written: emitted.written }
}

function deviationHandler(req: DeviationRequest, ctx: ResolvedContext, root: string): Applied | Refused {
  if (typeof req.file !== 'string' || !Number.isInteger(req.line) || req.line < 1) return { refused: 'a deviation names a file and a line' }
  const abs = join(root, req.file)
  if (!existsSync(abs)) return { refused: `no such file ${req.file}` }
  const text = readFileSync(abs, 'utf8')
  const lines = text.split('\n')
  const line = lines[req.line - 1]
  if (line === undefined) return { refused: `${req.file} has no line ${req.line}` }

  const value = req.value ?? line.match(COLOR_LITERAL)?.[0] ?? line.trim()
  const body: DecisionBody = { kind: 'deviation', file: req.file, line: req.line, value }
  // Already declared in source: the record gains the line and the file is untouched.
  if (/deviation:/.test(line)) return { body, unchanged: true, consequence: { note: line.trim() } }
  if (!req.reason) return { refused: 'a deviation declares its reason — pass --why "…"', body }

  const comment = req.file.endsWith('.css') ? ` /* deviation: ${req.reason} */` : ` // deviation: ${req.reason}`
  lines[req.line - 1] = line + comment
  if (!ctx.dryRun) writeFileSync(abs, lines.join('\n'))
  return { body, written: [req.file] }
}
