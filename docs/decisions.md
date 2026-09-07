# The Decision Model

One type, discriminated on `kind`:

```ts
type Decision = DecisionBody & {
  id: string            // 'd' + base36 ms + 4 chars — sorts by time
  at: string            // ISO
  decided: Hand         // who could have chosen otherwise
  written: Hand         // whose hand ran the command
  via: string           // 'cli' | 'overlay' | 'mcp:<client>' | 'import:src/theme/ledger.json' | a harness
  because?: string      // how both hands were determined, verbatim
  reason?: string       // intent, in the author's words
  supersedes?: string   // the previous decision on the same target
  consequence: {        // what the operation already knew when it ran — recorded, never computed
    written?: string[]; collapsesTo?: string; absorbed?: string[]
    adapt?: string[]; affected?: number; refused?: string; note?: string
  }
}

type Hand = { kind: 'human' | 'agent'; actor?: string }   // actor is opaque: a handle, an email, a harness id

type DecisionBody =
  | { kind: 'token'; token: string; action: 'propose' | 'keep' | 'cut' | 'mint'; value?: Value; from?: string[] }
  | { kind: 'override'; action: 'set' | 'remove' | 'rescope'; scope; selector; property; value?; fromScope?; node?; view? }
  | { kind: 'move'; region: string; from: { container; file; line }; to: { container; file; line; index } }
  | { kind: 'prop'; component; prop; file; line; from: PropValue; to: PropValue }
  | { kind: 'seed'; seeds: ThemeSeeds; from?: ThemeSeeds }
  | { kind: 'deviation'; file; line; value: string }
  | { kind: 'ship'; promoted: { system; component }; frozen: number; seeds? }
  | { kind: 'ready' }
```

A region move, a token cut and a declared deviation are not special kinds of
thing. They are all a change to the design state with provenance, intent
and consequences, so they are one type on one record, and the same folds
answer the same questions about each: what is current, what is its history,
what is pending since the last handoff.

Eight kinds, and there is no ninth for the rules themselves — see
[the contract](agents.md#the-contract). Every one of these is an act *within* the work;
the frame it happens inside is edited in files by people, not decided.

One line of the record, as it is on disk:

```json
{"kind":"token","token":"--shadow-color","action":"cut","id":"d0mtlvzac0-5lk7","at":"2026-09-03T18:56:42.000Z","decided":{"kind":"human","actor":"prometheus-000"},"written":{"kind":"agent","actor":"claude-code"},"via":"import:src/theme/ledger.json","because":"decided by human — --decided-by human on the command line; written by agent claude-code — CLAUDECODE in the environment; brought onto the record by import — the old file recorded a channel, not a judgement, so the deciding hand is the one this import stated","reason":"Lines, not shadows. The reference grammar — the portfolio and Visionary alike — draws every level with a 1px rule and an alpha wash, and paints no drop shadow anywhere; a shadow is decoration the eye pays for on every card. The elevation tokens keep their offsets and paint nothing, so the rule does the work it was already doing.","consequence":{"collapsesTo":"transparent"}}
```

The same decision, explained — the glass box. `DECISION` and `CONSEQUENCE`
are on the record. `CONTEXT` is what the record knows about the target.
`EVIDENCE` is what the projection's evaluators found, computed when asked
and never on the write path:

```
$ strata explain token:--shadow-color

DECISION
──────────────
Token: --shadow-color
Action: cut
Decided by: human prometheus-000
Written by: agent claude-code
Reason: Lines, not shadows. The reference grammar — the portfolio and Visionary
alike — draws every level with a 1px rule and an alpha wash …
Id: d0mtlvzac0-5lk7
At: 2026-09-03T18:56:42.000Z · via import:src/theme/ledger.json

CONTEXT
──────────────
target: token:--shadow-color  (record)
decisions on this target before it: 0  (record)

EVIDENCE
──────────────
consumers: 0  (token.usage)
usage concentration: none  (token.usage)
duplicate visual role: no  (token.duplicate-role)

CONSEQUENCE
──────────────
fallback → transparent
```

A cut token does not disappear. Fourteen sites say `var(--accent-strong)`,
and a property that simply stopped existing would fail every one of them
silently, at the consumer. It *collapses* — to a fallback declared beside the
engine, with the decision emitted where the token is defined:

```css
--shadow-color: transparent; /* cut by human prometheus-000: Lines, not shadows. … */
```

Two things the model refuses to be, both stated in the principles and worth
saying once more where the type is. The log is history where it is a witness
and source where it is derivable, and it never pretends to be both: a move is
on the record with its provenance, but the JSX is the state, and nothing
replays moves into source. And evidence is never computed when a decision is
written: a drag mid-design writes a line and hears nothing, because a design
in progress fails any check by definition.

And one thing it is not, which is easy to assume from the word "record":
**ordinary use is not a decision.** Nothing writes a line for a `var(--accent)`
already sitting in a recipe. The record holds departures and rulings, and
consumers are evidence — counted by `explain` and `check` from the source,
when someone asks. Thirty-six lines of judgement can be read end to end;
thirty thousand lines of usage cannot be read at all.

# Context & Precedent

Before a rule, there is what the record shows.

```
$ strata precedent --property padding

  # ILLUSTRATIVE — the shape of the output, not a reading of this record.
  # This product's record holds token decisions and a handful of overlay
  # gestures; no property has converged across enough targets yet. Run it and see.
  5 instances independently converged on padding = 12px across 2 views · 3 hands: prometheus-000, ada, and 1 decision by an unnamed hand · 4 by hand, 1 by agent — a candidate for promotion, which is a hand's to decide
  1 instance converged on padding = 16px · hands unnamed · 1 by hand
```

`strata precedent` searches every decision by property, value, component,
token, the kind of hand, the *named* hand (`--actor`), time, and the words in
its reason. It counts two things, and they answer different questions.
Distinct **targets** say a value was reached in more than one place. Distinct
**hands** — distinct `decided.actor` — say it was reached by more than one
person. One hand touching nine instances is a habit; three hands reaching the
same value is evidence, and independence means distinct hands wherever hands
are named. Where none is named the record says `hands unnamed` rather than
counting decisions as people.

Crossing the threshold makes a convergence a **candidate**, and that is the
whole of what is computed. The threshold is a preference in the grammar —
three, by default — and the drift report reads the same number. Promoting a
candidate is a decision: widen the scope, or mint a name for the value.
Nothing here has authority of its own; it is what happened.

`strata history <target>` prints every decision on one target as glass
boxes, oldest first; `strata log` prints the record one line each; `strata
show <id>` prints one. A reversal is two lines, not a deletion.

The record holds the change and who made it, and stops there. A refusal
changed nothing, so it is not a ruling — what was *tried* lives in the session
that tried it, which is the harness's business and not the substrate's. The
one exception is narrow: a projection that refuses something it can still name
appends the attempt with `consequence.refused` and no state change, because a
declined request against a known target is worth a line. Most refusals name
nothing and are not recorded, which is the same argument
`record.use-is-not-decision` makes about ordinary token use — thirty lines of
judgement can be read end to end, and thirty thousand lines of what happened
cannot be read at all.
