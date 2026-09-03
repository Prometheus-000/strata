---
allowed-tools: Bash(malleable:*), Bash(npx malleable:*), Bash(npm test:*), Bash(npm run build:*), Bash(git status:*), Bash(git diff:*), Bash(git add:*), Bash(git commit:*)
description: Review a designer's moves after "ready", adapt the code to the design, then commit
---

The designer has pressed **ready**. Your job is to read what they did, make
the code fit it, say what you noticed, and commit.

## 1. Read the handoff

Read `.malleable/ready.json`. If it is missing, say so and stop — nothing has
been handed off yet. It lists each move: what, from which container to which,
by whom, and anything the moved region still needs from where it came.

If `ready.by` is `agent`, the handoff came from an agent — possibly you, in an
earlier session. Say so up front: an agent's moves need a person's eyes before
they are committed.

Then run `malleable regions` for the structure as it is now, and `git diff`
for the moved files. The diff is the record; the receipt is who made it.

## 2. Make the code fit — this is the whole job

**Designers define the UX. A move is never wrong at the page level.** What can
be wrong is code that no longer fits the structure, and fixing that is yours:

- A move listed `needs wiring: open, setOpen` — the region references state
  bound where it came from. Lift the state to where both can reach it, or pass
  it down, or move it with the region. Do not move the region back.
- A dialog or panel moved out of the component that handled its Escape or its
  backdrop — give it a dismissal context where it now lives.
- Focus order follows DOM order. If the move put a region before something it
  depends on, the dependency moves or the code adapts; the region stays.
- Dead state, unused imports, a prop no longer passed — clean up what the move
  left behind.

Then run the project's tests and build.

## 3. Say what you noticed — as observations, never as costs

Read the moved files against GRAMMAR.md: a region named by position, two
filled actions on one surface, a raw value where a token belongs. Report each
in a line. **Never call a move a cost, a violation, or broken, and never undo
one.** If you think a move is a mistake, say why in one sentence and leave it
where the designer put it.

## 4. Commit

Only after the above, and only if they have not asked you to hold. Stage the
moved files and whatever you changed to make them fit, and write a message in
the designer's terms:

```
page: move Filters from main into the top bar

Filters now sits in the header nav. Wired `query` up to Page so both
the nav and the gallery read it.
```

Do not commit `.malleable/ready.json`. Delete it once you have acted on it, so
a stale handoff is not reviewed twice.
