import assert from 'node:assert/strict'
import { test } from 'node:test'
import { newId, type Decision } from '../src/decision'
import { buildIndex, converge, search } from '../src/precedent'

let clock = Date.parse('2026-09-01T00:00:00.000Z')
const d = (body: Omit<Decision, 'id' | 'at' | 'via' | 'consequence' | 'by'> & Partial<Decision>): Decision => {
  const at = body.at ?? new Date((clock += 60_000)).toISOString()
  return { id: newId(Date.parse(at)), by: 'human', via: 'test', consequence: {}, ...body, at } as Decision
}
const pad = (view: string, inst: string, by: 'human' | 'agent' = 'human', value = '12px', node = 'Card.div.st-card') =>
  d({ kind: 'override', action: 'set', scope: 'instance', selector: `${view}/${inst}::${node}`, property: 'padding', value: { literal: value }, node, view, by })

const LOG: Decision[] = [
  pad('gallery', 'a'),
  pad('gallery', 'b'),
  pad('settings', 'c', 'agent'),
  pad('gallery', 'd', 'human', '16px'),
  pad('gallery', 'e', 'human', '12px', 'Badge.span.st-badge'),
  d({ kind: 'override', action: 'rescope', scope: 'view', selector: 'gallery::Card.div.st-card', property: 'padding', value: { literal: '12px' }, node: 'Card.div.st-card', view: 'gallery', fromScope: 'instance', consequence: { absorbed: ['x'] } }),
  d({ kind: 'override', action: 'set', scope: 'instance', selector: 'gallery/z::Card.div.st-card', property: 'radius', value: { token: '--radius-pill' }, node: 'Card.div.st-card', view: 'gallery' }),
  d({ kind: 'prop', component: 'Badge', prop: 'tone', file: 'G.tsx', line: 4, from: null, to: 'positive' }),
  d({ kind: 'prop', component: 'Badge', prop: 'tone', file: 'S.tsx', line: 9, from: 'accent', to: 'positive', by: 'agent' }),
  d({ kind: 'token', token: '--accent-strong', action: 'cut', reason: 'one filled action per surface', by: 'agent' }),
  d({ kind: 'move', region: 'Filters', from: { container: 'main', file: 'P.tsx', line: 1 }, to: { container: 'nav', file: 'T.tsx', line: 2, index: 0 }, reason: 'filters belong with navigation' }),
  d({ kind: 'override', action: 'set', scope: 'instance', selector: 'gallery/q::Card.div.st-card', property: 'padding', value: { literal: '12px' }, node: 'Card.div.st-card', view: 'gallery', consequence: { refused: 'no' } }),
]

test('convergence counts distinct targets that reached one value, says where and by whom, and calls a candidate at the threshold', () => {
  const c = converge(LOG)
  const twelve = c.find((g) => g.property === 'padding' && g.value === '12px')!
  assert.deepEqual([twelve.count, twelve.independent, twelve.candidate], [5, true, true], 'four instances and the view-scope rescope; the refused one does not count')
  assert.deepEqual(twelve.views.sort(), ['gallery', 'settings'])
  assert.deepEqual(twelve.nodes.sort(), ['Badge.span.st-badge', 'Card.div.st-card'])
  assert.deepEqual(twelve.byAuthor, { human: 4, agent: 1 })
  const sixteen = c.find((g) => g.value === '16px')!
  assert.deepEqual([sixteen.count, sixteen.independent, sixteen.candidate], [1, false, false])
  const tone = c.find((g) => g.kind === 'prop')!
  assert.deepEqual([tone.property, tone.value, tone.count, tone.candidate], ['Badge.tone', 'positive', 2, false])
  assert.equal(converge(LOG, 2).find((g) => g.kind === 'prop')!.candidate, true, 'the threshold is a parameter')
})

test('search narrows by every field and reads the reasons; the lines are sentences', () => {
  const index = buildIndex(LOG)
  const padding = search(index, { property: 'padding' })
  assert.equal(padding.decisions.length, 7)
  assert.match(padding.lines[0], /^5 instances independently converged on padding = 12px across 2 views \(4 by hand, 1 by agent\) — promotion candidate$/)
  assert.equal(search(index, { property: 'padding', value: '16px' }).decisions.length, 1)
  assert.equal(search(index, { component: 'Badge' }).decisions.length, 3, 'its node, and both call sites')
  assert.equal(search(index, { token: '--radius-pill' }).decisions.length, 1)
  assert.equal(search(index, { token: '--accent-strong' }).decisions.length, 1)
  assert.equal(search(index, { author: 'agent' }).decisions.length, 3)
  assert.equal(search(index, { text: 'filled action' }).decisions[0].kind, 'token')
  assert.equal(search(index, { text: 'filters navigation' }).decisions[0].kind, 'move')
  assert.equal(search(index, { kind: 'prop', since: LOG[8].at }).decisions.length, 1)
  const drift = search(index, { unpromoted: true })
  assert.deepEqual(drift.decisions.map((x) => x.kind === 'override' && x.selector), ['gallery/a::Card.div.st-card', 'gallery/b::Card.div.st-card', 'settings/c::Card.div.st-card', 'gallery/d::Card.div.st-card', 'gallery/e::Badge.span.st-badge', 'gallery::Card.div.st-card', 'gallery/z::Card.div.st-card'], 'current instance and view decisions; the refused one is not current')
})
