# STRATA

**A design system for AI product teams — built the way generative products work.**
Six seeds, one deterministic derivation, endless coherent variation.

Strata is an adaptive, AI-native design system concept. Its core bet: a theme should not be a
stylesheet a team hand-tunes for weeks — it should be a small set of *seeds* from which the entire
visual system is derived, deterministically, in perceptually uniform color space. Humans turn the
dials; agents write the numbers; both speak the same contract.

## The three principles

1. **Adaptive by default** — nothing is hardcoded. Every surface, stroke, shadow, radius and
   duration derives from the semantic token tier. Retune the seeds and the whole product follows.
2. **Generative variation** — five dials (`hue`, `chroma`, `warmth`, `energy`, `density`) plus an
   appearance switch redraw the system in OKLCH, so generated themes stay coherent at any hue.
3. **Built for co-creation** — the system documents itself twice: prose for people (this file, the
   showcase site) and `src/tokens/tokens.json` for machines. An agent rethemes a product by
   emitting a new seed set — never by editing CSS.

## Architecture — a grammar, not a library

Strata separates the three things a design system bundles at its peril — meaning, behavior,
and expression — because they have wildly different half-lives, and governing all three at
the speed of the slowest is how systems become cages. Each layer gets its own governance:

```
LAYER 0  MEANING      src/theme/generateTheme.ts   ← the ONLY author
         strict · machine-verified · never forked
         projections: src/tokens/semantic.css + tokens.json  (npm run tokens)

LAYER 1  BEHAVIOR     src/behavior/                (useTabs, useDialog, …)
         shared · never forked — correctness is not a taste question

LAYER 2  RECIPES      src/components/              (12 styled compositions of 0+1)
         forkable by default — copy the source, keep the token + behavior imports

LAYER 3  LOCAL        your feature code
         free · no permission required · validator still enforces Layer 0
                └─► promotion: earned by appearing in ~3 features, never granted

MACHINE  npm run tokens (regenerate projections) · npm run validate (catch drift at
         the diff; declared deviations are legal and logged) · tokens.json (agent contract)
```

```
src/
├── tokens/      # GENERATED projections — never edit; npm run tokens
├── theme/       # generateTheme.ts (the engine) + ThemeContext.tsx
├── behavior/    # Layer 1 headless primitives
├── components/  # Layer 2 recipes + strata.css
└── site/        # The showcase — hero, foundations, gallery, Theme Lab
```

**The rule that makes it a system:** recipes never reference a raw value — they speak the
semantic tier, and the semantic tier has exactly one author, the engine. `npm run validate`
fails undeclared color literals; a `// deviation: <reason>` comment makes drift legal and
logged. See [GRAMMAR.md](GRAMMAR.md) for every rule *with its reason*.

## A theme is six numbers

```json
{
  "hue": 168,
  "chroma": 0.155,
  "warmth": 0,
  "energy": 0.5,
  "density": 1,
  "appearance": "dark"
}
```

- `hue` (0–360) — accent hue on the OKLCH wheel.
- `chroma` (0–0.25) — muted ↔ electric.
- `warmth` (−1–1) — tints all neutrals: cool slate ↔ warm paper.
- `energy` (0–1) — motion personality: calm glides ↔ kinetic springs; also rounds corners.
- `density` (0.85–1.15) — compact ↔ airy controls, paddings and gaps.
- `appearance` — `dark` | `light`; light appearances automatically deepen accents to hold contrast.

Six presets ship in `src/theme/generateTheme.ts`: Obsidian, Gallery, Ember, Ultraviolet, Meadow,
Glacier.

## For agents

You are welcome here. To retheme a product built on Strata:

1. Read `src/tokens/tokens.json` → `strata.themeEngine` for the seed ranges *and the reasons
   behind each dial* — generate from the reasoning, not just the ranges.
2. Emit a new seed object (stay inside the ranges; the engine clamps anyway).
3. Apply it with `applyTheme(seeds)` from `src/theme/generateTheme.ts`, or change the
   presets and run `npm run tokens` to recompile the projections.

Build new UI in Layer 3 (your feature) by default — no permission required; run
`npm run validate` before committing. Never edit `src/tokens/*` by hand: both files are
generated. Promotion into `src/components/` is a deliberate act, earned by reuse.

## Run it

```bash
npm install
npm run dev
```

Then open the Theme Lab and drag something.

## Type voice

- Display: **Fraunces** (optical sizing on) — editorial warmth.
- Body: **Instrument Sans** — quiet, contemporary.
- Data: **IBM Plex Mono** — the voice of tokens and seeds.
