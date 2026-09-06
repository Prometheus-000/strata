---
name: write-grammar
description: Use when a product has no voice yet, or when asked to write, revise or extend its design grammar — the rules its taste adds to the system's. Interviews for references, rejections and incidents; writes rules with reasons into grammar/rules.json and GRAMMAR.md; enforces nothing.
purpose: Write this product's voice — its own rules, each with the reason and the incident that earned it — into grammar/rules.json and GRAMMAR.md beside the system's rules, so every later packet carries the taste and no agent has to guess it.
inputs: []
context:
  state: [grammar, survey, tokens]
  precedent: { kind: seed }
  rules: [evaluation.report-not-police, layer3.free, promotion.candidate-at, knowledge.drift-by-transcription, record.decided-not-written]
constraints:
  - the grammar is frame, not a decision; write it in the files, by hand, and say so in the commit — nothing here goes through decide()
  - every rule carries a statement, a reason and where it came from — an incident, a reference or a quotation, dated; a rule with no reason is not written
  - "every rule you write carries \"scope\": \"product\" and \"check\": \"none\"; the system's rules are not rewritten, and an evaluator is code someone writes later"
  - five to nine rules; a voice with thirty rules is a component list with extra steps
  - the seeds are the first decision, not a rule — a theme is seven numbers on the record, through strata retheme
  - show the draft and write nothing until the person has confirmed it; their words go in the incident, quoted
evidenceRequired: []
typicalDecisions: [seed, token/keep, token/cut]
examples: []
reasons: |
  Rules ship with reasons. An agent, or a new teammate, that has the
  reasoning generates novel-but-coherent work; one that only has the
  component list generates collage. Every rule in a grammar carries the
  incident or argument that earned it, and the voice is the part of the
  grammar only this product can write: the system says what a token means
  and what may never be forked, and says nothing about whether the frame is
  one face or two, lines or shadows, black or paper.

  A voice is written in files because the frame is not decidable: an agent
  that could write the rules it works under would not be working under
  rules. So this skill ends with files a person committed, and the first
  decisions — the seeds, and the two or three tokens the voice already
  settled — are the only lines it puts on the record.
---

## Procedure

Run `strata skill write-grammar` and read the packet before anything else.
The state in it is the whole of what you know about this product: the
system's rules (so you do not write them twice), the survey of what the
stylesheets already decided, the tokens, and the seeds in force.

1. **Read the state.** The grammar state says how many rules are the system's
   and whether a voice exists; the survey says what the CSS already does — the
   faces it sets, how many radii, whether it paints shadows, which raw colours
   it keeps reaching for. On a product with no stylesheet the survey says so,
   and the voice starts from references and rejections rather than evidence.
   Say, in two lines, what you found.

2. **Interview, one question at a time.** Wait for each answer; do not
   propose rules yet. In order:
   - Two products whose chrome you would steal, and one you never would — and
     why, in a sentence each.
   - What you threw out last time, and what it was replaced with.
   - The ground: light or dark first, monochrome or a colour, and what the
     colour is for if there is one.
   - Type: one family or two, and what is set in mono.
   - Shape: how many radii, and lines or shadows.
   - Motion: does anything bounce; what is the one slow transition.
   - The sentence under all of it: what is the frame *for*, and what may the
     work inside it do that the frame may not? (The product Strata was built on
     answered "a canvas": quiet chrome so the picture can carry colour.)
   Where the survey contradicts an answer — three radii in the CSS, "two" in
   the answer — say so, and ask which was decided and which was an accident.

3. **Draft five to nine rules.** Each is: an imperative statement in one
   sentence; the argument for it; the incident, reference or quotation that
   earned it, with the date and the person's own words quoted; an id
   `voice.<slug>`; `"scope": "product"`; `"check": "none"`; and
   `"source": "GRAMMAR.md › The voice › <statement>"`. Show the draft as it
   will read in `GRAMMAR.md` and wait for the person to confirm or correct it.

4. **Write the files.** Append the rules to `grammar/rules.json` under `rules`
   — the system's rules stay exactly as they are — and write the voice section
   of `GRAMMAR.md` in the same form the package's own grammar uses: the bold
   statement, then the reason, then the incident.

5. **Run `strata check`.** The new rules appear under *cited, not evaluated*,
   marked as this product's. That is correct: a rule with `check: "none"` is
   read by a hand, and an evaluator is code someone may write later. Say so.

6. **The first decisions.** The voice usually settles the seeds — `strata
   retheme --hue … --chroma … --appearance … --why "<their words>"`, or
   `--link` with a Theme Lab address they picked by eye — and two or three
   tokens: lines not shadows is `strata cut --shadow-color --why "…"`, one
   family is `strata cut --font-display --why "…"`. Each carries
   `--decided-by human --actor <their handle>`, because they chose.

7. **Commit** the two grammar files and `.strata/decisions.jsonl` together,
   with a message that says the voice was written down and by whom.
