# bench — the founding claim, as an experiment

Strata's opening argument is one sentence:

> an agent with a component list generates collage, and an agent with reasons
> generates coherent work.

Nothing in this repository tested it. This does.

## What is being compared

The same task, performed twice by the same harness, differing only in what the
harness is given before it starts.

| arm | what it gets |
| --- | --- |
| `packet` | `strata skill <name> …` — the rules that bear on the task with their reasons, the precedent the record holds, the state, the procedure, the constraints |
| `list` | `bench/arms/list/BRIEF.md` — the same design system as a component and token list: every name, no reasons, no record, no rules |

The `list` arm is not a straw man. It is generated from the same ledger the
packet is built from, so both arms know exactly the same *names*. What one arm
has and the other does not is **why** — and the record of what was decided
before.

## The tasks

Two, chosen because each has a right answer the record knows and a list cannot.

1. **cut-token** — decide whether `--motion-instant` earns its place. The
   record holds three cuts with arguments, a fallback table that says what
   this token would collapse to, and a usage count. The list holds the name.
2. **move-region** — move `Filters` into the top bar. The record holds the
   rule that a move rewrites JSX on the spot through `strata move`, and the
   rule that behaviour is imported rather than copied. The list holds a
   component called `Filters`.

## The criterion

Mechanical, read off the record and the tree afterwards — no judgement call,
no rating:

| measure | read from |
| --- | --- |
| decisions written | `.strata/decisions.jsonl`, lines added |
| decisions carrying a reason | the `reason` field, present and non-empty |
| invariants after | `strata check --json` |
| projections hand-edited | `strata rebuild --check` |
| undeclared raw literals introduced | the `layer0.semantic-names-only` evaluator |
| cut tokens reached for | a `var(--x)` naming a token the ledger cut |

The last row is the sharp one. Three tokens in this product are cut, and the
list arm has no way to know it: `--radius-overlay` is a name in the
stylesheet, and reaching for it is the exact failure the claim predicts. An
arm that edits files without writing a decision scores zero on the first row,
which is the other predicted failure.

## Running it

Strata calls no model — many harnesses, one foundation — so the bench does not
invoke one either. It prepares an isolated copy of the product per arm, writes
the prompt the harness is to perform, and scores the result afterwards.

```bash
node bench/run.mjs prepare              # every task × arm, into bench/runs/
node bench/run.mjs prompt cut-token packet   # print one prompt
#   … perform it, with the working directory set to that arm's copy …
node bench/run.mjs score                # read the record in each arm
node bench/run.mjs report               # the two arms side by side
```

Each arm's copy carries the whole record, so the packet arm's precedent is
real precedent and not a fixture. `bench/runs/` is not committed; a scorecard
is written to `bench/RESULT.json` and committed once there is a real one to
commit.

Two things the bench had to get right, and got wrong first:

- An arm resolves `@strata/substrate` to **its own** copy. Pointing at the
  original would have every arm registering evaluators into one module
  instance and reading them from another, and every invariant would come back
  "no evaluator here can speak for this".
- Changed files are found by hashing the tree before and after, not with
  `git status`. An arm lives under an ignored directory, so git reports a
  clean tree however much changed inside it.

And one measure that had to be narrowed: "reached for a cut token" counts only
lines an arm **added**. A cut token already sitting in a file it happened to
touch is the repository's business, not the arm's.

## What a result means

A difference in the last three rows is evidence for the claim. A difference in
the first two is evidence that the *door* works — that a harness given the
packet writes decisions at all — which is a weaker and more boring claim, and
worth separating from the first.

No result is on the record yet. Until one is, the claim in the README is a
claim, and the README says so.
