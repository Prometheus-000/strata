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
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { registerHandler, type Applied, type Refused, type Request, type ResolvedContext } from '@strata/substrate/decide'
import type { DecisionBody } from '@strata/substrate/decision'
import { generateTheme, OBSIDIAN } from './generateTheme'
import { FALLBACKS, type TokenStatus } from './ledger'
import { emitTokens, readLedger, writeLedger } from './emit'

export type TokenRequest = Request & { kind: 'token'; token: string; action: 'propose' | 'keep' | 'cut' }
export type DeviationRequest = Request & { kind: 'deviation'; file: string; line: number; value?: string }

const STATUS: Record<TokenRequest['action'], TokenStatus> = { propose: 'proposed', keep: 'kept', cut: 'cut' }

/** Raw colour, as the evaluator also reads it: hex, oklch(), rgb()/rgba(), hsl()/hsla(). */
export const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\boklch\([^)]*\)|\brgba?\([^)]*\)|\bhsla?\([^)]*\)/

export function registerTheme(home: { root: string }): void {
  registerHandler<TokenRequest>('token', (req, ctx) => tokenHandler(req, ctx, home.root))
  registerHandler<DeviationRequest>('deviation', (req, ctx) => deviationHandler(req, ctx, home.root))
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
