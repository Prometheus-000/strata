# Governance

Four kinds of statement, and they do not carry the same authority:

| | Says | Authority |
| --- | --- | --- |
| **Invariant** | "Every var() names a property something defines." | Enforced. The only class a build fails on. A mechanical truth about the artifact, never a design judgement. |
| **Policy** | "Recipes speak semantic names, never a hex." | Evaluated and reported. Bent by a declared deviation, which is then knowledge. |
| **Preference** | "A shape that appears three times is a candidate." | Carries its number. |
| **Knowledge** | "Hand-written projections drift within a week." | Carries its source. |
| **Precedent** | "37 instances, 3 hands, converged on 12px." | Computed from the record. Never declared. Candidacy is the computed part; promoting a candidate is a decision. |

Most policy is *cited*, not evaluated, and the count belongs here rather than
in a footnote. Of 36 rules, four are invariants and 32 are not; thirteen of those 32
have an evaluator that speaks for them, and the other nineteen say
`"check": "none"` in `grammar/rules.json` and are carried into skill packets
to be read by a hand. `strata check` prints that count under CITED, NOT
EVALUATED, because a rule nothing evaluates is silent, and silence is easily
mistaken for a pass.

One class of drift has no projection to compare against: prose. A stylesheet
can be regenerated and diffed against the record; a sentence cannot, so it
goes on asserting whatever it asserted the day it was written. Two rules close
the mechanical half of that — an npm script, a CLI verb, a repo path, a rule
id, a state provider, a decision kind either resolve or they are reported,
and a skill whose packet cites a renamed rule is not left quietly empty. The
other half does not close: a sentence that is false but names nothing ("every
change is reviewed before it ships") has no identifier to resolve, and needs a
person who knows what is true. Both report under **policy** rather than
failing a build, because prose is not the artifact. This repository chooses to
fail its own build on them anyway, which is what `scripts/prose.test.ts` is.

A rule says whose it is, and there are three answers. `system` rules are
Strata's own and every adopter inherits them. `product` rules are one product's
taste and nobody inherits them. `personal` rules belong to a person rather than
to anything they built: a designer's voice outlives the product it was first
written for, and `strata init --voice` carries it to the next one. A voice
adopted by a product stays `personal` — the product works under it and does not
come to own it — unless `--house` is passed, which is a decision to make it the
product's and stop it travelling.

Seven of the nineteen are marked `"scope": "product"` (nine rules carry that
mark; two of them gained evaluators and left the cited list): they are this
product's taste — one family, two radii, lines not shadows — not the system's
rules, and an adopter does not inherit them. `npx strata init` copies the
system's rules into a new product and none of the nine; every packet carries
whatever voice that product wrote instead. Everything in GRAMMAR.md's voice
section is in the nine.

The grammar (`GRAMMAR.md`) is rules with reasons, in prose, co-authored: a
human writes the incident — the stylesheet with thirty-four accidental white
alphas, the muted ink that passed on the background and failed on the menu
it sat on — and an agent generates from the reasoning rather than the rule.
The same rules are data in `grammar/rules.json`, each with its authority,
and that is what `strata check` runs from:

```
$ npx strata check

  72 decision(s) on the record  ·  every invariant holds  ·  11 finding(s), none of them blocking

INVARIANTS  ·  enforced — the only class a build fails on
──────────────
✓ record.parses — 72 decision(s)
✓ projections.match-record
✓ fallbacks.total-acyclic
✓ css.vars-defined

POLICY  ·  reported, never refused — declaring a reason turns one into knowledge
──────────────
layer2.one-filled-action  src/site/App.tsx
    7 filled actions in one file. Primary is filled, Secondary is an edge, Ghost is bare text; when three calls to action carry the same chrome, the screen has no point.
      filled buttons: 7
      at: src/site/App.tsx:98, 434, 440-443, 529

KNOWLEDGE  ·  what the record learned — nothing here to answer for
──────────────
deviation.declared  src/site/site.css:868-874  (7×)
    declared: the hue slider paints the OKLCH wheel itself — a literal spectrum is the control's value, not themable surface
token.unused  --motion-instant
    never used — a cut candidate, or headroom; only you know which

CITED, NOT EVALUATED  ·  read by a hand, not by a machine — silence here is not a pass
──────────────
19 rule(s) carry no evaluator here. They are cited into skills and read by a hand; silence about them is not a pass.
7 of them are this product's own taste, not the system's.

HANDOFF
──────────────
  nothing changed since the last review
ready for review — human prometheus-000, …

every invariant holds; the rest is evaluation, and none of it blocks anything
```

The verdict is the first line as well as the last: whether anything needs a
reader should not take reaching the bottom.

`strata check` exits 0. `strata check --enforce` runs in `npm run build` and
exits 1 only when an invariant does not hold. This is the distinction the
whole system rests on:

```
EVALUATION     "Here is what happened."     always
ENFORCEMENT    "This cannot ship."          invariants only
```

Nothing runs while someone is designing. No hook, no lint, no cost mark
mid-drag; evaluation happens at `ready`, at `check`, and when asked. An
earlier version of this repo had a slot layer that declared structure as
bands, each with a behaviour contract, and priced every drag against it,
writing the cost into source for someone to accept. It was removed on two
findings: a design in progress fails any check by definition, so a tool that
reports mid-drag is measuring the wrong moment; and a designer's move does
not cost the page anything, because the designer is the one defining what
the page is. What it costs is code, and code is malleable to the design.
**Designers define the UX.** The reviewer makes the code fit and never moves
anything back.
