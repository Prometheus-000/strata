---
name: promote
description: Use when asked whether drift should become part of the system — the same override appearing across instances, views or components — or to widen a property override to a view, a component, or the seeds. Promotion is earned by count, never granted by proposal.
purpose: Decide how far an override goes — just this, all here, the component, the system — from what the record shows has converged, and widen it through the same operation the promote control runs.
inputs: [property]
context:
  state: [drift]
  precedent: { kind: override, property: $property, unpromoted: true }
  rules: [promotion.candidate-at, layer3.free, layer2.recipes-speak-tokens, evaluation.report-not-police]
constraints:
  - widening is a promise — "all here" absorbs every narrower override in the new scope, including ones that disagreed; the count is printed, never hidden
  - promotion to the system moves a seed, and the seed moves every token it derives; read the proposal before accepting it
  - un-promoted overrides are never cleaned up; someone made them on purpose
  - pass --by agent and --why on every write
evidenceRequired: [reuse count, independent, promotion candidate]
typicalDecisions: [override/rescope, override/set]
examples: []
reasons: |
  One is taste; nine of the same shape is a missing token, and the record is
  where that becomes visible. Promotion into the system is earned by count —
  the threshold is a preference in the grammar, three by default — which
  keeps the inventory small because everything in it was proven necessary.
  The precedent above is computed over history, not declared: thirty-seven
  instances independently converging on 12px is a fact, not a rule.
---

## Procedure

1. Read the drift above and the precedent: which values converged, from how
   many distinct targets, across how many views, by which hands. A
   convergence that meets the threshold is called a candidate; that is a
   finding, not an instruction.
2. Ask how far it goes. All here (view) when one screen wants it. The
   component when every use of the recipe wants it. The system when it is
   really a seed — and then read the proposal: which seed moves, by how
   much, and which other tokens move with it.
3. Decide, on the record:

   ```bash
   strata set Card.div.st-card padding 12px --scope view --view gallery --by agent --why "…"
   strata set Card.div.st-card radius --token --radius-pill --scope component --by agent --why "…"
   ```

   The printed line counts what was absorbed. A refusal — a literal base no
   seed can move, nothing to scope — is on the record too.
4. Run `strata drift` and `strata check`. What did not converge stays as it
   is, counted; it is the finding, not a failure.
