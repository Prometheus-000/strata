import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { readAll } from '../src/log'
import { importAll, rebuild, registerProjection, resetProjections } from '../src/projection'

test('import brings an old file onto the record once, in time order, chained; rebuild writes what the record says and check reports drift', () => {
  resetProjections()
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'strata-proj-'))
  fs.writeFileSync(path.join(dir, 'old.json'), JSON.stringify({ '--a': 'cut', '--b': 'kept' }))
  registerProjection({
    name: 'old.json',
    import: (root) => {
      const old = JSON.parse(fs.readFileSync(path.join(root, 'old.json'), 'utf8')) as Record<string, 'cut' | 'kept'>
      return Object.entries(old).map(([token, s], i) => ({ kind: 'token' as const, token, action: s === 'cut' ? ('cut' as const) : ('keep' as const), by: 'human' as const, at: `2026-01-0${2 - i}T00:00:00.000Z` }))
    },
    project: (_root, log) => ({
      'old.json': JSON.stringify(Object.fromEntries(log.filter((d) => d.kind === 'token').map((d) => [d.kind === 'token' && d.token, d.kind === 'token' && d.action]))),
    }),
  })
  const first = importAll(dir)
  assert.deepEqual(first.imported.map((d) => d.kind === 'token' && d.token), ['--b', '--a'], 'oldest first')
  assert.ok(first.imported.every((d) => d.via === 'import:old.json'))
  const second = importAll(dir)
  assert.deepEqual([second.imported.length, second.skipped], [0, ['old.json']])
  assert.equal(readAll(dir).length, 2)

  const check = rebuild(dir, { dryRun: true })
  assert.deepEqual([check.files, check.changed, check.written], [['old.json'], ['old.json'], []], 'the projected text differs from the hand-written file')
  const written = rebuild(dir)
  assert.deepEqual(written.written, ['old.json'])
  assert.deepEqual(rebuild(dir, { dryRun: true }).changed, [])
  assert.equal(fs.readFileSync(path.join(dir, 'old.json'), 'utf8'), '{"--b":"keep","--a":"cut"}')
})
