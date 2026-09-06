# Getting started with Strata

A guide for the first hour **with this repository**, which is itself a Strata
product: clone it, run it, read the record, make one decision, hand it off.

To put Strata in **your own** repository instead — an existing product or an
empty directory — [ADOPTING.md](ADOPTING.md) is that path, and it is two
commands: `npm install --save-dev strata-design && npx strata init`. Nothing
below applies to it; this repository already has a record, so it needs no
`init`.

If you have not read [README.md](README.md) yet, one paragraph is enough to
start: **Strata keeps a record of what a product decided** — every token cut,
every override, every move — in one append-only file, `.strata/decisions.jsonl`.
The CSS, the tokens, the React theme, the override store: those are
*projections*. They are written out of the record, and they can be written
again. Nothing here is edited by hand except through a decision.

---

## 1. What you need

| | |
| --- | --- |
| **Node** | 20 or newer (22+ recommended). `node -v` |
| **npm** | 10 or newer. Ships with Node. |
| **git** | to clone the repo. |

Nothing else. No database, no API key, no account. Strata calls no model — an
agent brings its own harness.

## 2. Install

```bash
git clone https://github.com/Prometheus-000/strata.git
cd strata
npm install
```

That links the three workspaces into the packages above them: `identity/` — the
identity engine, an append-only state drawn as a field, with the adapter from
the record beside it; `substrate/` — the
dependency-free core holding the decision type, the log, and `decide()` — and
`engine/`, the semantic compiler that turns seven numbers into every token. It
takes a few seconds.

## 3. Check that it works

```bash
npm test
```

Three suites run — the substrate, the root, and the malleable layer — and all
three should be green. None of them needs a browser.

Then ask the record how it is doing:

```bash
npm run check
```

```
INVARIANTS
──────────────
✓ record.parses — 66 decision(s)
✓ projections.match-record
✓ fallbacks.total-acyclic
✓ css.vars-defined
…
every invariant holds; the rest is evaluation, and none of it blocks anything
```

Read that last line carefully, because it is the whole governance model. **Only
the four invariants can fail a build.** Everything below them is reported to
you and never enforced:

| Block | What it is |
| --- | --- |
| `POLICY` | a rule with an evaluator found something — e.g. seven filled buttons in one file |
| `PREFERENCE` | this product's taste, carrying its number |
| `KNOWLEDGE` | declared deviations, unused tokens, tokens still unreviewed |
| `PRECEDENT` | what has converged by hand often enough to be a promotion candidate |
| `CITED, NOT EVALUATED` | rules no evaluator checks. They are cited into skills and read by a hand — silence about them is not a pass |
| `HANDOFF` | what changed since the last `ready` |

A design that is different is evidence, not an error.

> **How to run the CLI.** `npx strata <command>`, here and in any product that
> installed it.
> ```bash
> npx strata check
> npx strata log
> ```
> (`npx strata <command>` runs the same thing, and is what the npm
> scripts use.)

## 4. Run it

```bash
npm run dev
```

One server, six pages — open <http://localhost:5173>:

| Page | What it is |
| --- | --- |
| `/` | **The hub.** The showcase and the **Theme Lab**: seven dials — hue, chroma, lightness, warmth, energy, density, and dark/light — recompile every color, radius, rhythm and easing on the page, deterministically, in OKLCH. The URL is the theme, so a link carries the seeds. The record itself is rendered further down. |
| `/personalize.html` | **The personalizer.** The same engine with the two controls an end user actually wants: say a mood, or pick one. Remembered on the device. |
| `/malleable.html` | **The malleable layer.** A live page you change by hand. Drag a corner and it is an override; drag a region into another landmark and the JSX rewrites itself; pick a value on a component's own control and the attribute is rewritten. The promote control asks one question — how far does this go — in four words. |
| `/lab.html` | **The Theme Lab, alone.** The same instrument without the hub around it, for a frame that only has room for one. |
| `/identity.html` | **The identity.** The record drawn as a field: one state, four projections, from the literal to the abstract. Move to disturb it; click to decide. `?full` is the field alone; `?seed=7` runs a synthetic record. |
| `/sky.html` | **The sky.** The same record with depth: every record at a distance, one record as a galaxy, its families as systems, each target a planet, each decision a moon. One zoom; click a body to fly to it. |

