# What's not built

Stated so the next reader inherits the test and not the verdict:

- **The packet claim is tested once, narrowly, and holds in a narrower form
  than it is usually stated.** `bench/` ran two tasks from a packet and from a
  component list. On one of the two, the arm without the record made a correct
  decision that silently undid three house decisions it had no way to see —
  shadows repainted, dialogs given back their overshoot, a third radius
  returned — while the arm with the record lost nothing. On the other task the
  arms were indistinguishable. So: *a record that carries reasons keeps
  decisions from being undone by people who never saw them.* The broader
  "collage versus coherent work" framing is not what was measured. One run per
  cell per run, one model, and `bench/README.md` lists the rest of the limits.
- **The honours column is honoured by refusals, not by supervision — which is
  the one place worth spending.** A second experiment crossed context with
  harness: the same packet, but one arm held to the honours column as explicit
  terms of work. It changed the artifact not at all. Every arm, including the
  ones that had never seen a skill file, already wrote through `decide()`
  rather than editing a projection, already named two hands correctly, and
  already refused to invent decisions for values it could not attribute — one
  of them citing `author.ts` on not guessing a deciding hand. Nobody obliged
  any of it. The door did: `authorFrom` refuses to guess and prints why,
  `problemsWith` refuses a malformed line by name, `rebuild --check` reports
  drift unasked, and `--help` teaches `--decided-by` to anyone who types it. A
  refusal is written once and travels with the artifact; a harness has to be
  wrapped around every performer, forever.

  The one thing the terms measurably changed was containment — the unheld arms
  read this repository's own README and GRAMMAR from outside their sandbox, the
  held arms read nothing outside it — and that was the experiment's need, not
  the work's. In real use an agent reading the README is the point.

  Two things this does not license. The sample is four capable agents on one
  model, so "no harness needed" is a claim about performers of that quality and
  no others. And the failure that mattered was immune to both: no harness and
  no amount of care could restore three decisions nobody had written down. That
  is a record problem, and the answer to it is more refusals, not more
  supervision.
- **The record is seventy-two lines, and thirty-four of them were imported.**
  The rest were decided in live sessions — overlay drags, a retheme, a dozen
  declared deviations, one handoff. That is a record of a vocabulary and a few
  sessions, not yet a record of a product being designed over months.
- Code → Figma regeneration on CI. The Figma library was pushed by hand once
  and is a stale projection; `figma-library-state.json` is the evidence.
- The hub renders the record but cannot evaluate it: evidence needs the
  filesystem, so the four blocks on the site are two — DECISION and
  CONSEQUENCE. Either precompute the evaluation at build, or say the hub is
  the two blocks and stop implying four.
- A move takes a region, not a landmark and not a list item. A component
  whose root is a fragment can be moved from the terminal but not by hand: the
  overlay needs a host element to hit. A prop control writes literals and
  leaves expressions to the code, so `prop={cond ? a : b}` is out of reach by
  design rather than by omission.
- `--actor` is optional, and a decision without one is countable but not
  attributable. Precedent says `hands unnamed` rather than guessing, and the
  `because` sentence records that the name was missing where it happened.
- Precedent is computed over this product's record. A precedent index
  across products — what many teams independently converged on — is the
  same fold over a larger log, and is not here.
