import assert from 'node:assert/strict'
import { test } from 'node:test'
import { axisOf, edgeOf } from '../src/drop/zones'

const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect

test('the edge is the nearer half, along the axis the container stacks in', () => {
  const r = rect(0, 100, 200, 50)
  assert.equal(edgeOf(r, 10, 110, 'vertical'), 'before')
  assert.equal(edgeOf(r, 10, 140, 'vertical'), 'after')
  assert.equal(edgeOf(r, 20, 140, 'horizontal'), 'before')
  assert.equal(edgeOf(r, 180, 110, 'horizontal'), 'after')
})

test('the axis is read from two neighbours: below is vertical, beside is horizontal', () => {
  assert.equal(axisOf(rect(0, 0, 100, 20), rect(0, 30, 100, 20)), 'vertical')
  assert.equal(axisOf(rect(0, 0, 100, 20), rect(120, 0, 100, 20)), 'horizontal')
  assert.equal(axisOf(null, null), 'vertical')
})
