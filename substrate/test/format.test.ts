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
  assert.match(bare, /^DECISION  ·  [^\n]*\n──────────────\nToken: --accent-strong\nAction: cut\nDecided by: human\nWritten by: human\nReason: one filled action per surface\n/)
  assert.match(bare, /CONSEQUENCE  ·  [^\n]*\n──────────────\nfallback → --accent\naffected → 34\nwritten → src\/tokens\/semantic\.css/)
  assert.doesNotMatch(bare, /CONTEXT|EVIDENCE/)
  const full = formatDecision(cut, {
    context: [{ name: 'consumers', value: 34 }, { name: 'surfaces', value: 7 }],
    evidence: [{ name: 'contrast', value: 'pass', source: 'contrast' }, { name: 'duplicate visual role', value: true }],
  })
  assert.match(full, /CONTEXT  ·  [^\n]*\n──────────────\nconsumers: 34\nsurfaces: 7\n\nEVIDENCE  ·  [^\n]*\n──────────────\ncontrast: pass  \(contrast\)\nduplicate visual role: true/)
  assert.ok(full.indexOf('DECISION') < full.indexOf('CONTEXT') && full.indexOf('CONTEXT') < full.indexOf('EVIDENCE') && full.indexOf('EVIDENCE') < full.indexOf('CONSEQUENCE'))
})

test('one-line descriptions and the handoff read the way they are written', () => {
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

test('the handoff asks for eyes on an agent-decided line, and stops once a person has ruled on it', () => {
  const t = (n: number) => new Date(Date.parse('2026-09-03T12:00:00.000Z') + n * 1000).toISOString()
  const keep = (decided: Decision['decided'], at: string): Decision =>
    ({
      id: newId(Date.parse(at)),
      at,
      decided,
      written: { kind: 'agent', actor: 'claude-code' },
      via: 'cli',
      consequence: {},
      kind: 'token',
      token: '--font-display',
      action: 'keep',
    }) as Decision

  // The report is wrapped for a terminal, so these read it unwrapped.
  const flat = (s: string) => s.replace(/\s+/g, ' ')
  const proposed = keep({ kind: 'agent', actor: 'claude-code' }, t(1))
  const one = flat(formatHandoff([proposed], null))
  assert.match(one, /decided by an agent, not merely written by one/)
  assert.match(one, /→ .*keep --font-display/, 'and the line that needs a person is marked where it is, not listed again')
  assert.equal(one.match(/keep --font-display/g)?.length, 1, 'once, not twice — it was printed in full in two places')

  // The confirmation is the review. A reviewer sent to look at something
  // already answered learns to stop reading the list.
  const confirmed = keep({ kind: 'human', actor: 'prometheus-000' }, t(2))
  const both = flat(formatHandoff([proposed, confirmed], null))
  assert.doesNotMatch(both, /decided by an agent, not merely written by one/)
  assert.match(both, /human prometheus-000/, 'both lines still show: the record is the history, not the verdict')

  // A different target is not settled by an unrelated ruling.
  const other = { ...confirmed, token: '--font-mono' } as Decision
  assert.match(flat(formatHandoff([proposed, other], null)), /decided by an agent/)
})

test('the handoff fits the terminal it is read in, however long a decision is', () => {
  // What a reviewer meets, and the surface they read most carefully. A
  // declared deviation carries its value, and a font stack is two hundred
  // characters — printed straight it wrapped into rubble, and it was printed
  // twice because the lines needing a person were listed a second time.
  const long =
    "--strata-font-display: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Inter, system-ui, sans-serif; and more besides, at length"
  const d = {
    id: 'd1',
    at: '2026-09-07T00:00:00.000Z',
    decided: { kind: 'agent', actor: 'claude-code' },
    written: { kind: 'agent', actor: 'claude-code' },
    via: 'cli',
    consequence: {},
    kind: 'deviation',
    file: 'src/tokens/primitives.css',
    line: 15,
    value: long,
    reason: 'the system stack is the value',
  } as Decision

  const text = formatHandoff([d], null)
  const over = text.split('\n').filter((l) => l.length > 80)
  assert.deepEqual(over, [], 'no line is wider than the narrow terminal it is read in')
  assert.equal(text.match(/system-ui, sans-serif/g)?.length, 1, 'and the decision is printed once')
  assert.match(text, /→ /, 'the line a person must rule on is marked in place')
  assert.match(text, /d1/, 'with the id that reaches it')
  assert.match(text, /npx strata ready/, 'and an un-handed-off record says what hands it off')
})
