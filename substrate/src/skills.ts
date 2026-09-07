/**
 * SKILLS — design work an agent performs against the substrate, written down.
 *
 * A skill is not a prompt. It names its purpose, what it needs to be told,
 * which parts of the record and the grammar bear on it, the procedure, the
 * constraints it works under, the evidence a decision must carry, the
 * decisions it typically makes, examples from this product's own record, and
 * the reasons. `strata skill <name>` assembles all of that into one packet —
 * the precedent found, the rules cited, the state read — and the harness's
 * model performs the procedure. Strata calls no model; many harnesses, one
 * foundation.
 *
 * The file is a SKILL.md — the convention Claude Code already installs — with
 * a typed front matter the substrate reads. The front matter is a small YAML:
 * scalars, `[a, b]` lists, `- item` lists, `{ k: v }` maps, nested maps, and
 * `|` blocks. Nothing else, and no dependency.
 *
 * `.claude/skills` is shared ground. Strata reads it because that is where
 * Claude Code looks, so an adopter can keep Strata's skills there — but the
 * harness installs its own skills there too, and those are not Strata's to
 * perform. What makes a SKILL.md Strata's is that it states a purpose; the
 * harness's carry a name and a description and nothing the substrate reads.
 * A skill without a purpose in shared ground is left alone. In `skills/`,
 * Strata's own directory, it is still an error, because silence there would
 * hide a broken skill. Links are followed: `npx skills add` keeps the copy in
 * `.agents/skills` and links it in. (6 Sept 2026: an OKLCH skill arrived that
 * way, and the loader had been passing over it only because a link is not a
 * directory to readdir — the same skill copied in would have thrown.)
 */
import fs from 'node:fs'
import path from 'node:path'
import type { Decision } from './decision.ts'
import { byScope, loadRules, rulesFor, scopeOf, RULES_PATH, type Rule } from './grammar.ts'
import { byId, readAll } from './log.ts'
import { buildIndex, search, type PrecedentQuery, type PrecedentResult } from './precedent.ts'
import { describe } from './format.ts'

export interface Skill {
  name: string
  description?: string
  purpose: string
  inputs: string[]
  context: { state?: string[]; precedent?: Record<string, string>; rules?: string[] }
  constraints: string[]
  evidenceRequired: string[]
  typicalDecisions: string[]
  examples: string[]
  reasons: string
  /** The body: the procedure, in prose. */
  procedure: string
  file: string
}

/* ---------------- the YAML subset ---------------- */

type Node = string | Node[] | { [k: string]: Node }

const scalar = (v: string): string => {
  const t = v.trim()
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1)
  return t
}
const inlineList = (v: string): Node[] => (v.trim() === '[]' ? [] : v.trim().slice(1, -1).split(',').map(scalar).filter((x) => x !== ''))
const inlineMap = (v: string): { [k: string]: Node } => {
  const out: { [k: string]: Node } = {}
  for (const part of v.trim().slice(1, -1).split(',')) {
    const i = part.indexOf(':')
    if (i !== -1) out[scalar(part.slice(0, i))] = scalar(part.slice(i + 1))
  }
  return out
}
const value = (v: string): Node => (v.trim().startsWith('[') ? inlineList(v) : v.trim().startsWith('{') ? inlineMap(v) : scalar(v))

export function parseFrontMatter(text: string): { [k: string]: Node } {
  const lines = text.split('\n')
  const indentOf = (l: string) => l.length - l.trimStart().length
  let i = 0
  const parseBlock = (indent: number): Node => {
    // a list?
    if (lines[i]?.trim().startsWith('- ')) {
      const items: Node[] = []
      while (i < lines.length && indentOf(lines[i]) === indent && lines[i].trim().startsWith('- ')) {
        items.push(value(lines[i].trim().slice(2)))
        i++
      }
      return items
    }
    const map: { [k: string]: Node } = {}
    while (i < lines.length) {
      const line = lines[i]
      if (!line.trim() || line.trim().startsWith('#')) {
        i++
        continue
      }
      if (indentOf(line) < indent) break
      const m = line.trim().match(/^([\w-]+):\s*(.*)$/)
      if (!m) throw new Error(`front matter: cannot read "${line.trim()}"`)
      const [, key, rest] = m
      i++
      if (rest === '|') {
        const block: string[] = []
        while (i < lines.length && (indentOf(lines[i]) > indent || !lines[i].trim())) block.push(lines[i].slice(Math.min(indent + 2, indentOf(lines[i]))).trimEnd()), i++
        map[key] = block.join('\n').trim()
      } else if (rest === '') {
        const next = lines[i]
        map[key] = next !== undefined && indentOf(next) > indent ? parseBlock(indentOf(next)) : next !== undefined && next.trim().startsWith('- ') ? parseBlock(indent) : ''
      } else map[key] = value(rest)
    }
    return map
  }
  const out = parseBlock(0)
  return Array.isArray(out) || typeof out === 'string' ? {} : out
}

