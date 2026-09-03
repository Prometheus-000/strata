/**
 * LAYER 0 EMITTER — one source, many surfaces.
 * `src/theme/generateTheme.ts` is the single author of the semantic tier.
 * This script projects it into:
 *   - src/tokens/semantic.css  (the stylesheet components consume)
 *   - src/tokens/tokens.json   (the machine-readable contract)
 * Neither file is ever edited by hand. `npm run tokens` regenerates both.
 *
 * Between the engine and the projections sits the ledger,
 * `src/theme/ledger.json`: every token the engine emits is a proposal there,
 * and a person or an agent keeps or cuts each one. This script adds a
 * `proposed` line for any token the engine has started emitting and never
 * touches a decision. A cut token is projected as its fallback, with the
 * decision written beside it, so the stylesheet says what was decided rather
 * than quietly lacking a name.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { generateTheme, OBSIDIAN, PRESETS, type ThemeSeeds } from '../src/theme/generateTheme'
import {
  applyLedger,
  emptyLedger,
  FALLBACKS,
  reconcileLedger,
  summarise,
  type Ledger,
} from '../src/theme/ledger'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
export const LEDGER_PATH = 'src/theme/ledger.json'

const DARK = OBSIDIAN
const LIGHT = PRESETS.Gallery

const isColor = (prop: string) =>
  /^--(surface|ink|accent|line|focus|positive|warning|danger|shadow-color)/.test(prop)

/* ---- the ledger: reconcile, never edit a decision ---- */
const ledgerFile = join(root, LEDGER_PATH)
const before: Ledger = existsSync(ledgerFile)
  ? (JSON.parse(readFileSync(ledgerFile, 'utf8')) as Ledger)
  : emptyLedger()
const engineTokens = Object.keys(generateTheme(DARK))
const { ledger, added, stale } = reconcileLedger(engineTokens, before)
writeFileSync(ledgerFile, JSON.stringify(ledger, null, 2) + '\n')

const dark = applyLedger(generateTheme(DARK), ledger)
const light = applyLedger(generateTheme(LIGHT), ledger)
const cutNote = new Map(dark.receipts.map((r) => [r.token, r]))

/** A declaration, with the decision beside it when the token was cut. */
const decl = (p: string, v: string, indent = '  ') => {
  const cut = cutNote.get(p)
  const note = cut ? ` /* cut by ${cut.by ?? 'human'}${cut.reason ? `: ${cut.reason}` : ''} */` : ''
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
      ...(d.by ? { by: d.by } : {}),
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
          chroma: 'Muted ↔ electric. Light appearances compile at 0.87× and lower lightness to hold AA contrast.',
          warmth: 'Tints ALL neutrals toward paper (95°) or slate (245°). Neutrals are chosen, never default grey.',
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
      cut: dark.receipts.map((r) => ({ token: r.token, fallback: r.to, by: r.by, reason: r.reason })),
    },
    font: {
      display: { $value: "Fraunces, 'Iowan Old Style', Georgia, serif", $type: 'fontFamily' },
      body: { $value: "'Instrument Sans', 'Helvetica Neue', Arial, sans-serif", $type: 'fontFamily' },
      mono: { $value: "'IBM Plex Mono', 'SF Mono', Menlo, monospace", $type: 'fontFamily' },
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

writeFileSync(join(root, 'src/tokens/semantic.css'), css)
writeFileSync(join(root, 'src/tokens/tokens.json'), JSON.stringify(json, null, 2) + '\n')
console.log('emitted src/tokens/semantic.css and src/tokens/tokens.json from generateTheme.ts')
console.log(
  `ledger: ${counts.kept} kept · ${counts.cut} cut · ${counts.proposed} proposed (unreviewed — ship as generated)`,
)
for (const name of added) console.log(`  + ${name} proposed`)
for (const r of dark.receipts)
  console.log(`  ✂ ${r.token} → ${r.to}  (${r.by ?? 'human'}${r.reason ? `: ${r.reason}` : ''})`)
for (const name of stale)
  console.log(`  ~ ${name} is in the ledger but the engine no longer emits it — a decision about nothing; remove it by hand`)
