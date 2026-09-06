/**
 * THE IDENTITY IS A PROJECTION OF THE RECORD.
 *
 * Strata's identity is not a drawing. It is a behaviour: one persistent,
 * append-only state producing many visible expressions, with memory. The
 * state is the record — every decision, in order — and this module is the
 * derivation from that record to a scalar field over the unit square. What a
 * renderer does with the field (isolines, a dot lattice, a cross-section, a
 * 16px seed) is a projection, and none of the projections is the identity.
 * These rules are:
 *
 *   - The state is the record. There is `append` and there is no remove.
 *   - Every decision has a place, and the same target always lands in the
 *     same place. Precedent is visible without being declared.
 *   - Time is sequence, not the clock. Two builds of one record look alike.
 *   - Age spreads and settles; it never erases. Amplitude decays to a floor,
 *     radius grows. An old decision is broad, low relief.
 *   - A cut is mass moving to its fallback, and it leaves a hollow.
 *   - A deviation breaks away and is drawn as one.
 *   - A ship freezes a stratum: the isolines at that moment, kept beneath
 *     everything after. The strata are the ships.
 *   - Presence disturbs; only a decision is remembered. The pointer is an
 *     option to the sampler, never an event.
 *   - Nothing loops. The breath after the last event is aperiodic noise.
 *
 * This module has no dependencies at all and touches no filesystem, clock or
 * DOM, so the page, the favicon script and the tests all run the same code.
 * What turns a record into events lives beside it in `record.ts`; this file
 * only knows events, and an adopter with a different source writes a
 * different adapter and keeps everything below.
 */

/* ---------- types ---------- */

export type Vec = readonly [number, number]
export interface Polyline {
  points: Vec[]
  closed: boolean
}

export type EventKind = 'keep' | 'cut' | 'deviation' | 'ship' | 'generic' | 'refused'

export interface Receipt {
  id: string
  /** The decision's kind, as the record names it. A string here so the engine has no dependency. */
  kind: string
  target: string
  hand: string
  date: string
}

export interface IdentityEvent {
  /** Sequence index — the only clock. */
  i: number
  id: string
  key: string
  kind: EventKind
  /** Who chose. Whose hand wrote it is not drawn: at review, `written` changes nothing. */
  hand: 'human' | 'agent'
  p: Vec
  w: number
  /** Cut only: where the mass goes — the position of what it collapses to. */
  to?: Vec
  receipt: Receipt
}

/** Append-only. The type has no method that shortens `events`, and the module exports none. */
export interface IdentityState {
  readonly events: readonly IdentityEvent[]
}

export interface Presence {
  p: Vec
  /** 0..1, eased by the caller. */
  w: number
}

export interface FieldOptions {
  /** Theme seed: settle length and kernel sharpness. */
  energy: number
  /** Theme seed: level count. */
  density: number
  /** Grid cells per side. */
  n: number
  /** Isoline count. */
  levels: number
  /** Width over height of the surface. Positions spread across it; kernels stay circular. Default 1. */
  aspect?: number
  /** Seconds since equilibrium, hero only; undefined = no breath. */
  breath?: number
  /** The pointer, as a force. Never remembered. */
  presence?: Presence
}

export interface Cluster {
  c: Vec
  members: number[]
  /** The innermost closed contour around the centroid, if one exists — drawn a second time, concentric. */
  line?: Polyline
}

export interface Frame {
  t: number
  /** Cells per world unit (the height). */
  n: number
  /** Cells across (n · aspect). */
  nx: number
  aspect: number
  /** How many events the state holds, arrived or not — so a cross-section does not reflow as they arrive. */
  total: number
  arrived: IdentityEvent[]
  newest?: { event: IdentityEvent; age: number; q: Vec; r: number }
  grid: Float32Array
  levels: number[]
  contours: Array<{ level: number; lines: Polyline[] }>
  /** Isolines below zero: hollows and presence. */
  hollows: Array<{ level: number; lines: Polyline[] }>
  clusters: Cluster[]
  strata: Array<{ atIndex: number; lines: Polyline[] }>
  /** Current world position of every arrived event (a cut drifts), by index into `arrived`. */
  positions: Vec[]
}