const strs = (n: Node | undefined): string[] => (Array.isArray(n) ? n.map(String) : typeof n === 'string' && n ? [n] : [])
const str = (n: Node | undefined): string => (typeof n === 'string' ? n : '')
const map = (n: Node | undefined): { [k: string]: Node } => (n && typeof n === 'object' && !Array.isArray(n) ? n : {})

export function parseSkill(text: string, file: string): Skill {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!m) throw new Error(`${file}: a skill starts with front matter between --- lines`)
  const fm = parseFrontMatter(m[1])
  const ctx = map(fm.context)
  const skill: Skill = {
    name: str(fm.name) || path.basename(path.dirname(file)),
    description: str(fm.description) || undefined,
    purpose: str(fm.purpose),
    inputs: strs(fm.inputs),
    context: {
      state: strs(ctx.state),
      precedent: Object.keys(map(ctx.precedent)).length ? Object.fromEntries(Object.entries(map(ctx.precedent)).map(([k, v]) => [k, String(v)])) : undefined,
      rules: strs(ctx.rules),
    },
    constraints: strs(fm.constraints),
    evidenceRequired: strs(fm.evidenceRequired),
    typicalDecisions: strs(fm.typicalDecisions),
    examples: strs(fm.examples),
    reasons: str(fm.reasons),
    procedure: m[2].trim(),
    file,
  }
  if (!skill.purpose) throw new Error(`${file}: a skill states its purpose`)
  return skill
}

/** Strata's own directory. Every SKILL.md in it is Strata's, and must state its purpose. */
export const OWN_SKILL_DIR = 'skills'
/** Where skills are read from: Strata's own directory, then the ground it shares with the harness. */
export const SKILL_DIRS = [OWN_SKILL_DIR, '.claude/skills']

const frontMatterOf = (text: string): string => text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? ''
/** The field that makes a SKILL.md Strata's: the harness's skills name themselves and say what they are for, but only a skill the substrate performs states a purpose. */
export const statesPurpose = (text: string): boolean => /^purpose:/m.test(frontMatterOf(text))

export function loadSkills(root: string, dirs = SKILL_DIRS): Skill[] {
  const out = new Map<string, Skill>()
  for (const dir of dirs) {
    const abs = path.join(root, dir)
    if (!fs.existsSync(abs)) continue
    for (const name of fs.readdirSync(abs)) {
      const file = path.join(abs, name, 'SKILL.md')
      if (!fs.existsSync(file)) continue // follows a link; a broken link is nothing
      const text = fs.readFileSync(file, 'utf8')
      if (dir !== OWN_SKILL_DIR && !statesPurpose(text)) continue // the harness's, not Strata's
      const skill = parseSkill(text, path.relative(root, file))
      if (!out.has(skill.name)) out.set(skill.name, skill)
    }
  }
  return [...out.values()]
}

/* ---------------- state providers: what a projection can read for a skill ---------------- */

const providers = new Map<string, (root: string) => unknown>()
export const registerState = (name: string, read: (root: string) => unknown) => providers.set(name, read)
export const registeredState = () => [...providers.keys()]

/**
 * The grammar, as a skill reads it: how much of it is the system's and how
 * much this product's own, and the shape a rule takes — so a skill that
 * writes rules (`write-grammar`) knows what a rule is without a copy of the
 * schema in its body. The substrate provides it because the grammar is the
 * substrate's, the way `ready` is the one built-in handler.
 */