The dev server **writes through**: every one of those gestures appends a
decision to `.strata/decisions.jsonl` in this repo. The published static site
cannot write; it only shows what was decided.

Start dragging on `/malleable.html`, then come back to the terminal and run
`npx strata log` — your gestures are on the record, decided `human`,
via the overlay. A pointer is a hand, so the overlay never has to ask.

## 5. Read the record

Four commands cover most of it.

```bash
npx strata log                              # every decision, one line each
npx strata show <id>                        # one decision — take an id from the log
npx strata history token:--accent-strong    # everything ever decided about one target
npx strata explain token:--shadow-color     # the glass box
```

`explain` is the one to learn. It prints four blocks — **DECISION** (what, who,
why, when), **CONTEXT** (what the record already said), **EVIDENCE** (how many
consumers, where they are, whether a duplicate role exists), and
**CONSEQUENCE** (what the cut collapses to). No answer here is asserted; each
line says where it came from.

And to ask what has been decided before:

```bash
npx strata precedent --property padding
npx strata precedent --actor prometheus-000
npx strata precedent --unpromoted            # drift nobody has promoted yet
```

Precedent is *computed* over the record, never declared. "37 instances
independently converged on 12px" is a fact about history, and it is how
something earns its way into the shared system.

## 6. Say who decided — the part to get right

Every write names **two hands**, because they are two different questions:

| Flag | Question it answers |
| --- | --- |
| `--decided-by human\|agent` | who could have chosen otherwise (`--by` is the same flag) |
| `--actor <handle>` | which hand that was — a handle, an email, a harness id |
| `--written-by human\|agent` | whose hand ran the command |

Either may be an agent, and neither outranks the other. A decision a person
made and an agent typed is `decided: human, written: agent` — one line, both
true.

The rule that catches people: **an agent's shell that states neither is
refused, not guessed at.** Claude Code sets `CLAUDECODE` for every command it
runs, and that says who *wrote* and never who *decided*:

```
  CLAUDECODE says an agent's shell is writing this, but not who decided it,
  and that is not a guess this makes.
  Ask: who could have chosen otherwise? If the target and the value were both
  named to you, --decided-by human. If you chose either of them,
  --decided-by agent. Add --actor <handle> to say which hand.
```

That refusal is deliberate. Guessing is exactly what put an agent's name on
thirty-four of this record's decisions once already.

Beyond the flags: `STRATA_DECIDED_BY`, `STRATA_WRITTEN_BY`, `STRATA_ACTOR` and
`STRATA_AUTHOR` in the environment, in that order of deference.

## 7. Make your first decision

Every write takes `--why "…"` and accepts `--dry`. Start with `--dry` — it
prints exactly what would happen and writes nothing:

```bash
npx strata cut --motion-instant --why "trying it out" --decided-by human --actor you --dry
```

```
  --motion-instant: kept → cut
  collapses to 0ms — Below instant there is no motion, which is what reduced-motion already does.
  decided by human — --decided-by human on the command line; written by agent claude-code — CLAUDECODE in the environment
  (dry run — nothing written)
```

Three things to notice:

1. **A cut token never vanishes.** It collapses to a declared fallback, so the
   sites that say `var(--motion-instant)` keep working.
2. **The sentence that decided authorship is printed and kept.** It lands on
   the decision as `because`, so a wrong default is visible where it happened.
3. **`--why` is not optional in spirit.** The reason is the durable part; the
   CSS is a receipt.

Drop `--dry` and the same call writes: it appends the decision *and*
regenerates every projection it touches, in one step.

Then confirm nothing drifted:

```bash
npx strata rebuild --check
```

