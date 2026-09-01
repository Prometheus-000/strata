# Strata

**A design system that is generated, then governed — by the people who use it
and the agents that work beside them.**

A design system used to be a library: a stylesheet somebody hand-tuned, a
component set somebody maintained, and a review gate that turned "no" into a
process. It gave nothing back to the designer, it belonged to one platform,
and it assumed the only author was a human with a text box.

Strata is an attempt at the next thing. The whole system is derived from a
small, typed record — six numbers, a list of bands, a placement line — and
everything derived from that record is a projection you can throw away and
regenerate. Humans turn dials and drag things; agents read reasons and write
numbers; every change carries its author; and nothing, anywhere, is blocked.

> The record is what people decided. Everything else is a receipt.

**See it:** [prometheus-000.github.io/strata](https://prometheus-000.github.io/strata/)
is the hub — the showcase and Theme Lab, with the
[personalizer](https://prometheus-000.github.io/strata/personalize.html), the
[slot layer](https://prometheus-000.github.io/strata/slots.html) and the
[malleable layer](https://prometheus-000.github.io/strata/malleable.html) one
click away. The static site cannot write back to source; the two harnesses fall
back to your browser's storage there, and write through only on the dev server.

## What it gives back

**Creativity, to the designer.** Nothing here refuses. A drag lands where it
was aimed; a raw value ships if you declare it; a one-off in your feature needs
no permission. What the system does instead is *name the cost* at the moment of
the decision and write it into the diff, where it can be counted. Report, do
not police — nobody designs from inside a system that is waiting for them to
comply.

**Portability, to the product.** The record is data, not code. A theme is six
numbers that fit in a URL hash. A view's structure is a band list. A placement
is one line in source. CSS, `tokens.json`, a Figma library, a React provider
are projections of that data, and a projection is replaceable the day something
serves the product better. The engine imports no framework; React does not
appear until the runtime layer.

**Provenance, to the partnership.** Every override and every placement carries
`author: 'human' | 'agent'`, present and written from day one, before any agent
could write. The theme compiler itemises a receipt per word so a derivation is
inspectable rather than trusted. The grammar ships every rule with the incident
that earned it, because an agent with reasons generates novel-but-coherent
work and an agent with a component list generates collage.

## How it works

### A theme is six numbers

```json
{ "hue": 250, "chroma": 0.01, "warmth": -0.6, "energy": 0.35, "density": 1, "appearance": "dark" }
```

From those seeds the engine (`src/theme/generateTheme.ts`) derives every
colour, surface, stroke, radius, rhythm and easing, deterministically, in
perceptually uniform OKLCH. `warmth` tints every neutral so no grey is
unconsidered; `energy` buys shape as well as speed; a light appearance is not
inverted dark, it deepens accents to hold AA on paper. Retune a seed and the
whole product follows. The engine is the *only* author of the semantic tier:
`src/tokens/` is generated and never edited, because the first week of this
repo produced drift by transcription that nobody had chosen.

### Layers factored by half-life

Meaning, behaviour and expression change at wildly different rates, and
governing all three at the speed of the slowest is how a system becomes a cage.
So each layer gets its own governance:

| Layer | Holds | Governance |
| --- | --- | --- |
| 0 · Meaning | semantic tokens, derived by the engine | strict · one author · never forked |
| 1 · Behaviour | focus order, keyboard, dismissal, ARIA | shared · never forked — correctness is not a taste question |
| 2 · Recipes | styled compositions of 0 + 1 | forkable by default — copy the source, keep the imports |
| 3 · Local | your feature code | free · no permission · promotion earned by reuse |

The rule that makes it a system: a recipe never references a raw value. It
speaks the semantic vocabulary, and the vocabulary has one author.

### Grammar and tokens come from the environment; people decide what stays

Strata does not ask anyone to author a token set or a layout schema from a
blank page. It reads what is already there and proposes:

- **Prose → seeds.** "quiet warm library at 3am" compiles to a seed set, with a
  receipt per word (`library → energy 0.2, warmth +0.4`). Fragments are the
  expected input, out of order and self-correcting. The phrase is the record;
  the seeds are its receipt.
- **An image → seeds.** Drop a picture; its dominant hue, mean lightness and
  neutral cast become accent, appearance and warmth.
- **Source → manifest.** A codemod walks the real views, stamps stable identity
  on features and styled nodes, and reads each node's base values out of the
  stylesheet it actually uses. A preview of a mock is a mock.
- **Archetype → grammar.** `slots new checkout --from document` writes a slot
  grammar you *delete from*, and `slots grammar` prints how much free movement
  each feature has under it. Nothing validates against an archetype.

What is generated is then reviewed, edited, kept or cut by a person, and the
system is arranged so that each of those is a gesture, not a form:

| Gesture | Where |
| --- | --- |
| **Review** | the receipt beside every compiled word; the contrast receipts printed on every regeneration; the resolver's chain, which shows every candidate value and why it lost |
| **Edit** | the dials; a drag; the promote control that asks one question, *how far does this go*, in four words |
| **Enable** | `deviation: <reason>` makes a raw value legal and logged; `accepted:` on a placement records that a cost was seen and chosen |
| **Disable** | the accent gate, below which the whole colour tier collapses to ink; delete a band from an archetype and the positions it generated are gone |

### Deviation is telemetry

The validator fails an undeclared literal and *logs* a declared one. The
malleable layer's drift report groups every un-promoted override by shape and
counts it:

```
UNRESOLVED DRIFT — ships as-is, decided later
    9 × padding = 12px  (drifted)
        7 instances + 2 views · Card.root, Badge.pill
        9 appearances — promotion candidate
by author: 11 human · 0 agent
```

One is taste. Nine of the same shape is a missing token, and the report is
where that becomes visible. Promotion into the system is earned by count,
never granted by proposal — which keeps the inventory small because everything
in it was proven necessary. Un-promoted overrides are never cleaned up on ship:
someone made those decisions on purpose, and dropping them silently would be
the worst behaviour available.

### Structure has an author too

Property-level styling is governed by the engine. Structure had no equivalent
author: a designer who knows the filters belong above the grid had to write a
prompt, or a ticket, and wait. The slot layer fixes that. A view declares its
*bands*, each band carries a behaviour contract (focus phase, dismissal), and
the bands enumerate every legal position in advance. A feature moves by being
dragged into one.

```ts
'gallery.preset-grid': { slot: 'body/1', order: 3, by: 'human', open: ['sole-focus'] },
```

That line is the whole review. `by` is the author. `open` is a behavioural cost
the move incurred — a feature that owns its arrow keys now shares a slot — and
it is written on the same line as the slot, so moving the feature moves the
question with it and an old acceptance can never travel quietly into a new
place. **No move is ever blocked. No cost is ever incurred silently.** Both are
tested by search over every legal target, and a third test checks that the
resolver's source contains no refusal path at all.

## Governance is co-authored

The governing artefacts of this system are written by both parties, in the
same files, and read by both:

- **The grammar** (`GRAMMAR.md`, and one per library) is rules with reasons.
  A human writes the incident — the stylesheet with thirty-four accidental
  white alphas, the muted ink that passed on the background and failed on the
  menu it sat on — and an agent generates from the reasoning rather than the
  rule. The credo applies to itself: four philosophies were candidates and it
  kept two.
- **`tokens.json`** is the agent contract: seeds, ranges, and the *reason* for
  each dial alongside the compiled values. An agent rethemes a product by
  emitting a new seed set, never by editing CSS.
- **Deviations, open items and acceptances** live in source, next to the thing
  they describe, and lint recomputes them in both directions so a stale record
  announces itself.
- **The loop has a division of labour.** An agent generates the screen, because
  something must exist before it can be moved. The designer moves features,
  because choosing among enumerated positions needs a hand, not a prompt. The
  agent reviews, because separating *broken* from *costly* is judgement — and
  calling a deliberate cost "broken" is how a designer stops believing the
  tool. Pressing *ready for review* withholds nothing; the moves are already in
  source.

The `author` field is the hinge. Nothing writes `'agent'` yet — agent
authorship of overrides and placements is deliberately out of scope for the
first versions — but the column exists, is written, is read and is grouped by,
so provenance never has to be retrofitted. When agents do write, the drift
report already knows how to say *by author: 7 human · 4 agent*.

## What is here

```
src/theme/         the engine, the prose compiler, the image sampler, a React provider
src/tokens/        GENERATED projections — semantic.css, tokens.json; never edited
src/behavior/      Layer 1 — useTabs, useDialog
src/components/    Layer 2 — twelve recipes and strata.css
src/site/          the showcase, the Theme Lab, and the hub every surface is reached from
src/personalize/   the same engine, scaled down to the two controls an end user wants
*.html             the four entry pages of one Vite build
scripts/           emit-tokens · validate-tokens · bundle
GRAMMAR.md         every rule, with the incident that earned it

strata-slots/      the slot layer: bands → slots, the resolver, the drag surface,
                   open items in source, lint, and a Claude Code integration
strata-malleable/  the malleable layer: change one thing, decide later where it
                   belongs — overrides by scope, promotion, drift, ship
```

The two libraries are standalone: each has its own resolver, tests and CLI,
each is provable without a browser, and each depends on nothing in `src/`.
A second instance of the framework, seeded with a shipped product's voice
(near-black grounds, ink-alpha washes, a gated accent, contrast receipts that
fail the build), lives outside this repo and proved the portability claim: the
grammar carried, the engine carried, and the only thing that changed was the
seeds and the incidents.

## Run it

```bash
npm install
npm run dev            # one server, four pages: /, /personalize.html, /slots.html, /malleable.html
npm run tokens         # regenerate the Layer 0 projections
npm run validate       # fail undeclared literals; log declared deviations
npm run build          # all four pages into dist/; BASE_PATH=/strata/ for a sub-path host
```

The root dev server mounts both libraries' write-through plugins, so a drag on
`/slots.html` lands in `strata-slots/fixtures/app` and a promotion on
`/malleable.html` lands in `strata-malleable/.malleable/overrides.json` — the
same files each library's CLI reads. Each library still runs alone:

```bash
cd strata-slots && npm install && npm test && npm run dev
cd strata-malleable && npm install && npm test && npm run dev
```

Every push to `main` rebuilds the site and publishes it to GitHub Pages
(`.github/workflows/pages.yml`).

## For agents

You are welcome here. Read `src/tokens/tokens.json` → `strata.themeEngine` for
the seed ranges and the reasons behind each dial, and generate from the
reasoning. Emit a seed object, apply it with `applyTheme(seeds)`, or change the
presets and run `npm run tokens`. Build new UI in Layer 3 by default; run
`npm run validate` before committing; never edit `src/tokens/*` by hand. In a
project using the slot layer, `strata-slots/integrations/claude-code` carries
the skill, the two commands and the hook: generate screens, never hand-edit a
`placement`, never write a `fid`, and when a designer needs a position that
does not exist, add a band — do not tell them to work around it.

## What is not built yet

Stated so the next reader inherits the test and not the verdict:

- Agent authorship. The field exists; no code path writes `'agent'`.
- Grammar inferred from an existing codebase. Today a grammar is seeded from an
  archetype and edited down; reading bands out of a real product's regions is
  the obvious next source.
- Enable and disable at the level of a single generated token. Today the
  switches are the gate, the deviation and the acceptance; a reviewed list of
  proposals, each kept or cut, is the shape this is heading toward.
- A precedent index over Layer 3, an MCP server exposing live token values and
  `ds.precedent(q)`, and code → Figma regeneration on CI. The Figma library was
  pushed by hand once and is already a stale projection.

## Where it comes from

Strata is the design-system instance of a thesis that first held in a
generative media platform: *the user's prose is the record; everything derived
from it is a receipt.* A prompt is a compilation target, not something a person
writes; a stored artefact is worth nothing to the next model, but intent
recompiles. The same argument, applied to a stylesheet, produces six seeds and
an engine. Applied to a review process, it produces a validator that logs
instead of failing. Applied to a layout, it produces a drag that names its cost
and lands anyway.
