import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { test } from 'node:test'
import { readAll } from '@strata/substrate/log'
import { problemsWith, type Decision } from '@strata/substrate/decision'
import { PROMOTION_CANDIDATE_AT } from '@strata/substrate/precedent'
import * as field from '@strata/identity/field'
import { append, CONVERGE_AT, fieldAt, fnv1a, frameAt, marchingSquares, positionFor, strataAt, type FieldOptions } from '@strata/identity/field'
import { deriveEvents, IDENTITY_FILE, markValue, parseMark, stateFrom, syntheticStream, visitorDeviation } from '@strata/identity/record'
import { svgFrom } from '@strata/identity/render'
import { OBSIDIAN } from '../src/theme/generateTheme'
import { decide, resetHandlers } from '@strata/substrate/decide'
import { registerTheme } from '../src/theme/handlers'
import { registerIdentity } from '../src/identity/handler'
import { emitIdentity, FAVICON_PATH, MARK_PATH } from './emit-identity'

const REPO = path.join(path.dirname(new URL(import.meta.url).pathname), '..')
const OPTS: FieldOptions = { energy: OBSIDIAN.energy, density: OBSIDIAN.density, n: 64, levels: 6 }

test('a target has a place: FNV-1a is FNV-1a, the same key lands in the same spot, and two keys differ', () => {
  assert.equal(fnv1a(''), 0x811c9dc5)
  assert.equal(fnv1a('a'), 0xe40c292c)
  assert.equal(fnv1a('foobar'), 0xbf9cf968)
  const a = positionFor('token:--accent')
  assert.deepEqual(a, positionFor('token:--accent'))
  assert.notDeepEqual(a, positionFor('token:--accent-soft'))
  for (const v of a) assert.ok(v >= 0.08 && v <= 0.92)
})

test('the same state at the same time gives byte-identical lines — on the synthetic stream and on the real record', () => {
  const synth = stateFrom(syntheticStream(7))
  const f1 = frameAt(synth, 31.5, OPTS)
  const f2 = frameAt(synth, 31.5, OPTS)
  assert.deepEqual(f1.contours, f2.contours)
  assert.ok(f1.contours.some((c) => c.lines.length > 0), 'the field has isolines')
  const pal = { ink: 'oklch(0.95 0 0)', faint: 'oklch(0.95 0 0 / 0.4)', line: 'oklch(0.95 0 0 / 0.1)', ground: 'oklch(0.12 0 0)' }
  assert.equal(svgFrom(f1, 32, pal, { dot: true }), svgFrom(f2, 32, pal, { dot: true }))

  const real = stateFrom(readAll(REPO))
  assert.deepEqual(frameAt(real, Infinity, OPTS).contours, frameAt(real, Infinity, OPTS).contours)
})

test('memory: an appended event raises the field where it lands, never rewrites the past, and nothing can remove it', () => {
  const A = stateFrom(syntheticStream(3).slice(0, 20))
  const extra = visitorDeviation([0.3, 0.7], 20, '2026-09-05')
  const B = append(A, extra)
  assert.equal(B.events.length, A.events.length + 1)
  assert.equal(A.events.length, 20, 'the prior state is untouched')
  assert.ok(fieldAt(B, 22, 0.3, 0.7, OPTS) > fieldAt(A, 22, 0.3, 0.7, OPTS))
  assert.deepEqual(frameAt(B, 19.5, OPTS).contours, frameAt(A, 19.5, OPTS).contours, 'the future does not rewrite the past')
  const names = Object.keys(field)
  assert.ok(names.length > 10)
  assert.ok(!names.some((n) => /remove|delete|splice|truncate|reset|clear/i.test(n)), `no removal is exported: ${names.join(', ')}`)
})