```
  = src/theme/ledger.json
  = src/tokens/semantic.css
  = src/tokens/tokens.json
  = strata-malleable/.malleable/overrides.json

  every projection matches the record
```

`--check` only reports. `npx strata rebuild` (no flag) rewrites all four
files from the record — which is the point: you can delete them and get them
back.

**Never hand-edit those four files.** They are outputs. The next `rebuild`
overwrites your edit, and `check` will tell you they disagree with the record
before that.

## 8. Hand it off

When you are done designing, say so:

```bash
npx strata ready --why "gallery pass" --decided-by human --actor you
```

That marks a point on the record. The reviewer then reads what changed since
the last one — moves, picks and overrides, with reversals collapsed away —
rather than a diff of generated files:

```bash
npx strata handoff
```

Each line names both hands, so a proposal an agent made and a person confirmed
reads as exactly that:

```
  cut --radius-overlay → --radius-surface · human prometheus-000 (written agent claude-code) · …
```

Nothing evaluates you mid-drag. Evaluation happens at `ready`, at `check`, and
when you ask.

## 9. Working with an agent

An agent gets no private door: same `decide()`, same record, same flags — it
just has to say which hand decided.

```bash
npx strata cut --accent-strong --why "one filled action per surface" --decided-by agent --actor claude-code
```

An agent does not read the design system — it performs a **skill**. List them:

```bash
npx strata skill
```

```
  cut-token        Decide whether a token the engine emits earns its place …
  move-region      Move a region — a component call site under a landmark — into another landmark …
  pick-prop        Change one prop at one call site to a value the component declared it allows …
  promote          Decide how far an override goes — just this, all here, the component, the system …
  retheme          Move the product to a new appearance by emitting a seed set — seven numbers …
  review-handoff   Take what the designer decided as given, make the code fit it …
```

Assemble the packet for one — the rules that bear on it with their authority,
the precedent found, the current state, worked examples resolved from this
product's own record, and the evidence a decision must carry:

```bash
npx strata skill cut-token --token --accent-strong
```

The harness's model performs that procedure. Strata calls no model itself.

**Without a terminal.** There is an MCP server at `mcp/server.mjs` serving six
tools — `strata_skill`, `strata_precedent`, `strata_explain`, `strata_decide`,
`strata_check`, `strata_log`. There is no seventh tool that edits a file:
`strata_decide` goes through the same `decide()` the CLI and the overlay call.
See `mcp/README.md` for the client config. A tool call carries no shell, so
`decided` is required there and nothing is inferred.

The Claude Code plugin lives in
`strata-malleable/integrations/claude-code`.

## 10. Troubleshooting

