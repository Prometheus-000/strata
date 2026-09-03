# Strata

**A persistent design decision system for humans and agents.**

Strata is not a component library, a token collection, or an AI layer bolted
onto a design system.

It is a small, inspectable record of what a product has decided: its meaning,
behavior, expression, structure, reasons, precedents, and exceptions.

Everything else is a projection.

CSS, tokens, components, layouts, Figma libraries, and generated screens are
outputs of that record. They can be regenerated, replaced, or discarded
without losing the decisions that produced them.

Humans and agents operate on the same substrate. Every consequential change
has an author, a reason, and an observable result.

The system does not treat difference as failure. It records deviation,
measures reuse, and lets evidence determine what deserves to become part of
the shared system.

**The record is the decision. Everything else is a receipt.**

**See it:** [prometheus-000.github.io/strata](https://prometheus-000.github.io/strata/)
is the hub — the showcase, the Theme Lab, the record itself, with the
[personalizer](https://prometheus-000.github.io/strata/personalize.html) and
the [malleable layer](https://prometheus-000.github.io/strata/malleable.html)
one click away. The static site cannot write; it shows what was decided. The
dev server writes through.

## Thesis

A design system used to be a library: a stylesheet somebody hand-tuned, a
component set somebody maintained, and a review gate that turned "no" into a
process. It gave nothing back to the designer, it belonged to one platform,
and it assumed the only author was a human with a text box.

Three things broke that model at once. Agents started writing UI, and an
agent with a component list generates collage while an agent with reasons
generates coherent work. Products started needing more than one projection
of the same intent — React, CSS, Figma, a runtime the team has not chosen
yet. And the review gate turned out to measure the wrong moment: a design in
progress fails any check by definition, so a tool that reports mid-drag
reads as policing by volume, and nobody designs from inside a system that is
waiting for them to comply.

Strata's answer is to make the decision the primitive. Not the token, not
the component, not the theme — the decision: what changed, who changed it,
why, and what followed. One record holds every one of them. Every file a
build produces is derived from it and can be produced again. Every hand
goes through the same call. And nothing in it can fail a build except a
mechanical truth about the artifact: the record parses, the projections
match it, every fallback chain ends, every `var()` resolves. A design that
is different is reported, never refused.

## Principles

1. **Decisions are the source of truth.** A token cut, a property override,
   a region move, a prop pick, a seed change, a declared deviation, a ship,
   a handoff: one type, one record, appended and never rewritten.
2. **Context precedes judgment.** Before a hand decides, the record says what
   was decided before, how often the same value was reached independently,
   and which rules bear on it. An agent gets environmental context, not
   isolated rules.
3. **Humans and agents share the substrate.** A pointer in the overlay, a
   command in a terminal, an agent's shell: each builds the same request and
   says who it is writing for. Nothing else about them differs, and no hand
   gets a private door.
4. **Everything else is a projection.** `semantic.css`, `tokens.json`,
   `ledger.json`, the override store, a React provider, a Figma library: each
   is what the record says, written out, and `strata rebuild` writes it again.
5. **Deviation is evidence, not failure.** A raw value where a semantic name
   belongs is declared, counted and reported. Nine of the same shape is a
   missing token, and the record is where that becomes visible.
6. **Provenance is first-class.** Every decision carries `by`, `at`, `via`,
   and the sentence that decided the author, so a wrong default is visible
   where it happened and readable later.
7. **Knowledge becomes precedent through use.** Promotion into the shared
   system is earned by count over history, computed and never declared.
8. **Enforcement is reserved for invariants.** A build fails only when the
   artifact is invalid, unsafe, or cannot be faithfully produced from the
   record. Policy is evaluated. Preference carries its number. Knowledge
   carries its source. Precedent is computed. They do not share authority.

## Architecture

```
                    Decision Substrate
                           │
          ┌────────────────┼───────────────┐
          │                │               │
       Context          Decisions       Evidence
          │                │               │
          └────────────────┼───────────────┘
                           │
                        Agents
                           │
                     Projections
                           │
          ┌────────────────┼───────────────┐
          ↓                ↓               ↓
        Code             Figma           Runtime
```

The governing arrangement is one line: report, don't police.

```
                INVARIANT
                   │
              enforce
                   │
              ─────────
                   │
              everything
                 else
                   │
                observe
                   │
                record
                   │
               evaluate
                   │
              learn/promote
```

And the loop the whole thing runs in:

```
                       HUMAN INTENT
                            │
                            ▼
                 ┌────────────────────┐
                 │  DECISION SUBSTRATE │
                 │                    │
                 │  decisions         │   .strata/decisions.jsonl
                 │  context           │   history, current, pending
                 │  grammar           │   grammar/rules.json
                 │  provenance        │   by · at · via · because
                 │  precedent         │   strata precedent
                 │  evidence          │   strata explain · strata check
                 └─────────┬──────────┘
                           │
             ┌─────────────┼──────────────┐
             │             │              │
             ▼             ▼              ▼
          Agent A       Agent B        Agent C
          generate      evaluate       explore
             │             │              │
             └─────────────┼──────────────┘
                           ▼
                       DECISIONS          decide(request, { by, via })
                           │
                           ▼
                 ┌────────────────────┐
                 │    PROJECTIONS     │
                 │                    │
                 │ React              │   src/theme/ThemeContext.tsx
                 │ CSS                │   src/tokens/semantic.css
                 │ tokens.json        │   src/tokens/tokens.json
                 │ the override store │   strata-malleable/.malleable/overrides.json
                 │ the JSX itself     │   a move is a diff
                 │ Figma · other      │   not built; see the end
                 └─────────┬──────────┘
                           │
                           ▼
                       REAL USE
                           │
                           ▼
                    OBSERVATIONS          consumers · contrast · convergence
                           │
                           ▼
                      PRECEDENT           "37 instances independently converged on 12px"
                           │
                           └──────────────► substrate
```

The code is arranged the same way. `substrate/` is a package with no
dependencies and no framework: the Decision type, the log, `decide()`,
projections, precedent, the grammar, evaluators, `check`, skills. It imports
nothing from the layers above it. The theme engine (`src/theme/`) and the
malleable layer (`strata-malleable/`) are projections: each registers the
handlers for the kinds it applies, the files it derives from the record, the
evaluators that speak for it, and the state a skill can read. `bin/strata.mjs`
is the one CLI, and it mounts both.

## The Decision Model

One type, discriminated on `kind`:

```ts
type Decision = DecisionBody & {
  id: string            // 'd' + base36 ms + 4 chars — sorts by time
  at: string            // ISO
  by: 'human' | 'agent'
  via: string           // 'cli' | 'overlay' | 'import:src/theme/ledger.json' | a harness
  because?: string      // how `by` was determined, verbatim
  reason?: string       // intent, in the author's words
  supersedes?: string   // the previous decision on the same target
  consequence: {        // what the operation already knew when it ran — recorded, never computed
    written?: string[]; collapsesTo?: string; absorbed?: string[]
    adapt?: string[]; affected?: number; refused?: string; note?: string
  }
}

type DecisionBody =
  | { kind: 'token'; token: string; action: 'propose' | 'keep' | 'cut' }
  | { kind: 'override'; action: 'set' | 'remove' | 'rescope'; scope; selector; property; value?; fromScope?; node?; view? }
  | { kind: 'move'; region: string; from: { container; file; line }; to: { container; file; line; index } }
  | { kind: 'prop'; component; prop; file; line; from: PropValue; to: PropValue }
  | { kind: 'seed'; seeds: ThemeSeeds; from?: ThemeSeeds }
  | { kind: 'deviation'; file; line; value: string }
  | { kind: 'ship'; promoted: { system; component }; frozen: number; seeds? }
  | { kind: 'ready' }
```

A region move, a token cut and a declared deviation are not special kinds of
thing. They are all a change to the design state with provenance, intent
and consequences, so they are one type on one record, and the same folds
answer the same questions about each: what is current, what is its history,
what is pending since the last handoff.

One line of the record, as it is on disk:

```json
{"kind":"token","token":"--shadow-color","action":"cut","id":"d0mtlrb8y8-xsnb","at":"2026-09-03T16:46:02.000Z","by":"agent","via":"import:src/theme/ledger.json","reason":"Lines, not shadows. The reference grammar — the portfolio and Visionary alike — draws every level with a 1px rule and an alpha wash, and paints no drop shadow anywhere; a shadow is decoration the eye pays for on every card. The elevation tokens keep their offsets and paint nothing, so the rule does the work it was already doing.","consequence":{"collapsesTo":"transparent"}}
```

The same decision, explained — the glass box. `DECISION` and `CONSEQUENCE`
are on the record. `CONTEXT` is what the record knows about the target.
`EVIDENCE` is what the projection's evaluators found, computed when asked
and never on the write path:

```
$ strata explain token:--shadow-color

DECISION
──────────────
Token: --shadow-color
Action: cut
Author: agent
Reason: Lines, not shadows. The reference grammar — the portfolio and Visionary
alike — draws every level with a 1px rule and an alpha wash …
Id: d0mtlrb8y8-xsnb
At: 2026-09-03T16:46:02.000Z · via import:src/theme/ledger.json

CONTEXT
──────────────
target: token:--shadow-color  (record)
decisions on this target before it: 0  (record)

EVIDENCE
──────────────
consumers: 3  (token.usage)
usage concentration: low  (token.usage)
surfaces: 1  (token.usage)
consumer: src/tokens/semantic.css:85  (token.usage)
duplicate visual role: no  (token.duplicate-role)

CONSEQUENCE
──────────────
fallback → transparent
```

A cut token does not disappear. Fourteen sites say `var(--accent-strong)`,
and a property that simply stopped existing would fail every one of them
silently, at the consumer. It *collapses* — to a fallback declared beside the
engine, with the decision emitted where the token is defined:

```css
--shadow-color: transparent; /* cut by agent: Lines, not shadows. … */
```

Two things the model refuses to be. The log is history, not a store for
structure: a move is on the record with its provenance, but the JSX is the
state, and nothing replays moves into source — an earlier version of this
repo declared structure as data and priced every drag against it, and was
removed for it. And evidence is never computed when a decision is written:
a drag mid-design writes a line and hears nothing, because a design in
progress fails any check by definition.

## Context & Precedent

Before a rule, there is what the record shows.

```
$ strata precedent --property padding
  5 instances independently converged on padding = 12px across 2 views (4 by hand, 1 by agent) — promotion candidate
  1 instance converged on padding = 16px (1 by hand)
```

`strata precedent` searches every decision by property, value, component,
token, author, time and the words in its reason, and counts how many
distinct targets reached the same value. That count is what promotion is
earned by. The threshold at which a convergence is called a candidate is a
preference in the grammar — three, by default — and the drift report reads
the same number. Nothing here has authority of its own; it is what happened.

`strata history <target>` prints every decision on one target as glass
boxes, oldest first; `strata log` prints the record one line each; `strata
show <id>` prints one. A reversal is two lines, not a deletion. A refusal —
a request the projection could not apply — is a line too, with the reason.

## Agent Model

```
human ─┐
       ├──► decide(request, { by, via, because }) ──► handler applies ──► record appends
agent ─┘
```

There is one write path. The terminal, the overlay in the browser, and an
agent's shell each build a request and say who they are writing for. The
author is decided explicitly and never silently — `--by human|agent`, then
`STRATA_AUTHOR`, then `CLAUDECODE` in the environment (Claude Code sets it for
every command it runs), then `human` — and the sentence that decided is
printed on every write and kept on the decision. The overlay writes `human`
because a pointer is a hand. There is no API an agent has that a person
does not, and no file an agent edits that the record does not see.

An agent does not read the design system; it performs design work according
to a **skill**. A skill is a `SKILL.md` — the convention Claude Code already
installs — with a typed front matter the substrate reads:

```yaml
name: cut-token
purpose: Decide whether a token the engine emits earns its place, and cut it — to its declared fallback, never to nothing — or keep it, with the reason on the record.
inputs: [token]
context:
  state: [tokens, consumers]
  precedent: { kind: token, token: $token }
  rules: [layer0.semantic-names-only, voice.lines-not-shadows, layer2.one-filled-action, knowledge.accent-gate]
constraints:
  - never edit src/tokens or src/theme/ledger.json by hand — they are projections of the record
  - pass --by agent and --why on every write
evidenceRequired: [consumers, usage concentration, duplicate visual role]
typicalDecisions: [token/cut, token/keep]
examples: [d0mtlrb8y8-xsnb, d0mtlrb8y8-llbi]
reasons: |
  A cut token does not disappear …
```

The body is the procedure. `strata skill cut-token --token --accent-strong`
assembles the packet: the rules cited, with their reasons and their
authority; the precedent found; the state the projections provide; the
examples resolved from this product's own record; the evidence a decision
from this skill must carry. The harness's model performs the procedure.
Strata calls no model — many harnesses, one foundation. Six skills ship
(`cut-token`, `retheme`, `move-region`, `pick-prop`, `promote`,
`review-handoff`), and the Claude Code plugin in
`strata-malleable/integrations/claude-code` runs them.

## Governance

Four kinds of statement, and they do not carry the same authority:

| | Says | Authority |
| --- | --- | --- |
| **Invariant** | "Every var() names a property something defines." | Enforced. The only class a build fails on. A mechanical truth about the artifact, never a design judgement. |
| **Policy** | "Recipes speak semantic names, never a hex." | Evaluated and reported. Bent by a declared deviation, which is then knowledge. |
| **Preference** | "A shape that appears three times is a candidate." | Carries its number. |
| **Knowledge** | "Hand-written projections drift within a week." | Carries its source. |
| **Precedent** | "37 instances independently converged on 12px." | Computed from the record. Never declared. |

The grammar (`GRAMMAR.md`) is rules with reasons, in prose, co-authored: a
human writes the incident — the stylesheet with thirty-four accidental white
alphas, the muted ink that passed on the background and failed on the menu
it sat on — and an agent generates from the reasoning rather than the rule.
The same rules are data in `grammar/rules.json`, each with its authority,
and that is what `strata check` runs from:

```
$ strata check

INVARIANTS
──────────────
✓ record.parses — 34 decision(s)
✓ projections.match-record
✓ fallbacks.total-acyclic
✓ css.vars-defined

KNOWLEDGE
──────────────
deviation.declared  src/site/site.css:850
    declared: the hue slider paints the OKLCH wheel itself — a literal spectrum is the control's value, not themable surface
token.unused  --motion-instant
    never used — a cut candidate, or headroom; only you know which

HANDOFF
──────────────
  nothing changed since the last review
not yet handed off

every invariant holds; the rest is evaluation, and none of it blocks anything
```

`strata check` exits 0. `strata check --enforce` runs in `npm run build` and
exits 1 only when an invariant does not hold. This is the distinction the
whole system rests on:

```
EVALUATION     "Here is what happened."     always
ENFORCEMENT    "This cannot ship."          invariants only
```

Nothing runs while someone is designing. No hook, no lint, no cost mark
mid-drag; evaluation happens at `ready`, at `check`, and when asked. An
earlier version of this repo had a slot layer that declared structure as
bands, each with a behaviour contract, and priced every drag against it,
writing the cost into source for someone to accept. It was removed on two
findings: a design in progress fails any check by definition, so a tool that
reports mid-drag is measuring the wrong moment; and a designer's move does
not cost the page anything, because the designer is the one defining what
the page is. What it costs is code, and code is malleable to the design.
**Designers define the UX.** The reviewer makes the code fit and never moves
anything back.

## Projections

Every file below is derived from the record and can be produced again.
`strata rebuild` writes them; `strata rebuild --check` is the invariant that
they match.

| Projection | From | How |
| --- | --- | --- |
| `src/theme/ledger.json` | every current `token` decision | one line per engine token, with the decision's id |
| `src/tokens/semantic.css` | the engine, through the ledger | a cut token is emitted as its fallback with the decision beside it |
| `src/tokens/tokens.json` | the same | each token carries its decision under `$extensions["strata.ledger"]` |
| `strata-malleable/.malleable/overrides.json` | every `override`, `seed`, `ship` decision | a fold: set and rescope upsert and drop what they absorbed; remove drops; ship drops what it collapsed |
| the JSX | every `move` and `prop` decision | already applied when the decision was written; git is where diffs live |
| the React provider | `ledger.json` at build | the runtime never shows a token the record decided against |

A theme is six numbers — `{ hue, chroma, warmth, energy, density, appearance }`
— and the engine (`src/theme/generateTheme.ts`) derives every colour,
surface, stroke, radius, rhythm and easing from them, deterministically, in
OKLCH. The engine is the only author of the semantic tier, because the first
week of this repo produced drift by transcription that nobody had chosen.
Layers are factored by half-life — meaning, behaviour, recipes, local — and
each gets its own governance; the rule that makes it a system is that a
recipe never references a raw value. The malleable layer
(`strata-malleable/`) lets a designer change the real page by hand: a drag
on a corner is an override, a drag on a region rewrites the JSX, a pick on a
component's own controls rewrites the attribute, and the promote control asks
one question — how far does this go — in four words. Every one of those is a
decision on the same record.

The Figma library was pushed by hand once and is already a stale projection.
It is listed here so the next reader inherits the test and not the verdict.

## Examples

**A token is cut.** A person decides; the projections regenerate in the same
call; the record gains a line that supersedes the import.

```
$ strata cut --accent-strong --why "one filled action per surface" --by human

  --accent-strong: kept → cut
  collapses to --accent — One filled action per surface; a second strength of accent is the first thing a small system does without.
  by human — --by human on the command line
  ~ src/theme/ledger.json, src/tokens/semantic.css, src/tokens/tokens.json, .strata/decisions.jsonl
```

**A region moves, by an agent, when asked.** The JSX is rewritten, imports
follow, and the line says what the moved element still needs.

```
$ strata move Filters --to nav --by agent --why "the filters belong with navigation"

  fixtures/app/views/Page.tsx: removed <Filters /> · fixtures/app/views/TopBar.tsx: inserted <Filters /> · import added

  <Filters />  Page.main.page__main → TopBar.nav.topbar__nav   fixtures/app/views/TopBar.tsx:18 · agent
  by agent — --by agent on the command line
  ~ fixtures/app/views/Page.tsx, fixtures/app/views/TopBar.tsx, .strata/decisions.jsonl
```

**Drift converges; promotion is earned.** Three instances reach 12px by
hand; the record says so; a person widens it.

```
$ strata check
PRECEDENT
──────────────
drift.convergence  padding = 12px
    3 instances independently converged across 2 views — promotion candidate (3 by hand, 0 by agent)

$ strata set Card.div.st-card padding 12px --scope view --view gallery --by human --why "every card here"
  padding = 12px on Card.div.st-card
  scope: view · absorbed 3 narrower override(s)
```

**A handoff.** The designer presses ready; the reviewer reads what changed
since the last one, with a reversal collapsed away.

```
$ strata handoff

  <Badge tone>  accent → positive   fixtures/app/views/Gallery.tsx:14 · human
  <Filters />  Page.main.page__main → TopBar.nav.topbar__nav   fixtures/app/views/TopBar.tsx:18 · agent
      needs wiring: open

ready for review — human, 2026-09-03T18:02:11.000Z
```

## CLI

One interface. Every write is a decision on the record, takes `--by
human|agent` (otherwise `STRATA_AUTHOR`, then `CLAUDECODE`, then `human`),
`--why "…"`, and `--dry`.

```
the record
  check [--enforce] [--json]  here is what happened: invariants, then policy, preference, knowledge, precedent, handoff
  explain <id | targetKey>    one decision as a glass box: DECISION · CONTEXT · EVIDENCE · CONSEQUENCE
  log [--kind k]              every decision, one line each
  history <targetKey>         every decision on one target
  show <id>                   one decision
  precedent [words] [--property p] [--value v] [--component C] [--token --x] [--author a] [--unpromoted]
  skill [name] [--<input> v]  the skills, or the packet for one
  ready [--why …]             hand off what changed since the last ready
  import                      bring the old ledger and store onto the record, once
  rebuild [--check]           write every projection from the record; --check only says which differ

tokens (Layer 0)
  list · cut · keep · propose --<token> [--why …]
  deviate <file>:<line> --why …

the malleable layer
  id · regions · manifest · resolve · reconcile · drift · handoff
  set · remove · move · prop · ship
```

```bash
npm install                # links the substrate into both packages
npm run dev                # one server, three pages: /, /personalize.html, /malleable.html
npx strata check           # what happened
npx strata explain token:--shadow-color
npx strata skill           # the skills
npm test                   # the substrate, the theme, the malleable layer
npm run build              # tokens → check --enforce → tsc → vite; fails only on an invariant
```

`npm run ledger -- cut …` and `malleable move …` still work; they run the
same functions. The library runs alone too:

```bash
cd strata-malleable && npm install && npm test && npm run dev
```

Every push to `main` runs the tests and the build and publishes the site.

## What's not built

Stated so the next reader inherits the test and not the verdict:

- An MCP server over the same `decide()`, `explain()` and `precedent()` the
  CLI calls, so a harness reaches the substrate without a shell.
- Code → Figma regeneration on CI. The Figma library is a stale projection.
- The hub renders the record but cannot evaluate it: evidence needs the
  filesystem, so the four blocks on the site are two.
- A move takes a region, not a landmark and not a list item; a component
  whose root is a fragment can be moved from the terminal but not by hand; a
  prop control writes literals and leaves expressions to the code.
- The static roles in `semantic.css` (`--control-h-*`, `--font-*`,
  `--shadow-raised`) are hand-written and not yet proposals; the record
  decides what the engine derives.
- Precedent is computed over this product's record. A precedent index
  across products — what many teams independently converged on — is the
  same fold over a larger log, and is not here.

## Where it comes from

Strata is the design-system instance of a thesis that first held in a
generative media platform: *the user's prose is the record; everything
derived from it is a receipt.* A prompt is a compilation target, not
something a person writes; a stored artefact is worth nothing to the next
model, but intent recompiles. The same argument, applied to a stylesheet,
produces six seeds and an engine. Applied to a review process, it produces an
evaluator that reports instead of failing. Applied to a layout, it produces a
drag that lands, and a reviewer who adapts the code to it. Applied to all of
them at once, it produces one record, and everything else as a projection.
