/**
 * THE FRAME IS NOT DECIDABLE.
 *
 * Every decision kind is an act *within* the work: cut a token, override a
 * property, move a region, pick a prop, move the seeds, declare a deviation,
 * ship, hand off. The frame the work happens inside is a different category of
 * thing — `grammar/rules.json`, the skills' front matter and bodies,
 * `CLAUDE.md`, which rules are invariants, what number a preference carries —
 * and none of it comes through `decide()`. There is no `rule` kind, and the
 * omission is the design rather than a gap in it.
 *
 * The reason is not that agents are untrustworthy. It is that a decision
 * inside a frame cannot license a change to the frame without making the frame
 * mean nothing: an agent that can write the rules it works under is not
 * working under rules. Latitude on a feature is latitude on that feature.
 * Strata does not decide how much latitude an agent gets — the prompt does,
 * and the harness does — and this is the one thing Strata does hold, because
 * it is the only thing that would otherwise dissolve under its own use.
 *
 * The handler registry is open by construction: any module can call
 * `registerHandler`, which is what makes a projection a projection. That
 * openness is exactly why this test exists. It is the assertion that the door
 * still leads where it led — and it is *meant* to fail on a new kind, so that
 * adding one is a deliberate act with an argument attached, not a diff nobody
 * looked at twice.
 */
import assert from 'node:assert/strict'
import path from 'node:path'
import { test } from 'node:test'
import { registeredKinds, resetHandlers } from '@strata/substrate/decide'
import { KINDS } from '@strata/substrate/decision'
import { registerTheme } from '../src/theme/handlers'
import { registerMalleable } from '../strata-malleable/src/decide/index'

const REPO = path.join(path.dirname(new URL(import.meta.url).pathname), '..')

/**
 * The eight, and the reason each is an act within the work rather than a
 * statement about it. Written out rather than imported so that changing the
 * type does not silently change the assertion.
 */
const WITHIN_THE_WORK = {
  token: 'cut, keep, propose or mint one name in the vocabulary',
  override: 'set one property on one node, at some scope',
  move: 'move one region to another landmark',
  prop: 'pick one value a component already declared',
  seed: 'move the six numbers the engine derives from',
  deviation: 'declare one raw literal, where it sits',
  ship: 'collapse what was promoted; freeze the rest',
  ready: 'hand off what changed, for review',
} as const

const EIGHT = Object.keys(WITHIN_THE_WORK).sort()

test('the decision kinds are exactly the eight acts within the work', () => {
  assert.deepEqual([...KINDS].sort(), EIGHT, 'a kind was added to or removed from the type')
})

test('the projection registry admits those eight and nothing else', () => {
  resetHandlers()
  registerTheme({ root: REPO })
  registerMalleable({ root: path.join(REPO, 'strata-malleable'), source: 'fixtures/app' })

  assert.deepEqual(
    registeredKinds().sort(),
    EIGHT,
    'a projection registered a kind outside the eight. If it names something about the terms of the work — a rule, a skill, a threshold, a layer — the frame has become decidable, and an agent can change the rules it works under. If it is a new act within the work, add it here with the sentence that says why it is one.',
  )
})

test('nothing about the terms of the work is a decision kind', () => {
  // The specific shape this guards against, named so a future reader sees the
  // failure mode rather than a list of forbidden words: a kind whose subject
  // is the frame — the grammar, a skill, a policy, a threshold, a layer, the
  // invariant set — rather than the artifact.
  const aboutTheFrame = /^(rule|grammar|skill|policy|preference|threshold|invariant|layer|constraint|permission|scope|authority)$/
  for (const kind of [...KINDS, ...registeredKinds()])
    assert.doesNotMatch(
      kind,
      aboutTheFrame,
      `"${kind}" names a statement about the terms of the work, not an act within it. Rules, skills and thresholds are edited by people, in files, and read by every decision after — they are not themselves decided.`,
    )
})

test('every kind the type knows has a projection that applies it, and vice versa', () => {
  // Not a frame question, but the other half of the same closure: a kind with
  // no handler is a decision nothing can make, and a handler with no kind is a
  // door onto nothing. Either one means the eight are not really eight.
  resetHandlers()
  registerTheme({ root: REPO })
  registerMalleable({ root: path.join(REPO, 'strata-malleable'), source: 'fixtures/app' })
  assert.deepEqual(registeredKinds().sort(), [...KINDS].sort())
})
