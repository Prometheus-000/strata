---
name: move-region
description: Use when asked to move a region of a page — "put the filters in the top bar", "the settings belong in the sidebar" — or to write a page whose regions can be moved. A move rewrites the JSX on the spot and is a decision on the record.
purpose: Move a region — a component call site under a landmark — into another landmark, through the same operation a designer's drag runs, so the record names who moved it and the JSX is the state.
inputs: [region, to]
context:
  state: [structure]
  precedent: { kind: move, component: $region }
  rules: [knowledge.designer-defines-ux, evaluation.report-not-police, layer1.correctness-not-taste]
constraints:
  - move through strata move, never by editing JSX by hand, so the record names you
  - never move anything back that a designer moved
  - a list stays inside a region; its data is its order
  - "say who chose: who could have chosen otherwise? if the target and the value were both named to you, --decided-by human --actor <their handle>; if you chose either, --decided-by agent. Your shell already says who wrote it"
  - "using a token is not deciding one: nothing writes a line for a var(--x) already in a recipe. Consumers are evidence, computed on request"
  - pass --why on every write; a decision without a sentence is a keystroke
evidenceRequired: [needs wiring, landed in]
typicalDecisions: [move]
examples: []
reasons: |
  Structure is moved, not declared. The page's landmarks are its containers —
  <header>, <nav>, <main>, <aside>, <footer>, role="dialog" — and a region is
  a component call site under one. A move is a diff; there is no store for
  structure and no contract a move can fail. An earlier version priced every
  drag against a declared contract and was removed: a design in progress
  fails any check by definition, and a designer's move does not cost the
  page anything. What it costs is code, and code is malleable to the design.
---

## Procedure

1. Read the structure above (`strata regions` prints it): every container
   with its file:line, and the regions it holds in order. Nothing declares
   it; the markup is the declaration.
2. Name the move by region and destination: a tag, a landmark, a sid, or
   file:line. Say which region when a name sits under two containers.
3. Decide, on the record:

   ```bash
   strata move Filters --to nav --decided-by agent --why "…"
   strata move Filters --to main --at 0 --decided-by agent
   strata move Filters --to nav --dry        # plan it, write nothing
   ```

   The JSX is rewritten, imports follow, and the printed line says what the
   moved element still needs from where it came (`needs wiring`).
4. A move that leaves state behind still lands. Wire it at review: give a
   moved dialog its dismissal context where it now lives, pass what it read
   from its old parent. That is the reviewer's job, and it is yours.
5. When writing a page so it can be moved: every region is a component call
   site exported from its own file; a component's root is a host element,
   not a fragment; regions sit under landmarks; lists stay inside a region;
   run `strata id` after adding a component.
