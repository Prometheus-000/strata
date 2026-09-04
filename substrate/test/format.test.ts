import assert from 'node:assert/strict'
import { test } from 'node:test'
import { newId, type Decision } from '../src/decision.ts'
import { describe, formatDecision, formatHandoff } from '../src/format.ts'

const cut: Decision = {
  id: newId(Date.parse('2026-09-03T12:00:00.000Z')),
  decided: { kind: 'human' },
  written: { kind: 'human' },
  at: '2026-09-03T12:00:00.000Z',
  via: 'cli',
  kind: 'token',
  token: '--accent-strong',
  action: 'cut',
  reason: 'one filled action per surface',
  consequence: { collapsesTo: '--accent', affected: 34, written: ['src/tokens/semantic.css'] },
}

test('a decision prints as four blocks, and only the blocks it has', () => {
  const bare = formatDecision(cut)
  assert.match(bare, /^DECISION\n──────────────\nToken: --accent-strong\nAction: cut\nDecided by: human\nWritten by: human\nReason: one filled action per surface\n/)
  assert.match(bare, /CONSEQUENCE\n──────────────\nfallback → --accent\naffected → 34\nwritten → src\/tokens\/semantic\.css/)
  assert.doesNotMatch(bare, /CONTEXT|EVIDENCE/)
  const full = formatDecision(cut, {
    context: [{ name: 'consumers', value: 34 }, { name: 'surfaces', value: 7 }],
    evidence: [{ name: 'contrast', value: 'pass', source: 'contrast' }, { name: 'duplicate visual role', value: true }],
  })
  assert.match(full, /CONTEXT\n──────────────\nconsumers: 34\nsurfaces: 7\n\nEVIDENCE\n──────────────\ncontrast: pass  \(contrast\)\nduplicate visual role: true/)
  assert.ok(full.indexOf('DECISION') < full.indexOf('CONTEXT') && full.indexOf('CONTEXT') < full.indexOf('EVIDENCE') && full.indexOf('EVIDENCE') < full.indexOf('CONSEQUENCE'))
})

test('one-line descriptions and the handoff read like the receipt did', () => {
  assert.equal(describe(cut), 'cut --accent-strong → --accent · human · one filled action per surface')
  const move: Decision = {
    ...cut,
    kind: 'move',
    region: 'Filters',
    from: { file: 'Page.tsx', line: 5, container: 'main' },
    to: { file: 'TopBar.tsx', line: 10, container: 'header', index: 0 },
    reason: undefined,
    consequence: { adapt: ['open'] },
  }
  const text = formatHandoff([move], { ...cut, kind: 'ready', decided: { kind: 'human' }, consequence: {} })
  assert.match(text, /<Filters \/>\s+main → header\s+TopBar\.tsx:10 · human/)
  assert.match(text, /needs wiring: open/)
  assert.match(text, /ready for review — human/)
  assert.match(formatHandoff([], null), /nothing changed since the last review[\s\S]*not yet handed off/)
})