test('derivation: keep, cut, deviation, ship and refusal each become the event the rules say', () => {
  const prov = (n: number, decided: Decision['decided']) => ({
    id: `d00000000${n}-0000`,
    at: `2026-09-0${n}T00:00:00.000Z`,
    decided,
    written: { kind: 'agent' as const, actor: 'claude-code' },
    via: 'test',
  })
  const human = { kind: 'human' as const, actor: 'p' }
  const agent = { kind: 'agent' as const, actor: 'a' }
  const record: Decision[] = [
    { kind: 'token', token: '--surface-raised', action: 'keep', ...prov(1, human), consequence: {} },
    { kind: 'token', token: '--accent-strong', action: 'cut', ...prov(2, agent), consequence: { collapsesTo: '--accent' } },
    { kind: 'deviation', file: 'src/site/site.css', line: 858, value: '0.72', ...prov(3, human), consequence: {} },
    { kind: 'ship', promoted: { system: 0, component: 0 }, frozen: 0, ...prov(4, human), consequence: {} },
    { kind: 'token', token: '--nope', action: 'keep', ...prov(5, human), consequence: { refused: 'the engine does not emit it' } },
  ]
  for (const d of record) assert.deepEqual(problemsWith(d), [])
  const ev = deriveEvents(record)
  assert.deepEqual(
    ev.map((e) => e.kind),
    ['keep', 'cut', 'deviation', 'ship', 'refused'],
  )
  assert.deepEqual(
    ev.map((e) => e.w),
    [1, 1, 0.6, 0, 0],
  )
  assert.deepEqual(ev[1].to, positionFor('token:--accent'))
  assert.deepEqual(
    ev.map((e) => e.hand),
    ['human', 'agent', 'human', 'human', 'human'],
  )
  assert.equal(ev[0].receipt.hand, 'human p')
  assert.equal(ev[0].receipt.date, '2026-09-01')
  const state = stateFrom(record)
  assert.equal(strataAt(state, 3, OPTS).length, 0, 'no stratum before the ship arrives')
  const strata = strataAt(state, 4.5, OPTS)
  assert.equal(strata.length, 1)
  assert.equal(strata[0].atIndex, 3)
  assert.deepEqual(strataAt(state, 10, OPTS)[0].lines, strata[0].lines, 'a stratum is frozen')
  assert.equal(CONVERGE_AT, PROMOTION_CANDIDATE_AT)
  for (const d of syntheticStream(11)) assert.deepEqual(problemsWith(d), [], JSON.stringify(d))
  const kinds = new Set(syntheticStream(11).map((d) => d.kind))
  for (const k of ['token', 'deviation', 'ship', 'override', 'prop']) assert.ok(kinds.has(k as Decision['kind']), k)
})

test('marching squares: a disc is one closed ring, a plane is one open line, a constant is nothing, a saddle resolves', () => {
  const n = 64
  const grid = (f: (x: number, y: number) => number) => {
    const g = new Float32Array((n + 1) * (n + 1))
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) g[j * (n + 1) + i] = f(i / n, j / n)
    return g
  }
  const disc = marchingSquares(grid((x, y) => 1 - ((x - 0.5) ** 2 + (y - 0.5) ** 2) / 0.25), n, 0.5)
  assert.equal(disc.length, 1)
  assert.ok(disc[0].closed)
  const R = Math.sqrt(0.125)
  for (const [x, y] of disc[0].points) assert.ok(Math.abs(Math.hypot(x - 0.5, y - 0.5) - R) < 1.5 / n)
  assert.ok(disc[0].points.length > 40)

  const plane = marchingSquares(grid((x) => x), n, 0.5)
  assert.equal(plane.length, 1)
  assert.ok(!plane[0].closed)
  const ends = [plane[0].points[0], plane[0].points[plane[0].points.length - 1]].sort((a, b) => a[1] - b[1])
  assert.deepEqual(ends.map(([x, y]) => [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6]), [[0.5, 0], [0.5, 1]])

  assert.deepEqual(marchingSquares(grid(() => 0.2), n, 0.5), [])

  const saddle = new Float32Array([1, 0, 0, 1])
  const lines = marchingSquares(saddle, 1, 0.5)
  assert.equal(lines.length, 2)
  for (const l of lines) assert.equal(l.points.length, 2)
})

