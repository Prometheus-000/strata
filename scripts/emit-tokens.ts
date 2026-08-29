/**
 * LAYER 0 EMITTER — one source, many surfaces.
 * `src/theme/generateTheme.ts` is the single author of the semantic tier.
 * This script projects it into:
 *   - src/tokens/semantic.css  (the stylesheet components consume)
 *   - src/tokens/tokens.json   (the machine-readable contract)
 * Neither file is ever edited by hand. `npm run tokens` regenerates both.
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { generateTheme, OBSIDIAN, PRESETS, type ThemeSeeds } from '../src/theme/generateTheme'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const DARK = OBSIDIAN
const LIGHT = PRESETS.Gallery

const isColor = (prop: string) =>
  /^--(surface|ink|accent|line|focus|positive|warning|danger|shadow-color)/.test(prop)

const block = (tokens: Record<string, string>, filter: (p: string) => boolean, indent = '  ') =>
  Object.entries(tokens)
    .filter(([p]) => filter(p))
    .map(([p, v]) => `${indent}${p}: ${v};`)
    .join('\n')

const dark = generateTheme(DARK)
const light = generateTheme(LIGHT)

const css = `/* ============================================================
   STRATA · TIER 2 — SEMANTIC ROLES · GENERATED FILE
   Do not edit. This file is a projection of src/theme/generateTheme.ts
   compiled from the Obsidian (dark) and Gallery (light) seed sets.
   Regenerate with: npm run tokens
   ============================================================ */

:root,
[data-theme='dark'] {
  color-scheme: dark;
${block(dark, isColor)}
}

[data-theme='light'] {
  color-scheme: light;
${block(light, isColor)}
}

:root {
  /* ---- Engine-derived rhythm, motion, shape (Obsidian defaults) ---- */
${block(dark, (p) => !isColor(p))}

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

const colorGroup = (tokens: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(tokens)
      .filter(([p]) => isColor(p))
      .map(([p, v]) => [p.slice(2), { $value: v, $type: 'color' }]),
  )

const json = {
  $schema: 'https://design-tokens.github.io/community-group/format/',
  $description:
    'Strata design tokens — GENERATED from src/theme/generateTheme.ts (npm run tokens). A theme is six seeds; every color below is a compiled projection, never a source. Agents: retheme by writing seeds and regenerating — never by editing values here.',
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
    font: {
      display: { $value: "Fraunces, 'Iowan Old Style', Georgia, serif", $type: 'fontFamily' },
      body: { $value: "'Instrument Sans', 'Helvetica Neue', Arial, sans-serif", $type: 'fontFamily' },
      mono: { $value: "'IBM Plex Mono', 'SF Mono', Menlo, monospace", $type: 'fontFamily' },
    },
    color: {
      $description: 'Compiled projections of the seed sets above. Semantic names only — components never see a literal.',
      dark: colorGroup(dark),
      light: colorGroup(light),
    },
    rhythm: Object.fromEntries(
      Object.entries(dark)
        .filter(([p]) => !isColor(p))
        .map(([p, v]) => [p.slice(2), { $value: v }]),
    ),
  },
}

writeFileSync(join(root, 'src/tokens/semantic.css'), css)
writeFileSync(join(root, 'src/tokens/tokens.json'), JSON.stringify(json, null, 2) + '\n')
console.log('emitted src/tokens/semantic.css and src/tokens/tokens.json from generateTheme.ts')
