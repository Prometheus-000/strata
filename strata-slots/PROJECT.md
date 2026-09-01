# Strata · Slot Layer — Project Brief

A standalone library that lets a designer **move a feature from one region of a
view to another by dragging it there**, and that will not let them break their
own product doing it. No dependency on the Strata source; integration is a later
step.

This repo builds one thing and does not build a product around it. No theme
engine, no property overrides, no component library, no auth, no server. The
deliverable is a pure function, a codemod, a drag surface, and a test suite good
enough to prove the function works without a browser.

---

## Why

Property-level styling is already governed. A theme engine derives colour,
radius, rhythm and easing from a small seed set, so a designer changing a corner
radius is changing a seed, not an element — the change is authored, typed and
reviewable.

Structure has no equivalent author. A designer who knows the filters belong
above the grid rather than beside it has no way to put them there. They write a
prompt, or a ticket, and wait.

**And a consumer of this system must not be able to break their own product by
moving a feature.** Layout stays legal by construction, because slots are
enumerated and a drop cannot invent a destination. Behaviour does not: focus
order, keyboard traversal and dismissal semantics all depend on where a feature
sits. Someone dragging a region cannot be expected to know they have just put
the filters after the results they filter. That is the system's responsibility,
not theirs.

The system meets that responsibility by **naming the cost**. Not by refusing the
move, and not by refusing the commit either. Refusing would put the tool in the
position of knowing better than the person using it, about a product it cannot
see — and nobody designs from inside a system that is waiting for them to
comply. A mismatch produces an **open item**: a named behavioural cost, visible
while the designer is still reaching for the slot, that travels with the design
into source and into the diff.

The system is linked to what is being built and coexists with it. It reports; it
does not police. **No move is ever blocked. No behavioural cost is ever incurred
silently.**

---

## The grammar

The brief says slots are "defined by the spacing grammar, enumerated in advance"
and never says what defines the grammar — the one hole it left, and a
load-bearing one, since the slot set is the entire vocabulary a designer gets.

[GRAMMAR.md](GRAMMAR.md) fills it: seven rules, each with its reason, and a
six-step derivation. The measure is **free movement** — how many positions a
feature can reach at no cost — which is decided by how many slots sit under a
contract that satisfies what it requires, and is computed from the same
`slotCosts` the drag surface asks.

Guidance without imposition rests on three things: archetypes are seeds nothing
validates against, every grammar finding is a report, and the one near-hard
finding is about a designer contradicting *themselves* rather than disagreeing
with us.

## Definitions

Every term below is defined here. No prior context is assumed.

| Term | Definition |
|---|---|
| **View** | A named unit of design work, **declared by the designer** — not derived from routes, files, or the component tree. Views are **flat**: they do not nest, and a node belongs to exactly one. |
| **State** | A variant of a view in which some features are absent and others appear. Same design decisions, different node set. **States are not views.** |
| **Feature** | The unit that moves. A composed region, not a leaf element. |
| **Slot** | A named position within a view where a feature may sit. Slots are defined by the **spacing grammar**, enumerated in advance, and are the **only** legal destinations. **A slot carries a behaviour contract.** |

A **spacing grammar** is the small declaration that generates a view's slots: an
ordered list of *bands* (the vertical rhythm), each divided into a fixed number
of *columns*. Slots are the (band, column) pairs, named `band/column` —
`lede/1`, `body/2`. Enumerated in advance means the set is finite, known before
any drag begins, and cannot be extended by dropping something somewhere new.

---

## Build

### 1. Identity

Stable ids on features and slots that survive to runtime, assigned by a
build-time codemod over source.

**Ids must survive refactors, wrapping, and reordering — a structural path is
not an id.** The codemod therefore assigns an id *once* and never recomputes it:
a node that already carries one is left alone, and the id names the view and the
component rather than the position. Wrapping a feature in a container, moving it
up the file, or moving it to another slot cannot change what it is. That last
one matters most: moving things is the entire point of this layer, so an id that
did not survive a move would break every time it was used.

Slot ids come from the grammar and need no codemod — they are generated, and
generating them twice gives the same answer.

### 2. Slot store

```
{ view, state, feature, slot, order, author: 'human' | 'agent', ts }
```

Assignments only. The primary key is `(view, state, feature)`: a feature occupies
one slot per state, so there is no precedence question.

`author` is present from the start even though agents cannot write yet.
Retrofitting provenance is expensive, so the column exists, is written, and is
read — a real field rather than a reserved word.

**Ordering within a slot** (was undecided; decided): two features can share a
slot, so a slot holds an ordered list and the record carries `order`. It is a
number on the same line as a feature's source declaration index, which is what
lets an assigned feature and an un-assigned one sort against each other without a
tie-break rule that only one of them understands.

