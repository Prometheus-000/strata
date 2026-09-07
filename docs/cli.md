# CLI

One interface. Every write is a decision on the record and states two hands:
`--decided-by human|agent` (`--by` is the same flag; otherwise
`STRATA_DECIDED_BY`, then `STRATA_AUTHOR`) with `--actor <handle>`, and
`--written-by`, which `CLAUDECODE` answers on its own. Plus `--why "…"` and
`--dry`.

```
starting
  init [--yes] [--voice p [--house]] [--source d] [--tokens d | --no-theme] [--no-skills] [--mcp] [--dry]
                              the record, the grammar, the skills, the tokens — in an empty repo or a full one
                              --voice takes a person's rules and the prose they cite, from a path or a git URL
                              --house takes them in as this product's own; without it they stay the person's

the record
  check [--enforce] [--json]  here is what happened: invariants, then policy, preference, knowledge, precedent, handoff
  explain <id | targetKey>    one decision as a glass box: DECISION · CONTEXT · EVIDENCE · CONSEQUENCE
  log [--kind k]              every decision, one line each
  history <targetKey>         every decision on one target
  show <id>                   one decision
  precedent [words] [--property p] [--value v] [--component C] [--token --x] [--author a] [--actor h] [--unpromoted]
  skill [name] [--<input> v]  the skills, or the packet for one
  ready [--why …]             hand off what changed since the last ready
  handoff                     what changed since the last ready
  import                      bring an old ledger and store onto the record, once
  rebuild [--check]           write every projection from the record; --check only says which differ

the theme (Layer 0)
  retheme [--hue n] [--chroma n] [--warmth n] [--energy n] [--density n] [--lightness n] [--appearance dark|light] [--link <url>]
                              move the seven seeds, on the record; every projection is compiled from them in the same call
  list · cut · keep · propose --<token> [--why …]
  mint --<token> --value <v> --why …   coin a name for a value usage kept reaching
  deviate <file>:<line> --why …
  survey                      what the stylesheets already decided

the malleable layer
  id · regions · manifest · resolve · reconcile · drift · handoff
  set · remove · move · prop · ship
```

```bash
npm install                # links the three workspaces: the substrate, the engine, the identity
npm run dev                # one server, six pages: /, /personalize.html, /malleable.html, /lab.html, /identity.html, /sky.html
npm run identity           # the favicon and the mark, projected from the record
npx strata check           # what happened
npx strata explain token:--shadow-color
npx strata skill           # the skills
npm test                   # the substrate, the theme, the malleable layer
npm run build              # tokens → check --enforce → tsc → vite; fails only on an invariant
```

In a product that installed it, every one of those `npx strata` lines is the
same command; `npm install --save-dev strata-design && npx strata init` is
where that product starts. See [ADOPTING.md](../ADOPTING.md).

A harness without a shell reaches the same calls over MCP — `strata_skill`,
`strata_precedent`, `strata_explain`, `strata_decide`, `strata_check`,
`strata_log`, and no seventh tool that edits a file. See `mcp/README.md`;
`strata_decide` requires `decided` and infers nothing, because a tool call
carries no shell to read.

The library runs alone too:

```bash
cd strata-malleable && npm install && npm test && npm run dev
```

Every push to `main` runs the tests and the build and publishes the site.
