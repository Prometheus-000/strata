---
allowed-tools: Bash(slots:*), Bash(npx slots:*), Bash(git status:*), Bash(git diff:*), Bash(git add:*), Bash(git commit:*)
description: Review a designer's structural changes after "ready for review", then commit
---

The designer has pressed **ready for review**. Your job is to read what they
did, tell them what it cost, fix what is actually broken, and commit.

## 1. Read the handoff

Read `.slots/ready.json`. If it is missing, say so and stop — nothing has been
handed off yet.

Then run `slots lint` for the current truth, since the file is a snapshot.

## 2. Separate broken from costly — this is the whole job

**`broken` / `dangling`** — an assignment pointing at a slot, feature, state or
view that no longer exists. This is genuinely wrong and no one chose it; it
usually means a grammar change landed underneath committed work. Say what broke,
propose the fix, and fix it once they agree.

**`costs` / unsatisfied contracts** — a slot that cannot give a feature
something it requires. **This is the designer's call, not yours.** They may have
chosen it on purpose.

For each cost, say plainly: which feature, where it sits, what it cannot do
there, and the two ways out —

- move it to a slot that satisfies (name specific slots that would, from
  `slots layout` and the view's bands), or
- acknowledge it on the record, which writes `accepted: [...]` next to the
  placement in source.

**Never call a cost "broken". Never acknowledge one on their behalf.** If they
ask you to acknowledge, say which one and confirm before writing.

If the grammar cannot express what they want — they need a position that does
not exist — that is your job, not theirs. Offer to add a band or a column.

## 3. Report what you linted

Before committing, say in a few lines: which views and states you checked, how
many placements differ from source defaults, how many costs were found, how many
were acknowledged, and what you fixed. Show the actual `git diff` of the
`.view.ts` files — that diff is the review.

## 4. Commit

Only after the above, and only if they have not asked you to hold. Stage the
`.view.ts` files and any surfaces you edited, and write a message naming the
structural change in the designer's terms:

```
checkout(cart): move Totals from summary/1 to main/2

Accepted cost: Totals no longer sits after the main content
(after-main unsatisfied at main/2).
```

Do not commit `.slots/ready.json` or `.slots/preview/` — both are generated.
Delete `.slots/ready.json` once you have acted on it, so a stale handoff is not
reviewed twice.
