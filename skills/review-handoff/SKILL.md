---
name: review-handoff
description: Use when a designer has pressed ready, when asked to review a handoff, or when /malleable-review runs. The whole job is to make the code fit the design and never move anything back.
purpose: Take what the designer decided — moves, picks, overrides — as given, make the code fit it, say what you noticed as observations, and never undo a decision that is not yours.
inputs: []
context:
  state: [structure, drift]
  precedent: { since: $since }
  rules: [knowledge.designer-defines-ux, evaluation.report-not-police, layer1.correctness-not-taste, layer2.one-filled-action]
constraints:
  - never move anything back; a designer's move is never wrong at the page level
  - anything you notice against the grammar is an observation in a line, never a cost and never a violation
  - if the handoff was pressed by an agent, say so: a person reviews before it is committed
  - commit the source and the record together; there is no receipt file to delete
evidenceRequired: [needs wiring]
typicalDecisions: [move, prop, ready]
examples: []
reasons: |
  Designers define the UX. Focus order, dismissal and keyboard handling are
  code, and when a region moves the code adapts — at review, by whoever
  generates. Undoing a designer's move is how a designer stops believing the
  tool. Pressing ready withholds nothing: the moves are already in source,
  and the handoff is a query over the record, not a file.
---

## Procedure

1. Read the handoff: `strata handoff`. Every move and pick since the last
   ready, collapsed — a reversal is a change of mind and does not appear —
   with its author, and whether it has been handed off.
2. Make the code fit. For each move, `strata explain <id>` says what it
   still needs (`needs wiring`) and where it landed. Give a moved dialog its
   dismissal context where it now lives; pass what a region read from its
   old parent; delete state nothing reads any more. Run the tests.
3. Say what you noticed, as observations, one line each: a region named by
   its old position, two filled actions on one surface, a pick that made a
   group inconsistent with its data. Not as costs. Not as violations.
4. `strata check` for the whole picture; only an invariant can fail it, and
   none of them is about the design.
5. Commit the source and `.strata/decisions.jsonl` together, with a message
   that says what the designer decided and what you wired. Do not press
   ready yourself; it is the designer's word.
