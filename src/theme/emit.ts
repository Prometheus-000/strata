/**
 * LAYER 0 EMITTER — one source, many surfaces.
 * `generateTheme.ts` is the single author of the semantic tier. This projects
 * it into `src/tokens/semantic.css` (the stylesheet components consume) and
 * `src/tokens/tokens.json` (the machine-readable contract). Neither file is
 * ever edited by hand.
 *
 * Between the engine and the projections sits the ledger,
 * `src/theme/ledger.json`, itself a projection of the record: every token the
 * engine emits is a proposal there, and a person or an agent keeps or cuts
 * each one through `decide()`. This adds a `proposed` line for any token the
 * engine has started emitting and never touches a decision. A cut token is
 * projected as its fallback, with the decision written beside it, so the
 * stylesheet says what was decided rather than quietly lacking a name.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { generateTheme, OBSIDIAN, PRESETS, type ThemeSeeds } from './generateTheme'
import { applyLedger, emptyLedger, FALLBACKS, reconcileLedger, summarise, type Ledger, type TokenStatus } from './ledger'
import { handText, type Hand } from '@strata/substrate/decision'

export const LEDGER_PATH = 'src/theme/ledger.json'
export const SEMANTIC_PATH = 'src/tokens/semantic.css'
export const TOKENS_PATH = 'src/tokens/tokens.json'

export const readLedger = (root: string): Ledger =>
  existsSync(join(root, LEDGER_PATH)) ? (JSON.parse(readFileSync(join(root, LEDGER_PATH), 'utf8')) as Ledger) : emptyLedger()

export const writeLedger = (root: string, ledger: Ledger) => writeFileSync(join(root, LEDGER_PATH), JSON.stringify(ledger, null, 2) + '\n')

export interface EmitResult {
  counts: Record<TokenStatus, number>
  added: string[]
  stale: string[]
  receipts: Array<{ token: string; to: string; decided?: Hand; reason?: string }>
  /** The projections, as text, so a check can compare them with what is on disk. */
  files: Record<string, string>
  written: string[]
}

/**
 * Project the engine through the ledger. `dryRun` computes everything and
 * writes nothing; `ledger` projects a ledger that is not on disk yet — the
 * one the record says — instead of reading the file.
 */
