# Principles

1. **Decisions are the record, and the record is source where it can be.** A
   token cut, a property override, a region move, a prop pick, a seed change,
   a declared deviation, a ship, a handoff: one type, one record, appended and
   never rewritten. What that record *is* to a projection differs by kind, and
   the difference is stated rather than smoothed over. For a token, an
   override, a seed or a ship it is the **source**: the file is derived from
   it and `strata rebuild` writes it again. For a move, a prop pick or a
   declared deviation it is a **witness**: the JSX is the state, the change
   was applied when the decision was written, and nothing replays it. The log
   is history, not a store for structure — an earlier version of this repo
   declared structure as data and priced every drag against it, and was
   removed for it.
2. **Context precedes judgment.** Before a hand decides, the record says what
   was decided before, how often the same value was reached independently,
   and which rules bear on it. An agent gets environmental context, not
   isolated rules.
3. **Every hand goes through the same door.** A pointer in the overlay, a
   command in a terminal, an agent's shell, an MCP call: each builds the same
   request and says both who chose and whose hand wrote it. Nothing else about
   them differs, and no hand gets a private door. There are four authoring
   roles here and they are not interchangeable: the **engine** authors values,
   a **component author** declares which properties are malleable, a
   **designer** decides, and an **agent** performs skills. A person and an
   agent share the substrate; they do not share a job.
4. **Everything derivable is a projection.** `semantic.css`, `tokens.json`,
   `ledger.json`, the override store, a React provider, a Figma library: each
   is what the record says, written out, and `strata rebuild` writes it again.
   Source is not one of them: a moved region lives in the JSX, and the record
   witnesses the move rather than owning the file.
5. **Deviation is evidence, not failure.** A raw value where a semantic name
   belongs is declared, counted and reported. Nine of the same shape is a
   missing token, and the record is where that becomes visible.
6. **Provenance names two hands.** Every decision carries `decided` — who
   could have chosen otherwise — and `written` — whose hand ran the command —
   each with an optional `actor`, alongside `at`, `via`, and the sentence that
   decided both. Either may be an agent. An agent typing a person's decision
   is the ordinary case; an agent that *chose* is the case a reviewer needs to
   see, and the record can tell them apart.
7. **Candidacy is computed; promotion is decided.** A count of distinct
   targets and distinct hands crossing the number the grammar prefers makes a
   convergence a *candidate*, and that much is computed from history and never
   declared. Promoting it — widening the scope, or minting a name for the
   value — is a decision a hand makes, with a reason, on the record.
8. **Enforcement is reserved for invariants.** A build fails only when the
   artifact is invalid or cannot be faithfully produced from the record — the
   record parses, the projections match it, every fallback chain ends, every
   `var()` resolves. Safety is *not* on that list, deliberately: an invariant
   here is a mechanical truth about the artifact, and a contrast threshold is
   a judgement about text at a size. So contrast is reported instead —
   `safety.contrast` measures every token that is read against the grounds it
   is actually set against, on both appearances, and reports what falls short
   without refusing anything. **Focus correctness is not evaluated**, and this
   sentence used to claim it was: what exists is `layer1.imported-not-copied`,
   which reports a focus primitive that was reimplemented rather than
   imported, and `knowledge.accent-gate`, which records that focus stays
   visible when the colour tier collapses to ink. Neither is a check that
   focus works. Policy is evaluated. Preference carries its number. Knowledge
   carries its source. Precedent is computed. They do not share authority.