**The behaviour contract.** Slots declare what they support; features declare
what they require. Neither declaration is a permission — together they price a
position.

A band declares `focusPhase` (`before-main` | `main` | `after-main`) and
`dismissible`. A feature declares any of five requirements, covering exactly the
three cases position can break:

| Requirement | Case | What it means |
|---|---|---|
| `before-main` · `main` · `after-main` | focus order | Slots are enumerated in reading order, which *is* DOM order, which *is* tab order. A banner or a filter must be reachable before the content it introduces; a contentinfo must not be. |
| `sole-focus` | keyboard traversal | A feature that handles its own arrow keys cannot share a slot with another region, or the arrow keys are ambiguous and neither feature owns them. |
| `dismissible` | dismissal | Escape and click-outside need a region where "outside" is defined. In the middle of the main body it is not. |

Five requirements is a floor, not a ceiling. What else the contract should cover
is genuinely open; these are the three cases the brief named, and the check is
one `switch` in `src/grammar/behavior.ts`.

**Acceptance** lives inside the placement record, not in a list of its own:

```ts
'gallery.detail': { slot: 'body/2', order: 0, by: 'human', accepted: ['dismissible'] },
```

That binds a decision to a *position* by construction. Move the feature and
`slot` changes on the same line as `accepted`, which is exactly where a reviewer
is already looking — there is no way to carry an old acceptance quietly into a
new place. Reordering inside a slot keeps it; changing slot asks again.

Acknowledging is one click, and it unlocks nothing, because nothing is locked.
It is a record: it lets a reader of the diff tell "this cost exists and nobody
has looked at it" from "this cost exists and someone decided it was right". A
justification field would be a text box, and a text box is the failure this
whole model is arranged around.

### 3. Resolver

A pure deterministic function from `(view, state, feature)` to `slot`, and from
`(view, state)` to the whole layout. Reads no UI state, no DOM, no clock.

Built and tested headless **before any interface exists**. Everything else — the
drag surface, the runtime, the CLI, the diff — is a client of this function and
none of them re-implements a step of it. That single constraint is what stops
the rendered layout and the reported layout from disagreeing.

**The resolver also evaluates the behaviour contract and emits open items naming
what a slot cannot satisfy. It never blocks a move and never gates anything.**
The layout it returns is the layout that was asked for; the costs travel beside
it. What a host does with an open item is the host's decision.

A cost is charged to whoever pays it, which is not always whoever moved:
dropping a feature next to one that owns its arrow keys costs *that* feature its
`sole-focus`, and the open item says so.

Open items are **computed, never stored**. They are a pure function of the
manifest and the assignments, so they cannot drift from the design they
describe. The same evaluation prices a slot before anything moves, which is why
what the drag previews and what the drop produces cannot disagree — tested
directly rather than assumed.

### 4. Spatial drop

The designer drags a feature; the slot is inferred from where it lands.

No dropdown, no parent picker, no tree panel and no path field. **Naming the
destination in the structure's own vocabulary is the failure mode this exists to
avoid** — a designer who has to find `body/2` in a list has been handed the
component tree with extra steps.

Slots are visible **only during a drag**. **Every move is allowed.** Every slot
is a destination; a slot that cannot fully satisfy the feature is marked as the
designer approaches and spells out what it cannot satisfy under the pointer —
and then takes the feature anyway.

The cost is shown at the moment of the decision rather than discovered
afterwards, which is the whole of *no behavioural cost is ever incurred
silently*. What it does not do is stop the hand.

Slots are revealed on **press**, not on the first move. Empty slots have no
height at rest, so revealing them adds space — and adding space while someone is
already aiming moves the target out from under the pointer.

**Occupied slots** (was undecided; decided): a slot holds an ordered list, and
the drop zone inside it is subdivided.

- Drop on an occupant's **centre** → **swap**. The two features exchange
  positions; both sides are priced, and neither is refused.
- Drop on an occupant's **edge** — above, below, or either side → **insert**
  before or after it.
- Drop on the empty part of a slot → **append**.

### 5. Persistence and visibility

**The library holds assignments and open items and exposes them.** It does not
decide when they are written, does not own a session, and does not gate a
commit. Batching, triggers and enforcement belong to the host.

That boundary is load-bearing. A library that owned the session would be wrong
for every host but the one it was written against; a library that gated the
commit would have chosen one team's policy for everybody. So `SlotsProvider`
holds the store, computes the open items, and calls `onChange`. Everything past
that line is somebody else's.

**Open items persist into source, next to the assignment that produced them.**

