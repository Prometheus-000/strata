---
name: malleable
description: Use when generating, editing, moving, or reviewing pages, regions, or styled components in a project that uses strata-malleable (it has a `.malleable/` directory or `malleable` in its scripts). Covers writing pages whose regions can be moved, adding regions, writing as an agent with --by agent, and reviewing a designer's handoff by adapting code to the design.
---

# Malleable

This project lets a designer change the real page by hand — drag a corner to
change a radius, drag an edge to change padding, **drag a region to move it
into another landmark** — with no prompt and no text box. A move rewrites the
JSX on the spot; `git diff` is the record. Your half of the loop is different
from theirs:

| Phase | Who | Why |
|---|---|---|
| Generate a page, a region, a component | **You** | Something must exist before it can be moved |
| Move a region, change a property | **The designer** | Choosing where things go needs a hand, not a prompt |
| Move a region when asked to, by name | **You, as `agent`** | `malleable move … --by agent`, so the receipt says who decided |
| Review the handoff and make the code fit | **You** | Designers define the UX; code logic is malleable to the design |

**The premise: designers define the UX.** A move is never wrong at the page
level. Focus order, dismissal, keyboard handling are code, and when a region
moves the code adapts — at review, by you. Nothing speaks while the designer
is working: no hook, no lint, no cost mark. A design in progress fails any
check by definition.

## Vocabulary

- **Container** — a landmark element: `<header>`, `<nav>`, `<main>`, `<aside>`,
  `<footer>`, `role="dialog"`, `<form role="search">`, or the root element of
  the page component. Regions move between containers. Nothing declares one;
  the page's own markup is the list.
- **Region** — a component call site under a container: `<Filters />` inside
  `<main>`. The unit that moves.
- **Identity** — `data-sid` on styled nodes and landmarks, `data-region` on the
  root element of every component. Stamped by `malleable id`. **Never write or
  edit these by hand.**

## Writing a page so it can be moved

```tsx
// Page.tsx — the composition. Landmarks are the containers.
import { Filters } from './Filters'
import { Gallery } from './Gallery'
import { TopBar } from './TopBar'

export function Page() {
  return (
    <div className="page">
      <TopBar />
      <main className="page__main">
        <Filters />
        <Gallery />
      </main>
      <footer className="page__foot">…</footer>
    </div>
  )
}
```

Rules that make a page movable:

1. **Every region is a component call site**, exported from its own file. A
   bare `<div>` full of markup cannot be picked up; `<Filters />` can.
2. **A component's root is a host element** (`<form>`, `<section>`, `<div>`),
   not a fragment and not another component — that is where `data-region`
   lands, and without it the region has no handle in the DOM.
3. **Regions sit under landmarks.** A `<header>` inside `TopBar` is a container
   too; the reader looks through the call site to find it.
4. **Lists stay inside a region.** `{items.map(…)}` renders a list; its data is
   its order. Wrap it in a component and move that.
5. **Keep a region self-contained where you can.** A region that reads state
   from the component around it can still be moved — the receipt says what it
   needs — but one that owns its state moves without a review step.
6. **Run `malleable id` after adding a component.** Unstamped regions cannot be
   moved.

## Property controls — what a component says may be changed

A component declares its controls beside itself, the way Framer's
`addPropertyControls` sits beside a component. Two kinds, one declaration:

```ts
import { defineControls } from 'strata-malleable'

export function Badge({ tone = 'neutral', children }) { … }

export const controls = defineControls(Card, {
  tone: { options: ['neutral', 'accent', 'positive'] },  // a prop with options: picked on the object
  interactive: { toggle: true },                          // a boolean prop: one chip, on or off
  lines: { range: [1, 6] },                               // a numeric prop: scrubbed sideways, within the range
  radius: { range: [0, 24], snap: ['--radius-pill'] },    // a CSS length on the root node: its own handle limits
  padding: false,                                         // no handle for this one
})
```

- A **prop control** is one of three shapes. `options` is a fixed list of
  strings, picked. `toggle: true` is a boolean, one chip that is on or off;
  `default` says what the component does when the attribute is absent (false
  when omitted). `range` on a non-CSS key is a number, scrubbed sideways in
  steps of `step` (1 when omitted). All three appear above the selected
  instance; a pick rewrites the attribute on the call site in whichever file
  uses the component — `tone="accent"`, `interactive`, `interactive={false}`,
  `lines={3}` — and is receipted like a move. An attribute whose value is an
  expression is left to the code.
- A **CSS control** shapes the handle the overlay already offers on the root
  node: `range` clamps the drag, `snap` replaces the tokens it can land on,
  `false` removes the handle. The root node still needs the property declared
  in CSS — `malleable id` says so when it does not.
- A pick on an instance rendered from a list is a pick on the whole list:
  one call site, one line, every card follows. That is correct — a group
  stays consistent — and every instance in the group is outlined while the
  strip is up, so what the pick touches is visible before the pick.
  A card used elsewhere on the platform is another call site and is not
  touched. If one card in a group must differ, that is data, and the reviewer
  changes the data.
- Declare only what the component genuinely allows. A control is a promise
  that any option is a valid state of the component.

```bash
malleable prop Badge tone positive --in fixtures/app/views/Gallery.tsx --by agent
malleable prop Badge tone --default --in fixtures/app/views/Gallery.tsx --by agent
```

## Writing as an agent

When the designer asks you to move something — "put the filters in the top
bar" — do it through the CLI, never by editing JSX by hand, so the receipt
names you:

```bash
malleable regions                                   # containers and what they hold
malleable move Filters --to nav --by agent          # into the nav, at the end
malleable move Filters --to main --at 0 --by agent  # before the first region of main
malleable set Card.div.st-card radius 20px --view gallery --instance ember --by agent
malleable ready --by agent                          # hand a generated page to review
```

Always pass `--by agent`. The CLI infers it from `CLAUDECODE` in your shell and
prints which signal it used, but an explicit flag is the honest record. A move
that leaves state behind still lands; the CLI says `needs wiring at review`.

## Reviewing a handoff

When the designer presses **ready**, `.malleable/ready.json` is written. See
the `/malleable-review` command. The whole job: **make the code fit the
design, and never move anything back.** Wire what a move left behind, give a
moved dialog its dismissal context where it now lives, clean up dead state,
run the tests. Anything you notice against GRAMMAR.md — a region named by
position, two filled actions on one surface — you report as an observation, in
a line. Not as a cost. Not as a violation.

## Commands

```bash
malleable id        # stamp identity, rebuild the manifest and structure — after any edit that adds a node
malleable regions   # every container, with the regions it holds
malleable drift     # un-promoted property overrides, counted by shape and by author
malleable ship      # collapse promoted overrides into source
malleable move      # move a region, from the terminal
malleable prop      # pick a prop value on a call site, from the terminal
malleable ready     # hand off; commits nothing
```
