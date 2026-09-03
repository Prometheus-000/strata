# The Strata Grammar

## Credo

Two commitments, stated once, enacted everywhere below:

**The most important design choices are what you don't see.** The engine deepens accents on
light grounds to hold AA contrast, honors reduced-motion at both the stylesheet and the
runtime, and a validator reviews every diff. None of it has a UI. All of it is the design.

**Less but better.** Six seeds instead of a thousand hand-picked values. One filled action
per surface. Promotion is earned by three appearances in the wild, so the inventory stays
small because everything in it was proven necessary. The credo applies to itself: four
philosophies were candidates for this section, and it kept two.

---

Rules ship with reasons. An agent (or a new teammate) that has the reasoning generates
novel-but-coherent work; one that only has the component list generates collage. Every rule
below carries the incident or argument that earned it. If you deviate, declare it —
`// deviation: <reason>` — and the validator will log it instead of failing you. Declared
drift is promotion-candidate telemetry, not a violation.

## Layer 0 — Meaning

**Semantic names only: `--accent`, `--surface-raised`, never a hex, never `green-500`.**
Consistency is not visual sameness; it is predictability of meaning. Two screens that share
nothing but this vocabulary still cohere.

**The engine is the only author.** `semantic.css` and `tokens.json` are projections of
`generateTheme.ts` — regenerate with `npm run tokens`, never edit. This rule exists because
this repo already grew its own drift in week one: the hand-written CSS said surface chroma
0.012 while the engine computed 0.006. Nobody chose that; transcription did.

**A theme is six seeds, and light is not inverted dark.** Light appearances compile accents
at 0.87× chroma and lower lightness because a light accent that merely inverts fails AA on
paper. The engine encodes the correction so no one has to remember it.

**Warmth tints every neutral.** A pure mid-grey reads as unconsidered. Neutrals borrow a
whisper of hue — toward paper (95°) or slate (245°) — so even "grey" is a chosen color.

**Energy buys shape as well as speed.** Kinetic themes get spring easing, shorter durations
*and* rounder corners; calm themes glide and stay architectural. Motion personality that
stops at duration produces themes that feel mislabeled.

## The voice — the house taste, as rules

The default is a taste, and a taste is a set of decisions with reasons, so it is written the
way everything else here is. It is enacted in three places, none of them a stylesheet: the
`Obsidian` seeds in `generateTheme.ts`, the decisions in `src/theme/ledger.json`, and the
rules below. Retune the seeds or reverse a decision and the voice follows; nothing below is
enforced by hand.

**One family. Hierarchy is weight, size and measure — never a second voice.** Display and body
are the same system face; headings are the body face set at 600–700 and tracked tight. This
rule was earned in v0.2, which shipped a variable serif with italic accents and a green
display line, and the owner's correction is the record: *"overly designed text. This does not
meet my own design grammar."* The two references it was measured against — the portfolio and
Visionary — set everything in one face and let scale contrast do the work: one display line,
everything else at reading size.

**Mono is for what is read as data — labels, values, receipts — and never for prose.** The
same correction, from the other side: when Visionary's compiled prompt was dressed as a
developer tool, the owner wrote *"I did not actually want it to look like code. My whole design
thesis is it should not feel utilitarian."* A value in mono is honest; a paragraph in mono is a
costume.

**Labels are microtype: small, tracked caps, faint ink. The accent never carries a label.** A
kicker in the accent colour is a second voice competing with the heading it introduces. The
portfolio's data plates set every key at 11px, 700, tracked 0.14em, in faint ink, and the value
beside it in full ink — the key names, the value speaks.

**Monochrome by default; colour is a choice, and a monochrome accent is ink.** Chroma 0 is the
house seed. The argument is Rams' — a tool is unobtrusive so the user's own work carries the
colour — and the incident is Visionary's canvas, whose ground stays black even on the paper
theme because the picture is not chrome. The engine pulls an achromatic accent to the ink pole
(near-white on dark, near-black on light) because a mid grey at the chromatic lightness fails AA
on paper and reads as disabled everywhere.

**Lines, not shadows.** Every level in both references is a 1px rule and an alpha wash; neither
paints a drop shadow anywhere. `--shadow-color` is cut in the ledger, so the elevation tokens
keep their offsets and paint nothing — the rule does the work it was already doing.

