import assert from 'node:assert/strict'
import path from 'node:path'
import { test } from 'node:test'
import { readAll } from '@strata/substrate/log'
import { targetKey, type Decision } from '@strata/substrate/decision'
import { direction, dist3, levelFor, neighbourCentre, PLANE_SCALE, R_MOON, R_RECORD, R_SYSTEM, R_TARGET, skyFrom } from '@strata/identity/sky'
import { deriveEvents, pathOf, skyOf, stateFrom, syntheticStream } from '@strata/identity/record'

const REPO = path.join(path.dirname(new URL(import.meta.url).pathname), '..')

test("a decision's system and target are named from its kind", () => {
  const prov = { id: 'd000000000-0000', at: '2026-09-01T00:00:00.000Z', decided: { kind: 'human' as const }, written: { kind: 'human' as const }, via: 'test', consequence: {} }
  const cases: Array<[Decision, [string, string]]> = [
    [{ kind: 'token', token: '--accent-soft', action: 'keep', ...prov }, ['--accent', '--accent-soft']],
    [{ kind: 'override', action: 'set', scope: 'instance', selector: '.card', property: 'padding', value: { literal: '12px' }, ...prov }, ['.card', '.card padding']],
    [{ kind: 'prop', component: 'Button', prop: 'variant', file: 'src/site/App.tsx', line: 1, from: 'a', to: 'b', ...prov }, ['Button', 'Button.variant']],
    [{ kind: 'move', region: 'sidebar', from: { container: 'a', file: 'f', line: 1 }, to: { container: 'b', file: 'f', line: 2, index: 0 }, ...prov }, ['regions', 'sidebar']],
    [{ kind: 'deviation', file: 'src/site/site.css', line: 858, value: '0.72', ...prov }, ['src/site/site.css', 'src/site/site.css:858']],
    [{ kind: 'ship', promoted: { system: 0, component: 0 }, frozen: 0, ...prov }, ['the record', 'ship']],
  ]
  for (const [d, expected] of cases) assert.deepEqual(pathOf(d), expected)
})

test('the same name lands in the same place at every level, and the levels nest: targets inside systems, moons inside targets', () => {
  const decisions = syntheticStream(7)
  const a = skyOf('the record', decisions)
  const b = skyOf('the record', decisions)
  assert.deepEqual(
    a.targets.map((t) => t.pos),
    b.targets.map((t) => t.pos),
  )
  for (const sys of a.systems) {
    assert.ok(dist3(sys.pos, a.root.pos) <= R_RECORD, `${sys.name} is inside the record`)
    for (const tgt of sys.children) {
      assert.ok(dist3(tgt.pos, sys.pos) <= R_SYSTEM, `${tgt.name} is inside ${sys.name}`)
      for (const moon of tgt.children) assert.ok(dist3(moon.pos, tgt.pos) <= R_TARGET, `a moon of ${tgt.name} is inside it`)
      assert.ok(R_MOON < R_TARGET && R_TARGET < R_SYSTEM && R_SYSTEM < R_RECORD)
    }
  }
  // Two records are two places; the same record under a different name is a different galaxy.
  const c = skyOf('an adopter', decisions, neighbourCentre('an adopter', 0))
  assert.ok(dist3(c.root.pos, a.root.pos) >= 4, 'a neighbour is far enough to be a point of light')
  assert.notDeepEqual(c.systems[0].pos, a.systems[0].pos)
  // Directions are unit vectors, and different keys point different ways.
  const d1 = direction('x')
  const d2 = direction('y')
  assert.ok(Math.abs(Math.hypot(...d1) - 1) < 1e-9)
  assert.notDeepEqual(d1, d2)
})

test('mass is the decisions made, refusals excluded; moons are in time order; the real record builds', () => {
  const decisions = syntheticStream(11)
  const sky = skyOf('the record', decisions)
  const refused = decisions.filter((d) => d.consequence.refused).length
  assert.ok(refused > 0, 'the synthetic stream refuses one')
  assert.equal(sky.root.mass, decisions.length - refused)
  assert.equal(
    sky.systems.reduce((s, x) => s + x.mass, 0),
    sky.root.mass,
  )
  for (const tgt of sky.targets) {
    assert.equal(
      tgt.mass,
      tgt.children.filter((m) => !m.refused).length,
    )
    const indices = tgt.children.map((m) => m.index ?? -1)
    assert.deepEqual(indices, [...indices].sort((x, y) => x - y), 'moons are in time order')
  }
  assert.equal(sky.moons.length, decisions.length)
  const distinct = new Set(decisions.map(targetKey)).size
  assert.equal(sky.targets.length, distinct, 'one planet per target')

  const real = skyOf('the record', readAll(REPO))
  assert.ok(real.systems.length > 1)
  assert.equal(real.root.mass, readAll(REPO).filter((d) => !d.consequence.refused).length)
  // The engine's builder takes the adapter's names, and takes a default when it is given none.
  const bare = skyFrom('bare', stateFrom(decisions), [])
  assert.equal(bare.systems.length, 1)
  assert.equal(bare.systems[0].name, 'the record')
})

test('the readout names the level a distance is at, from the supercluster in to the moons', () => {
  assert.equal(levelFor(22).name, 'supercluster')
  assert.equal(levelFor(2.4).name, 'galaxy')
  assert.equal(levelFor(R_SYSTEM * 2).name, 'system')
  assert.equal(levelFor(R_TARGET * 2).name, 'planet')
  assert.equal(levelFor(R_TARGET * 0.5).name, 'moons')
})

test('the sky from above is the field: every target sits in the sky at the place the field gives it, scaled and centred', () => {
  const decisions = syntheticStream(7)
  const sky = skyOf('the record', decisions)
  const events = deriveEvents(decisions)
  for (const tgt of sky.targets) {
    const moon = tgt.children[0]
    const ev = events[moon.index ?? -1]
    if (ev.kind === 'deviation') continue // a mark on the identity is placed by the hand, not the address
    const expectX = (ev.p[0] - 0.5) * PLANE_SCALE
    const expectY = -(ev.p[1] - 0.5) * PLANE_SCALE
    assert.ok(Math.abs(tgt.pos[0] - expectX) < 1e-9 && Math.abs(tgt.pos[1] - expectY) < 1e-9, `${tgt.name}: sky (${tgt.pos[0]}, ${tgt.pos[1]}) vs field (${expectX}, ${expectY})`)
  }
  // The same target lands in the same place in every record.
  const other = skyOf('an adopter', syntheticStream(11), [4, 0, 0])
  const shared = sky.targets.find((t) => other.targets.some((o) => o.name === t.name))
  assert.ok(shared, 'the two synthetic records share a target')
  const twin = other.targets.find((o) => o.name === shared.name)!
  assert.ok(Math.abs(twin.pos[0] - 4 - shared.pos[0]) < 1e-9 && Math.abs(twin.pos[1] - shared.pos[1]) < 1e-9)
})
