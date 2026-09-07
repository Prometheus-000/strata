# Adopting Strata

Strata keeps a record of what a product decided — every token cut, every
override, every move, every retheme — in one append-only file,
`.strata/decisions.jsonl`. The CSS, the token contract, the React theme: those
are *projections*. They are written out of the record, and they can be written
again. Nothing among them is edited by hand.

This page is for putting that in **your** repository. If you want to read the
argument first, [README.md](README.md) is the argument, and
[GETTING_STARTED.md](GETTING_STARTED.md) is a tour of this repository, which is
itself a Strata product.

Two tracks, and they begin the same way.

```bash
npm install --save-dev strata-design
npx strata init
```

`init` asks four questions — where your source is, whether to take a voice
from another product, whether to write the semantic tokens and where, whether to
install the skills — and every answer has a default. `--yes` takes the defaults, `--dry` shows what it would write and
writes nothing, and running it twice writes nothing the second time. It never
overwrites a file you have.

## What `init` puts in your repository

| | |
| --- | --- |
| `.strata/decisions.jsonl` | **The record.** Empty. Every decision from now on is a line in it. Commit it. |
| `.strata/config.json` | Where your source and tokens live. Frame, not a decision: edit it by hand. |
| `grammar/rules.json` | The system's 27 rules. Their prose stays in the package; nothing is copied twice. |
| `GRAMMAR.md` | Your voice. Empty, with the shape of a rule and how to write one. |
| `.claude/skills/` | What an agent performs here: `cut-token`, `retheme`, `write-grammar`. |
| `<tokens>/primitives.css` | Tier 1: raw scales. Yours from here — copied once, never rewritten. |
| `<tokens>/semantic.css`, `tokens.json`, `ledger.json` | Projections of the record. Never edit them; `npx strata rebuild` writes them again. |

Add `--mcp` and it writes `.mcp.json` too, so a harness without a shell reaches
the same record over the Model Context Protocol.

## An existing product

`init` surveys what your stylesheets already decided — how many faces you set,
how many radii you use, whether you paint shadows, which raw colours you keep
reaching for — and prints it. That survey is where the voice starts: most of it
was decided by somebody, once, and never written down.

```bash
npx strata check      # what happened. Only an invariant can fail; a design never does
npx strata survey     # the same survey, any time
```

Your first check will list every raw colour in your source under
`layer0.semantic-names-only`. That is not a punishment and nothing fails: each
line carries the way to legalise it (`npx strata deviate <file>:<line> --why
"…"`), and a declared deviation becomes knowledge on the record instead of a
finding. Adopt the vocabulary at whatever pace you like.

Two paths from there, in either order:

- **Write the voice.** `/write-grammar` in Claude Code, or `npx strata skill
  write-grammar` in any harness. It reads the survey, interviews you, and
  writes rules with their reasons into `GRAMMAR.md` and `grammar/rules.json`.
- **Move the theme.** `npx strata retheme --hue … --chroma … --why "…"`. Seven
  numbers, on the record; every projection is compiled from them in the same
  call.

## A new product

Nothing to survey, and that is the honest starting point: a voice begins from
references and rejections rather than from evidence. `init` says so and offers
the same two doors. Most people start with the theme, because seeing it makes
the rest concrete:

```bash
npx strata retheme --hue 20 --chroma 0.12 --why "warm, and a colour for the one filled action" --decided-by human --actor <you>
```

Then `/write-grammar`, which will ask what that colour is *for*.

## Every write says who chose

Two hands, because they are two questions:

| Flag | Question |
| --- | --- |
| `--decided-by human\|agent` | who could have chosen otherwise (`--by` is the same flag) |
| `--actor <handle>` | which hand that was |
| `--written-by human\|agent` | whose hand ran the command |

Either may be an agent. An agent's shell that states neither is **refused**,
not guessed at: `CLAUDECODE` in the environment says who *wrote* and never who
*decided*. Every write takes `--why "…"` and accepts `--dry`.

## What never to edit by hand

The projections: `semantic.css`, `tokens.json`, `ledger.json`, and the override
store if you mount the malleable layer. `npx strata rebuild --check` reports
when one has drifted, and `npx strata check --enforce` fails a build on it —
one of exactly four invariants, all of them mechanical truths about the
artifact. A design that is different is reported, never refused.

`grammar/rules.json`, `GRAMMAR.md` and the skills are the opposite: they are
the *frame*, they are ordinary files, and people edit them by hand. Nothing
writes them through `decide()`, deliberately — an agent that could rewrite the
rules it works under would not be working under rules.

## Where things live

| Path | What it is |
| --- | --- |
| `.strata/decisions.jsonl` | The record. Append-only. Commit it. |
| `.strata/config.json` | Your layout. Frame. |
| `grammar/rules.json`, `GRAMMAR.md` | The rules and their reasons. Frame. |
| `.claude/skills/` | What an agent performs. Frame. |
| `<tokens>/` | Primitives (yours) and three projections (the record's). |

## The identity is a projection too

`public/favicon.svg`, `src/identity/mark.svg` and the two hero images are the
record drawn as a field, regenerated by `npx strata rebuild`'s sibling
`npm run identity` and by every build. A product with a record of its own gets
a field of its own from the same engine; the adapter is `identity/src/record.ts`.

The one thing that cannot be a projection is GitHub's social preview: it is
uploaded by hand in the repository's settings and must be a raster. `npm run
social-card` writes the 1280×640 PNG that setting wants, from the same SVG, so
the card is the record as it stood when you ran it.

## Not in this release

Named rather than implied away:

- **The malleable layer inside your own app** — the overlay a designer drags,
  the Vite plugin that writes through, `defineControls` beside a component. It
  runs in this repository (`npm run dev`, then `/malleable.html`) and its
  verbs are in the CLI, but it is not packaged for an adopter's app yet.
- **Evaluators for your own voice rules.** The rules you write carry
  `"check": "none"`, so `check` lists them as cited and read by a hand. An
  evaluator is code, and writing one is a pull request rather than a setting.
- **A precedent index across products.** Precedent is computed over your
  record, and only yours.
