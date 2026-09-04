---
name: retheme
description: Use when asked to change the look of the product — warmer, calmer, a colour, a mood, a brand — or to produce a new theme from a phrase or an image. A theme is six seeds; never edit CSS.
purpose: Move the product to a new appearance by emitting a seed set — six numbers — and never by editing a stylesheet, with the reason on the record.
inputs: [intent]
context:
  state: [tokens]
  precedent: { kind: seed }
  rules: [layer0.light-not-inverted-dark, layer0.warmth-tints-neutrals, layer0.energy-buys-shape, voice.monochrome-default, voice.dark-first, layer0.engine-only-author, record.decided-not-written, record.use-is-not-decision]
constraints:
  - the engine is the only author of the semantic tier; a retheme is seeds, never values
  - stay inside the ranges tokens.json declares under strata.themeEngine.seeds.$ranges
  - chroma 0 is the house default; colour is a choice you state a reason for
  - every write carries --why; the sentence is the decision, and the record keeps it
evidenceRequired: [contrast on dark (vs --surface-page), contrast on light (vs --surface-page)]
typicalDecisions: [seed]
examples: []
reasons: |
  Meaning, behaviour and expression change at different rates. A theme is the
  fastest-changing layer, so it is the smallest record: six numbers that fit
  in a URL hash. Everything derived from them is a projection you can throw
  away. A light appearance is not inverted dark — the engine deepens accents
  to hold AA on paper, so nobody has to remember to.
---

## Procedure

1. Read `src/tokens/tokens.json` → `strata.themeEngine`: the ranges, and the
   reason behind each dial. Generate from the reasoning, not from the values.
2. Turn the intent into seeds. Fragments are fine — "quiet, warm, library" —
   `compilePrompt` in `src/theme/compilePrompt.ts` shows how words map to
   dials and prints a receipt per word. An image gives hue, appearance and
   warmth (`src/theme/imageSeeds.ts`).
3. Decide, on the record. In a project with the malleable layer:

   ```bash
   strata set --scope system …   # the promote control's route: one property moves a seed
   ```

   or write the seed set directly where the product keeps it (`OBSIDIAN` in
   the engine, or the store's seeds) and record it:

   ```bash
   strata retheme --hue 250 --chroma 0.08 --warmth -0.6 --energy 0.35 --density 1 --appearance dark --why "…" --decided-by agent
   ```

4. Regenerate the projections (`npm run tokens`) and run `strata check`.
   Contrast is evidence, reported per token; the engine already holds AA for
   text on the page, so a failing pair is worth a sentence, not a revert.