export function grammarState(root: string): string {
  const rules = loadRules(root)
  if (!rules.length) return `no grammar here — ${RULES_PATH} is missing or empty; the system's rules arrive with \`strata init\``
  const system = byScope(rules, 'system')
  const product = byScope(rules, 'product')
  const count = (xs: readonly Rule[]) => (['invariant', 'policy', 'preference', 'knowledge'] as const).map((a) => `${a} ${xs.filter((r) => r.authority === a).length}`).join(' · ')
  const out = [
    `${system.length} rule(s) the system brings · ${product.length} this product's own`,
    `  system: ${count(system)}`,
    product.length
      ? `  this product's voice: ${count(product)}`
      : `  no voice yet — a rule with "scope": "product" is this product's; they go in ${RULES_PATH} beside the system's, each with its reason`,
  ]
  for (const r of product) out.push(`    ${r.id} — ${r.statement}`)
  out.push(
    '',
    'a rule is: { id, authority: invariant | policy | preference | knowledge, statement, reason, source, check: <evaluator id> | "none", scope?: "product", incident?, layer?, value (a preference carries its number) }',
    'only an invariant can fail a build; a rule with check "none" is cited into packets and read by a hand, and check says so',
  )
  return out.join('\n')
}

const BUILT_IN_STATE: Array<[string, (root: string) => unknown]> = [['grammar', grammarState]]
const registerBuiltinState = () => {
  for (const [name, read] of BUILT_IN_STATE) providers.set(name, read)
}
export const resetState = () => {
  providers.clear()
  registerBuiltinState()
}
registerBuiltinState()

/* ---------------- the packet ---------------- */

export interface Packet {
  skill: Skill
  inputs: Record<string, string>
  missing: string[]
  rules: Rule[]
  /** Rule ids the skill cites that this product's grammar does not have — said, not silently dropped. */
  rulesMissing: string[]
  /** Whether the product has a grammar at all. */
  grammar: boolean
  /**
   * The voice this product works under, on every packet, because the frame
   * travels with the work. Both kinds: a product's own taste, and a person's
   * voice carried into it — a packet that dropped the second left an agent
   * with none of what `--voice` had just brought in.
   */
  voice: Rule[]
  precedent: PrecedentResult | null
  state: Record<string, unknown>
  examples: Decision[]
  /** Evaluators the harness must run (strata explain) before a decision from this skill is complete. */
  evidenceRequired: string[]
  /** Decision kinds this skill is expected to make, as `kind/action`. */
  allowed: string[]
}

const substitute = (v: string, inputs: Record<string, string>) => v.replace(/\$(\w+)/g, (_, k) => inputs[k] ?? '')

export function assemblePacket(skill: Skill, inputs: Record<string, string>, root: string): Packet {
  const missing = skill.inputs.filter((k) => !inputs[k])
  const log = readAll(root)
  const all = loadRules(root)
  const cited = skill.context.rules ?? []
  const rules = rulesFor(all, cited)
  const rulesMissing = cited.filter((id) => !rules.some((r) => r.id === id))
  const voice = [...byScope(all, 'product'), ...byScope(all, 'personal')].filter((r) => !rules.some((x) => x.id === r.id))
  let precedent: PrecedentResult | null = null
  if (skill.context.precedent) {
    const q: PrecedentQuery = {}
    for (const [k, v] of Object.entries(skill.context.precedent)) {
      const s = substitute(v, inputs)
      if (!s) continue
      if (k === 'unpromoted') q.unpromoted = s === 'true'
      else (q as Record<string, unknown>)[k] = s
    }
    precedent = search(buildIndex(log), q)
  }
  const state: Record<string, unknown> = {}
  for (const name of skill.context.state ?? []) {
    const read = providers.get(name)
    state[name] = read ? read(root) : `(no projection here provides "${name}")`
  }
  const examples = skill.examples.map((id) => byId(log, id)).filter((d): d is Decision => !!d)
  return { skill, inputs, missing, rules, rulesMissing, grammar: all.length > 0, voice, precedent, state, examples, evidenceRequired: skill.evidenceRequired, allowed: skill.typicalDecisions }
}

