import assert from 'node:assert/strict'
import { test } from 'node:test'
import { enumerateSlots, isLegalSlot, parseSlotId, slotId, validateView } from '../src/grammar/grammar'
import type { ViewDecl } from '../src/schema'

const VIEW: ViewDecl = {
  id: 'v',
  states: ['a', 'b'],
  defaultState: 'a',
  bands: [
    { id: 'masthead', columns: 1 },
    { id: 'body', columns: 3 },
  ],
}

test('the grammar enumerates its slots in reading order', () => {
  assert.deepEqual(
    enumerateSlots(VIEW.bands).map((s) => s.id),
    ['masthead/1', 'body/1', 'body/2', 'body/3'],
  )
  assert.deepEqual(
    enumerateSlots(VIEW.bands).map((s) => s.index),
    [0, 1, 2, 3],
  )
})

test('enumeration is the whole slot set — there is no fifth', () => {
  assert.equal(isLegalSlot(VIEW, 'body/3'), true)
  assert.equal(isLegalSlot(VIEW, 'body/4'), false)
  assert.equal(isLegalSlot(VIEW, 'aside/1'), false)
  assert.equal(isLegalSlot(VIEW, 'body'), false)
})

test('slot ids round-trip and reject what is not one', () => {
  assert.equal(slotId('body', 2), 'body/2')
  assert.deepEqual(parseSlotId('body/2'), { band: 'body', column: 2 })
  assert.equal(parseSlotId('body/0'), null)
  assert.equal(parseSlotId('body'), null)
  assert.equal(parseSlotId('a/b'), null)
})

test('a malformed grammar fails at build time, not as an empty region', () => {
  assert.deepEqual(validateView(VIEW), [])
  assert.match(validateView({ ...VIEW, bands: [] })[0], /declares no bands/)
  assert.match(validateView({ ...VIEW, defaultState: 'z' })[0], /default state/)
  assert.match(
    validateView({ ...VIEW, bands: [{ id: 'b', columns: 0 }] })[0],
    /at least one column/,
  )
  assert.match(
    validateView({ ...VIEW, bands: [{ id: 'b', columns: 1 }, { id: 'b', columns: 2 }] })[0],
    /declares band "b" twice/,
  )
  assert.match(
    validateView({ ...VIEW, bands: [{ id: 'a/b', columns: 1 }] })[0],
    /cannot be a slot id/,
  )
  assert.match(validateView({ ...VIEW, states: ['a', 'a'], defaultState: 'a' })[0], /state "a" twice/)
})

test('enumeration is deterministic', () => {
  assert.deepEqual(enumerateSlots(VIEW.bands), enumerateSlots(VIEW.bands))
})
