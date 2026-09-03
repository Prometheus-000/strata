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
 */
import fs from 'node:fs'
import path from 'node:path'
import type { Decision } from './decision.ts'
import { loadRules, rulesFor, type Rule } from './grammar.ts'
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

export const SKILL_DIRS = ['skills', '.claude/skills']

export function loadSkills(root: string, dirs = SKILL_DIRS): Skill[] {
  const out = new Map<string, Skill>()
  for (const dir of dirs) {
    const abs = path.join(root, dir)
    if (!fs.existsSync(abs)) continue
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      const file = path.join(abs, entry.name, 'SKILL.md')
      if (!entry.isDirectory() || !fs.existsSync(file)) continue
      const skill = parseSkill(fs.readFileSync(file, 'utf8'), path.relative(root, file))
      if (!out.has(skill.name)) out.set(skill.name, skill)
    }
  }
  return [...out.values()]
}

/* ---------------- state providers: what a projection can read for a skill ---------------- */

const providers = new Map<string, (root: string) => unknown>()
export const registerState = (name: string, read: (root: string) => unknown) => providers.set(name, read)
export const resetState = () => providers.clear()
export const registeredState = () => [...providers.keys()]

/* ---------------- the packet ---------------- */

export interface Packet {
  skill: Skill
  inputs: Record<string, string>
  missing: string[]
  rules: Rule[]
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
  const rules = rulesFor(loadRules(root), skill.context.rules ?? [])
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
  return { skill, inputs, missing, rules, precedent, state, examples, evidenceRequired: skill.evidenceRequired, allowed: skill.typicalDecisions }
}

export function formatPacket(p: Packet): string {
  const out: string[] = [`# ${p.skill.name}`, '', p.skill.purpose, '']
  if (p.skill.inputs.length) {
    out.push('## Inputs', '')
    for (const k of p.skill.inputs) out.push(`- ${k}: ${p.inputs[k] ?? '(missing — pass --' + k + ' …)'}`)
    out.push('')
  }
  if (p.rules.length) {
    out.push('## Rules that bear on this', '')
    for (const r of p.rules) out.push(`- **${r.id}** (${r.authority}) — ${r.statement}`, `  _${r.reason}_`)
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
  out.push('## Procedure', '', p.skill.procedure, '')
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
  out.push('Every decision goes through `strata …` with `--by agent` and `--why "…"`. Nothing here is checked while you work; `strata check` says what happened when you are ready.')
  return out.join('\n')
}