**My write was refused.** Read the message: it is almost always the authorship
question. Add `--decided-by human` or `--decided-by agent`, and `--actor
<handle>`. See [section 6](#6-say-who-decided--the-part-to-get-right).

**`npx strata` fails with `Cannot find module …/src/theme/generateTheme`.**
The `strata` bin has a plain `#!/usr/bin/env node` shebang but the CLI imports
TypeScript, so it needs a loader. Use `npx strata <command>` (or, if you
want the raw form, `node --import tsx/esm bin/strata.mjs <command>`).

**`npm run dev` says the port is taken.** Something is already on 5173; stop it,
or run `npm run dev -- --port 5174`.

**`rebuild --check` says projections differ.** Someone hand-edited a generated
file, or a decision landed without regenerating. Run
`npx strata rebuild`. The record wins, always.

**The build fails.** `npm run build` runs `check --enforce`, so it fails only on
one of the four invariants — the record does not parse, a projection disagrees
with it, a fallback chain does not terminate, or a `var()` names a property
nothing defines. It will not fail because a design is unusual. If it did, that
is a bug in the invariant.

**`npm test` reports a prose failure naming a file you added.** That is
`scripts/prose.test.ts` doing its job. It reads every markdown file and every
comment in the repo and checks that each npm script, `strata` verb and repo
path named there actually exists — including in this guide. Fix the name.

**A projection is in a directory I did not expect.** `.strata/config.json`
says where this product keeps its source and its tokens. It is frame, not a
decision: edit it by hand, then `npx strata rebuild`.

**I want to undo something.** You do not rewrite the record; you decide again.
The new decision supersedes the old one and both stay readable — that is what
`history` shows you.

## 11. Where things live

| Path | What it is |
| --- | --- |
| `.strata/decisions.jsonl` | **The record.** Append-only. The one source of truth. |
| `substrate/` | The core: decision type, log, `decide()`, projections, precedent, grammar, evaluators, `check`, skills. No dependencies, no framework, imports nothing above it. |
| `engine/src/generateTheme.ts` | The semantic compiler. Seven seeds in, every semantic role out, in OKLCH. One module — a vendored copy would be a second author. |
| `src/theme/` | The theme projection: handlers, the ledger, the emitters. |
| `src/tokens/semantic.css`, `src/tokens/tokens.json`, `src/theme/ledger.json` | Generated. Do not edit. |
| `strata-malleable/` | The layer a designer changes by hand — a projection, plus the dev-server write path. |
| `strata-malleable/.malleable/overrides.json` | Generated. Do not edit. |
| `grammar/rules.json` | The rules, as data — cited by skills, evaluated by `check`. |
| `skills/` | The six `SKILL.md` files an agent performs. |
| `.strata/config.json` | Where this product keeps its source and its tokens. Frame: edited by hand, never decided. |
| `.agents/skills/`, `.claude/skills/`, `skills-lock.json` | Harness skills, vendored and pinned — today one, `oklch-skill`: conversion, gamut and contrast, for whoever works on the engine. `.claude/skills` is shared ground: what makes a `SKILL.md` Strata's is that it states a `purpose`, and one without is the harness's, left alone. |
| `mcp/server.mjs` | The same door over MCP. |
| `bench/README.md` | The experiment: does a record of reasons change what an agent builds? |
| `bin/strata.mjs` | The one CLI; it mounts the substrate and both projections. |

## 12. Command cheatsheet

```
starting
  init [--yes] [--source d] [--tokens d | --no-theme] [--no-skills] [--mcp] [--dry]
                               begin a product: the record, the grammar, the skills, the tokens

the record
  check [--enforce] [--json]   invariants, then policy, preference, knowledge, precedent, handoff
  explain <id | targetKey>     one decision as a glass box
  log [--kind k]               every decision, one line each
  history <targetKey>          every decision on one target
  show <id>                    one decision
  precedent [words] [--property p] [--value v] [--component C] [--actor a] [--unpromoted]
  skill [name] [--<input> v]   the skills, or the packet for one
  ready [--why …]              hand off what changed since the last ready
  import                       bring an old ledger and store onto the record, once
  rebuild [--check]            write every projection from the record

the theme
  retheme [--hue n] [--chroma n] [--warmth n] [--energy n] [--density n] [--lightness n] [--appearance dark|light] [--link <url>]
  list · cut · keep · propose · mint --<token> [--why …]
  deviate <file>:<line> --why …
  survey

the layer a designer changes by hand
  id · regions · manifest · resolve · reconcile · drift · handoff
  set · remove · move · prop · ship

every write names two hands, takes --why "…", and accepts --dry
  --decided-by human|agent · --actor <handle> · --written-by human|agent
```

```bash
npm run dev       # the six pages
npm run identity  # the favicon and the mark, from the record
npm test          # substrate + root + malleable
npm run check     # what happened
npm run build     # tokens → check --enforce → tsc → vite
```

That layer also runs alone:

```bash
cd strata-malleable && npm install && npm test && npm run dev
```

---

**Next:** [GRAMMAR.md](GRAMMAR.md) for the rules and their authority, the
README's *Governance* section for why only four things can ever fail a build,
and [ADOPTING.md](ADOPTING.md) to put Strata in a repository of your own.
