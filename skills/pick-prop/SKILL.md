---
name: pick-prop
description: Use when asked to change a component's variant or option at a call site — the badge's tone, whether a card is interactive — or to declare what a component allows to be changed. A pick rewrites the attribute and is a decision on the record.
purpose: Change one prop at one call site to a value the component declared it allows, through the same operation a designer's pick runs, so the record names who picked it and the JSX is the state.
inputs: [component, prop, value]
context:
  state: [structure]
  precedent: { kind: prop, component: $component }
  rules: [layer2.recipes-speak-tokens, layer2.one-filled-action, layer2.status-ink-and-wash]
constraints:
  - pick only what the component declared with defineControls; a control is a promise that any option is a valid state
  - a call site rendered from a list is one line of source; a pick on one instance is a pick on all of them, and that is correct
  - an attribute whose value is an expression is left to the code
  - "say who chose: who could have chosen otherwise? if the target and the value were both named to you, --decided-by human --actor <their handle>; if you chose either, --decided-by agent. Your shell already says who wrote it"
  - "using a token is not deciding one: nothing writes a line for a var(--x) already in a recipe. Consumers are evidence, computed on request"
  - pass --why on every write; a decision without a sentence is a keystroke
evidenceRequired: [reuse count]
typicalDecisions: [prop]
examples: []
reasons: |
  A component says what may be changed about it, beside itself, the way
  Framer's property controls sit beside a component — because the person who
  wrote <Badge> is the one who knows tone has three values. A pick writes the
  attribute at the call site: a diff, not an override, receipted with its
  author like a move. If one card in a group must differ, that is data, and
  the reviewer changes the data.
---

## Procedure

1. Read the component's controls — `defineControls(...)` beside it — and the
   call sites in the file (`strata prop` names the parents when there is more
   than one).
2. Read the precedent above: what has this prop been picked to before, and
   how often? Three call sites converging on one value is a default asking
   to be changed at the component.
3. Decide, on the record:

   ```bash
   strata prop Badge tone positive --in fixtures/app/views/Gallery.tsx --decided-by agent --why "…"
   strata prop Badge tone --default --in fixtures/app/views/Gallery.tsx --decided-by agent
   ```

4. Declare only what the component genuinely allows when adding controls;
   `strata id` reports a declaration it cannot read.