**Nothing bounces, and there are two radii: a control and a panel.** `--motion-ease-emphasis`
and `--radius-overlay` are cut. The engine gives a calm theme a spring on emphasis and a 19px
dialog; a sheet that overshoots and the one soft shape on an architectural page were both
personality the chrome should not have. The energy dial still sets speed.

**The appearance control is the mark.** A dot after the wordmark: faint ink when the theme is
monochrome, the accent when there is one, so the door is also the state. One click flips the
ground. This is Visionary's own control, and its reason travels with it: *"Appearance costs
nothing and answers to nobody, so a card in there read as one more thing to decide before you
could work."* A labelled switch in the navigation was that card. Quiet and hidden are different
things — it is a real button with a name, reachable by tab.

**Dark is the first ground; light is one flipped bit.** The portfolio's review named the baseline
that must be preserved — *"dark theme, minimal monochrome typography, and a technical 'research
lab' feel"* — and `Gallery` is `Obsidian` with `appearance` flipped and nothing else changed,
because the two poles are one theme's two grounds.

## Layer 1 — Behavior (never forked)

**Correctness is not a taste question.** Roving tabindex, arrow-key order, Escape and
backdrop dismissal live in `src/behavior/` and are consumed, never copied. This is the part
everyone quietly rebuilds badly when they eject from a monolithic system — so it is the part
an eject must preserve.

**A backdrop click is a click on the `<dialog>` element itself.** Clicks inside content land
on descendants; testing `e.target === dialog` is the whole implementation. Anything cleverer
(bounding-box math) breaks the moment the sheet scrolls.

**Reduced motion is honored at both layers.** The generated CSS carries the
`prefers-reduced-motion` override for the no-JS path, and `applyTheme` re-checks it at
runtime — because inline style properties beat media queries, a runtime engine that ignores
the preference silently undoes the stylesheet's promise.

## Layer 2 — Recipes (forkable by default)

**Recipes speak tokens and consume behavior; everything else is theirs.** Copy a recipe into
your feature, keep the two imports, restyle freely. The adversarial relationship with a
design system ends the moment taking the code is sanctioned.

**One filled action per surface.** Primary is filled; Secondary is an edge; Ghost is bare
text. When three calls to action carry the same chrome, the screen has no point.

**Disabled is `opacity: 0.45` on the whole control, not a third palette.** A disabled
variant per color multiplies the matrix without adding meaning; a uniform veil reads as
"off" everywhere at once.

**Status colors are ink and wash, split by role.** `--danger` is ink — it cannot carry
white text. Its wash (`--danger-soft`) is a fill. One name per role, because a border alpha
and a fill alpha doing different jobs under one name is how 34 accidental alphas happen.

## Layer 3 — Local (no permission required)

Build one-offs in your feature. The validator still enforces Layer 0 — tokens are enforced
regardless of where code lives — but no one reviews expression here. When the same shape
appears in three features, it becomes a promotion candidate; promotion is earned by usage,
never granted by proposal.

## The machine layer

- `npm run tokens` — regenerate all Layer 0 projections from the engine, through the
  ledger. Adds a `proposed` line for any new token; never edits a decision.
- `npm run ledger -- cut|keep --<token> --why "…"` — decide one generated token. A cut
  token collapses to its fallback (`src/theme/ledger.ts`, beside the engine, with a reason
  per entry) in every projection, and the decision is emitted beside the declaration.
  Omitting the property instead would fail every `var()` that names it, silently, at the
  consumer — which is the behaviour this repo calls the worst available.
- `npm run validate` — fails undeclared color literals in `src/components` and `src/site`;
  prints declared deviations as telemetry; counts every consumer of a cut token and names
  every token nothing uses. Runs in `npm run build`.
- `src/tokens/tokens.json` — the agent-readable contract: seeds, ranges, and the *reasons*
  for each dial, alongside compiled values; each token carries its ledger decision.
- Next, in order of leverage: a precedent index over Layer 3, an MCP server exposing live
  token values + `ds.precedent(q)`, and code→Figma regeneration on CI (the current Figma
  library was pushed by hand once and is already a stale projection — see
  `figma-library-state.json`).
