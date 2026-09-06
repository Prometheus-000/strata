---
name: retheme
description: Use when asked to change the look of the product — warmer, calmer, a colour, a mood, a brand — or to produce a new theme from a phrase or an image. A theme is seven seeds; never edit CSS.
purpose: Move the product to a new appearance by emitting a seed set — seven numbers — and never by editing a stylesheet, with the reason on the record.
inputs: [intent]
context:
  state: [tokens]
  precedent: { kind: seed }
  rules: [layer0.light-not-inverted-dark, layer0.warmth-tints-neutrals, layer0.energy-buys-shape, layer0.engine-only-author, record.decided-not-written, record.use-is-not-decision]
constraints:
  - the engine is the only author of the semantic tier; a retheme is seeds, never values
  - stay inside the ranges tokens.json declares under strata.themeEngine.seeds.$ranges
  - the ground and whether there is colour at all are the product's voice, in the packet above; read it before you move a dial it speaks about
  - every write carries --why; the sentence is the decision, and the record keeps it
evidenceRequired: [contrast on dark (vs --surface-page), contrast on light (vs --surface-page)]
typicalDecisions: [seed]
examples: []
reasons: |
  Meaning, behaviour and expression change at different rates. A theme is the
  fastest-changing layer, so it is the smallest record: seven numbers that fit
  in a URL hash. Everything derived from them is a projection you can throw
  away. A light appearance is not inverted dark — the engine deepens accents
  to hold AA on paper, so nobody has to remember to.
---

## Procedure

1. Read the tokens state above, and the ranges and the reason behind each
   dial in the contract the projections write (`strata skill retheme` names
   the file under the projections state). Generate from the reasoning, not
   from the values.
2. Turn the intent into seeds. Fragments are fine — "quiet, warm, library".
   Hue is the accent's place on the wheel; chroma is how much colour there is
   at all, and 0 compiles the accent to ink; warmth tints every neutral;
   energy buys easing and shape together; density scales the rhythm;
   lightness places the ground within its appearance.
3. Decide, on the record. The seeds are the theme:

   ```bash
   strata retheme --hue 250 --chroma 0.08 --warmth 0 --lightness -1 --energy 0.35 --density 1 --appearance dark --why "…" --decided-by agent
   strata retheme --link https://…/lab.html#s=250,0.08,0,0.35,1,dark   # the seeds someone picked by eye
   ```

   Every projection is compiled from the record in the same call; there is no
   second step and no file to edit. In a project with the malleable layer,
   `strata set --scope system …` reaches the same decision from a property.
4. Run `strata check`. Contrast is evidence, reported per token; the engine
   already holds AA for text on the page, so a failing pair is worth a
   sentence, not a revert.
