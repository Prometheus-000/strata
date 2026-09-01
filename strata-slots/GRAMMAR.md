# The Slot Grammar

A view's grammar is the entire vocabulary of positions a designer gets. Whoever
writes `bands: []` decides how much freedom the tool has to give, so this file
says what makes one good — and, as with every rule in this repo, why.

None of it is enforced. `slots lint` reports; you decide. The one finding that
comes close to a rule is about you contradicting yourself, not about disagreeing
with us.

---

## The measure

**Free movement** is how many positions a feature can reach without incurring a
cost. It is decided by one thing: how many slots sit under a contract that
satisfies what that feature requires.

```
Detail requires `dismissible`.
Only `aside` provides it. `aside` has one column.

  masthead/1   lede/1  lede/2   body/1  body/2  body/3   aside/1   footer/1  footer/2
                                                          ▲
                                                    the only place
                                                    Detail can ever sit
```

That is a grammar giving a designer nine positions and one choice. `slots
grammar` prints the number for every feature, which is the honest answer to "is
my grammar any good" — better than a score, because it says *for whom*.

Two consequences, and they pull in opposite directions:

- **A band that carries no contract difference buys nothing.** Cost depends on
  the band's contract, not on how many bands there are. Splitting `main` into
  `main-a` and `main-b` leaves free movement exactly where it was and leaves the
  vocabulary with two names for one thing.
- **A band that carries a real contract difference constrains on purpose.** That
  is the whole point — but it *is* a constraint, so it should be paid for with a
  difference that actually exists.

**Within a band, order is taste. Across bands, order is meaning.** Everything
below follows from that line.

---

## The rules

### A band is a semantic region, not a visual row

Restyle the view completely in your head — different widths, stacked on mobile,
right-to-left. Is this still a distinct region? Then it is a band. Does it exist
only because two things happen to sit side by side? Then it is columns.

*Bands carry the behaviour contract, and contracts are semantic. A band that
exists for visual reasons generates slots no requirement can tell apart, which
is vocabulary with nothing to say.*

### Columns are peers; bands are not

Swapping two features inside a band is a matter of taste — nothing behavioural
changes. Moving one to another band changes its focus phase or its landmark.

*This is what makes free movement a real quantity rather than a metaphor. If the
two kinds of move cost the same, the grammar is not carrying any meaning.*

### The column count is the widest any state needs

Not the widest it looks — the most features that legitimately sit side by side
in any *single* state.

*States vary the node set. A band sized for the sparsest state cannot hold the
densest, and the designer discovers this by finding nowhere to drop.*

### Every requirement your features declare must be satisfiable somewhere

If a feature requires `dismissible` and no band provides it, no drag can ever
resolve that cost. The designer is not choosing; they are stuck.

*This is the one hard check, and it is not a matter of taste. You said this
feature needs something and built a vocabulary that offers it nowhere. Fixing it
means adding a band or a column — a hand-back to whoever edits the grammar, not
a decision for whoever is dragging.*

### Split a band only where the split means something

Reach for a new band when the region carries a different contract — a different
focus phase, a dismissal context the neighbouring band does not have. Reach for
a column when you just need one more position.

*A split with no contract difference costs a designer nothing and gains them
nothing: identical free movement, one more name in the vocabulary, and counts
across a codebase that no longer add up. A split with a real difference is a
constraint you are choosing deliberately — which is fine, and is what the
contract is for.*

### Watch for a feature pinned to one slot

If exactly one slot satisfies what a feature requires, that feature can never
move. It is in the grammar but not in the design work.

*Sometimes correct — a dialog's actions really do belong in one place. But it is
worth seeing, because the usual cause is a contract provided by one narrow band
when it could as easily be provided by two.*

### Name by role, not position

`aside`, not `right`. `masthead`, not `top`.

*Two reasons. Position names stop being true the moment the band stacks on a
narrow screen or the document runs right-to-left. And they do not aggregate:
counting contract violations across a codebase is the whole point of recording
open items in source, and `right/1` in one repo and `sidebar/1` in another are
one region wearing two names — the total is worthless.*

### Emptiness is headroom; permanent emptiness is noise

An empty slot is an invitation, not waste. A slot empty in every state, forever,
is vocabulary nobody needed.

*Reported, never judged. Only you know which one you meant.*

---

## Deriving one, in six steps

1. **List every feature across all states.** Not the ones on screen now — all of
   them.
2. **Group them by behavioural role.** What must be reachable before the main
   content · what *is* the main content · what comes after it · what needs a
   dismissal context.
3. **Each group is a band.** Its column count is the most features from that
   group present in any single state. Add headroom if you want it; you will be
   told if it stays empty forever.
4. **Name each band by its role.**
5. **Attach the behaviour it actually provides** — `focusPhase`, `dismissible`,
   `landmark`. Only what is true.
6. **Check every requirement is satisfiable.** `slots grammar` shows this as a
   column; `slots lint` reports the gaps.

Steps 2 and 3 are the whole job. The rest is transcription.

---

## Starting points

`slots new <id> --from <archetype>` writes a grammar you edit down:

| | shape |
|---|---|
| `document` | masthead · main(2) · footer |
| `workbench` | masthead · rail · canvas · inspector · status |
| `feed` | masthead · lede(2) · stream · aside · footer |
| `surface` | header · body(2) · actions — a dialog, dismissible throughout |
| `blank` | nothing, and a pointer to step 1 above |

**Nothing validates against an archetype.** They are seeds, and the fastest way
to use one is to delete from it. `document` ships `main` with two columns to
demonstrate that columns are peers — not to predict that your main region has
two things in it.
