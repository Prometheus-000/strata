/**
 * LAYER 0 EMITTER — one source, many surfaces.
 * The engine is the single author of the semantic tier. This projects it
 * into the product's stylesheet (`semantic.css`, what components consume) and
 * its contract (`tokens.json`, machine-readable). Neither file is ever edited
 * by hand, and where they live is the product's frame file's to say.
 *
 * Between the engine and the projections sits the ledger, itself a projection
 * of the record: every token the engine emits is a proposal there, and a
 * person or an agent keeps or cuts each one through `decide()`. This adds a
 * `proposed` line for any token the engine has started emitting and never
 * touches a decision. A cut token is projected as its fallback, with the
 * decision written beside it, so the stylesheet says what was decided rather
 * than quietly lacking a name.
 *
 * The seeds the tier is compiled from are the record's: the last retheme, or
 * the last ship that promoted to the system, and the engine's default before
 * either. They were a constant in the engine that `ship` rewrote in place —
 * impossible for a product that installs the engine, and wrong in principle,
 * because a seed decision is source and the constant was a copy of it.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { flipAppearance, generateTheme, OBSIDIAN, PRESETS, ROLES_AGAINST_PRIMITIVES, SEED_RANGE, type ThemeSeeds } from './generateTheme'
import { applyLedger, emptyLedger, fallbacksFor, reconcileLedger, summarise, type Ledger, type TokenStatus } from './ledger'
import { readAll, seedsInForce } from '@strata/substrate/log'
import { current } from '@strata/substrate/fold'
import type { Decision } from '@strata/substrate/decision'
import { handText, type Hand } from '@strata/substrate/decision'
import { loadConfig, tokenPaths } from '@strata/substrate/config'

/** Where this product's token projections live, from its frame file. */
export function themePaths(root: string): { ledger: string; semantic: string; tokens: string; primitives: string } {
  const paths = tokenPaths(loadConfig(root))
  if (!paths) throw new Error('this product keeps its own tokens (`tokens` is null in .strata/config.json), so the theme projection writes nothing here')
  return paths
}

export const readLedger = (root: string): Ledger => {
  const p = join(root, themePaths(root).ledger)
  return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as Ledger) : emptyLedger()
}

export const writeLedger = (root: string, ledger: Ledger) => {
  const p = join(root, themePaths(root).ledger)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, JSON.stringify(ledger, null, 2) + '\n')
}

/** The two grounds of the theme in force: the house, and the same seeds with the appearance flipped. */
export function grounds(seeds: ThemeSeeds): { house: ThemeSeeds; dark: ThemeSeeds; light: ThemeSeeds } {
  const other = flipAppearance(seeds)
  return { house: seeds, dark: seeds.appearance === 'dark' ? seeds : other, light: seeds.appearance === 'light' ? seeds : other }
}

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
 * The roles a hand coined, from the record. The engine derives everything it
 * can from seven numbers; these are the names usage earned that no seed
 * produces, and the record is their source — which is why they arrive here
 * rather than from `generateTheme`.
 */
export function mintedRoles(log: readonly Decision[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const d of current(log).values()) {
    if (d.kind !== 'token' || d.action !== 'mint' || !d.value) continue
    out[d.token] = 'token' in d.value ? `var(${d.value.token})` : d.value.literal
  }
  return out
}

/**
 * Project the engine through the ledger. `dryRun` computes everything and
 * writes nothing; `ledger` projects a ledger that is not on disk yet — the
 * one the record says — instead of reading the file; `log` is the record to
 * read the seeds and the minted roles from, when the caller holds a decision
 * the file does not yet.
 */
