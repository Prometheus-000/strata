# The record, over MCP

The same door, without a terminal. A harness that speaks the Model Context
Protocol gets what the CLI gets: the record, the reasons, the precedent, the
packets, and the one call that changes anything.

```json
{
  "mcpServers": {
    "strata": {
      "command": "node",
      "args": ["--import", "tsx/esm", "/path/to/strata/mcp/server.mjs"]
    }
  }
}
```

`STRATA_ROOT` picks the product (default: the repository this file sits in),
`STRATA_MALLEABLE` the library root, `MALLEABLE_ROOT` the app tree.

## The tools

| tool | what it is for |
| --- | --- |
| `strata_skill` | the packet for a piece of design work — read it before the work, not after |
| `strata_precedent` | what was decided before, with convergence counted |
| `strata_explain` | one decision as four blocks, evidence computed on request |
| `strata_decide` | the one way anything changes |
| `strata_check` | here is what happened |
| `strata_log` | every decision, or one target's history |

There is no seventh tool that edits a file. `strata_decide` goes through the
same `decide()` the CLI and the overlay call, and the same handlers apply the
same changes to the same projections — so this is a new *surface*, not a new
way in.

## Every write says who chose

`decided` is required, and nothing is inferred. A CLI can read `CLAUDECODE`
and conclude that an agent's hand ran the command; a tool call carries no
shell, and guessing would put an agent's name on judgements that were not its
own — the exact mistake this record already made once, on thirty-four lines.

So a write without `decided` is refused, with the question it should have
answered: **who could have chosen otherwise?** If the target and the value
were both named to you, the deciding hand is theirs, with their handle as the
`actor`. If you chose either of them, it is yours.

`written` defaults to the calling client as an agent, which is almost always
true and is the half that can be inferred safely. Decisions made here record
`via: mcp:<client>`, so the record says which surface wrote them.
