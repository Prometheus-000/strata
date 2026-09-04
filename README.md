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
names two hands — who chose, and whose hand wrote it — a reason, and an
observable result.

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
generates coherent work — which is the founding claim, and `bench/` is where
it is put to a test rather than repeated. It has been run once; the result is
narrower than the sentence, and is written up there. Products started needing more than one projection
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

1. **Decisions are the record, and the record is source where it can be.** A
   token cut, a property override, a region move, a prop pick, a seed change,
   a declared deviation, a ship, a handoff: one type, one record, appended and
   never rewritten. What that record *is* to a projection differs by kind, and
   the difference is stated rather than smoothed over. For a token, an
   override, a seed or a ship it is the **source**: the file is derived from
   it and `strata rebuild` writes it again. For a move, a prop pick or a
   declared deviation it is a **witness**: the JSX is the state, the change
   was applied when the decision was written, and nothing replays it. The log
   is history, not a store for structure — an earlier version of this repo
   declared structure as data and priced every drag against it, and was
   removed for it.
2. **Context precedes judgment.** Before a hand decides, the record says what
   was decided before, how often the same value was reached independently,
   and which rules bear on it. An agent gets environmental context, not
   isolated rules.
3. **Every hand goes through the same door.** A pointer in the overlay, a
   command in a terminal, an agent's shell, an MCP call: each builds the same
   request and says both who chose and whose hand wrote it. Nothing else about
   them differs, and no hand gets a private door. There are four authoring
   roles here and they are not interchangeable: the **engine** authors values,
   a **component author** declares which properties are malleable, a
   **designer** decides, and an **agent** performs skills. A person and an
   agent share the substrate; they do not share a job.
4. **Everything derivable is a projection.** `semantic.css`, `tokens.json`,
   `ledger.json`, the override store, a React provider, a Figma library: each
   is what the record says, written out, and `strata rebuild` writes it again.
   Source is not one of them: a moved region lives in the JSX, and the record
   witnesses the move rather than owning the file.
5. **Deviation is evidence, not failure.** A raw value where a semantic name
   belongs is declared, counted and reported. Nine of the same shape is a
   missing token, and the record is where that becomes visible.
6. **Provenance names two hands.** Every decision carries `decided` — who
   could have chosen otherwise — and `written` — whose hand ran the command —
   each with an optional `actor`, alongside `at`, `via`, and the sentence that
   decided both. Either may be an agent. An agent typing a person's decision
   is the ordinary case; an agent that *chose* is the case a reviewer needs to
   see, and the record can tell them apart.
7. **Candidacy is computed; promotion is decided.** A count of distinct
   targets and distinct hands crossing the number the grammar prefers makes a
   convergence a *candidate*, and that much is computed from history and never
   declared. Promoting it — widening the scope, or minting a name for the
   value — is a decision a hand makes, with a reason, on the record.
8. **Enforcement is reserved for invariants.** A build fails only when the
   artifact is invalid or cannot be faithfully produced from the record — the
   record parses, the projections match it, every fallback chain ends, every
   `var()` resolves. Safety is *not* on that list, deliberately: AA contrast
   and focus correctness are evaluated and reported like every other policy,
   because an invariant here is a mechanical truth about the artifact and a
   contrast threshold is a judgement. Policy is evaluated. Preference carries
   its number. Knowledge carries its source. Precedent is computed. They do
   not share authority.

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
                 │  provenance        │   decided · written · at · via · because
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
                       DECISIONS          decide(request, { decided, written, via })
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
                      PRECEDENT           "37 instances, 3 hands, converged on 12px"
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
  decided: Hand         // who could have chosen otherwise
  written: Hand         // whose hand ran the command
  via: string           // 'cli' | 'overlay' | 'mcp:<client>' | 'import:src/theme/ledger.json' | a harness
  because?: string      // how both hands were determined, verbatim
  reason?: string       // intent, in the author's words
  supersedes?: string   // the previous decision on the same target
  consequence: {        // what the operation already knew when it ran — recorded, never computed
    written?: string[]; collapsesTo?: string; absorbed?: string[]
    adapt?: string[]; affected?: number; refused?: string; note?: string
  }
}

type Hand = { kind: 'human' | 'agent'; actor?: string }   // actor is opaque: a handle, an email, a harness id

type DecisionBody =
  | { kind: 'token'; token: string; action: 'propose' | 'keep' | 'cut' | 'mint'; value?: Value; from?: string[] }
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

