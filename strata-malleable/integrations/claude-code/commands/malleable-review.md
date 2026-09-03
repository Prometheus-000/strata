---
description: Review the designer's handoff — make the code fit the design, never move anything back, commit
allowed-tools: Bash(strata:*), Bash(npx strata:*), Bash(npm run strata:*), Bash(npm test:*), Bash(npm run build:*), Bash(git status:*), Bash(git diff:*), Bash(git add:*), Bash(git commit:*)
---

The designer pressed **ready**. It is on the record; nothing was committed.

## 1. Read the handoff, and the skill

```bash
npx strata handoff
npx strata skill review-handoff
```

The packet lists every move and pick since the last ready, collapsed, with
its author, the rules that bear on the review, and the procedure. If the
handoff was pressed by `agent`, say so: a person reviews before it is
committed.

## 2. Make the code fit — this is the whole job

For each move, `npx strata explain <id>` says what it still needs. Wire what
a move left behind; give a moved dialog its dismissal context where it now
lives; delete state nothing reads any more. Run the tests.

## 3. Say what you noticed — as observations, never as costs

One line each. Not a violation. Not a score. `npx strata check` for the
whole picture; only a mechanical invariant can fail it, never a design.

## 4. Commit

Source and `.strata/decisions.jsonl` together, with a message that says what
the designer decided and what you wired. There is no receipt file to delete.
