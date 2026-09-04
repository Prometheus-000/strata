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

The `list` arm is not a straw man. Its brief is generated from the same ledger
the packet is built from, so both arms know exactly the same *names*. What one
arm has and the other does not is **why** — and the record of what was decided
before.

**The control's sandbox genuinely lacks the frame**, which took two goes to get
right. The first version copied the whole repository into both arms and
differed only in what the prompt *mentioned*; both list arms went looking,
found `bin/strata.mjs`, the skills, the ledger and the precedent, and produced
work indistinguishable from the packet arms on every measure. Of course they
did. A control that has the answers in a file it wasn't pointed at is not a
control.

So the `list` arm's copy omits `.strata/`, `grammar/`, `skills/`, `README.md`,
`GRAMMAR.md` and `src/theme/ledger.json`, and the two projections that carry
the record *inside* them are reduced to what a conventional design system
ships: the `/* cut by … */` comments come out of `semantic.css`, and the
`$extensions`, `$reasons` and ledger block come out of `tokens.json`. One more
copy of the record lives outside it — the harness engine vendors the three
cuts, and that file's own comment calls it "a copy of a decision" — so the
control gets an empty table there.

What remains, stated rather than pretended away: the control keeps the
library's *source*, so evaluator files still carry some rule text, and the
shipped stylesheet still reads `--radius-overlay: var(--radius-surface)`, which
an observant agent could recognise as an alias standing in for a cut. That is
the artifact speaking, and it is exactly what a real consumer of a design
system sees, so it stays.

## The second axis: what is required of the performer

The first two runs varied what the performer was *given* and left it otherwise
unconstrained. That measured the substrate, not the contract — nothing obliged
the performer to honour anything, so a good result was the agent's doing and a
bad one was nobody's.

So arms now cross two axes: `packet` or `list` for what is given, `loose` or
`held` for what is required.

| harness | terms |
| --- | --- |
| `loose` | the task, and nothing else |
| `held` | the README's honours column, stated as conditions of work |

The `held` terms are: read the context first, stay inside the working
directory, every change through `strata …` and never a hand-edited projection,
**run `check` and `rebuild --check` before and after and compare them**, and
answer honestly who decided.

The fourth is load-bearing and the reason this axis exists. The failure the
first result found — three decisions undone as a side effect of one unrelated
correct decision — was invisible to every measure in this bench and to the
agent itself until after the fact. A before-and-after comparison is the shape
of harness that catches it. Whether it actually does is the question.

