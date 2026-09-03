import assert from 'node:assert/strict'
import { test } from 'node:test'
import { OBSIDIAN } from '../src/engine/generateTheme'
import { driftReport, formatDrift } from '../src/ship/drift'
import { describe, emptyStore, put } from '../src/store/store'
import type { Manifest, NodeAddress } from '../src/schema'

const CARD = 'Card.div.st-card'
const MANIFEST: Manifest = {
  version: 1,
  generatedFrom: [],
  nodes: [
    {
      nodeId: CARD,
      file: 'fixtures/app/recipes/Card.tsx',
      component: 'Card',
      layer: 'recipe',
      tag: 'div',
      classes: ['st-card'],
      base: { radius: { token: '--radius-surface' } },
      baseFrom: { radius: { selector: '.st-card', file: 'fixtures/app/recipes/recipes.css' } },
    },
  ],
}
const at = (instancePath: string): NodeAddress => ({ nodeId: CARD, viewId: 'gallery', instancePath })

test('an agent override is a real row: described, grouped, counted', () => {
  let store = put(emptyStore(OBSIDIAN), {
    address: at('ember'),
    property: 'radius',
    value: { literal: '20px' },
    author: 'agent',
    ts: 1,
  })
  store = put(store, {
    address: at('meadow'),
    property: 'radius',
    value: { literal: '20px' },
    author: 'human',
    ts: 2,
  })
  const report = driftReport(store, MANIFEST)
  assert.deepEqual(report.byAuthor, { agent: 1, human: 1 })
  assert.match(formatDrift(report), /by author: 1 agent · 1 human/)
  const agentRow = store.overrides.find((o) => o.author === 'agent')!
  assert.match(describe(store, agentRow), /· agent$/)
})
