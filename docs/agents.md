# Agent Model

```
human ─┐
       ├──► decide(request, { by, via, because }) ──► handler applies ──► record appends
agent ─┘
```

## The contract

Two columns, because they are not the same kind of promise and reading them
as one is how a system gets trusted for things it never claimed.

| Strata **guarantees** | A harness **honours** |
| --- | --- |
| The four invariants: the record parses, the projections match it, every fallback chain ends, every `var()` resolves. | Every write goes through the door — `strata …`, the overlay, or `strata_decide`. |
| Every write through `decide()` carries who chose, who wrote, and why. | `--decided-by` says who chose, and it is answered honestly. |
| A packet assembled from the record, the grammar and the live state, on request. | Projections and `data-*` stamps are never hand-edited. |
| A projection can be produced again from the record, and `rebuild --check` proves it. | The packet is read before the work, not after. |
| The eight kinds are the only things `decide()` writes. | What an agent may decide *within* the work is the harness's call, not Strata's. |

**The frame is not decidable.** The eight kinds — `token`, `override`, `move`,
`prop`, `seed`, `deviation`, `ship`, `ready` — are all acts *within* the work:
cut a name, set a property, move a region, pick a value, move the seeds,
declare a literal, ship, hand off. The frame the work happens inside is a
different category of thing — `grammar/rules.json`, the skills' front matter
and bodies, `CLAUDE.md`, which rules are invariants, what number a preference
carries — and none of it comes through this door. There is no `rule` kind.
Rules, skills and thresholds are not decisions; nothing writes them through
`decide()`, and a test asserts the registry still admits exactly those eight,
so adding a ninth is a deliberate act with an argument attached.

The omission is the design, not an oversight. A decision inside a frame cannot
license a change to the frame without the frame meaning nothing: an agent that
can rewrite the rules it works under is not working under rules, and a grant of
latitude on one feature is not a grant to rewrite the terms that apply to
everything after it.

Which is also why the right-hand column says what it says. **Strata does not
decide how much autonomy an agent has** — the prompt does, and the harness
does. The substrate records every decision and its author and limits neither;
an agent may cut every token in the vocabulary if that is what it was asked to
do, and the record will say who chose. Autonomy over the *frame* is not
granted by anything here, because there is no door for it to come through.

One gap, named rather than papered over: **the frame files are ordinary files.**
Any writer with a filesystem — a person, an agent, a script — can edit
`rules.json` or a `SKILL.md` outside `decide()`, and Strata does not currently
notice. What holds is that such an edit is not a *decision*: it leaves no line,
carries no author and no reason, and shows up as a diff for a reviewer like any
other. That is a weaker guarantee than the one the record makes about
projections, and it is stated here rather than implied away.

The failure mode, in one sentence: **a hand-edited projection fails
`projections.match-record` on the next check, and a hand-edited JSX does
not — the record simply does not know.** That asymmetry is the two ontologies
in Principle 1 showing through, and it is why the skills are written as terms
of working here rather than as enforcement. Nothing stops an agent from
editing a component by hand. The record just will not contain the reason, and
a year later nobody will know there was one.

There is one write path. The terminal, the overlay in the browser, an agent's
shell, and an MCP call each build a request and say **both** who chose and
whose hand wrote it. Neither is guessed. `--decided-by human|agent` (`--by` is
the same flag), then `STRATA_DECIDED_BY`, then `STRATA_AUTHOR`; `--actor`
names the hand. `CLAUDECODE` in the environment — which Claude Code sets for
every command it runs — infers the hand that *wrote* and never the hand that
decided, and an agent's shell with nothing else stated is refused rather than
guessed at. The sentence that decided both is printed on every write and kept
on the decision. The overlay writes `human` for both, because a pointer is a
hand and the hand on the mouse is the hand that chose. There is no API an
agent has that a person does not, and no projection an agent edits that the
record does not see.

An agent does not read the design system; it performs design work according
to a **skill**. A skill is a `SKILL.md` — the convention Claude Code already
installs — with a typed front matter the substrate reads:

```yaml
name: cut-token
purpose: Decide whether a token the engine emits earns its place, and cut it — to its declared fallback, never to nothing — or keep it, with the reason on the record.
inputs: [token]
context:
  state: [tokens, consumers]
  precedent: { kind: token, token: $token }
  rules: [layer0.semantic-names-only, voice.lines-not-shadows, layer2.one-filled-action, knowledge.accent-gate]
constraints:
  - never edit src/tokens or src/theme/ledger.json by hand — they are projections of the record
  - "say who chose: who could have chosen otherwise? if the target and the value were both named to you, --decided-by human --actor <their handle>; if you chose either, --decided-by agent"
  - "using a token is not deciding one: nothing writes a line for a var(--x) already in a recipe"
evidenceRequired: [consumers, usage concentration, duplicate visual role]
typicalDecisions: [token/cut, token/keep]
examples: [d0mtlvzac0-5lk7, d0mtlvzac0-fnuq]
reasons: |
  A cut token does not disappear …
```

The body is the procedure. `strata skill cut-token --token --accent-strong`
assembles the packet: the rules cited, with their reasons and their
authority; the precedent found; the state the projections provide; the
examples resolved from this product's own record; the evidence a decision
from this skill must carry. The harness's model performs the procedure.
Strata calls no model — many harnesses, one foundation. Six skills ship
(`cut-token`, `retheme`, `move-region`, `pick-prop`, `promote`,
`review-handoff`), and the Claude Code plugin in
`strata-malleable/integrations/claude-code` runs them.

`.claude/skills` is shared ground: the harness's own skills live there too,
and an OKLCH skill is vendored in `.agents/skills/` and linked in, for whoever
works on the engine. What makes a `SKILL.md` Strata's is that it states a
`purpose`; a skill without one is the harness's, and Strata leaves it alone.