The second term also closes a hole the first runs had: the arms were told not
to *modify* anything outside their directory and never told not to *read*, and
the real repository was on the same disk the whole time.

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
node bench/run.mjs prepare [task]       # every arm × harness, into bench/runs/
node bench/run.mjs prompt cut-token packet   # print one prompt
#   … perform it, with the working directory set to that arm's copy …
node bench/run.mjs score                # read the record in each arm
node bench/run.mjs report               # the two arms side by side
```

Each arm's copy carries the whole record, so the packet arm's precedent is
real precedent and not a fixture. `bench/runs/` is not committed; a scorecard
is appended to `bench/RESULTS.jsonl`, one line per scored run, and the tables
in this file are generated from it. Results were overwritten in place until
run 3, which is why run 2 is marked backfilled: it survives as numbers
transcribed from a terminal, its arms long deleted. A bench that could not keep
its own record is a poor advertisement for one.

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

## The first result

Two runs, four arms each, every arm performed by a harness with no knowledge of
this repository beyond what its prompt and its sandbox gave it.

**Run 1 was void.** Both control arms went looking, found `bin/strata.mjs`, the
skills, the ledger and the precedent, and produced work indistinguishable from
the packet arms on every measure. The control had the answers in a directory it
had not been pointed at, so the two arms were the same experiment. The run's
one real output was a bug: `strata move`, `prop`, `set` and `remove` all
crashed *after* writing, on a `const` arrow in its temporal dead zone. Four
independent agents walked into it.

**Run 2, with the frame genuinely absent, found the difference — and not where
this bench was looking for it.** Every scorecard below is generated from
`bench/RESULTS.jsonl` by `node bench/run.mjs docs`; `--check` fails if they
disagree.

<!-- scorecards: generated by `node bench/run.mjs docs` -->

### Run 2 — context only (packet vs list) · backfilled

Transcribed from the score output before results were append-only; the arms have been deleted and cannot be re-scored. Every later run is generated from the record.

```
cut-token                   packet/loose    list/loose
decisions written                      1             1
with a reason                          1             1
decided by agent                       1             1
invariants hold                      yes           yes
projections hand-edited                0             0
undeclared literals                    0             0
reached for a cut token                0             0
decisions silently undone              0             3
files changed                          3             3
```

```
move-region                 packet/loose    list/loose
decisions written                      1             1
with a reason                          1             1
decided by agent                       0             0
invariants hold                      yes           yes
projections hand-edited                0             0
undeclared literals                    0             0
reached for a cut token                0             0
decisions silently undone              0             0
files changed                          3             5
```

### Run 3 — context × harness (the 2×2)

```
cut-token                   packet/loose   packet/held    list/loose     list/held
decisions written                      1             1             1             1
with a reason                          1             1             1             1
decided by agent                       1             1             1             1
invariants hold                      yes           yes           yes           yes
projections hand-edited                0             0             0             0
undeclared literals                    0             0             0             0
reached for a cut token                0             0             0             0
decisions silently undone              0             0             3             3
files changed                          3             2             3             3
```

### Run 4 — context × harness, repeated

```
cut-token                   packet/loose   packet/held    list/loose     list/held
decisions written                      1             1             4             1
with a reason                          1             1             4             1
decided by agent                       1             1             1             1
invariants hold                      yes           yes           yes           yes
projections hand-edited                0             0             0             0
undeclared literals                    0             0             0             0
reached for a cut token                0             0             0             0
decisions silently undone              0             0             0             3
files changed                          3             3             3             3
```

<!-- /scorecards -->

The control did everything right. It found the CLI unaided, wrote a proper
decision with a reason and a named hand, hand-edited nothing, verified the
fallback chain, and cut the same token the packet arm cut for substantially the
same argument. It then reported, unprompted, that its one write had reverted
three decisions it could not see:

    --shadow-color         transparent            → oklch(0.050 0.010 236.0 / 0.50)
    --motion-ease-emphasis var(--motion-ease)     → var(--strata-ease-spring)
    --radius-overlay       var(--radius-surface)  → 1.215rem

Shadows repaint. Dialogs overshoot. A third radius comes back. Three house
decisions — argued for, written down, and *invisible in the artifact* — undone
as a side effect of one unrelated correct decision. The packet arm performed
the same task and lost nothing.

It refused to hand-restore them, correctly, on the grounds that the next
rebuild would undo the restoration. And it refused to invent decisions for
them, citing `substrate/src/author.ts` on not guessing a deciding hand. It
behaved impeccably throughout. **That is the finding: this is not about how
careful the agent is.**

### What this does and does not show

The measure that caught it was not in the original six. "Reached for a cut
token" looks for an arm that *writes* a cut name; nothing was reached for and
nothing was written. A decision was simply lost. `decisions silently undone`
was added afterwards, which is worth stating plainly — the bench was extended
to describe a result it had not anticipated.

Honest limits, in the order they weaken the finding:

- **Part of the mechanism is the control's design.** The control has Strata's
  machinery and no record, so a write re-emits the stylesheet from an engine
  with no cuts to apply. A product that never installed Strata would not
  re-emit at all. What is *not* an artifact is the reason the agent could not
  prevent it: the stylesheet it was handed said `--radius-overlay:
  var(--radius-surface)` with no provenance, and three deliberate decisions
  were indistinguishable from three accidental aliases.

  It is worth being precise about which way this limit points. The loss needs a
  regenerable artifact to happen at all — so the exposure is not a property of
  Strata but of regeneration, and it arrives with whatever else regenerates a
  product's surfaces, installed or not. Read that way this bench is not a test
  of a feature. It is the smallest available demonstration that when artifacts
  become regenerable, the decisions behind them stop being documentation.
- **The move-region task showed no difference at all** — 0 to 0 on every
  measure. The claim held on one task of two.
- **One arm per cell.** The two packet runs agreed with each other, which is
  weak evidence of stability and no more.
- **The same model performed every arm.** Nothing here tests whether the
  effect survives a different harness.
- **The arms were told not to modify anything outside their directory, but not
  told not to read.** The real repository was on the same disk throughout. The
  transcripts show no reads of its record, skills, grammar or prose — but the
  instruction did not forbid it, and a future run should.

The claim, then, holds in the narrow form the evidence supports: **a record
that carries reasons keeps decisions from being undone by people who never saw
them.** The broader "collage versus coherent work" framing is not what was
measured, and is still a claim.

## The harness result, and a correction to the one above

The 2×2 — context (`packet`/`list`) crossed with harness (`loose`/`held`) — on
the cut-token task.


**The stated hypothesis was wrong.** The prediction was that `list/held` would
catch the reversion that `list/loose` missed, because term 4 requires comparing
`check` and `rebuild --check` before and after. Both arms reverted the same
three tokens, and both noticed. Every mechanical measure is identical. A
before-and-after comparison did not change the artifact, because the harness
cannot restore decisions that are not recorded anywhere — and "silently" was
always the wrong word: the agent reported it in both loose runs too. It was
silent to the measures, not to the performer.

**What the harness demonstrably did do was contain the experiment.** Counting
paths outside its own tree in each transcript:

| cell | files touched outside its arm |
| --- | --- |
| `packet/held` | 0 |
| `list/held` | 0 |
| `list/loose` | 3 — including the real repository's `README.md` and `GRAMMAR.md` |

Which retro-fits the earlier runs. The first two runs told their arms not to
*modify* anything outside their directory and never told them not to *read*,
and the real repository sat on the same disk throughout. So **the "frameless"
control was reading the actual frame** — the prose, at least, if not the
ledger. The result above survives that (the three cuts reverted anyway, because
knowing a decision exists is not the same as being able to restore it without
inventing a hand and a reason for it), but every control cell before the `held`
ones was contaminated, and only the two `held` cells were ever clean.

That is the harness's contribution here, and it is not the one that was
predicted: **it is the term that made a control a control** — an experimental
need, not the work's. In real use, an agent reading the README is the point.

Which leaves the harness axis with nothing else to its name, and that is the
result. Every arm honoured the honours column without being held to it, because
the door refuses rather than instructs: `authorFrom` will not guess a hand,
`problemsWith` will not take a malformed line, `rebuild --check` reports drift
unasked. A refusal is written once and travels with the artifact; a harness has
to be wrapped around every performer, forever. On this evidence the refusals
are where the leverage is — with the caveat that four capable agents on one
model is a narrow base to generalise from, and that neither refusals nor
supervision could restore a decision nobody wrote down. Which is the same
lesson the substrate keeps teaching in a different register — the guarantee is
worth what the honouring is worth, and nothing obliges the honouring except a
harness.

One difference this bench could not adjudicate at the time: `packet/held`
**kept** `--motion-instant` where all three loose arms cut it, arguing that the
token has no consumers but one *dependent* — `--motion-fast` declares it as its
fallback, so cutting it pulls the bottom rung out of the ladder. Three loose
arms noted that same fact and cut anyway. It was recorded as a difference
observed rather than a difference caused, pending a repeat.

## Run 4: the repeat, and the one thing a record could do that supervision could not

The same 2×2, run again on the same task.

**The `packet/held` keep was noise.** All four cells cut `--motion-instant`, on
substantially the same argument each time — zero consumers, and the tap
acknowledgement the token was kept for is transitioned at `--motion-fast` in
the stylesheet, so the tier it existed to name is occupied by the tier below
it. `packet/held` made the same dependent-token observation it made in Run 3
and reached the opposite conclusion, which is what one sample of a coin flip
looks like from the other side. Across two runs the harness axis has now moved
nothing but containment.

**`list/loose` did something none of the four earlier control cells did: it
repaired the reversion.** Same trap — its one cut re-emitted the stylesheet
from a record that had never been told about three earlier decisions, and
`--shadow-color`, `--radius-overlay` and `--motion-ease-emphasis` came back. It
then wrote the three onto the record as cuts, `decided` human with **no actor**,
`written` agent, each reason saying in as many words that it is a transcription
of what the stylesheet already shipped and not a judgement of its own:

> I am not the hand that chose this; the stylesheet is the evidence that a
> person did, and it is stated here as a person unnamed rather than claimed by
> the agent that typed it.

Run 2's control faced the identical situation and found two exits, both
closed: it would not hand-restore the values, because the next rebuild would
undo the restoration, and it would not invent decisions for them, citing
`substrate/src/author.ts` on not guessing a deciding hand. Both refusals were
correct. The third exit is the one the two-hand split opens — a decision whose
deciding hand is a human it cannot name, written by an agent that says so. The
artifact is restored, the record is honest about how, and nobody is credited
with a choice they did not make. Every measure went to zero as a result.

That is the strongest thing this bench has shown, and the narrowest: not that
the record prevents the loss — it did not, in four of five control cells — but
that when an agent goes looking for a way to undo the loss without lying about
who decided, the record has one and the stylesheet does not.

**What it does not show.** `list/loose` did not repair in Run 2 or Run 3, so
one repair in three is variance, not a property of the loose harness, and the
tempting read — that term 4's "report any difference you did not intend" set
reporting as the ceiling, and the arm with no terms went past it — is not
supported by its own control. `list/held` reported the three and stopped; so
did two of the three loose arms before it. What separates Run 4's `list/loose`
from every other control cell is not its harness. It is that one agent, on one
run, thought of the move.
