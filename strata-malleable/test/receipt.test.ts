import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { appendMove, emptyReceipt, formatReceipt, markReady, readReceipt, writeReceipt } from '../src/structure/receipt'
import type { MoveRecord } from '../src/schema'

const move = (what: string, from: string, to: string, line = 10, by: 'human' | 'agent' = 'human'): MoveRecord => ({
  what,
  from: { file: 'Page.tsx', line: 5, container: from },
  to: { file: 'TopBar.tsx', line, container: to, index: 0 },
  by,
  at: '2026-09-02T00:00:00.000Z',
})

test('moves append in order and carry their author', () => {
  let r = appendMove(emptyReceipt(), move('Filters', 'main', 'header'))
  r = appendMove(r, move('Badge', 'nav', 'main', 12, 'agent'))
  assert.deepEqual(r.moves.map((m) => [m.what, m.by]), [['Filters', 'human'], ['Badge', 'agent']])
})

test('a move that exactly reverses the last one is a change of mind, not two moves', () => {
  let r = appendMove(emptyReceipt(), { ...move('Filters', 'main', 'header'), from: { file: 'Page.tsx', line: 5, container: 'main' } })
  r = appendMove(r, { ...move('Filters', 'header', 'main', 5), from: { file: 'TopBar.tsx', line: 10, container: 'header' } })
  assert.deepEqual(r.moves, [])
})

test('ready stamps the handoff; a move after it reopens', () => {
  let r = markReady(appendMove(emptyReceipt(), move('Filters', 'main', 'header')), 'agent', 'now')
  assert.deepEqual(r.ready, { by: 'agent', at: 'now' })
  r = appendMove(r, move('Badge', 'nav', 'main'))
  assert.equal(r.ready, null)
})

test('the receipt round-trips through disk and prints what a reviewer needs', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'malleable-receipt-'))
  const r = markReady(appendMove(emptyReceipt(), { ...move('Filters', 'main', 'header'), adapt: ['open'] }), 'human', 'now')
  writeReceipt(r, dir)
  assert.deepEqual(readReceipt(dir), r)
  const text = formatReceipt(r)
  assert.match(text, /<Filters \/>\s+main → header\s+TopBar\.tsx:10 · human/)
  assert.match(text, /needs wiring: open/)
  assert.match(text, /ready for review — human/)
  assert.deepEqual(readReceipt(path.join(dir, 'nowhere')), emptyReceipt())
})
