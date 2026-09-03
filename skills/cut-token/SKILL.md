---
name: cut-token
description: Use when asked whether a generated token earns its place, to cut or keep one, or to review the ledger. Every decision goes through strata cut|keep with a reason.
purpose: Decide whether a token the engine emits earns its place in the vocabulary, and cut it — to its declared fallback, never to nothing — or keep it, with the reason on the record.
inputs: [token]
context:
  state: [tokens, consumers]
  precedent: { kind: token, token: $token }
  rules: [layer0.semantic-names-only, layer0.engine-only-author, voice.lines-not-shadows, voice.two-radii, layer2.one-filled-action, knowledge.accent-gate]
constraints:
  - never edit src/tokens or src/theme/ledger.json by hand — they are projections of the record
  - a cut collapses to the fallback beside the engine; you do not choose the floor, you decide whether the token stands
  - one decision per token per reason; if the reason changes, decide again and the record keeps both
  - "say who chose: who could have chosen otherwise? if the target and the value were both named to you, --decided-by human --actor <their handle>; if you chose either, --decided-by agent. Your shell already says who wrote it"
  - "using a token is not deciding one: nothing writes a line for a var(--x) already in a recipe. Consumers are evidence, computed on request"
  - pass --why on every write; a decision without a sentence is a keystroke
evidenceRequired: [consumers, usage concentration, duplicate visual role, contrast on dark (vs --surface-page)]
typicalDecisions: [token/cut, token/keep, token/propose]
examples: [d0mtlvzac0-5lk7, d0mtlvzac0-fnuq, d0mtlvzac0-ed0m]
reasons: |
  A cut token does not disappear. Fourteen sites say var(--accent-strong); a
  property that simply stopped existing would fail every one of them silently,
  at the consumer. So it collapses — to a fallback declared beside the engine,
  with the decision emitted where the token is defined — and the projections
  say what was decided rather than quietly lacking a name.

  The house voice is a set of cuts: no shadow colour, one easing curve, two
  radii. Each one has a reason a reader can disagree with, which is the point.
---

## Procedure

1. Run `strata explain token:<token>` and read the four blocks. The CONTEXT
   block is what the record already says; the EVIDENCE block is what the
   consumers say. A token with no consumers is headroom or a cut candidate —
   only the reason tells which.
2. Read the precedent above: has this token, or its role, been decided before?
   A reversal is allowed; it is a second decision, not an edit.
3. Ask one question: does the vocabulary need this distinction? A second
   strength of accent is the first thing a small system does without; a
   fourth surface level is the order a popover needs. The rules cited above
   carry the incidents that settled similar questions.
4. Decide, on the record:

   ```bash
   strata cut --<token> --why "<one sentence a reader can disagree with>" --decided-by agent
   strata keep --<token> --why "…" --decided-by agent
   ```

   The projections regenerate in the same call. Read the printed line: it
   names the fallback it landed on and the sentence that decided the author.
5. Run `strata check`. A cut that leaves consumers is not a failure; the
   consumers are counted and shown. Say what you noticed, as observations.