/** Unit-square coordinates to world: x spreads across the aspect, y is the height. */
export const toWorld = (p: Vec, aspect: number): Vec => [p[0] * aspect, p[1]]
export const toUnit = (p: Vec, aspect: number): Vec => [p[0] / aspect, p[1]]
export const gridWidth = (n: number, aspect: number) => Math.max(1, Math.round(n * aspect))

/* ---------- constants, named so a test can pin them and a hand can zero them ---------- */

export const A_FLOOR = 0.35
export const TAU_A = 12
export const R0 = 0.09
export const R_MAX = 0.26
export const TAU_R = 16
export const TRACE = 0.35
export const DEVIATION_W = 0.6
export const GENERIC_W = 0.5
export const DEVIATION_RING = 0.42
export const CLUSTER_RADIUS = 0.06
/** Three, as `PROMOTION_CANDIDATE_AT` in substrate/src/precedent.ts — redefined here because that module reads the filesystem. */
export const CONVERGE_AT = 3
export const PRESENCE_RADIUS = 0.14
export const PRESENCE_W = 0.8
export const BREATH_AMPLITUDE = 0.02
/** Lattice steps per second of the breath's value noise. */
export const BREATH_RATE = 1 / 12
export const INSET = 0.08

/* ---------- small maths ---------- */

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
export const smoothstep = (t: number) => {
  const x = clamp01(t)
  return x * x * (3 - 2 * x)
}
const dist = (a: Vec, b: Vec) => Math.hypot(a[0] - b[0], a[1] - b[1])

