# strata-malleable × Claude Code

The loop, and who does what:

```
   you ── prompt ──▶ Claude          generates the page: regions under landmarks,
                       │             each a component of its own
                       ▼
                 npm run dev         your real page, running
                       │
   you ── drag ───────▶│             drag a corner to change a property · drag a
                       │             region to move it · no prompt, no text box ·
                       │             a move rewrites the JSX on the spot
   you ── "ready" ────▶│             one `ready` line on the record — NOT a commit
                       ▼
                 /malleable-review   Claude reads it and makes the code fit the
                       │             design; it never undoes a move
                       ▼
                    git commit
```

**Nothing speaks until you say ready.** A design in progress fails any check by
definition, so there is no hook, no lint, no cost mark mid-drag. The only
things the layer ever reports are the drift report for properties and the
receipt of who moved what.

## Install

```bash
npm install --save-dev strata-malleable
npx malleable init
```

`init` copies the skill and the two commands into `.claude/`. It installs no
hook, touches no settings, and adds nothing to `.gitignore` — pressing ready
writes one `ready` decision to `.strata/decisions.jsonl`, which is committed
like every other decision. There is no handoff file to ignore, and there has
not been one since the record replaced it.

Then:

```bash
npx malleable id      # stamp identity on your nodes and regions
npm run dev           # open the loop
```

## What each piece does

| Piece | Job |
|---|---|
| `skills/malleable` | Teaches Claude how to generate a page whose regions can be moved, how to write as an agent, and how to review a handoff by adapting code to the design |
| `/malleable-preview` | Stamps identity, serves the page, then **gets out of the way** — it is told not to suggest layouts |
| `/malleable-review` | Reads the receipt and the diff, wires what a move left behind, reports what it noticed, commits |

## The rule the review turns on

**Designers define the UX.** A move is never wrong at the page level. If the
code no longer fits — a dialog moved out of its dismissal context, a region
that still references state from where it came — the code adapts. Claude's
job at review is to make it fit, say what it noticed, and never move anything
back.

## Alternative: install as a plugin

```
/plugin marketplace add <this repo>
/plugin install strata-malleable
```

The plugin carries the same skill and commands. `npx malleable init` is still
worth running afterwards for the `.gitignore` line.
