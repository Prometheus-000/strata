# Strata

**A design system that is generated, then governed — by the people who use it
and the agents that work beside them.**

A design system used to be a library: a stylesheet somebody hand-tuned, a
component set somebody maintained, and a review gate that turned "no" into a
process. It gave nothing back to the designer, it belonged to one platform,
and it assumed the only author was a human with a text box.

Strata is an attempt at the next thing. The whole system is derived from a
small, typed record — six numbers, a ledger of decisions, the page's own
markup — and everything derived from that record is a projection you can throw
away and regenerate. Humans turn dials and drag things; agents read reasons and
write numbers; every change carries its author; and nothing, anywhere, is
blocked or flagged while someone is still deciding.

> The record is what people decided. Everything else is a receipt.

**See it:** [prometheus-000.github.io/strata](https://prometheus-000.github.io/strata/)
is the hub — the showcase and Theme Lab, with the
[personalizer](https://prometheus-000.github.io/strata/personalize.html) and the
[malleable layer](https://prometheus-000.github.io/strata/malleable.html) one
click away. The static site cannot write back to source; the harness falls back
to your browser's storage there, and writes through only on the dev server.

## What it gives back

**Creativity, to the designer.** Nothing here refuses, and nothing here speaks
until you say ready. A drag lands where it was aimed; a region moves where it
was put; a raw value ships if you declare it; a one-off in your feature needs
no permission. A design in progress fails any check by definition, so no check
runs while you are designing. What the system does instead is write the
decision into the diff and hand the review to whoever asked for it. Report,
do not police — nobody designs from inside a system that is waiting for them
to comply.

**Portability, to the product.** The record is data, not code. A theme is six
numbers that fit in a URL hash. A token decision is one line in a ledger. A
page's structure is its landmarks, and a move is a diff. CSS, `tokens.json`, a
Figma library, a React provider are projections of that data, and a projection
is replaceable the day something serves the product better. The engine imports
no framework; React does not appear until the runtime layer.

**Provenance, to the partnership.** Every override carries
`author: 'human' | 'agent'`; every token decision carries a name; every move is
receipted with the hand that made it. The theme compiler itemises a receipt
per word so a derivation is inspectable rather than trusted. The grammar ships
every rule with the incident that earned it, because an agent with reasons
generates novel-but-coherent work and an agent with a component list generates
collage.

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
  on styled nodes and on the root of every component, and reads each node's
  base values out of the stylesheet it actually uses. A preview of a mock is a
  mock.
- **Source → structure.** `malleable regions` reads the page's containers out
  of the page: its landmarks (`<header>`, `<nav>`, `<main>`, `<aside>`,
  `<footer>`, `role="dialog"`, `<form role="search">`), looking through the
  components that compose the page to the landmarks inside them, and lists the
  regions each one holds in source order. Nothing declares structure; the
  markup is the declaration.

What is generated is then reviewed, edited, kept or cut by a person, and the
system is arranged so that each of those is a gesture, not a form:

| Gesture | Where |
| --- | --- |
| **Review** | the receipt beside every compiled word; the contrast receipts printed on every regeneration; the resolver's chain, which shows every candidate value and why it lost; the diff a move leaves |
| **Edit** | the dials; a drag on a corner or an edge; a drag on a region; a pick, a toggle or a scrub from a component's own controls; the promote control that asks one question, *how far does this go*, in four words |
| **Enable** | `deviation: <reason>` makes a raw value legal and logged; `kept` in the token ledger says a generated token was reviewed and wanted |
| **Disable** | `cut` in the token ledger — the token collapses to its declared fallback in every projection, and the validator counts every consumer |

### Every generated token is a proposal

The engine emits thirty-four tokens. `src/theme/ledger.json` holds a line for
each — `proposed` until someone decides, then `kept` or `cut`, with a reason
and a name. `npm run tokens` adds proposals and never edits a decision;
`npm run ledger -- cut --accent-strong --why "one filled action per surface"`
makes one. A cut token does not vanish: fourteen places in `strata.css` say
`var(--accent-strong)`, and a property that simply stopped existing would fail
every one of them silently, at the consumer. It *collapses* instead — to a
fallback declared beside the engine (`--accent-strong` → `--accent` → `--ink`,
the accent gate written down), with the decision emitted where the token is
defined:

```css
--accent-strong: var(--accent); /* cut by human: one filled action per surface */
```

`tokens.json` says `cut` on the token so an agent reads a decision rather than
a missing name; the runtime applies the same ledger so the Theme Lab never
shows a token the build decided against; and `npm run validate` logs every
usage that collapsed and every token nothing uses — a cut candidate, or
headroom; only you know which.

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

### Structure is moved, not declared

Property-level styling is governed by the engine. Structure had no equivalent
gesture: a designer who knows the filters belong in the top bar had to write a
prompt, or a ticket, and wait. Now a region — any component sitting under a
landmark — is picked up by its body and put down in another landmark, before or
after a neighbour, and the drop rewrites the JSX on the spot:

```diff
 // Page.tsx
-import { Filters } from './Filters'
 import { Gallery } from './Gallery'
       <main className="page__main">
-        <Filters />
         <Gallery />

 // TopBar.tsx
 import { Badge } from '../recipes/Badge'
+import { Filters } from './Filters'
       <nav className="topbar__nav">
         <Badge />
+        <Filters />
       </nav>
```

That diff is the whole record. There is no store for structure, no declared
list of positions, no contract a move can fail. **Designers define the UX.**
Focus order, dismissal and keyboard handling are code, and when a region moves
the code adapts to it — at review, by whoever generates. Nothing is priced or
marked while a region is in the air; the only things drawn are the container
under the pointer and one line where it would land. A move that leaves state
behind still lands, and the receipt says what to wire. The reviewer makes the
code fit and never moves anything back.

An earlier version of this repo had a *slot layer*: structure was declared as
a list of bands, each band carried a behaviour contract, every position was
enumerated in advance, and every drag was priced against the contract and the
cost written into source for someone to accept. It was removed, on two
findings. A design in progress fails any check by definition, so a tool that
reports mid-drag is measuring the wrong moment and reads as policing by
volume. And the premise was wrong: a designer's move does not cost the page
anything, because the designer is the one defining what the page is; what it
costs is code, and code is malleable to the design. What survived is the
kernel — a move lands in source with its author and someone reviews it — and
the reader that finds landmarks in a page, which is what makes a declaration
unnecessary.

### A component says what may be changed about it

The handles the overlay offers used to come from a global registry crossed
with whatever the stylesheet happened to declare. Now a component declares its
own controls beside itself, the way Framer's property controls sit beside a
component — because the person who wrote `<Badge>` is the one who knows that
`tone` has three values and that its radius should never leave the pill:

```ts
export const controls = defineControls(Card, {
  tone: { options: ['neutral', 'accent', 'positive'] },
  interactive: { toggle: true },
  lines: { range: [1, 6] },
  radius: { range: [0, 24], snap: ['--radius-pill'] },
  padding: false,
})
```

Two kinds, one declaration. A CSS control shapes the handle: its range, the
tokens it snaps to, or no handle at all. A prop control sits above the
selected instance and takes the shape of its prop — a strip of options, one
chip that is on or off, a number you scrub sideways within the declared
range — and a pick rewrites the attribute at the call site: `<Badge
tone="accent">` becomes `<Badge tone="positive">`, `<Card>` becomes `<Card
interactive lines={3}>`, in the file that uses it. That is a diff, not an
override, receipted with its author like a move. No panel, no field: only the
values the component allows, on the object. Six cards rendered from one
`.map` are one line of source, so a pick on any of them is a pick on all of
them, and every instance in the group is outlined while the strip is up.

## Governance is co-authored

The governing artefacts of this system are written by both parties, in the
same files, and read by both:

- **The grammar** (`GRAMMAR.md`) is rules with reasons.
  A human writes the incident — the stylesheet with thirty-four accidental
  white alphas, the muted ink that passed on the background and failed on the
  menu it sat on — and an agent generates from the reasoning rather than the
  rule. The credo applies to itself: four philosophies were candidates and it
  kept two.
- **`tokens.json`** is the agent contract: seeds, ranges, and the *reason* for
  each dial alongside the compiled values. An agent rethemes a product by
  emitting a new seed set, never by editing CSS.
- **Deviations and token decisions** live in source, next to the thing they
  describe — a `deviation:` comment beside the literal, a `cut` beside the
  token — so the decision and the thing decided are one diff.
- **The loop has a division of labour.** An agent generates the page, because
  something must exist before it can be moved. The designer moves regions and
  drags properties, because choosing where things go needs a hand, not a
  prompt. The agent reviews, because making code fit a design is judgement —
  and undoing a designer's move is how a designer stops believing the tool.
  Pressing *ready* withholds nothing; the moves are already in source.

The `author` field is the hinge. An agent writes through the same operations a
drag does — `malleable move`, `malleable prop`, `malleable set`, `malleable ready`,
`npm run ledger -- cut` — and every one of those has to say who is writing:
`--by`, then an environment variable, then `CLAUDECODE` (which Claude Code sets
for every command it runs), then `human`, and the sentence that decided is
printed on every write so a wrong default is visible where it happened. A move
is a diff, so git already knows who committed it; what git cannot say is which
hand made each move before the commit, and that is what the receipt is for:

```json
{ "what": "Filters", "from": { "container": "Page.main.page__main" }, "to": { "container": "TopBar.nav.topbar__nav" }, "by": "human" }
```

The drift report ends with *by author: 11 human · 0 agent*; the receipt names
the mover on every line; and the plugin's skill tells the agent to pass
`--by agent` and never to move anything back.

## What is here

```
src/theme/         the engine, the prose compiler, the image sampler, a React provider
src/tokens/        GENERATED projections — semantic.css, tokens.json; never edited
src/behavior/      Layer 1 — useTabs, useDialog
src/components/    Layer 2 — twelve recipes and strata.css
src/site/          the showcase, the Theme Lab, and the hub every surface is reached from
src/personalize/   the same engine, scaled down to the two controls an end user wants
*.html             the three entry pages of one Vite build
scripts/           emit-tokens · validate-tokens · ledger · bundle
GRAMMAR.md         every rule, with the incident that earned it

strata-malleable/  the malleable layer: change one thing, decide later where it
                   belongs — overrides by scope, promotion, drift, ship; and
                   move a region, which rewrites the JSX on the spot — with a
                   Claude Code integration for generating and reviewing
```

The library is standalone: it has its own resolver, structure reader, tests
and CLI, is provable without a browser, and depends on nothing in `src/`.
A second instance of the framework, seeded with a shipped product's voice
(near-black grounds, ink-alpha washes, a gated accent, contrast receipts that
fail the build), lives outside this repo and proved the portability claim: the
grammar carried, the engine carried, and the only thing that changed was the
seeds and the incidents.

## Run it

```bash
npm install
npm run dev            # one server, three pages: /, /personalize.html, /malleable.html
npm run tokens         # regenerate the Layer 0 projections through the ledger
npm run ledger -- list # every generated token and what was decided about it
npm run validate       # fail undeclared literals; log declared deviations and collapsed tokens
npm run build          # all three pages into dist/; BASE_PATH=/strata/ for a sub-path host
```

The root dev server mounts the library's write-through plugin, so on
`/malleable.html` a property drag lands in `strata-malleable/.malleable/overrides.json`,
a region move rewrites `strata-malleable/fixtures/app` in place, and *ready*
drops the receipt at `strata-malleable/.malleable/ready.json` — the same files
the library's CLI reads. The library still runs alone:

```bash
cd strata-malleable && npm install && npm test && npm run dev
```

Every push to `main` rebuilds the site and publishes it to GitHub Pages
(`.github/workflows/pages.yml`).

## For agents

You are welcome here. Read `src/tokens/tokens.json` → `strata.themeEngine` for
the seed ranges and the reasons behind each dial, and generate from the
reasoning. Emit a seed object, apply it with `applyTheme(seeds)`, or change the
presets and run `npm run tokens`. Each token there carries its ledger decision
under `$extensions["strata.ledger"]`: never reach for one marked `cut`, and
when you cut or keep one yourself, do it with `npm run ledger` so the line
carries your name. Build new UI in Layer 3 by default; run `npm run validate`
before committing; never edit `src/tokens/*` by hand. In a project using the
malleable layer, `strata-malleable/integrations/claude-code` carries the skill
and the two commands, and no hook: generate pages whose regions sit under
landmarks, each region a component of its own; run `malleable id` after adding
one and never write `data-sid` or `data-region` by hand; move regions with
`malleable move … --by agent` rather than by editing JSX, so the receipt names
you; and at review make the code fit the design — wire what a move left
behind, give a moved dialog its dismissal context where it now lives — and
never move anything back.

## What is not built yet

Stated so the next reader inherits the test and not the verdict:

- A precedent index over Layer 3, an MCP server exposing live token values and
  `ds.precedent(q)`, and code → Figma regeneration on CI. The Figma library was
  pushed by hand once and is already a stale projection.
- The token ledger governs the engine's output. The static roles in
  `semantic.css` (`--control-h-*`, `--font-*`, `--shadow-raised`) are not
  proposals yet — they are hand-written, and the ledger only decides what the
  engine derives.
- A move takes a region, not a landmark and not a list item. `<nav>` cannot be
  dragged out of `<header>`, and a card rendered by `.map` stays in its data's
  order. Both are reported by `malleable regions` where they apply.
- A component whose root is a fragment has no host element to carry
  `data-region`, so it can be moved from the terminal but not by hand.
- A prop control writes literals. An attribute whose value is an expression
  (`open={isOpen}`) is left to the code, and the strip says so.

## Where it comes from

Strata is the design-system instance of a thesis that first held in a
generative media platform: *the user's prose is the record; everything derived
from it is a receipt.* A prompt is a compilation target, not something a person
writes; a stored artefact is worth nothing to the next model, but intent
recompiles. The same argument, applied to a stylesheet, produces six seeds and
an engine. Applied to a review process, it produces a validator that logs
instead of failing. Applied to a layout, it produces a drag that lands, and a
reviewer who adapts the code to it.
