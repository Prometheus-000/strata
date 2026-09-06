# The {{product}} Grammar

Rules with reasons, in prose. The system's rules — what a token means, what may
be forked, what never is, how a decision is recorded, what can and cannot fail
a build — arrive with Strata. Their prose, with the incidents that earned each
one, lives in the package at `{{package}}/GRAMMAR.md`; this product inherits
them and does not rewrite them. `grammar/rules.json` holds the same rules as
data, each with the authority it carries, and `npx strata check` reads every
one that has an evaluator and names the ones nothing does.

What belongs in this file is the voice: the rules this product's taste adds to
the system's. None has been written yet.

## The voice — this product's taste, as rules

_Nothing written yet._

A voice is five to nine rules, and every one is written the same way: an
imperative sentence, the argument for it, and the incident, reference or
quotation that earned it, dated. In Claude Code, `/write-grammar` conducts the
interview — two products whose chrome you would steal and one you never would;
what you threw out last time; the ground, the type, the shape, the motion; the
one sentence under all of it — and writes the rules here and into
`grammar/rules.json` with `"scope": "product"` and `"check": "none"`. For any
other harness, `npx strata skill write-grammar` assembles the same packet.

The shape a rule takes, as an example (it is from the product Strata was built
on, not from this one):

**One family. Hierarchy is weight, size and measure — never a second voice.**
Display and body are the same face; headings are the body face set at 600–700
and tracked tight. Earned in v0.2, which shipped a variable serif with italic
accents and a green display line, and the owner's correction is the record:
*"overly designed text. This does not meet my own design grammar."*

Rules ship with reasons. An agent, or a new teammate, that has the reasoning
generates novel-but-coherent work; one that only has the component list
generates collage. A rule that cannot say why it exists is not written down —
and a rule with `"check": "none"` is not silent: `npx strata check` lists it
under *cited, not evaluated*, because a rule nothing evaluates is read by a
hand, and silence is easily mistaken for a pass.
