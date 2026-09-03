---
name: malleable
description: Use when generating, editing, moving, or reviewing pages, regions, or styled components in a project that uses strata-malleable (it has a `.malleable/` directory or `malleable` in its scripts). Covers writing pages whose regions can be moved, adding regions, deciding as an agent with --by agent, and reviewing a designer's handoff by adapting code to the design.
purpose: Work on a page the designer can change by hand, through the same record their hand writes to — generate what can be moved, decide when asked with your name on it, and at review make the code fit the design.
inputs: []
context:
  state: [structure, drift]
  rules: [knowledge.designer-defines-ux, evaluation.report-not-police, layer1.correctness-not-taste]
constraints:
  - every write is strata <verb> --by agent; never edit JSX or overrides.json by hand to change what a designer can change by hand
  - never move anything back
  - never write data-sid or data-region by hand; run strata id
typicalDecisions: [move, prop, override/set, ready]
examples: []
reasons: |
  Designers define the UX. A move is never wrong at the page level; code
  logic is malleable to the design. Nothing speaks while the designer is
  working: no hook, no lint, no cost mark. A design in progress fails any
  check by definition.
---

# Malleable

This project lets a designer change the real page by hand — drag a corner to
change a radius, drag an edge to change padding, **drag a region to move it
into another landmark** — with no prompt and no text box. Every one of those
is a decision on `.strata/decisions.jsonl`, the same record your writes go
to; a move rewrites the JSX on the spot, and `git diff` plus the record is
the whole story. Your half of the loop is different from theirs:

| Phase | Who | Why |
|---|---|---|
| Generate a page, a region, a component | **You** | Something must exist before it can be moved |
| Move a region, change a property | **The designer** | Choosing where things go needs a hand, not a prompt |
| Move a region when asked to, by name | **You, as `agent`** | `strata move … --by agent`, so the record says who decided |
| Review the handoff and make the code fit | **You** | Designers define the UX; code logic is malleable to the design |

**The premise: designers define the UX.** A move is never wrong at the page
level. Focus order, dismissal, keyboard handling are code, and when a region
moves the code adapts — at review, by you. Nothing speaks while the designer
is working: no hook, no lint, no cost mark. A design in progress fails any
check by definition.

## The substrate, in one paragraph

There is one record and one way to change it. `strata <verb> … --by agent`
applies the change and appends a decision with your name, your reason and
what followed. `strata explain <id>` shows any decision as four blocks —
DECISION, CONTEXT, EVIDENCE, CONSEQUENCE. `strata precedent …` says what
was decided before. `strata check` says what happened; only a mechanical
invariant can fail it, never a design. The skills assemble the context for
a piece of design work: `strata skill <name> --<input> …`.

## Vocabulary

- **Container** — a landmark element: `<header>`, `<nav>`, `<main>`, `<aside>`,
  `<footer>`, `role="dialog"`, `<form role="search">`, or the root element of
  the page component. Regions move between containers. Nothing declares one;
  the page's own markup is the list.
- **Region** — a component call site under a container: `<Filters />` inside
  `<main>`. The unit that moves.
- **Identity** — `data-sid` on styled nodes and landmarks, `data-region` on the
  root element of every component. Stamped by `strata id`. **Never write or
  edit these by hand.**

## Writing a page so it can be moved

See the `move-region` skill (`strata skill move-region`): every region is a
component call site exported from its own file; a component's root is a
host element; regions sit under landmarks; lists stay inside a region; run
`strata id` after adding a component.

## Property controls — what a component says may be changed

```ts
import { defineControls } from 'strata-malleable'

export const controls = defineControls(Card, {
  tone: { options: ['neutral', 'accent', 'positive'] },  // a prop with options: picked on the object
  interactive: { toggle: true },                          // a boolean prop: one chip, on or off
  lines: { range: [1, 6] },                               // a numeric prop: scrubbed sideways, within the range
  radius: { range: [0, 24], snap: ['--radius-pill'] },    // a CSS length on the root node: its own handle limits
  padding: false,                                         // no handle for this one
})
```

A pick rewrites the attribute at the call site — a decision on the record,
like a move. Declare only what the component genuinely allows. See the
`pick-prop` skill.

## Deciding as an agent

```bash
strata regions                                      # containers and what they hold
strata move Filters --to nav --by agent --why "…"   # into the nav, at the end
strata move Filters --to main --at 0 --by agent     # before the first region of main
strata prop Badge tone positive --in fixtures/app/views/Gallery.tsx --by agent
strata set Card.div.st-card radius 20px --view gallery --instance ember --by agent
strata ready --by agent                             # hand a generated page to review
```

Always pass `--by agent`. The CLI infers it from `CLAUDECODE` in your shell and
prints which signal it used, but an explicit flag is the honest record. A move
that leaves state behind still lands; the printed line says `needs wiring`.

## Reviewing a handoff

When the designer presses **ready**, it is on the record. `/malleable-review`
runs `strata skill review-handoff`. The whole job: **make the code fit the
design, and never move anything back.**

## Commands

```bash
strata id         # stamp identity, rebuild the manifest and structure — after any edit that adds a node
strata regions    # every container, with the regions it holds
strata handoff    # what changed since the last ready, from the record
strata drift      # un-promoted property overrides, counted by shape and by author
strata explain    # one decision as a glass box
strata check      # what happened; invariants, then everything else
strata skill      # the skills, and the packet for one
```
