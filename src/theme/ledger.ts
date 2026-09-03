/**
 * THE TOKEN LEDGER — every generated token is a proposal; people keep or cut.
 *
 * The engine emits thirty-odd semantic tokens from six seeds. Until now the only
 * switches at that level were the deviation comment (let a raw value in) and
 * the acceptance (let a cost stand). This is the third: a decision per token.
 * `src/theme/ledger.json` is the record — the engine adds a `proposed` line for
 * every token it emits, and a person or an agent turns each into `kept` or
 * `cut`, with a reason and a name. `npm run tokens` never edits a decision.
 *
 * A cut token does not disappear. Fourteen sites in `strata.css` say
 * `var(--accent-strong)`; if the property simply stopped existing, every one
 * of them would go invalid at computed-value time — a cost paid at the consumer,
 * silently, invisible in the diff. That is the behaviour this repo calls the
 * worst available. So a cut token *collapses*: it is emitted as its fallback
 * (`--accent-strong: var(--accent)`), the decision is written where the token
 * is defined, `tokens.json` says `cut` so an agent reads a decision rather than
 * a missing name, and the validator counts the consumers as telemetry.
 *
 * Decisions live in the ledger. What a token collapses *to* lives here, next to
 * the engine, because that is derivation knowledge and the engine is the only
 * author of the semantic tier. The table is total over the engine's output and
 * acyclic; a test says so.
 */

export type TokenStatus = 'proposed' | 'kept' | 'cut'
export type { Author, Hand } from '@strata/substrate/decision'
import type { Author, Hand } from '@strata/substrate/decision'

export interface TokenDecision {
  status: TokenStatus
  /** Who could have chosen otherwise. */
  decided?: Hand
  /** Whose hand ran the command. */
  written?: Hand
  reason?: string
  /** The decision in `.strata/decisions.jsonl` that set this line. The ledger is a projection of the record. */
  id?: string
}

export interface Ledger {
  $description?: string
  tokens: Record<string, TokenDecision>
}

export const LEDGER_DESCRIPTION =
  'Every token the engine proposes, and what people decided. The engine adds `proposed` lines (npm run tokens) and never edits a decision; a person or an agent makes each one `kept` or `cut` (npm run ledger -- cut <token> --why "…"). A cut token collapses to its fallback in every projection — semantic.css, tokens.json, the runtime — and every usage is logged by npm run validate. Nothing here is deleted: a stale decision about a token the engine no longer emits is reported, not removed.'

/** What a cut token collapses to, and why that is the honest floor. */
export interface Fallback {
  /** A token name (`--x`), or a CSS literal. */
  to: string
  why: string
}

const t = (to: string, why: string): Fallback => ({ to, why })

export const FALLBACKS: Record<string, Fallback> = {
  /* surfaces — every level collapses toward the page */
  '--surface-page': t('Canvas', 'The root surface. Below it there is only the user agent, which is the honest floor.'),
  '--surface-sunken': t('--surface-page', 'A sunken area that is not distinguished is the page.'),
  '--surface-raised': t('--surface-page', 'A card that does not lift is a region of the page.'),
  '--surface-overlay': t('--surface-raised', 'An overlay without its own level sits at the raised one.'),
  '--surface-veil': t('transparent', 'A veil is a dimming decision; without it the backdrop shows through.'),

  /* ink — muted and faint fall back to full ink, never the other way */
  '--ink': t('CanvasText', 'The root text colour. Below it there is only the user agent.'),
  '--ink-muted': t('--ink', 'Secondary text that is not distinguished is text. Contrast can only improve.'),
  '--ink-faint': t('--ink-muted', 'Tertiary falls to secondary, then to ink; each step is more legible than the last.'),
  '--ink-inverse': t('--surface-page', 'Text on an inverted ground is the colour of the ground it came from.'),

  /* accent — the gate: cut the accent and the colour tier collapses to ink */
  '--accent': t('--ink', 'This is the accent gate, stated here for this repo: without an accent, emphasis is ink. Everything accent-derived follows.'),
  '--accent-strong': t('--accent', 'One filled action per surface; a second strength of accent is the first thing a small system does without.'),
  '--accent-ink': t('--ink-inverse', 'Text on the accent is inverse text; when the accent is ink, that is the page colour, and it still reads.'),
  '--accent-soft': t('transparent', 'A wash is the absence of a fill decision. Falling to a surface would be a new one.'),
  '--accent-line': t('--line-strong', 'A tinted rule is a rule.'),
  '--focus-ring': t('--accent', 'Focus stays visible: the accent, and behind that ink.'),

  /* rules */
  '--line': t('transparent', 'A hairline that is not distinguished is no hairline; layout does not depend on it.'),
  '--line-strong': t('--line', 'A stronger rule without its own weight is the rule.'),

  /* status — introduced here as a gate: status colours collapse to ink, washes to nothing */
  '--positive': t('--ink', 'Status ink without a colour tier is ink; the word carries the meaning, which is the accessible case anyway.'),
  '--warning': t('--ink', 'As positive.'),
  '--danger': t('--ink', 'As positive. Danger is never only a colour.'),
  '--positive-soft': t('transparent', 'A wash is the absence of a fill decision.'),
  '--warning-soft': t('transparent', 'As positive-soft.'),
  '--danger-soft': t('transparent', 'As positive-soft.'),

  /* shadow */
  '--shadow-color': t('transparent', 'No shadow colour is no shadow. The elevation tokens keep their offsets and paint nothing.'),

  /* motion — each duration falls to the next faster, ending at nothing */
  '--motion-slow': t('--motion-base', 'A slow tier that is not distinguished is the base tier.'),
  '--motion-base': t('--motion-fast', 'Base falls to fast.'),
  '--motion-fast': t('--motion-instant', 'Fast falls to instant.'),
  '--motion-instant': t('0ms', 'Below instant there is no motion, which is what reduced-motion already does.'),
  '--motion-ease-emphasis': t('--motion-ease', 'An emphasis curve without its own personality is the ordinary curve.'),
  '--motion-ease': t('ease', 'The user agent’s default curve.'),

  /* rhythm and shape */
  '--density': t('1', 'Unit density: every control and gap at its declared size.'),
  '--radius-overlay': t('--radius-surface', 'An overlay without its own radius rounds like a surface.'),
  '--radius-surface': t('--radius-interactive', 'A surface without its own radius rounds like a control.'),
  '--radius-interactive': t('0', 'No radius. Square is the honest floor for shape.'),
}

