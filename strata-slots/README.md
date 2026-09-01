# strata-slots

Move a feature to where it belongs by dragging it there. Nothing stops you —
not the move, not the commit. What the move costs is named while you are still
reaching for the slot, and travels with the design into source and into the
diff.

See [PROJECT.md](PROJECT.md) for the brief this repo implements, every term
defined, and the reasoning behind each decision.

```bash
npm install
npm run id        # assign identity over the view surfaces, build the manifest
npm test          # 100 headless tests — no browser involved
npm run dev       # the drag surface
```

## What is where

```
src/schema/      the whole vocabulary — types only, zero imports
src/grammar/     the spacing grammar → the slot set, and the behaviour check
src/identity/    the codemod (TS compiler API) and the manifest it produces
src/store/       assignments, the drop, and write-through to source
src/resolve/     THE RESOLVER — pure, and also the validator
src/report/      the diff, per view and per state
src/lint/        the lint pass: contracts, dangling assignments, drifted records
src/runtime/     <View> / <Feature>, rendering from the resolver
src/drop/        the drag surface: hit-testing, zones, what a slot costs
src/harness/     A HOST. Not the library — see below
fixtures/app/    two views the codemod operates on for real
```

Steps 1–3 of the brief (`schema`, `grammar`, `identity`, `store`, `resolve`)
import nothing but each other and `typescript`. React starts at `runtime/`.

## With Claude Code

```bash
npm install --save-dev strata-slots
npx slots init && npx slots id && npx slots preview
```

Claude generates the screen; you drag features between slots with no prompt;
you press **ready for review**; `/slots-review` reads what changed, fixes what
broke, reports what it costs, and commits. See
[integrations/claude-code](integrations/claude-code/README.md).

## Library and host

The library holds assignments and open items and exposes them. It does not
decide when they are written, does not own a session, and does not gate
anything:

```tsx
<SlotsProvider manifest={manifest} onChange={(store, openItems) => { /* yours */ }}>
```

`onChange` is the whole extension point. Persist there, batch there, write
through there, refuse to ship there — or do none of it.

`src/harness` is one host. It owns the session, saves to local storage on every
change, writes through on its own boundaries (leaving a state or a view, and the
last cost being acknowledged — never on a timer), and enforces nothing. Those
are four choices, all of them replaceable, and they are in one file so you can
see which are the app's and which are the library's.

## In the terminal

Everything the drag surface does, the CLI does too — not for parity, but because
the resolver has to be provable without a browser.

```bash
npm run slots       # the slot set each view's grammar enumerates
npm run manifest    # every declared view and the features that belong to it
npm run layout      # the resolved layout, every view, every state
npm run open        # behavioural costs, and who has acknowledged them
npm run lint        # [--json] contracts, dangling assignments, drifted records
npm run diff        # placements that differ from source defaults
npm run resolve gallery focus gallery.preset-grid
```

## The shape of it

A **view** is declared by hand in a `.view.ts` file: its states, and the *bands*
that generate its slots. A band also declares what its slots can promise —
where they fall in focus order, whether dismissal works there.

```ts
export default defineView({
  id: 'gallery',
  states: ['browse', 'focus'],
  defaultState: 'browse',
  bands: [
    { id: 'masthead', columns: 1, behavior: { focusPhase: 'before-main' } },
    { id: 'lede', columns: 2, behavior: { focusPhase: 'before-main' } },
    { id: 'body', columns: 3, behavior: { focusPhase: 'main' } },
    { id: 'aside', columns: 1, behavior: { focusPhase: 'main', dismissible: true } },
    { id: 'footer', columns: 2, behavior: { focusPhase: 'after-main' } },
  ],
})
```

A **view surface** says where each feature sits by default, which states include
it, and what it needs. `fid` is written by `npm run id` and never by hand.

```tsx
<View id="gallery">
  <Feature fid="gallery.filters" slot="lede/1" states="browse" requires="before-main">
    <Filters />
  </Feature>
  <Feature fid="gallery.preset-grid" slot="body/1" requires="sole-focus">
    <PresetGrid />
  </Feature>
</View>
```

Dragging `Filters` anywhere works. Dragging it into `body/2` works too — and
that slot is marked on the way in, because `Filters` must stay reachable before
the content it filters and `body/2` is main content. The move lands; the cost
becomes an open item.

A drop writes here, and this is the whole review:

```diff
   placement: {
     focus: {
-      'gallery.preset-grid': { slot: 'body/1', order: 0, by: 'human' },
+      'gallery.preset-grid': { slot: 'lede/1', order: 0, by: 'human' },
     },
   },
```

An accepted cost writes on the same line as the slot it applies to, so moving
the feature moves the question with it:

```ts
'gallery.detail': { slot: 'body/2', order: 0, by: 'human', accepted: ['dismissible'] },
```

## The two claims

Both tested by search rather than asserted:

- **No move is ever blocked.** Every legal target, three deep, lands where it
  was aimed. The only refusals left are structural — a slot the grammar does not
  define is not a position, so it is not a move.
- **No cost is incurred silently.** Every slot is priced before the drag begins,
  what the drag previews is what the drop produces, and the cost is recomputed
  from source everywhere the design is shown.

And a third, guarding the first two from erosion: `test/behavior.test.ts` checks
that no design exists which the library would refuse to write, and that the
resolver's source contains no refusal path at all.

## Defining a grammar

The slot set is the whole vocabulary a designer gets, so [GRAMMAR.md](GRAMMAR.md)
says what makes one good and why. The measure is **free movement** — how many
positions a feature can reach at no cost — not how many slots exist.

```bash
slots new checkout --from document   # a seed you delete from, not a schema
slots grammar                        # slots, free movement, what it can satisfy
```

Nothing validates a grammar against an archetype, and every grammar finding in
`slots lint` is a report. The one that comes closest to a rule —
`unsatisfiable-requirement` — is not us disagreeing with a designer: it means
they declared a requirement and built a vocabulary offering it nowhere, which is
a dead end no drag can leave.

## Costs are written down

An unsatisfied contract is recorded in source, on the placement that produced
it:

```ts
'gallery.preset-grid': { slot: 'body/1', order: 3, by: 'human', open: ['sole-focus'] },
```

Not session state, not a warning log — a line in a diff and a number you can
total across a codebase without running anything. `commit` materialises a record
even for a feature that never moved, when a neighbour's arrival is what cost it
something.

Writing derived data down risks drift, so `npm run lint` recomputes and reports
any record that disagrees, in both directions. It also catches what nothing else
can: an assignment whose slot, feature, view or state no longer exists — because
a slot that is gone is not a slot that fails a contract, it is an assignment
pointing at nothing.

Lint sets no exit code. Whether a finding stops a build is a policy, and
policies differ between teams.
