import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { init } from '../src/init'

test('init copies the skill and the commands, ignores the receipt, and installs no hook', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'malleable-init-'))
  const first = init(dir, process.cwd())
  assert.ok(first.wrote.includes('.claude/skills/malleable/SKILL.md'))
  assert.ok(first.wrote.includes('.claude/commands/malleable-preview.md'))
  assert.ok(first.wrote.includes('.claude/commands/malleable-review.md'))
  assert.ok(first.wrote.includes('.gitignore'))
  assert.equal(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8'), '.malleable/ready.json\n')
  assert.ok(!fs.existsSync(path.join(dir, '.claude/hooks')))
  assert.ok(!fs.existsSync(path.join(dir, '.claude/settings.json')))

  const second = init(dir, process.cwd())
  assert.deepEqual(second.wrote, [])
  assert.ok(second.skipped.includes('.gitignore'))
  assert.equal(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8'), '.malleable/ready.json\n')
})
