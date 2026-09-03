/**
 * The bench is a fixture for an experiment nobody has run yet, which is
 * exactly the kind of thing that rots. This does not run it — that needs a
 * harness — it checks that what it points at still exists.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { loadSkills } from '@strata/substrate/skills'

const REPO = path.join(path.dirname(new URL(import.meta.url).pathname), '..')
const tasks = JSON.parse(fs.readFileSync(path.join(REPO, 'bench/tasks.json'), 'utf8')).tasks as Array<{
  id: string
  skill: string
  inputs: Record<string, string>
  instruction: string
  whatTheRecordKnows: string[]
}>

test('every bench task names a skill that exists, and gives it the inputs it declares', () => {
  const skills = loadSkills(REPO)
  assert.ok(tasks.length >= 2, 'the claim is tested on more than one task')
  for (const task of tasks) {
    const skill = skills.find((s) => s.name === task.skill)
    assert.ok(skill, `${task.id} names the skill ${task.skill}, which is not in this repo any more`)
    assert.deepEqual(Object.keys(task.inputs).sort(), [...skill.inputs].sort(), `${task.id} passes exactly what ${task.skill} asks for`)
    assert.ok(task.instruction.trim().length > 10, `${task.id} states the task in words a harness can act on`)
    assert.ok(task.whatTheRecordKnows.length > 0, `${task.id} says what the record knows that a component list does not — otherwise the arms are the same`)
  }
})

test('the instruction is identical in both arms — only the context differs', () => {
  // The experiment is worthless if the arms are asked different questions, so
  // the shape that makes that impossible is asserted rather than trusted: one
  // instruction per task, used by both.
  for (const task of tasks) assert.equal(typeof task.instruction, 'string')
  assert.equal(new Set(tasks.map((t) => t.id)).size, tasks.length, 'task ids are unique')
})
