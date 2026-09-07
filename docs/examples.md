# Examples

**A token is cut.** A person decides; the projections regenerate in the same
call; the record gains a line that supersedes the import.

```
$ strata cut --accent-strong --why "one filled action per surface" --decided-by human --actor prometheus-000

  --accent-strong: kept → cut
  collapses to --accent — One filled action per surface; a second strength of accent is the first thing a small system does without.
  decided by human — --decided-by human on the command line; written by agent claude-code — CLAUDECODE in the environment
  ~ src/theme/ledger.json, src/tokens/semantic.css, src/tokens/tokens.json, .strata/decisions.jsonl
```

A person decided it; an agent's shell typed it; the record says both, and the
stylesheet credits the hand that chose:

```css
--accent-strong: var(--accent); /* cut by human prometheus-000: one filled action per surface */
```

**A region moves, by an agent, when asked.** The JSX is rewritten, imports
follow, and the line says what the moved element still needs.

```
$ strata move Filters --to nav --decided-by human --actor prometheus-000 --why "the filters belong with navigation"

  fixtures/app/views/Page.tsx: removed <Filters /> · fixtures/app/views/TopBar.tsx: inserted <Filters /> · import added

  <Filters />  Page.main.page__main → TopBar.nav.topbar__nav   fixtures/app/views/TopBar.tsx:18 · human prometheus-000 (written agent claude-code)
  decided by human — --decided-by human on the command line; written by agent claude-code — CLAUDECODE in the environment
  ~ fixtures/app/views/Page.tsx, fixtures/app/views/TopBar.tsx, .strata/decisions.jsonl
```

Asked to put the filters in the top bar, the agent chose nothing: the region
and the destination were both named to it. So the deciding hand is the
person's and the writing hand is the agent's, which is what the line says.
Had it been told "the top bar feels empty" and picked the filters itself, the
deciding hand would be `agent` and the instruction would go in `--why`.

**Drift converges; promotion is earned.** Three instances reach 12px by
hand; the record says so; a person widens it.

```
$ strata check
PRECEDENT  ·  computed from the record — promoting a candidate is a hand’s decision
──────────────
drift.convergence  padding = 12px
    3 instances independently converged across 2 views · hands unnamed · 3 decisions by hand — a candidate, which is computed; promoting it is a hand's decision

$ strata set Card.div.st-card padding 12px --scope view --view gallery --decided-by human --actor prometheus-000 --why "every card here"
  padding = 12px on Card.div.st-card
  scope: view · absorbed 3 narrower override(s)
```

Or, when the value has a job and no name, the other kind of promotion — the
one that adds a word to the language rather than choosing within it:

```
$ strata mint --radius-card --value 12px --from d0mtlvzac0-ed0m --why "nine cards reached 12px independently; the value has a job and no name"

  minted --radius-card = 12px
  minted from 1 converging decision(s); cut, it collapses to 12px
```

**A handoff.** The designer presses ready; the reviewer reads what changed
since the last one, with a reversal collapsed away.

```
$ strata handoff

  <Badge tone>  accent → positive   fixtures/app/views/Gallery.tsx:14 · human prometheus-000
  <Filters />  Page.main.page__main → TopBar.nav.topbar__nav   fixtures/app/views/TopBar.tsx:18 · agent claude-code
      needs wiring: open

1 line was decided by an agent, not merely written by one — a person reviews it before it is committed:
  d0mtm5z44t-ifap  <Filters />  Page.main.page__main → TopBar.nav.topbar__nav   fixtures/app/views/TopBar.tsx:18 · agent claude-code

ready for review — human prometheus-000, 2026-09-03T18:02:11.000Z
```

The split is the point. An agent that typed a person's decision needs no
second look; an agent that *chose* is a line nobody has seen, and the handoff
names those rather than leaving a reviewer to work out which is which.