/** 32-bit FNV-1a. Stable across runtimes; the whole reason a target has a place. */
export function fnv1a(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

const unit = (h: number) => h / 2 ** 32

/** Where a target lives. Same key, same place — that is precedent. */
export function positionFor(key: string): Vec {
  const x = unit(fnv1a(key))
  const y = unit(fnv1a(key + '\u0000y'))
  return [lerp(INSET, 1 - INSET, x), lerp(INSET, 1 - INSET, y)]
}

/** A deviation lands on the outer ring, away from whatever it left. */
export function deviationPosition(key: string): Vec {
  const a = unit(fnv1a(key)) * Math.PI * 2
  return [0.5 + DEVIATION_RING * Math.cos(a), 0.5 + DEVIATION_RING * Math.sin(a)]
}

/** Wendland C2: compact support, peak 1, smooth to the edge. */
export const wendland = (s: number) => (s >= 1 ? 0 : (1 - s) ** 4 * (4 * s + 1))

/** The radius (as a fraction of r) at which the kernel has fallen to half — the newest event's own ring. */
export const HALF_RADIUS = (() => {
  let lo = 0
  let hi = 1
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2
    if (wendland(mid) > 0.5) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
})()

export const amplitude = (age: number) => A_FLOOR + (1 - A_FLOOR) * Math.exp(-Math.max(0, age) / TAU_A)
export const radius = (age: number) => R0 + (R_MAX - R0) * (1 - Math.exp(-Math.max(0, age) / TAU_R))
/** How many events an arrival takes to settle. Calm themes take a whole beat; kinetic ones a third. */
export const settleLength = (energy: number) => lerp(1.0, 0.35, clamp01(energy))
export const envelope = (age: number, sigma: number) => (sigma <= 0 ? (age > 0 ? 1 : 0) : smoothstep(age / sigma))

/** Aperiodic 1D value noise in [-1, 1]. A lattice of hashed values, smoothly interpolated; it never returns to its start. */
export function valueNoise1D(x: number, seed: number): number {
  const i = Math.floor(x)
  const f = x - i
  const at = (k: number) => unit(fnv1a(`${seed}:${k}`)) * 2 - 1
  return lerp(at(i), at(i + 1), smoothstep(f))
}

/* ---------- state: append, never remove ---------- */

export const emptyState = (): IdentityState => ({ events: [] })

/** A record with one decision in it: the seed phase, and the loading state. */
export const seedState = (): IdentityState =>
  append(emptyState(), {
    id: 'seed',
    key: 'seed',
    kind: 'keep',
    hand: 'human',
    p: [0.5, 0.5],
    w: 1,
    receipt: { id: 'seed', kind: 'token', target: 'the first decision', hand: 'human', date: '' },
  })

export function append(state: IdentityState, ev: Omit<IdentityEvent, 'i'> & { i?: number }): IdentityState {
  const i = state.events.length
  return { events: [...state.events, { ...ev, i }] }
}


/* ---------- the field ---------- */

interface Term {
  q: Vec
  r: number
  a: number
}

/** Where a cut's mass is at this age: it arrives, then travels to its fallback over two settles. */
function cutPosition(ev: IdentityEvent, age: number, sigma: number): Vec {
  if (!ev.to) return ev.p
  const k = sigma <= 0 ? 1 : smoothstep((age - sigma) / (2 * sigma))
  return [lerp(ev.p[0], ev.to[0], k), lerp(ev.p[1], ev.to[1], k)]
}

function breathFactor(ev: IdentityEvent, breath: number | undefined): number {
  if (breath === undefined) return 1
  return 1 + BREATH_AMPLITUDE * valueNoise1D(breath * BREATH_RATE, fnv1a(ev.id))
}

/** Every bump and hollow in the field at `t`, with where each arrived event currently sits. */
function terms(state: IdentityState, t: number, opts: FieldOptions): { terms: Term[]; arrived: IdentityEvent[]; positions: Vec[] } {
  const sigma = settleLength(opts.energy)
  const aspect = opts.aspect ?? 1
  const out: Term[] = []
  const arrived: IdentityEvent[] = []
  const positions: Vec[] = []
  for (const ev of state.events) {
    const age = t - ev.i
    if (age <= 0) continue
    arrived.push(ev)
    const q = toWorld(ev.kind === 'cut' ? cutPosition(ev, age, sigma) : ev.p, aspect)
    positions.push(q)
    if (ev.w === 0) continue
    const env = envelope(age, sigma)
    const a = ev.w * env * amplitude(age)
    const r = radius(age) * breathFactor(ev, opts.breath)
    out.push({ q, r, a })
    if (ev.kind === 'cut') out.push({ q: toWorld(ev.p, aspect), r, a: -TRACE * env * amplitude(age) })
  }
  if (opts.presence && opts.presence.w > 0) out.push({ q: opts.presence.p, r: PRESENCE_RADIUS, a: -PRESENCE_W * opts.presence.w })
  return { terms: out, arrived, positions }
}

/**
 * Stacked decisions add, but the picture compresses the stack: three hands on
 * one target are a convergence, not a tower, and a tower is all rings. Linear
 * below one, saturating above; monotonic, so more is still more.
 */
export const CEILING = 1.6
export const compress = (f: number) => CEILING * Math.tanh(f / CEILING)

const evaluate = (ts: readonly Term[], x: number, y: number) => {
  let f = 0
  for (const { q, r, a } of ts) {
    const dx = x - q[0]
    const dy = y - q[1]
    const s = Math.sqrt(dx * dx + dy * dy) / r
    if (s < 1) f += a * wendland(s)
  }
  return compress(f)
}

/** The field at one point. */
export const fieldAt = (state: IdentityState, t: number, x: number, y: number, opts: FieldOptions) => evaluate(terms(state, t, opts).terms, x, y)

/** The field sampled on an (nx+1)·(n+1) lattice at spacing 1/n, row-major, each term visiting only the cells inside its support. */
export function sampleField(state: IdentityState, t: number, opts: FieldOptions): Float32Array {
  return sampleTerms(terms(state, t, opts).terms, opts.n, gridWidth(opts.n, opts.aspect ?? 1))
}

function sampleTerms(ts: readonly Term[], n: number, nx: number): Float32Array {
  const W = nx + 1
  const grid = new Float32Array(W * (n + 1))
  for (const { q, r, a } of ts) {
    const i0 = Math.max(0, Math.floor((q[0] - r) * n))
    const i1 = Math.min(nx, Math.ceil((q[0] + r) * n))
    const j0 = Math.max(0, Math.floor((q[1] - r) * n))
    const j1 = Math.min(n, Math.ceil((q[1] + r) * n))
    for (let j = j0; j <= j1; j++) {
      const dy = j / n - q[1]
      for (let i = i0; i <= i1; i++) {
        const dx = i / n - q[0]
        const s = Math.sqrt(dx * dx + dy * dy) / r
        if (s < 1) grid[j * W + i] += a * wendland(s)
      }
    }
  }
  for (let k = 0; k < grid.length; k++) grid[k] = compress(grid[k])
  return grid
}

/** Bilinear read of a sampled grid at a world point. */
export function sampleGrid(grid: Float32Array, n: number, nx: number, x: number, y: number): number {
  const W = nx + 1
  const fx = Math.min(Math.max(x * n, 0), nx - 1e-6)
  const fy = Math.min(Math.max(y * n, 0), n - 1e-6)
  const i = Math.floor(fx)
  const j = Math.floor(fy)
  const u = fx - i
  const v = fy - j
  const g = (a: number, b: number) => grid[b * W + a]
  return lerp(lerp(g(i, j), g(i + 1, j), u), lerp(g(i, j + 1), g(i + 1, j + 1), u), v)
}

/* ---------- isolines ---------- */

/**
 * Fixed absolute levels, so a line does not jump between frames when the
 * range moves; spaced closer at the base than at the crests, because the low
 * contours are where two decisions become one shape and the crests are where
 * one decision becomes a bullseye.
 */
export const levelsFor = (count: number): number[] => {
  const n = Math.max(1, count)
  if (n === 1) return [SEED_LEVEL]
  return Array.from({ length: n }, (_, k) => 0.08 + 1.5 * ((k + 0.5) / n) ** 1.5)
}
/** The one contour the seed reading draws: low enough to be the outline of everything, high enough to close around one decision. */
export const SEED_LEVEL = 0.3
/** Below the ground: where a cut left its hollow, and where a hand is pressing. Drawn dashed, because it is absence. */
export const HOLLOW_LEVELS = [-0.06, -0.18]

export type Station = 'layers' | 'contours' | 'field' | 'dot' | 'hero' | 'mark' | 'favicon' | 'loading'

export function levelCount(station: Station, density: number): number {
  switch (station) {
    case 'hero':
      return Math.round(8 * density)
    case 'contours':
    case 'field':
      return Math.round(6 * density)
    case 'mark':
      return 4
    default:
      return 1
  }
}

/**
 * Marching squares. Corners counter-clockwise from bottom-left; crossings by
 * linear interpolation; the two saddles resolved by the cell's mean. Segments
 * are joined by grid-edge identity rather than by coordinates, and walked in a
 * fixed order, which is what makes the same field give byte-identical lines.
 */
export function marchingSquares(grid: Float32Array, n: number, level: number, nx = n): Polyline[] {
  const W = nx + 1
  const g = (i: number, j: number) => grid[j * W + i]
  // Edge keys: a horizontal edge at (i, j) runs from (i, j) to (i+1, j); a vertical one from (i, j) to (i, j+1).
  const H = (i: number, j: number) => ((j * W + i) << 1) | 0
  const V = (i: number, j: number) => ((j * W + i) << 1) | 1
  type Seg = { a: number; b: number; pa: Vec; pb: Vec }
  const segs: Seg[] = []
  const cross = (x0: number, y0: number, v0: number, x1: number, y1: number, v1: number): Vec => {
    const d = v1 - v0
    const k = d === 0 ? 0.5 : (level - v0) / d
    return [(x0 + (x1 - x0) * k) / n, (y0 + (y1 - y0) * k) / n]
  }
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < nx; i++) {
      const v00 = g(i, j)
      const v10 = g(i + 1, j)
      const v11 = g(i + 1, j + 1)
      const v01 = g(i, j + 1)
      const b0 = v00 >= level
      const b1 = v10 >= level
      const b2 = v11 >= level
      const b3 = v01 >= level
      if (b0 === b1 && b1 === b2 && b2 === b3) continue
      const edges: Array<{ k: number; p: Vec }> = []
      if (b0 !== b1) edges.push({ k: H(i, j), p: cross(i, j, v00, i + 1, j, v10) })
      if (b1 !== b2) edges.push({ k: V(i + 1, j), p: cross(i + 1, j, v10, i + 1, j + 1, v11) })
      if (b2 !== b3) edges.push({ k: H(i, j + 1), p: cross(i + 1, j + 1, v11, i, j + 1, v01) })
      if (b3 !== b0) edges.push({ k: V(i, j), p: cross(i, j + 1, v01, i, j, v00) })
      if (edges.length === 2) {
        segs.push({ a: edges[0].k, b: edges[1].k, pa: edges[0].p, pb: edges[1].p })
      } else if (edges.length === 4) {
        // A saddle. edges are [bottom, right, top, left]. If the centre sides with v00,
        // v00 and v11 are one region and the other two corners are isolated.
        const centre = (v00 + v10 + v11 + v01) / 4 >= level
        const [bottom, right, top, left] = edges
        if (centre === b0) {
          segs.push({ a: bottom.k, b: right.k, pa: bottom.p, pb: right.p })
          segs.push({ a: top.k, b: left.k, pa: top.p, pb: left.p })
        } else {
          segs.push({ a: left.k, b: bottom.k, pa: left.p, pb: bottom.p })
          segs.push({ a: right.k, b: top.k, pa: right.p, pb: top.p })
        }
      }
    }
  }
  // Join by shared edge.
  const byEdge = new Map<number, number[]>()
  segs.forEach((s, idx) => {
    for (const k of [s.a, s.b]) {
      const list = byEdge.get(k)
      if (list) list.push(idx)
      else byEdge.set(k, [idx])
    }
  })
  const used = new Uint8Array(segs.length)
  const out: Polyline[] = []
  const next = (edge: number, from: number): number => {
    const list = byEdge.get(edge)
    if (!list) return -1
    for (const idx of list) if (idx !== from && !used[idx]) return idx
    return -1
  }
  for (let s = 0; s < segs.length; s++) {
    if (used[s]) continue
    used[s] = 1
    const seg = segs[s]
    const forward: Vec[] = [seg.pb]
    let edge = seg.b
    let cur = s
    let closed = false
    for (;;) {
      const nx = next(edge, cur)
      if (nx === -1) break
      used[nx] = 1
      const sg = segs[nx]
      const [outEdge, outP] = sg.a === edge ? [sg.b, sg.pb] : [sg.a, sg.pa]
      forward.push(outP)
      edge = outEdge
      cur = nx
      if (edge === seg.a) {
        closed = true
        break
      }
    }
    const backward: Vec[] = []
    if (!closed) {
      edge = seg.a
      cur = s
      for (;;) {
        const nx = next(edge, cur)
        if (nx === -1) break
        used[nx] = 1
        const sg = segs[nx]
        const [outEdge, outP] = sg.a === edge ? [sg.b, sg.pb] : [sg.a, sg.pa]
        backward.push(outP)
        edge = outEdge
        cur = nx
      }
    }
    const points = [...backward.reverse(), seg.pa, ...forward]
    if (closed) points.pop() // the walk returned to pa; the flag says so
    out.push({ points, closed })
  }
  return out
}

