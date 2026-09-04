import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { newId, type Decision } from '../src/decision.ts'
import { append } from '../src/log.ts'
import { RULES_PATH } from '../src/grammar.ts'
import { assemblePacket, formatPacket, loadSkills, parseFrontMatter, parseSkill, registerState, resetState } from '../src/skills.ts'

const SKILL = `---
name: cut-token
description: Decide whether a generated token earns its place.
purpose: Decide whether a generated token earns its place, and cut it with a reason if not.
inputs: [token]
context:
  state: [tokens]
  precedent: { kind: token, token: $token }
  rules: [voice.one-filled-action, nope]
constraints:
  - never edit src/tokens by hand
  - decide through strata
evidenceRequired: [consumers, contrast]
typicalDecisions: [token/cut, token/keep]
examples: [ID_CUT]
reasons: |
  A cut token collapses, never disappears.
  Fourteen sites say var(--accent-strong).
---

## Procedure

1. Read the consumers.
2. Decide.
`

test('the front matter subset reads scalars, lists, maps, nested maps and blocks', () => {
  const fm = parseFrontMatter(`a: one\nb: [x, y]\nc:\n  - p\n  - q\nd: { k: v, k2: v2 }\ne:\n  f: g\n  h: [i]\nj: |\n  line one\n  line two\nk: "quoted"`)
  assert.deepEqual(fm, { a: 'one', b: ['x', 'y'], c: ['p', 'q'], d: { k: 'v', k2: 'v2' }, e: { f: 'g', h: ['i'] }, j: 'line one\nline two', k: 'quoted' })
})

test('a skill parses, loads from its directory, and assembles a packet with rules, precedent, state and examples', () => {
  resetState()
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'strata-skill-'))
  const cut: Decision = { id: newId(Date.parse('2026-09-03T12:00:00.000Z')), at: '2026-09-03T12:00:00.000Z', decided: { kind: 'human' }, written: { kind: 'human' }, via: 'cli', kind: 'token', token: '--accent-strong', action: 'cut', reason: 'one filled action per surface', consequence: { collapsesTo: '--accent' } }
  append(dir, cut)
  fs.mkdirSync(path.join(dir, 'skills/cut-token'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'skills/cut-token/SKILL.md'), SKILL.replace('ID_CUT', cut.id))
  fs.mkdirSync(path.join(dir, 'grammar'))
  fs.writeFileSync(path.join(dir, RULES_PATH), JSON.stringify({ rules: [{ id: 'voice.one-filled-action', authority: 'policy', statement: 'One filled action per surface.', reason: 'when three calls to action carry the same chrome, the screen has no point', source: 'g', check: 'none' }] }))
  registerState('tokens', () => '34 tokens · 31 kept · 3 cut')

  const skills = loadSkills(dir)
  assert.equal(skills.length, 1)
  const skill = skills[0]
  assert.deepEqual([skill.name, skill.inputs, skill.evidenceRequired, skill.typicalDecisions], ['cut-token', ['token'], ['consumers', 'contrast'], ['token/cut', 'token/keep']])
  assert.deepEqual(skill.context, { state: ['tokens'], precedent: { kind: 'token', token: '$token' }, rules: ['voice.one-filled-action', 'nope'] })
  assert.match(skill.procedure, /^## Procedure\n\n1\. Read the consumers\./)
  assert.match(skill.reasons, /^A cut token collapses, never disappears\.\nFourteen sites/)

  const missing = assemblePacket(skill, {}, dir)
  assert.deepEqual(missing.missing, ['token'])
  const p = assemblePacket(skill, { token: '--accent-strong' }, dir)
  assert.deepEqual(p.missing, [])
  assert.deepEqual(p.rules.map((r) => r.id), ['voice.one-filled-action'], 'an unknown rule id is dropped, not invented')
  assert.equal(p.precedent?.decisions.length, 1)
  assert.deepEqual(p.state, { tokens: '34 tokens · 31 kept · 3 cut' })
  assert.deepEqual(p.examples.map((d) => d.id), [cut.id])
  const text = formatPacket(p)
  assert.match(text, /^# cut-token\n\nDecide whether a generated token earns its place, and cut it/)
  assert.match(text, /## Rules that bear on this\n\n- \*\*voice\.one-filled-action\*\* \(policy\) — One filled action per surface\./)
  assert.match(text, /## Precedent\n\n- [^\n]*cut --accent-strong → --accent · human · one filled action per surface/)
  assert.match(text, /## State: tokens\n\n```\n34 tokens/)
  assert.match(text, /## Constraints\n\n- never edit src\/tokens by hand/)
  assert.match(text, /## Evidence required[\s\S]*consumers, contrast/)
  assert.match(text, /## Reasons\n\nA cut token collapses/)
  assert.throws(() => parseSkill('no front matter', 'x/SKILL.md'), /starts with front matter/)
  assert.throws(() => parseSkill('---\nname: x\n---\nbody', 'x/SKILL.md'), /states its purpose/)
})
