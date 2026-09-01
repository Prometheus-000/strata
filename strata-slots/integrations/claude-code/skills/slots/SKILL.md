---
name: slots
description: Use when creating, editing, or reviewing screens, views, features, or layout structure in a project that uses strata-slots (it has a `*.view.ts` file or a `slots.config.json`). Covers writing view declarations and view surfaces, adding features, adding bands and slots, and reviewing a designer's structural changes after they press "ready for review".
---

# Slots

This project separates **structure** from prose. A view's positions are
enumerated in advance, and a designer moves features between them by dragging —
without prompting you. Your half of the loop is different from theirs:

| Phase | Who | Why |
|---|---|---|
| Generate a screen, feature, band, or slot | **You** | Something must exist before it can be moved |
| Move a feature between existing slots | **The designer** | Choosing among enumerated positions needs a hand, not a prompt |
| Review what changed, then commit | **You** | Reading a diff and judging cost is judgement |

**The division that matters: dragging cannot create a slot.** Slots come from
the grammar. When a designer needs a position that does not exist, that is a
hand-back to you — add a band or a column, do not tell them to work around it.

## Vocabulary

- **View** — a named unit of design work, declared by hand. Views are flat: they
  never nest, and a node belongs to exactly one.
- **State** — a variant of a view where some features are absent and others
  appear. Same design decisions, different node set. **A state is not a view.**
- **Feature** — the unit that moves. A composed region, never a leaf element.
- **Slot** — a named position, `band/column`. The only legal destination.
- **Band** — a horizontal row that generates slots and carries the behaviour
  contract.

## Writing a view

Two files. Both are hand-written; the tool only ever adds `fid` and `placement`.

**The declaration** (`something.view.ts`) — states and the spacing grammar:

```ts
import { defineView } from 'strata-slots'

export default defineView({
  id: 'checkout',
  states: ['cart', 'payment'],
  defaultState: 'cart',
  bands: [
    { id: 'header',  columns: 1, behavior: { focusPhase: 'before-main', landmark: 'banner' } },
    { id: 'main',    columns: 2, behavior: { focusPhase: 'main', landmark: 'main' } },
    { id: 'aside',   columns: 1, behavior: { focusPhase: 'main', dismissible: true } },
    { id: 'summary', columns: 1, behavior: { focusPhase: 'after-main', landmark: 'contentinfo' } },
  ],
})
```

`bands` generates the slot set: `header/1`, `main/1`, `main/2`, `aside/1`,
`summary/1`. That is every position in this view. There is no sixth.

**The surface** (`Checkout.tsx`) — which features exist, where source puts them,
which states include them, and what they need:

```tsx
import { Feature, View } from 'strata-slots'

export function Checkout({ state }: { state?: string }) {
  return (
    <View state={state} id="checkout">
      <Feature slot="header/1" requires="before-main"><Title /></Feature>
      <Feature slot="main/1"><Basket /></Feature>
      <Feature slot="main/2" states="payment"><PayPanel /></Feature>
      <Feature slot="summary/1" requires="after-main"><Totals /></Feature>
    </View>
  )
}
```

Then run `slots id` — it stamps a stable `fid` on each `<Feature>`. Never write
`fid` yourself and never edit one; overrides are addressed by it.

## Defining a grammar

**The measure is free movement, not slot count.** A feature's freedom is how
many positions it can reach without incurring a cost, and that is decided by how
many slots sit under a contract satisfying what it requires. A grammar with nine
slots where a feature can only ever sit in one of them has given the designer
nine positions and one choice.

Two consequences that pull opposite ways, and holding both is the job:

- **A split with no contract difference buys nothing.** Cost follows the
  contract, not the band count. Splitting `main` into `main-a` and `main-b`
  leaves freedom exactly where it was and leaves two names for one region.
- **A split with a real contract difference constrains on purpose** — and also
  *creates* destinations. A view where every band says `main` gives a feature
  requiring `before-main` nowhere to be.

### Deriving one — six steps

1. List every feature across all states.
2. Group by behavioural role: reachable before the main content · is it · after
   it · needs a dismissal context.
3. Each group is a band. Columns = the most features from that group present in
   any *single* state.
4. Name by role, never by position — `aside`, not `right`. Position names stop
   being true when the band stacks or the document runs right-to-left, and they
   do not aggregate across a codebase, which is what the counts depend on.
5. Attach only the behaviour the band actually provides.
6. Check every requirement is satisfiable: `slots grammar`.

Steps 2 and 3 are the whole job. Read `GRAMMAR.md` for each rule's reason —
generate from the reasoning, not from the archetype list, or you will produce
collage.

```bash
slots new <id> --from document|workbench|feed|surface|blank
slots grammar [view]    # slots, free movement per feature, what it can satisfy
```

Archetypes are seeds, not schemas. Nothing validates a grammar against one, and
the fastest way to use one is to delete from it.

## The behaviour contract

A band declares what its slots support; a feature declares what it requires.
Where they do not meet, the system records an **open item**. Nothing is blocked
— not the move, not the commit. The cost is named and written into source.

| Requirement | Covers | Give it to a feature that… |
|---|---|---|
| `before-main` | focus order | is a banner, nav, or filters the main content depends on |
| `main` | focus order | must sit in the main region |
| `after-main` | focus order | is a footer, totals, contentinfo |
| `sole-focus` | keyboard traversal | handles its own arrow keys (a grid, a listbox, a tab set) |
| `dismissible` | dismissal | closes on Escape or click-outside |

Only add a requirement a feature genuinely has. A requirement nobody needs
produces noise in every count, and the counts are the point.

## Rules

1. **Never hand-edit `placement` in a `.view.ts` file.** It is tool-written from
   the designer's drags. Editing it by hand will be silently overwritten and
   will make `slots lint` report drift.
2. **Never write or change a `fid`.** Run `slots id` instead. Ids survive
   refactors, wrapping and reordering *because* they are pinned, and rewriting
   one orphans every assignment against it.
3. **Run `slots id` after adding or removing a `<Feature>`.** Unstamped features
   do not render.
4. **A slot must exist in the grammar.** If a feature needs somewhere new, add a
   band or a column to the declaration — never invent a slot id on a `<Feature>`.
5. **A feature is a composed region.** Never wrap a bare `<div>` or a string.
6. **Views never nest.** A `<View>` inside a `<View>` fails the build.
7. **When a designer needs a position that does not exist, add a band or a
   column** — that is your half of the loop, and dragging cannot do it.
   **Never widen a band's contract to make a cost go away.** Declaring a band
   `dismissible` because something in it wants to be dismissible does not build
   a dismissal context; it just stops the system telling anyone the truth.

## Commands

```bash
slots id        # stamp identity, rebuild the manifest — after any surface edit
slots layout    # resolved layout, every view, every state
slots open      # behavioural costs this design carries
slots lint      # costs + dangling assignments + drifted records
slots preview   # serve the real views so a designer can move things
slots diff      # what differs from source defaults, per view and per state
```

## Reviewing a handoff

When the designer presses **ready for review**, `.slots/ready.json` is written.
See the `/slots-review` command. The one thing to get right: **separate what is
broken from what merely costs.**

- `broken` (dangling assignments — a slot, feature, state or view that no longer
  exists) — genuinely wrong. Offer to fix it.
- `costs` (unsatisfied contracts) — **the designer's call, not yours.** Report
  what each costs and offer the two ways out: move it somewhere that satisfies,
  or acknowledge it on the record. Never call these "broken" and never
  acknowledge one on the designer's behalf.
