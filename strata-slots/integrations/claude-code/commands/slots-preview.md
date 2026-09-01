---
allowed-tools: Bash(slots:*), Bash(npx slots:*), Bash(./node_modules/.bin/slots:*)
description: Serve this project's views so a designer can move features by hand
---

Start the structural preview and hand the loop over.

1. Run `slots id` to stamp identity and rebuild the manifest.
2. Report anything it flags. Do not continue past a problem — a view that does
   not build cannot be previewed.
3. Run `slots preview` in the background and give the user the URL.
4. Say, in one line, what they can do there: drag a feature to move it, and
   press **ready for review** when the shape is right.

Then stop and wait. **Do not narrate the preview, do not suggest layouts, and do
not offer to move anything for them.** Choosing among enumerated positions is
the part of this loop that does not need you, and interrupting it with
suggestions is the failure mode the whole design is arranged around.