/* ---------- geometry the renderers share ---------- */

export function pointInPolygon(p: Vec, poly: readonly Vec[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export const polygonArea = (poly: readonly Vec[]) => {
  let a = 0
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1]
  return Math.abs(a) / 2
}

/** A copy of `line` scaled about `c` by `k` — the second, concentric hairline a convergence earns. */
export const concentric = (line: Polyline, c: Vec, k: number): Polyline => ({
  closed: line.closed,
  points: line.points.map(([x, y]) => [c[0] + (x - c[0]) * k, c[1] + (y - c[1]) * k] as Vec),
})

/** Groups of arrived events within `CLUSTER_RADIUS` of one another, `CONVERGE_AT` or more strong. */
export function clusters(arrived: readonly IdentityEvent[], positions: readonly Vec[], r = CLUSTER_RADIUS): Array<{ c: Vec; members: number[] }> {
  const parent = arrived.map((_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  const idx = arrived.map((_, i) => i).filter((i) => arrived[i].w > 0)
  for (let a = 0; a < idx.length; a++)
    for (let b = a + 1; b < idx.length; b++)
      if (dist(positions[idx[a]], positions[idx[b]]) <= r) parent[find(idx[a])] = find(idx[b])
  const groups = new Map<number, number[]>()
  for (const i of idx) {
    const root = find(i)
    const g = groups.get(root)
    if (g) g.push(i)
    else groups.set(root, [i])
  }
  const out: Array<{ c: Vec; members: number[] }> = []
  for (const members of groups.values()) {
    if (members.length < CONVERGE_AT) continue
    const c: Vec = [
      members.reduce((s, i) => s + positions[i][0], 0) / members.length,
      members.reduce((s, i) => s + positions[i][1], 0) / members.length,
    ]
    out.push({ c, members })
  }
  return out.sort((a, b) => a.members[0] - b.members[0])
}

function innermostAround(c: Vec, contours: Frame['contours']): Polyline | undefined {
  let best: Polyline | undefined
  let bestArea = Infinity
  for (const { lines } of contours)
    for (const line of lines) {
      if (!line.closed || !pointInPolygon(c, line.points)) continue
      const area = polygonArea(line.points)
      if (area < bestArea) {
        bestArea = area
        best = line
      }
    }
  return best
}

/* ---------- strata: what a ship froze ---------- */

const strataCache = new WeakMap<IdentityState, Map<string, Polyline[]>>()

/** The isolines at each ship that has arrived by `t`, frozen: the past cannot change, so the cache never invalidates. */
export function strataAt(state: IdentityState, t: number, opts: FieldOptions): Frame['strata'] {
  const out: Frame['strata'] = []
  let cache = strataCache.get(state)
  if (!cache) {
    cache = new Map()
    strataCache.set(state, cache)
  }
  const still: FieldOptions = { ...opts, breath: undefined, presence: undefined }
  for (const ev of state.events) {
    if (ev.kind !== 'ship' || t - ev.i <= 0) continue
    const aspect = opts.aspect ?? 1
    const key = `${ev.i}:${opts.n}:${opts.levels}:${opts.energy}:${opts.density}:${aspect}`
    let lines = cache.get(key)
    if (!lines) {
      const grid = sampleField(state, ev.i, still)
      lines = levelsFor(opts.levels).flatMap((L) => marchingSquares(grid, opts.n, L, gridWidth(opts.n, aspect)))
      cache.set(key, lines)
    }
    out.push({ atIndex: ev.i, lines })
  }
  return out
}

/* ---------- the frame: everything a renderer needs ---------- */

export function frameAt(state: IdentityState, t: number, opts: FieldOptions): Frame {
  const aspect = opts.aspect ?? 1
  const nx = gridWidth(opts.n, aspect)
  const { terms: ts, arrived, positions } = terms(state, t, opts)
  const grid = sampleTerms(ts, opts.n, nx)
  const levels = levelsFor(opts.levels)
  const contours = levels.map((level) => ({ level, lines: marchingSquares(grid, opts.n, level, nx) }))
  const hollows = HOLLOW_LEVELS.map((level) => ({ level, lines: marchingSquares(grid, opts.n, level, nx) }))
  const found = clusters(arrived, positions).map((cl) => ({ ...cl, line: innermostAround(cl.c, contours) }))
  let newest: Frame['newest']
  for (let k = arrived.length - 1; k >= 0; k--) {
    const ev = arrived[k]
    if (ev.w === 0) continue
    const age = t - ev.i
    newest = { event: ev, age, q: positions[k], r: radius(age) * HALF_RADIUS }
    break
  }
  return { t, n: opts.n, nx, aspect, total: state.events.length, arrived, newest, grid, levels, contours, hollows, clusters: found, strata: strataAt(state, t, opts), positions }
}
