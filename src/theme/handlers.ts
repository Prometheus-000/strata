/**
 * THE THEME PROJECTION'S HANDLERS — how a token decision and a declared
 * deviation are applied when someone decides them.
 *
 * A token decision lands in `src/theme/ledger.json` (a projection of the
 * record, kept on disk because the runtime imports it) and re-emits
 * `semantic.css` and `tokens.json`, because a decision that is not in the
 * stylesheet has not been made yet. A deviation writes its comment beside the
 * literal it legalises — the decision and the thing decided are one diff —
 * and the record carries who declared it and why.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { registerHandler, type Applied, type Refused, type Request, type ResolvedContext } from '@strata/substrate/decide'
import type { Decision, DecisionBody } from '@strata/substrate/decision'
import { current } from '@strata/substrate/log'
import { registerProjection, type Imported } from '@strata/substrate/projection'
import { generateTheme, OBSIDIAN } from './generateTheme'
import { FALLBACKS, type Ledger, type TokenDecision, type TokenStatus } from './ledger'
import { emitTokens, readLedger, writeLedger, LEDGER_PATH } from './emit'

export type TokenRequest = Request & { kind: 'token'; token: string; action: 'propose' | 'keep' | 'cut' }
export type DeviationRequest = Request & { kind: 'deviation'; file: string; line: number; value?: string }

const STATUS: Record<TokenRequest['action'], TokenStatus> = { propose: 'proposed', keep: 'kept', cut: 'cut' }

/** Raw colour, as the evaluator also reads it: hex, oklch(), rgb()/rgba(), hsl()/hsla(). */
export const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\boklch\([^)]*\)|\brgba?\([^)]*\)|\bhsla?\([^)]*\)/

export function registerTheme(home: { root: string }): void {
  registerHandler<TokenRequest>('token', (req, ctx) => tokenHandler(req, ctx, home.root))
  registerHandler<DeviationRequest>('deviation', (req, ctx) => deviationHandler(req, ctx, home.root))
  registerProjection({ name: LEDGER_PATH, import: importLedger, project: projectTheme })
}

const ACTION: Record<TokenStatus, TokenRequest['action']> = { proposed: 'propose', kept: 'keep', cut: 'cut' }

/** When the ledger was last committed — the honest time for a decision nobody stamped. */
function ledgerTime(root: string): string {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', LEDGER_PATH], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    if (out) return new Date(out).toISOString()
  } catch {
    /* not a repo, or the file is untracked */
  }
  return statSync(join(root, LEDGER_PATH)).mtime.toISOString()
}

/** Every decided line in the old ledger, as the decision that would have written it. Proposed lines are the engine's, not anyone's. */
function importLedger(root: string): Imported[] {
  if (!existsSync(join(root, LEDGER_PATH))) return []
  const at = ledgerTime(root)
  return Object.entries(readLedger(root).tokens)
    .filter(([, d]) => d.status !== 'proposed')
    .map(([token, d]) => ({
      kind: 'token' as const,
      token,
      action: ACTION[d.status],
      by: d.by ?? 'human',
      at,
      ...(d.reason ? { reason: d.reason } : {}),
      ...(d.status === 'cut' ? { consequence: { collapsesTo: FALLBACKS[token]?.to } } : {}),
    }))
}

/** The ledger the record says, and the two files the engine emits through it. */
function projectTheme(root: string, log: readonly Decision[]): Record<string, string> {
  const now = current(log)
  const tokens: Record<string, TokenDecision> = {}
  for (const name of Object.keys(generateTheme(OBSIDIAN))) {
    const d = now.get(`token:${name}`)
    tokens[name] = d && d.kind === 'token' ? { status: STATUS[d.action], by: d.by, ...(d.reason ? { reason: d.reason } : {}), id: d.id } : { status: 'proposed' }
  }
  const ledger: Ledger = { ...readLedger(root), tokens }
  return emitTokens(root, { dryRun: true, ledger }).files
}

function tokenHandler(req: TokenRequest, ctx: ResolvedContext, root: string): Applied | Refused {
  const engine = generateTheme(OBSIDIAN)
  if (typeof req.token !== 'string' || !req.token.startsWith('--')) return { refused: 'a token is a custom property name, like --accent-strong' }
  if (!(req.token in engine)) return { refused: `the engine does not emit ${req.token}. It emits:\n    ${Object.keys(engine).join('\n    ')}` }
  const status = STATUS[req.action]
  if (!status) return { refused: `a token is proposed, kept or cut — not "${String(req.action)}"` }

  const ledger = readLedger(root)
  const prior = ledger.tokens[req.token]
  const body: DecisionBody = { kind: 'token', token: req.token, action: req.action }
  const landing = () => (status === 'cut' ? { collapsesTo: FALLBACKS[req.token]?.to } : {})
  if (prior && prior.status === status && (req.reason === undefined || prior.reason === req.reason)) return { body, unchanged: true, consequence: landing() }

  const next = {
    ...ledger,
    tokens: { ...ledger.tokens, [req.token]: { status, by: ctx.by, ...(req.reason ? { reason: req.reason } : {}), id: ctx.id } },
  }
  if (!ctx.dryRun) writeLedger(root, next)
  const emitted = emitTokens(root, { dryRun: ctx.dryRun })
  const receipt = emitted.receipts.find((r) => r.token === req.token)
  return {
    body,
    consequence: status === 'cut' ? { collapsesTo: receipt?.to ?? FALLBACKS[req.token]?.to } : {},
    written: emitted.written,
  }
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
