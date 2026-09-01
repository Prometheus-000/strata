# strata-slots × Claude Code

The loop, and who does what:

```
   you ── prompt ──▶ Claude          generates the screen: view, bands, features
                       │             (a slot must exist before anything can move into it)
                       ▼
                 slots preview       your real views, running
                       │
   you ── drag ───────▶│             move features between slots · no prompt, no text box
                       │
   you ── "ready" ────▶│             writes .slots/ready.json — NOT a commit
                       ▼
                 /slots-review       Claude reads it: fixes what broke, reports what it
                       │             costs, leaves the cost decisions to you
                       ▼
                    git commit
```

**"Ready for review" is not a save button.** The moves are already in source by
the time you press it — it withholds nothing. It says *I think this is right*,
and starts the review.

## Install

```bash
npm install --save-dev strata-slots
npx slots init
```

`init` writes `slots.config.json`, the skill, the two commands, a `PostToolUse`
hook, and the right `.gitignore` lines. It merges into an existing
`.claude/settings.json` and never overwrites a setting it did not add.

Then:

```bash
npx slots id        # stamp identity on your features
npx slots preview   # open the loop
```

## What each piece does

| Piece | Job |
|---|---|
| `skills/slots` | Teaches Claude the grammar so generated screens are valid, and the rules it must not break (never hand-edit `placement`, never write a `fid`) |
| `/slots-preview` | Stamps identity, serves your views, then **gets out of the way** — it is told not to suggest layouts |
| `/slots-review` | Reads the handoff, separates broken from costly, fixes the first, reports the second, commits |
| `hooks/slots-check.sh` | After Claude edits a view, re-stamps identity and reports assignments that stopped resolving. Silent when clean |

## The distinction the review turns on

`/slots-review` must never conflate these:

- **Broken** — an assignment pointing at a slot, feature, state or view that no
  longer exists. Nobody chose it; usually a grammar change landed underneath
  committed work. Claude fixes it.
- **A cost** — a slot that cannot give a feature something it requires. You may
  have chosen it deliberately. Claude reports it and offers the two ways out
  (move it, or acknowledge it on the record) and does neither on your behalf.

Calling a deliberate cost "broken" is how a designer stops believing the tool.

## Alternative: install as a plugin

```
/plugin marketplace add <this repo>
/plugin install strata-slots
```

The plugin carries the same skill, commands and hook. `npx slots init` is still
worth running afterwards to pin `slots.config.json`.