export function emitTokens(root: string, opts: { dryRun?: boolean; ledger?: Ledger; log?: readonly Decision[] } = {}): EmitResult {
  const paths = themePaths(root)
  const log = opts.log ?? readAll(root)
  const { house, dark: DARK, light: LIGHT } = grounds(seedsInForce(log, OBSIDIAN))
  const HOUSE = house.appearance
  const minted = mintedRoles(log)
  const fallbacks = fallbacksFor(minted)
  const theme = (seeds: ThemeSeeds) => ({ ...generateTheme(seeds), ...minted })

  // These used to be written out here by hand, which made the emitter a second
  // author of ten semantic roles: they had no origin in the engine, no line in
  // the ledger, and no way to be cut, kept or explained. They are the engine's
  // now, and this only decides where they sit in the file.
  const againstPrimitive = (prop: string) => ROLES_AGAINST_PRIMITIVES.includes(prop) || prop in minted

  // `--surface-pad` is not a colour, whatever its prefix says.
  const isColor = (prop: string) =>
    !againstPrimitive(prop) && /^--(surface|ink|accent|line|focus|positive|warning|danger|shadow-color)/.test(prop)

  /* ---- the ledger: reconcile, never edit a decision ---- */
  const engineTokens = Object.keys(theme(DARK))
  const { ledger, added, stale } = reconcileLedger(engineTokens, opts.ledger ?? readLedger(root))

  const dark = applyLedger(theme(DARK), ledger, { mode: 'var', fallbacks })
  const light = applyLedger(theme(LIGHT), ledger, { mode: 'var', fallbacks })
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
   Do not edit. This file is a projection of the record: the engine,
   compiled from the seeds in force on both grounds — light and dark —
   through the decisions in ${paths.ledger}; a cut token is emitted as
   its fallback, with the decision beside it.
   :root carries the ground the record decided (${HOUSE}).
   Regenerate with: npx strata rebuild
   ============================================================ */

${HOUSE === 'light' ? ':root,\n' : ''}[data-theme='light'] {
  color-scheme: light;
${block(light.tokens, isColor)}
}

${HOUSE === 'dark' ? ':root,\n' : ''}[data-theme='dark'] {
  color-scheme: dark;
${block(dark.tokens, isColor)}
}

:root {
  /* ---- Engine-derived rhythm, motion, shape (house defaults) ---- */
${block((HOUSE === 'light' ? light : dark).tokens, (p) => !isColor(p) && !againstPrimitive(p))}

  /* ---- Roles held against a Tier 1 primitive, and the names usage earned ---- */
${block((HOUSE === 'light' ? light : dark).tokens, againstPrimitive)}
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
    ...(s.lightness !== undefined ? { lightness: s.lightness } : {}),
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
        collapsesTo: fallbacks[p]?.to,
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
      'Strata design tokens — GENERATED from the record by the engine (npx strata rebuild). A theme is seven seeds; every color below is a compiled projection, never a source. Agents: retheme with `npx strata retheme …`, which puts the seeds on the record and regenerates this — never by editing values here. Each token carries its ledger decision under $extensions["strata.ledger"]: a cut token is emitted as its fallback and should not be reached for.',
    strata: {
      themeEngine: {
        $description:
          'The single source of the semantic tier. generateTheme(seeds) derives every color, radius, rhythm and easing in OKLCH. Ranges are clamped by the engine.',
        seeds: {
          $ranges: SEED_RANGE,
          $reasons: {
            hue: 'Accent hue on the OKLCH wheel — perceptually uniform, so any hue yields the same apparent vividness.',
            chroma: 'Muted ↔ electric. 0 is monochrome — the engine’s default — and a monochrome accent compiles to ink, not grey. Light appearances compile at 0.87× and lower lightness to hold AA contrast.',
            warmth: 'Tints ALL neutrals toward paper (85°) or slate (250°). Neutrals are chosen, never default grey; an accent hue never reaches them.',
            energy: 'Motion personality AND shape: kinetic themes snap (spring easing, shorter durations) and round off; calm themes glide and stay architectural.',
            density: 'Scales control heights, paddings and gaps together so rhythm compresses uniformly.',
            lightness: 'Where the ground sits within its appearance: −1 is OLED black or bone, 0 the default ground, +1 charcoal or paper-white. Every surface is a fixed step off the ground, and the accent moves with it to keep its distance. Optional: absent means the default.',
          },
          inForce: seedJson(house),
          compiled: { dark: seedJson(DARK), light: seedJson(LIGHT) },
        },
        presets: Object.fromEntries(Object.entries(PRESETS).map(([k, v]) => [k, seedJson(v)])),
      },
      ledger: {
        $description:
          'Every generated token is a proposal; the ledger records what people decided. proposed = unreviewed, ships as generated. kept = reviewed and wanted. cut = collapses to its fallback everywhere; the fallback is named on the token. Agents: never reach for a cut token; to cut or keep one, run npx strata cut|keep --<token> --why "…".',
        source: paths.ledger,
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

  const files = { [paths.ledger]: JSON.stringify(ledger, null, 2) + '\n', [paths.semantic]: css, [paths.tokens]: JSON.stringify(json, null, 2) + '\n' }
  const written: string[] = []
  if (!opts.dryRun) {
    for (const [file, text] of Object.entries(files)) {
      mkdirSync(dirname(join(root, file)), { recursive: true })
      writeFileSync(join(root, file), text)
      written.push(file)
    }
  }
  return { counts, added, stale, receipts: dark.receipts, files, written }
}