export function formatPacket(p: Packet): string {
  const out: string[] = [`# ${p.skill.name}`, '', p.skill.purpose, '']
  if (p.skill.inputs.length) {
    out.push('## Inputs', '')
    for (const k of p.skill.inputs) out.push(`- ${k}: ${p.inputs[k] ?? '(missing — pass --' + k + ' …)'}`)
    out.push('')
  }
  const ruleLine = (r: Rule) => [`- **${r.id}** (${r.authority}) — ${r.statement}`, `  _${r.reason}_`]
  if (p.rules.length || p.rulesMissing.length) {
    out.push('## Rules that bear on this', '')
    if (!p.grammar) out.push(`no grammar here — \`${RULES_PATH}\` is missing, so the ${p.rulesMissing.length} rule(s) this skill cites cannot be read; \`strata init\` brings the system's`)
    else if (p.rulesMissing.length) out.push(`${p.rulesMissing.length} cited rule(s) are not in this product's grammar: ${p.rulesMissing.join(', ')}`)
    for (const r of p.rules) out.push(...ruleLine(r))
    out.push('')
  }
  if (p.voice.length) {
    // Whose it is, said once at the head rather than in a parenthetical on
    // every line — and said accurately: a carried voice belongs to a person,
    // and calling it the product's own taste was wrong about the one thing
    // this section exists to state.
    const own = p.voice.filter((r) => scopeOf(r) === 'product').length
    const mine = p.voice.length - own
    const whose =
      own && mine
        ? `${own} this product added to the system’s, and ${mine} carried in from a person’s voice`
        : mine
          ? `A person’s voice, carried into this product — ${mine} ${mine === 1 ? 'rule that belongs to them and travels' : 'rules that belong to them and travel'} on`
          : `Every rule this product added to the system’s`
    out.push("## The voice this product works under", '', `${whose}, because the taste travels with every piece of work:`, '')
    for (const r of p.voice) out.push(...ruleLine(r))
    out.push('')
  }
  if (p.precedent) {
    out.push('## Precedent', '')
    if (!p.precedent.decisions.length) out.push('nothing on the record about this yet')
    for (const line of p.precedent.lines) out.push(`- ${line}`)
    for (const d of p.precedent.decisions.slice(-12)) out.push(`- ${d.id} · ${describe(d)}`)
    if (p.precedent.decisions.length > 12) out.push(`- … ${p.precedent.decisions.length - 12} earlier`)
    out.push('')
  }
  for (const [name, v] of Object.entries(p.state)) {
    out.push(`## State: ${name}`, '', '```', typeof v === 'string' ? v : JSON.stringify(v, null, 2), '```', '')
  }
  // The body usually opens with its own `## Procedure`; one heading, not two.
  out.push(...(/^##\s+Procedure\b/.test(p.skill.procedure) ? [p.skill.procedure, ''] : ['## Procedure', '', p.skill.procedure, '']))
  if (p.skill.constraints.length) {
    out.push('## Constraints', '')
    for (const c of p.skill.constraints) out.push(`- ${c}`)
    out.push('')
  }
  if (p.evidenceRequired.length) out.push('## Evidence required', '', `Run \`strata explain <id>\` after deciding; these must be present: ${p.evidenceRequired.join(', ')}.`, '')
  if (p.allowed.length) out.push('## Typical decisions', '', p.allowed.map((a) => `\`${a}\``).join(', '), '')
  if (p.examples.length) {
    out.push('## Examples from this product', '')
    for (const d of p.examples) out.push(`- ${d.id} · ${describe(d)}${d.reason ? '' : ''}`)
    out.push('')
  }
  if (p.skill.reasons) out.push('## Reasons', '', p.skill.reasons, '')
  // The rule for who decided is cited above, from the grammar, like every other
  // rule — it used to be retyped in this footer and in all six skills, which is
  // one fact with eight owners and no source. A pointer cannot go stale; a copy
  // is a place a change has to remember to visit.
  out.push(
    'Every decision goes through `strata …` with `--why "…"` and two hands. The rules above say which hands and why.',
    '',
    'Nothing here is checked while you work; `strata check` says what happened when you are ready.',
  )
  return out.join('\n')
}
