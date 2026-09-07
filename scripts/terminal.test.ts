/**
 * MARKDOWN DOES NOT RENDER IN A TERMINAL.
 *
 * Twice in one day a string written for a reader printed its own backticks:
 * `what changed since the last \`ready\`` in the check report, and
 * `\`strata rebuild\` writes it again` in what `init` says at the end. Both
 * were written by someone editing markdown all day who never ran the command
 * to look at it.
 *
 * A refusal is written once and travels with the artifact; a habit has to be
 * kept up forever. So this is the refusal: in a module that prints, a quoted
 * string may not carry a backtick. Template literals are the language's own
 * and are left alone — the rule is about markdown that leaked into copy, not
 * about how a string was built.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

const REPO = path.join(path.dirname(new URL(import.meta.url).pathname), '..')
/**
 * The modules whose strings a person reads in a terminal.
 *
 * Named rather than found by a pattern, because the distinction is a judgement
 * and a pattern got it wrong: "files that call io.out" skipped `check.ts`,
 * which composes the report that `cli.ts` prints — and both of the backticks
 * that shipped were in files like it.
 *
 * Two are deliberately absent. `substrate/src/skills.ts` assembles a packet for
 * an agent, and that packet is markdown: fenced blocks and backticked commands
 * are correct there. `src/theme/emit.ts` writes `tokens.json`, whose own
 * `$description` is addressed to agents for the same reason — its one thrown
 * message was fixed by hand rather than by putting the whole file under a rule
 * that does not fit it.
 */
const SPEAKS = [
  'substrate/src/check.ts',
  'substrate/src/cli.ts',
  'substrate/src/format.ts',
  'substrate/src/precedent.ts',
  'substrate/src/root.ts',
  'src/init.ts',
  'src/voices.ts',
  'src/theme/cli.ts',
  'src/theme/survey.ts',
  'strata-malleable/src/cli.ts',
]

/**
 * The single- and double-quoted strings in a source file.
 *
 * Walked character by character rather than matched, because a comment can
 * hold an apostrophe and a string can hold a `//`, and a regex that is wrong
 * about either reports the wrong lines — which is worse than not looking.
 */
export function quotedStrings(text: string): Array<{ line: number; text: string }> {
  const out: Array<{ line: number; text: string }> = []
  let line = 1
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '\n') {
      line++
      continue
    }
    if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++
      i--
      continue
    }
    if (c === '/' && text[i + 1] === '*') {
      i += 2
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) {
        if (text[i] === '\n') line++
        i++
      }
      i++
      continue
    }
    if (c === '/' && startsRegex(text, i)) {
      // A regex holds quotes that are not strings: /['"]/ would otherwise open one.
      i++
      for (; i < text.length && text[i] !== '/'; i++) {
        if (text[i] === '\\') i++
        else if (text[i] === '[') for (; i < text.length && text[i] !== ']'; i++) if (text[i] === '\\') i++
        else if (text[i] === '\n') break
      }
      continue
    }
    if (c === '`') {
      // A template literal is the language's own backtick. Skipped whole,
      // including the expressions inside it, which may hold strings of their own.
      let depth = 0
      i++
      for (; i < text.length; i++) {
        if (text[i] === '\n') line++
        else if (text[i] === '\\') i++
        else if (text[i] === '$' && text[i + 1] === '{') depth++
        else if (text[i] === '}' && depth > 0) depth--
        else if (text[i] === '`' && depth === 0) break
      }
      continue
    }
    if (c === "'" || c === '"') {
      const at = line
      const start = ++i
      for (; i < text.length && text[i] !== c; i++) {
        if (text[i] === '\\') i++
        else if (text[i] === '\n') line++
      }
      out.push({ line: at, text: text.slice(start, i) })
    }
  }
  return out
}

/**
 * Whether a `/` opens a regex or divides. The last thing that mattered decides:
 * after a value it is division, and after an operator or an opening bracket a
 * regex can begin.
 */
function startsRegex(text: string, at: number): boolean {
  let i = at - 1
  while (i >= 0 && /\s/.test(text[i])) i--
  if (i < 0) return true
  return '(,=:[!&|?{};+-*%~^'.includes(text[i])
}

function sources(dir: string): string[] {
  const abs = path.join(REPO, dir)
  if (!fs.existsSync(abs)) return []
  const out: string[] = []
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const rel = path.posix.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...sources(rel))
    else if (/\.(ts|tsx|mjs)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) out.push(rel)
  }
  return out
}

test('a module that speaks to a person does not put markdown in a quoted string', () => {
  const found: string[] = []
  for (const file of SPEAKS) {
    const abs = path.join(REPO, file)
    assert.ok(fs.existsSync(abs), `${file} is listed as speaking to a person and is not there`)
    for (const s of quotedStrings(fs.readFileSync(abs, 'utf8'))) if (s.text.includes('`')) found.push(`${file}:${s.line}  ${s.text.slice(0, 80)}`)
  }
  assert.deepEqual(found, [], `a backtick renders as a backtick in a terminal — write the command plainly:\n  ${found.join('\n  ')}`)
})

test('the scanner tells a template literal from a quoted string, and knows what a comment is', () => {
  // The rule is only as good as this: a template literal is fine, a quoted
  // string is copy, and neither a comment nor an apostrophe is either.
  const say = (t: string) => quotedStrings(t).map((s) => s.text)

  assert.deepEqual(say('io.out(`the last ${x} ready`)'), [], 'a template literal is the language, not markdown')
  assert.deepEqual(say("io.out('the last `ready`')"), ['the last `ready`'], 'a quoted string carrying a backtick is the fault')
  assert.deepEqual(say('// a comment about `ready`\nio.out("fine")'), ['fine'], 'a comment is not copy')
  assert.deepEqual(say('/* a block about `ready` */\nio.out("fine")'), ['fine'], 'nor a block comment')
  assert.deepEqual(say(`io.out('http://example.com')`), ['http://example.com'], 'a // inside a string is not a comment')
  assert.deepEqual(say("// it's fine\nio.out('ok')"), ['ok'], 'an apostrophe in a comment does not open a string')
  assert.deepEqual(say('io.out(`a ${"b"} c`)'), [], 'a string inside a template expression is still inside the template')
  assert.deepEqual(say(`io.out('say \\'this\\'')`), ["say \\'this\\'"], 'an escaped quote does not end the string')

  // And the two that actually shipped.
  assert.deepEqual(say("band('HANDOFF', 'what changed since the last `ready`')"), ['HANDOFF', 'what changed since the last `ready`'])
  assert.equal(say("notes.push('and `strata rebuild` writes it again')").filter((s) => s.includes('`')).length, 1)
})