export function emitTokens(root: string, opts: { dryRun?: boolean; ledger?: Ledger } = {}): EmitResult {

  const DARK = OBSIDIAN
  const LIGHT = PRESETS.Gallery

  const isColor = (prop: string) =>
    /^--(surface|ink|accent|line|focus|positive|warning|danger|shadow-color)/.test(prop)

  /* ---- the ledger: reconcile, never edit a decision ---- */
  const engineTokens = Object.keys(generateTheme(DARK))
  const { ledger, added, stale } = reconcileLedger(engineTokens, opts.ledger ?? readLedger(root))

  const dark = applyLedger(generateTheme(DARK), ledger)
  const light = applyLedger(generateTheme(LIGHT), ledger)
  const cutNote = new Map(dark.receipts.map((r) => [r.token, r]))

  /** A declaration, with the decision beside it when the token was cut. */
  const decl = (p: string, v: string, indent = '  ') => {
    const cut = cutNote.get(p)
    const note = cut ? ` /* cut by ${cut.decided ? handText(cut.decided) : 'an unnamed hand'}${cut.reason ? `: ${cut.reason}` : ''} */` : ''
    return `${indent}${p}: ${v};${note}`
  }

  const block = (tokens: Record<string, string>, filter: (p: string) => boolean, indent = '  ') =>
    Object.entries(tokens)
      .filter(([p]) => filter(p))
      .map(([p, v]) => decl(p, v, indent))
      .join('\n')

  const css = `/* ============================================================
   STRATA · TIER 2 — SEMANTIC ROLES · GENERATED FILE
   Do not edit. This file is a projection of src/theme/generateTheme.ts
   compiled from the Obsidian (dark) and Gallery (light) seed sets,
   through the decisions in src/theme/ledger.json — a cut token is
   emitted as its fallback, with the decision beside it.
   Regenerate with: npm run tokens
   ============================================================ */

:root,
[data-theme='dark'] {
  color-scheme: dark;
${block(dark.tokens, isColor)}
}

[data-theme='light'] {
  color-scheme: light;
${block(light.tokens, isColor)}
}

:root {
  /* ---- Engine-derived rhythm, motion, shape (Obsidian defaults) ---- */
${block(dark.tokens, (p) => !isColor(p))}

  /* ---- Static roles (not seed-derived) ---- */
  --radius-pill: var(--strata-radius-round);

  --control-h-sm: calc(2rem * var(--density));
  --control-h-md: calc(2.5rem * var(--density));
  --control-h-lg: calc(3rem * var(--density));
  --control-pad-x: calc(var(--strata-space-4) * var(--density));
  --surface-pad: calc(var(--strata-space-5) * var(--density));
  --stack-gap: calc(var(--strata-space-4) * var(--density));

  --font-display: var(--strata-font-display);
  --font-body: var(--strata-font-body);
  --font-mono: var(--strata-font-mono);

  --shadow-raised: var(--strata-shadow-1) var(--shadow-color);
  --shadow-floating: var(--strata-shadow-2) var(--shadow-color);
  --shadow-overlay: var(--strata-shadow-3) var(--shadow-color);
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --motion-instant: 0ms;
    --motion-fast: 0ms;
    --motion-base: 0ms;
    --motion-slow: 0ms;
  }
}
`

  const seedJson = (s: ThemeSeeds) => ({
    hue: s.hue,
    chroma: s.chroma,
    warmth: s.warmth,
    energy: s.energy,
    density: s.density,
    appearance: s.appearance,
  })

  /** The decision, as an extension on every token so an agent reads it where it reads the value. */
  const decision = (p: string) => {
    const d = ledger.tokens[p] ?? { status: 'proposed' as const }
    const cut = cutNote.get(p)
    return {
      'strata.ledger': {
        status: d.status,
        ...(d.decided ? { decided: d.decided } : {}),
        ...(d.written ? { written: d.written } : {}),
        ...(d.reason ? { reason: d.reason } : {}),
        ...(cut ? { fallback: cut.to } : {}),
        collapsesTo: FALLBACKS[p]?.to,
      },
    }
  }

  const colorGroup = (tokens: Record<string, string>) =>
    Object.fromEntries(
      Object.entries(tokens)
        .filter(([p]) => isColor(p))
        .map(([p, v]) => [p.slice(2), { $value: v, $type: 'color', $extensions: decision(p) }]),
    )

  const counts = summarise(ledger)

  const json = {
    $schema: 'https://design-tokens.github.io/community-group/format/',
    $description:
      'Strata design tokens — GENERATED from src/theme/generateTheme.ts (npm run tokens). A theme is six seeds; every color below is a compiled projection, never a source. Agents: retheme by writing seeds and regenerating — never by editing values here. Each token carries its ledger decision under $extensions["strata.ledger"]: a cut token is emitted as its fallback and should not be reached for.',
    strata: {
      themeEngine: {
        $description:
          'The single source of the semantic tier. generateTheme(seeds) derives every color, radius, rhythm and easing in OKLCH. Ranges are clamped by the engine.',
        seeds: {
          $ranges: { hue: [0, 360], chroma: [0, 0.25], warmth: [-1, 1], energy: [0, 1], density: [0.85, 1.15] },
          $reasons: {
            hue: 'Accent hue on the OKLCH wheel — perceptually uniform, so any hue yields the same apparent vividness.',
            chroma: 'Muted ↔ electric. 0 is monochrome — the house default — and a monochrome accent compiles to ink, not grey. Light appearances compile at 0.87× and lower lightness to hold AA contrast.',
            warmth: 'Tints ALL neutrals toward paper (95°) or slate (260°). Neutrals are chosen, never default grey; an accent hue never reaches them.',
            energy: 'Motion personality AND shape: kinetic themes snap (spring easing, shorter durations) and round off; calm themes glide and stay architectural.',
            density: 'Scales control heights, paddings and gaps together so rhythm compresses uniformly.',
          },
          compiled: { dark: seedJson(DARK), light: seedJson(LIGHT) },
        },
        presets: Object.fromEntries(Object.entries(PRESETS).map(([k, v]) => [k, seedJson(v)])),
      },
      ledger: {
        $description:
          'Every generated token is a proposal; src/theme/ledger.json records what people decided. proposed = unreviewed, ships as generated. kept = reviewed and wanted. cut = collapses to its fallback everywhere; the fallback is named on the token. Agents: never reach for a cut token; to cut or keep one, run npm run ledger -- cut|keep <token> --why "…".',
        source: LEDGER_PATH,
        counts,
        cut: dark.receipts.map((r) => ({ token: r.token, fallback: r.to, decided: r.decided, reason: r.reason })),
      },
      font: {
        display: { $value: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Inter, system-ui, sans-serif", $type: 'fontFamily' },
        body: { $value: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Inter, system-ui, sans-serif", $type: 'fontFamily' },
        mono: { $value: "ui-monospace, 'SF Mono', 'Roboto Mono', Menlo, Consolas, monospace", $type: 'fontFamily' },
      },
      color: {
        $description: 'Compiled projections of the seed sets above. Semantic names only — components never see a literal.',
        dark: colorGroup(dark.tokens),
        light: colorGroup(light.tokens),
      },
      rhythm: Object.fromEntries(
        Object.entries(dark.tokens)
          .filter(([p]) => !isColor(p))
          .map(([p, v]) => [p.slice(2), { $value: v, $extensions: decision(p) }]),
      ),
    },
  }

  const files = { [LEDGER_PATH]: JSON.stringify(ledger, null, 2) + '\n', [SEMANTIC_PATH]: css, [TOKENS_PATH]: JSON.stringify(json, null, 2) + '\n' }
  const written: string[] = []
  if (!opts.dryRun) {
    for (const [file, text] of Object.entries(files)) {
      writeFileSync(join(root, file), text)
      written.push(file)
    }
  }
  return { counts, added, stale, receipts: dark.receipts, files, written }
}
