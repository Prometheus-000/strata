import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { init } from '../src/init'

test('init copies this layer’s own skill and commands, installs no hook, and installs nobody else’s skills', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'malleable-init-'))
  const first = init(dir, process.cwd())
  assert.ok(first.wrote.includes('.claude/skills/malleable/SKILL.md'))
  assert.ok(first.wrote.includes('.claude/commands/malleable-preview.md'))
  assert.ok(first.wrote.includes('.claude/commands/malleable-review.md'))
  assert.ok(!first.wrote.includes('.gitignore'), 'nothing is ignored: the record is committed')
  assert.ok(!fs.existsSync(path.join(dir, '.claude/hooks')))
  assert.ok(!fs.existsSync(path.join(dir, '.claude/settings.json')))
  // Strata's own catalogue is `strata init`'s to install, and it rewrites the
  // examples as it goes — this used to copy the catalogue verbatim afterwards
  // and overwrite that, so a new product's first check reported three decision
  // ids from the product the skills shipped from.
  assert.deepEqual(first.wrote.filter((f) => /skills\/(cut-token|retheme|promote|move-region|pick-prop|review-handoff|write-grammar)\//.test(f)), [])

  const second = init(dir, process.cwd())
  assert.deepEqual(second.wrote, [])
  assert.ok(second.skipped.includes('.claude/skills/malleable/SKILL.md'))

  // A file that is there is never rewritten.
  fs.writeFileSync(path.join(dir, '.claude/commands/malleable-review.md'), 'mine\n')
  init(dir, process.cwd())
  assert.equal(fs.readFileSync(path.join(dir, '.claude/commands/malleable-review.md'), 'utf8'), 'mine\n')
})