Eight kinds, and there is no ninth for the rules themselves — see
[the contract](#the-contract). Every one of these is an act *within* the work;
the frame it happens inside is edited in files by people, not decided.

One line of the record, as it is on disk:

```json
{"kind":"token","token":"--shadow-color","action":"cut","id":"d0mtlvzac0-5lk7","at":"2026-09-03T18:56:42.000Z","decided":{"kind":"human","actor":"prometheus-000"},"written":{"kind":"agent","actor":"claude-code"},"via":"import:src/theme/ledger.json","because":"decided by human — --decided-by human on the command line; written by agent claude-code — CLAUDECODE in the environment; brought onto the record by import — the old file recorded a channel, not a judgement, so the deciding hand is the one this import stated","reason":"Lines, not shadows. The reference grammar — the portfolio and Visionary alike — draws every level with a 1px rule and an alpha wash, and paints no drop shadow anywhere; a shadow is decoration the eye pays for on every card. The elevation tokens keep their offsets and paint nothing, so the rule does the work it was already doing.","consequence":{"collapsesTo":"transparent"}}
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
Decided by: human prometheus-000
Written by: agent claude-code
Reason: Lines, not shadows. The reference grammar — the portfolio and Visionary
alike — draws every level with a 1px rule and an alpha wash …
Id: d0mtlvzac0-5lk7
At: 2026-09-03T18:56:42.000Z · via import:src/theme/ledger.json

CONTEXT
──────────────
target: token:--shadow-color  (record)
decisions on this target before it: 0  (record)

EVIDENCE
──────────────
consumers: 0  (token.usage)
usage concentration: none  (token.usage)
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
--shadow-color: transparent; /* cut by human prometheus-000: Lines, not shadows. … */
```

Two things the model refuses to be, both stated in the principles and worth
saying once more where the type is. The log is history where it is a witness
and source where it is derivable, and it never pretends to be both: a move is
on the record with its provenance, but the JSX is the state, and nothing
replays moves into source. And evidence is never computed when a decision is
written: a drag mid-design writes a line and hears nothing, because a design
in progress fails any check by definition.

And one thing it is not, which is easy to assume from the word "record":
**ordinary use is not a decision.** Nothing writes a line for a `var(--accent)`
already sitting in a recipe. The record holds departures and rulings, and
consumers are evidence — counted by `explain` and `check` from the source,
when someone asks. Thirty-six lines of judgement can be read end to end;
thirty thousand lines of usage cannot be read at all.

## Context & Precedent

Before a rule, there is what the record shows.

```
$ strata precedent --property padding

  # ILLUSTRATIVE — the shape of the output, not a reading of this record.
  # This product's record holds token decisions and two decisions made in a
  # live session; it has no override convergence yet. Run it and see.
  5 instances independently converged on padding = 12px across 2 views · 3 hands: prometheus-000, ada, and 1 decision by an unnamed hand · 4 by hand, 1 by agent — a candidate for promotion, which is a hand's to decide
  1 instance converged on padding = 16px · hands unnamed · 1 by hand
```

`strata precedent` searches every decision by property, value, component,
token, the kind of hand, the *named* hand (`--actor`), time, and the words in
its reason. It counts two things, and they answer different questions.
Distinct **targets** say a value was reached in more than one place. Distinct
**hands** — distinct `decided.actor` — say it was reached by more than one
person. One hand touching nine instances is a habit; three hands reaching the
same value is evidence, and independence means distinct hands wherever hands
are named. Where none is named the record says `hands unnamed` rather than
counting decisions as people.

Crossing the threshold makes a convergence a **candidate**, and that is the
whole of what is computed. The threshold is a preference in the grammar —
three, by default — and the drift report reads the same number. Promoting a
candidate is a decision: widen the scope, or mint a name for the value.
Nothing here has authority of its own; it is what happened.

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

### The contract

Two columns, because they are not the same kind of promise and reading them
as one is how a system gets trusted for things it never claimed.

| Strata **guarantees** | A harness **honours** |
| --- | --- |
| The four invariants: the record parses, the projections match it, every fallback chain ends, every `var()` resolves. | Every write goes through the door — `strata …`, the overlay, or `strata_decide`. |
| Every write through `decide()` carries who chose, who wrote, and why. | `--decided-by` says who chose, and it is answered honestly. |
| A packet assembled from the record, the grammar and the live state, on request. | Projections and `data-*` stamps are never hand-edited. |
| A projection can be produced again from the record, and `rebuild --check` proves it. | The packet is read before the work, not after. |
| The eight kinds are the only things `decide()` writes. | What an agent may decide *within* the work is the harness's call, not Strata's. |

**The frame is not decidable.** The eight kinds — `token`, `override`, `move`,
`prop`, `seed`, `deviation`, `ship`, `ready` — are all acts *within* the work:
cut a name, set a property, move a region, pick a value, move the seeds,
declare a literal, ship, hand off. The frame the work happens inside is a
different category of thing — `grammar/rules.json`, the skills' front matter
and bodies, `CLAUDE.md`, which rules are invariants, what number a preference
carries — and none of it comes through this door. There is no `rule` kind.
Rules, skills and thresholds are not decisions; nothing writes them through
`decide()`, and a test asserts the registry still admits exactly those eight,
so adding a ninth is a deliberate act with an argument attached.

The omission is the design, not an oversight. A decision inside a frame cannot
license a change to the frame without the frame meaning nothing: an agent that
can rewrite the rules it works under is not working under rules, and a grant of
latitude on one feature is not a grant to rewrite the terms that apply to
everything after it.

Which is also why the right-hand column says what it says. **Strata does not
decide how much autonomy an agent has** — the prompt does, and the harness
does. The substrate records every decision and its author and limits neither;
an agent may cut every token in the vocabulary if that is what it was asked to
do, and the record will say who chose. Autonomy over the *frame* is not
granted by anything here, because there is no door for it to come through.

One gap, named rather than papered over: **the frame files are ordinary files.**
Any writer with a filesystem — a person, an agent, a script — can edit
`rules.json` or a `SKILL.md` outside `decide()`, and Strata does not currently
notice. What holds is that such an edit is not a *decision*: it leaves no line,
carries no author and no reason, and shows up as a diff for a reviewer like any
other. That is a weaker guarantee than the one the record makes about
projections, and it is stated here rather than implied away.

The failure mode, in one sentence: **a hand-edited projection fails
`projections.match-record` on the next check, and a hand-edited JSX does
not — the record simply does not know.** That asymmetry is the two ontologies
in Principle 1 showing through, and it is why the skills are written as terms
of working here rather than as enforcement. Nothing stops an agent from
editing a component by hand. The record just will not contain the reason, and
a year later nobody will know there was one.

There is one write path. The terminal, the overlay in the browser, an agent's
shell, and an MCP call each build a request and say **both** who chose and
whose hand wrote it. Neither is guessed. `--decided-by human|agent` (`--by` is
the same flag), then `STRATA_DECIDED_BY`, then `STRATA_AUTHOR`; `--actor`
names the hand. `CLAUDECODE` in the environment — which Claude Code sets for
every command it runs — infers the hand that *wrote* and never the hand that
decided, and an agent's shell with nothing else stated is refused rather than
guessed at. The sentence that decided both is printed on every write and kept
on the decision. The overlay writes `human` for both, because a pointer is a
hand and the hand on the mouse is the hand that chose. There is no API an
agent has that a person does not, and no projection an agent edits that the
record does not see.

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
  - "say who chose: who could have chosen otherwise? if the target and the value were both named to you, --decided-by human --actor <their handle>; if you chose either, --decided-by agent"
  - "using a token is not deciding one: nothing writes a line for a var(--x) already in a recipe"
evidenceRequired: [consumers, usage concentration, duplicate visual role]
typicalDecisions: [token/cut, token/keep]
examples: [d0mtlvzac0-5lk7, d0mtlvzac0-fnuq]
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
| **Precedent** | "37 instances, 3 hands, converged on 12px." | Computed from the record. Never declared. Candidacy is the computed part; promoting a candidate is a decision. |

Most policy is *cited*, not evaluated, and the count belongs here rather than
in a footnote. Of 32 rules, four are invariants and 28 are not; eleven of those 28
have an evaluator that speaks for them, and the other seventeen say
`"check": "none"` in `grammar/rules.json` and are carried into skill packets
to be read by a hand. `strata check` prints that count under CITED, NOT
EVALUATED, because a rule nothing evaluates is silent, and silence is easily
mistaken for a pass.

Eight of the seventeen are marked `"scope": "product"`: they are this
product's taste — one family, two radii, lines not shadows — not the system's
rules, and an adopter is expected to replace them. Everything in GRAMMAR.md's
voice section is in that eight.

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
✓ record.parses — 36 decision(s)
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
— and the engine (`@strata/engine`) derives every colour, surface, stroke,
radius, rhythm and easing from them, deterministically, in OKLCH. It is one
module, imported by this product and by the malleable layer alike; it was two
for a while, 134 diff lines apart, and two compilers are two authors of the
semantic tier. The engine is the only author of that tier, because the first
week of this repo produced drift by transcription that nobody had chosen, and
`layer0.engine-only-author` is now checkable rather than merely cited.

Ten roles that used to be hand-written into the emitter — the control
heights, the pads and gaps, `--radius-pill`, the three `--font-*` and the
three `--shadow-*` — are engine proposals like everything else, so every
semantic role has one origin, a line in the ledger, and a fallback that says
what it collapses to.
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
$ strata cut --accent-strong --why "one filled action per surface" --decided-by human --actor prometheus-000

  --accent-strong: kept → cut
  collapses to --accent — One filled action per surface; a second strength of accent is the first thing a small system does without.
  decided by human — --decided-by human on the command line; written by agent claude-code — CLAUDECODE in the environment
  ~ src/theme/ledger.json, src/tokens/semantic.css, src/tokens/tokens.json, .strata/decisions.jsonl
```

A person decided it; an agent's shell typed it; the record says both, and the
stylesheet credits the hand that chose:

```css
--accent-strong: var(--accent); /* cut by human prometheus-000: one filled action per surface */
```

**A region moves, by an agent, when asked.** The JSX is rewritten, imports
follow, and the line says what the moved element still needs.

```
$ strata move Filters --to nav --decided-by human --actor prometheus-000 --why "the filters belong with navigation"

  fixtures/app/views/Page.tsx: removed <Filters /> · fixtures/app/views/TopBar.tsx: inserted <Filters /> · import added

  <Filters />  Page.main.page__main → TopBar.nav.topbar__nav   fixtures/app/views/TopBar.tsx:18 · human prometheus-000 (written agent claude-code)
  decided by human — --decided-by human on the command line; written by agent claude-code — CLAUDECODE in the environment
  ~ fixtures/app/views/Page.tsx, fixtures/app/views/TopBar.tsx, .strata/decisions.jsonl
```

Asked to put the filters in the top bar, the agent chose nothing: the region
and the destination were both named to it. So the deciding hand is the
person's and the writing hand is the agent's, which is what the line says.
Had it been told "the top bar feels empty" and picked the filters itself, the
deciding hand would be `agent` and the instruction would go in `--why`.

**Drift converges; promotion is earned.** Three instances reach 12px by
hand; the record says so; a person widens it.

```
$ strata check
PRECEDENT
──────────────
drift.convergence  padding = 12px
    3 instances independently converged across 2 views · hands unnamed · 3 by hand, 0 by agent — a candidate, which is computed; promoting it is a hand's decision

$ strata set Card.div.st-card padding 12px --scope view --view gallery --decided-by human --actor prometheus-000 --why "every card here"
  padding = 12px on Card.div.st-card
  scope: view · absorbed 3 narrower override(s)
```

Or, when the value has a job and no name, the other kind of promotion — the
one that adds a word to the language rather than choosing within it:

```
$ strata mint --radius-card --value 12px --from d0mtlvzac0-ed0m --why "nine cards reached 12px independently; the value has a job and no name"

  minted --radius-card = 12px
  minted from 1 converging decision(s); cut, it collapses to 12px
```

**A handoff.** The designer presses ready; the reviewer reads what changed
since the last one, with a reversal collapsed away.

```
$ strata handoff

  <Badge tone>  accent → positive   fixtures/app/views/Gallery.tsx:14 · human prometheus-000
  <Filters />  Page.main.page__main → TopBar.nav.topbar__nav   fixtures/app/views/TopBar.tsx:18 · agent claude-code
      needs wiring: open

1 line was decided by an agent, not merely written by one — a person reviews it before it is committed:
  d0mtm5z44t-ifap  <Filters />  Page.main.page__main → TopBar.nav.topbar__nav   fixtures/app/views/TopBar.tsx:18 · agent claude-code

ready for review — human prometheus-000, 2026-09-03T18:02:11.000Z
```

The split is the point. An agent that typed a person's decision needs no
second look; an agent that *chose* is a line nobody has seen, and the handoff
names those rather than leaving a reviewer to work out which is which.

## CLI

One interface. Every write is a decision on the record and states two hands:
`--decided-by human|agent` (`--by` is the same flag; otherwise
`STRATA_DECIDED_BY`, then `STRATA_AUTHOR`) with `--actor <handle>`, and
`--written-by`, which `CLAUDECODE` answers on its own. Plus `--why "…"` and
`--dry`.

```
the record
  check [--enforce] [--json]  here is what happened: invariants, then policy, preference, knowledge, precedent, handoff
  explain <id | targetKey>    one decision as a glass box: DECISION · CONTEXT · EVIDENCE · CONSEQUENCE
  log [--kind k]              every decision, one line each
  history <targetKey>         every decision on one target
  show <id>                   one decision
  precedent [words] [--property p] [--value v] [--component C] [--token --x] [--author a] [--actor h] [--unpromoted]
  skill [name] [--<input> v]  the skills, or the packet for one
  ready [--why …]             hand off what changed since the last ready
  import                      bring the old ledger and store onto the record, once
  rebuild [--check]           write every projection from the record; --check only says which differ

tokens (Layer 0)
  list · cut · keep · propose --<token> [--why …]
  mint --<token> --value <v> --why …   coin a name for a value usage kept reaching
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

A harness without a shell reaches the same calls over MCP — `strata_skill`,
`strata_precedent`, `strata_explain`, `strata_decide`, `strata_check`,
`strata_log`, and no seventh tool that edits a file. See `mcp/README.md`;
`strata_decide` requires `decided` and infers nothing, because a tool call
carries no shell to read.

`npm run ledger -- cut …` and `malleable move …` still work; they run the
same functions. The library runs alone too:

```bash
cd strata-malleable && npm install && npm test && npm run dev
```

Every push to `main` runs the tests and the build and publishes the site.

## What's not built

Stated so the next reader inherits the test and not the verdict:

- **The packet claim is tested once, narrowly, and holds in a narrower form
  than it is usually stated.** `bench/` ran two tasks from a packet and from a
  component list. On one of the two, the arm without the record made a correct
  decision that silently undid three house decisions it had no way to see —
  shadows repainted, dialogs given back their overshoot, a third radius
  returned — while the arm with the record lost nothing. On the other task the
  arms were indistinguishable. So: *a record that carries reasons keeps
  decisions from being undone by people who never saw them.* The broader
  "collage versus coherent work" framing is not what was measured. One run per
  cell, one model, and `bench/README.md` lists the rest of the limits.
- **The honours column is honoured by refusals, not by supervision — which is
  the one place worth spending.** A second experiment crossed context with
  harness: the same packet, but one arm held to the honours column as explicit
  terms of work. It changed the artifact not at all. Every arm, including the
  ones that had never seen a skill file, already wrote through `decide()`
  rather than editing a projection, already named two hands correctly, and
  already refused to invent decisions for values it could not attribute — one
  of them citing `author.ts` on not guessing a deciding hand. Nobody obliged
  any of it. The door did: `authorFrom` refuses to guess and prints why,
  `problemsWith` refuses a malformed line by name, `rebuild --check` reports
  drift unasked, and `--help` teaches `--decided-by` to anyone who types it. A
  refusal is written once and travels with the artifact; a harness has to be
  wrapped around every performer, forever.

  The one thing the terms measurably changed was containment — the unheld arms
  read this repository's own README and GRAMMAR from outside their sandbox, the
  held arms read nothing outside it — and that was the experiment's need, not
  the work's. In real use an agent reading the README is the point.

  Two things this does not license. The sample is four capable agents on one
  model, so "no harness needed" is a claim about performers of that quality and
  no others. And the failure that mattered was immune to both: no harness and
  no amount of care could restore three decisions nobody had written down. That
  is a record problem, and the answer to it is more refusals, not more
  supervision.
- **The record is thirty-six lines, and thirty-four of them were imported.**
  Two were decided in a live session. That is a record of a vocabulary, not
  yet a record of a product being designed.
- Code → Figma regeneration on CI. The Figma library was pushed by hand once
  and is a stale projection; `figma-library-state.json` is the evidence.
- The hub renders the record but cannot evaluate it: evidence needs the
  filesystem, so the four blocks on the site are two — DECISION and
  CONSEQUENCE. Either precompute the evaluation at build, or say the hub is
  the two blocks and stop implying four.
- A move takes a region, not a landmark and not a list item. A component
  whose root is a fragment can be moved from the terminal but not by hand: the
  overlay needs a host element to hit. A prop control writes literals and
  leaves expressions to the code, so `prop={cond ? a : b}` is out of reach by
  design rather than by omission.
- `--actor` is optional, and a decision without one is countable but not
  attributable. Precedent says `hands unnamed` rather than guessing, and the
  `because` sentence records that the name was missing where it happened.
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