const isToken = (v: string) => v.startsWith('--')

/**
 * Cut tokens collapse; everything else passes through. `var` mode emits
 * `var(--fallback)` so the stylesheet keeps following the theme; `value` mode
 * resolves the chain to a concrete string, for contrast receipts and swatches
 * that need a colour rather than a reference.
 */
export function applyLedger(
  tokens: Record<string, string>,
  ledger: Ledger,
  opts: { mode: 'var' | 'value' } = { mode: 'var' },
): { tokens: Record<string, string>; receipts: Array<{ token: string; to: string; decided?: Hand; reason?: string }> } {
  const out: Record<string, string> = {}
  const receipts: ReturnType<typeof applyLedger>['receipts'] = []
  const isCut = (name: string) => ledger.tokens[name]?.status === 'cut'

  /** Follow the fallback chain past every cut token to the first live one. */
  const landing = (name: string, seen = new Set<string>()): string => {
    const fb = FALLBACKS[name]
    if (!fb || seen.has(name)) return name
    seen.add(name)
    if (!isToken(fb.to)) return fb.to
    return isCut(fb.to) ? landing(fb.to, seen) : fb.to
  }

  for (const [name, value] of Object.entries(tokens)) {
    if (!isCut(name) || !FALLBACKS[name]) {
      out[name] = value
      continue
    }
    const to = landing(name)
    const decision = ledger.tokens[name]
    receipts.push({ token: name, to, decided: decision.decided, reason: decision.reason })
    out[name] = !isToken(to) ? to : opts.mode === 'var' ? `var(${to})` : (tokens[to] ?? to)
  }
  return { tokens: out, receipts }
}

/**
 * Bring the ledger up to date with what the engine emits. Adds a `proposed`
 * line for each new token; never edits or removes a decision. Reports entries
 * for tokens the engine no longer emits as stale, because silently dropping a
 * decision someone wrote down would be the worst behaviour available.
 */
export function reconcileLedger(
  engineTokens: string[],
  ledger: Ledger,
): { ledger: Ledger; added: string[]; stale: string[] } {
  const tokens: Record<string, TokenDecision> = { ...ledger.tokens }
  const added: string[] = []
  for (const name of engineTokens)
    if (!tokens[name]) {
      tokens[name] = { status: 'proposed' }
      added.push(name)
    }
  const stale = Object.keys(tokens).filter((name) => !engineTokens.includes(name))
  return {
    ledger: { $description: ledger.$description ?? LEDGER_DESCRIPTION, tokens },
    added,
    stale,
  }
}

export const emptyLedger = (): Ledger => ({ $description: LEDGER_DESCRIPTION, tokens: {} })

/** Counts, for the one line every projection prints. */
export function summarise(ledger: Ledger): Record<TokenStatus, number> {
  const n: Record<TokenStatus, number> = { proposed: 0, kept: 0, cut: 0 }
  for (const d of Object.values(ledger.tokens)) n[d.status]++
  return n
}

/** A token map with the ledger applied — what every consumer should read. */
export const themeTokens = (
  tokens: Record<string, string>,
  ledger: Ledger,
  mode: 'var' | 'value' = 'var',
): Record<string, string> => applyLedger(tokens, ledger, { mode }).tokens
