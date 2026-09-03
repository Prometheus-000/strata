---
allowed-tools: Bash(strata:*), Bash(npx strata:*), Bash(malleable:*), Bash(npx malleable:*), Bash(npm run dev:*)
description: Serve the page so a designer can move regions and drag properties by hand
---

Start the page and hand the loop over.

1. Run `strata id` to stamp identity and rebuild the manifest and structure.
2. Report anything it prints as a problem. Do not continue past one — a page
   that does not build cannot be moved.
3. Run the dev server in the background and give the user the URL.
4. Say, in one line, what they can do there: drag a corner or an edge to change
   a property, drag a region to move it into another landmark, and press
   **ready** when the shape is right.

Then stop and wait. **Do not narrate the page, do not suggest layouts, and do
not offer to move anything for them.** Choosing where a region goes is the part
of this loop that does not need you, and interrupting it with suggestions is
the failure mode the whole design is arranged around.