```ts
placement: {
  browse: {
    'gallery.activity':    { slot: 'body/1', order: 4, by: 'human' },
    'gallery.preset-grid': { slot: 'body/1', order: 3, by: 'human', open: ['sole-focus'] },
  },
},
```

Not session state, and not a warning log. A warning is a line nobody totals; a
value that only exists while the tool is running is invisible in a diff and
uncountable across a codebase — you would have to run every repo's resolver to
ask how many `dismissible` contracts an organisation is violating. Written down,
that question is a grep.

Note which record carries the cost. `gallery.activity` moved; `gallery.preset-grid`
is what *pays* — it lost its arrow keys when something arrived beside it — and it
never moved at all. So `commit` materialises a record for it at the slot it
already occupied, because a cost with nowhere to live is a cost that disappears.
The diff shows a placement that did not move and a cost that arrived.

Items carry enough structure to answer both questions asked of them. *What is
unsatisfied in what I am building* — view, state, feature, slot. *Which
contracts are being violated across everything built on this system* —
`requirement`, the `band` that bears the contract, and the `provides` that band
actually offered, so a count can say **why** and not only **how many**. The
library exposes that data and the totals; it does not ship the dashboards that
read them and does not collect across codebases on its own.

Recording derived data buys visibility and risks drift. The risk is not
prevented — it is detected. See step 6.

Provenance splits the same way. `author` is written as `by`; `ts` is not,
because git already knows when a line changed and who committed it, and a
timestamp in source churns every diff while telling a reviewer nothing the log
does not.

**What `src/harness` decides**, as one host among possible hosts — read it for
the examples, not for the library's opinion:

| Policy | This host's choice |
|---|---|
| Session | Owns which view and state you are looking at |
| Persistence | Every change to local storage immediately, so work is uncommitted rather than lost |
| Triggers | Its own boundaries — leaving a state or view, and the last cost being acknowledged. Never a clock: a timer knows nothing about the work, so it fires mid-thought and produces the gesture-sized diffs batching exists to avoid |
| Enforcement | None. Costs are shown, counted and carried into the diff |

### 6. Lint

A pass over what source records, runnable standalone (`npm run lint`, or
`--json`) and inside a host's build. **It reports; the host decides whether a
failing report stops anything.** It sets no exit code and throws nothing.

**Class 1 — unsatisfied behaviour contracts**, read back out of source rather
than recomputed from a session, with totals by contract and by band.

**Class 2 — assignments that no longer resolve**: a removed slot, a renamed
band, a deleted feature, a renamed state, a placement for a feature that state
no longer has.

This class exists for a specific reason. *Nothing generates an open item when
the grammar changes underneath an assignment.* The contract check asks whether a
slot satisfies a requirement — and a slot that no longer exists is not a slot
that fails to satisfy. It is an assignment pointing at nothing, and without this
pass it would be silent.

**Class 3 — records that disagree with the resolver.** The answer to the drift
objection against writing open items down: recompute, compare, and say so, in
both directions — a cost recorded that is now satisfied, and a cost that is real
but not written. A stale line that announces itself is not a failure; a stale
line nobody notices would be.

One deliberate non-finding: a feature sitting at its source default with nothing
written about it is never "drifted". Nothing written is not a wrong record — it
is a design that has never been committed.

---

## Stack

TypeScript. The TypeScript compiler API for the codemod. **No other runtime
dependencies for steps 1–3** — `src/schema`, `src/grammar`, `src/identity`,
`src/store` and `src/resolve` import nothing but each other and `typescript`
(build time only). React appears at step 4 and nowhere below it.

---

## Done when

I can move a feature from one slot to another, in one state of a view, leave the
other state alone, and ship — without typing a prompt or opening a file.

**If any step needs a text box, the model is wrong.**

**No move is ever blocked. No behavioural cost is ever incurred silently.**

---

## Not in scope

Property overrides of any kind. Snap-to-token. Agent authorship. Nested views.
Arbitrary reparenting — slots are the only destinations.

---

## Sequencing

1. Schema, grammar, slot enumeration, the contract check — unit tested alone
2. Identity codemod and the manifest it produces — tested against real sources
3. Store operations and the resolver's cost evaluation — tested headless
4. Write-through to source, and the per-view/per-state diff — tested by writing
   real files and reading them back
5. The lint pass — tested by moving the grammar underneath committed work
6. CLI harness: resolve and print a layout in the terminal
7. Runtime `<View>` / `<Feature>`, rendering from the resolver
8. The drag surface

Steps 1–6 are provable without a browser and are where the correctness lives.
Steps 7–8 are the interface that makes the correctness usable. Do not reorder.