test('the favicon and the mark are emitted from the record, valid, and the same bytes every time', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'strata-identity-'))
  fs.mkdirSync(path.join(dir, '.strata'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'src/theme'), { recursive: true })
  fs.copyFileSync(path.join(REPO, '.strata/decisions.jsonl'), path.join(dir, '.strata/decisions.jsonl'))
  fs.copyFileSync(path.join(REPO, 'src/theme/ledger.json'), path.join(dir, 'src/theme/ledger.json'))
  execFileSync('node', ['--import', 'tsx/esm', 'scripts/emit-identity.ts', dir], { cwd: REPO, stdio: 'pipe' })
  const favicon = fs.readFileSync(path.join(dir, FAVICON_PATH), 'utf8')
  const mark = fs.readFileSync(path.join(dir, MARK_PATH), 'utf8')
  for (const svg of [favicon, mark]) {
    assert.ok(svg.startsWith('<svg'))
    assert.match(svg, /<path d="M/)
    assert.match(svg, /prefers-color-scheme/)
    assert.match(svg, /--ink/)
    assert.ok(!/NaN|Infinity/.test(svg))
  }
  assert.match(favicon, /viewBox="0 0 32 32"/)
  assert.equal((favicon.match(/<circle/g) ?? []).length, 1)
  const again = emitIdentity(dir)
  assert.equal(again[FAVICON_PATH], favicon)
  assert.equal(again[MARK_PATH], mark)
})

test('a click on the field is a deviation on identity.html: accepted by the identity, written to no file, and read back in its place', () => {
  resetHandlers()
  registerTheme({ root: REPO })
  registerIdentity()
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'strata-identity-mark-'))
  fs.mkdirSync(path.join(dir, '.strata'), { recursive: true })
  const ctx = { root: dir, decided: { kind: 'human' as const }, written: { kind: 'human' as const }, via: 'identity', at: '2026-09-06T00:00:00.000Z' }
  const before = fs.readFileSync(path.join(REPO, IDENTITY_FILE), 'utf8')

  const ok = decide({ kind: 'deviation', file: IDENTITY_FILE, line: 1, value: markValue([0.31, 0.72]) }, ctx)
  assert.ok(ok.ok, ok.ok ? '' : ok.error)
  assert.equal(ok.written.length, 0, 'no file was written')
  assert.equal(fs.readFileSync(path.join(REPO, IDENTITY_FILE), 'utf8'), before, 'the surface is untouched')
  assert.match(ok.decision.consequence.note ?? '', /a mark on the field at 0\.3100,0\.7200/)
  assert.equal(readAll(dir).length, 1)

  const [ev] = deriveEvents(readAll(dir))
  assert.equal(ev.kind, 'deviation')
  assert.deepEqual(ev.p, [0.31, 0.72], 'the place on the record is the place in the field')
  assert.equal(ev.receipt.target, 'a mark on the field')
  assert.deepEqual(parseMark('0.3100,0.7200'), [0.31, 0.72])
  assert.equal(parseMark('1.5,0.2'), undefined)
  assert.equal(parseMark('not a place'), undefined)

  const bad = decide({ kind: 'deviation', file: IDENTITY_FILE, line: 2, value: 'oklch(0.5 0 0)' }, ctx)
  assert.ok(!bad.ok && /a place in the unit square/.test(bad.error))

  // A deviation on a real file still goes to the theme's handler, which asks for the reason it always asked for.
  const elsewhere = decide({ kind: 'deviation', file: 'src/site/site.css', line: 1, value: '0' }, { ...ctx, root: REPO, dryRun: true })
  assert.ok(!elsewhere.ok && /declares its reason/.test(elsewhere.error))

  // With no theme registered, the identity refuses the file rather than accepting it without its comment.
  resetHandlers()
  registerIdentity()
  const alone = decide({ kind: 'deviation', file: 'src/site/site.css', line: 1, value: '0', reason: 'x' }, { ...ctx, root: REPO, dryRun: true })
  assert.ok(!alone.ok && /answers only for identity\.html/.test(alone.error))
})
