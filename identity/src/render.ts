/**
 * THE PROJECTIONS. Four ways to draw one frame — a cross-section, isolines,
 * a dot lattice, a 16px seed — and an SVG serializer for the two that ship
 * as files. They share one polyline type and one palette, and none of them
 * is the identity; `field.ts` is.
 *
 * The voice, enacted: every line is one CSS pixel of ink; every step is an
 * alpha, never a second colour; there is no shadow, no blur, no fill except
 * a human's marker and the lattice's dots; the canvas is transparent, so the
 * ground is the page's own surface and follows the appearance seed through
 * CSS. Colours arrive resolved as a `Palette` — five strings the host reads
 * from its own theme — so no colour string is ever written here, and a host
 * with a different theme engine passes its own.
 */
import { clamp01, concentric, lerp, sampleGrid, type Frame, type IdentityEvent, type Polyline, type Vec } from './field.ts'

export interface Palette {
  ink: string
  faint: string
  line: string
  ground: string
  /** Only when the theme has chroma; a monochrome accent is ink, and ink is already here. */
  accent?: string
}

export type Projection = 'layers' | 'contours' | 'field' | 'dot'
export interface Size {
  w: number
  h: number
}

/** Alpha of contour level k of N: the ground faint, the crest near full ink. */
export const levelAlpha = (k: number, N: number) => (N <= 1 ? 0.75 : lerp(0.25, 0.9, k / (N - 1)))
export const STRATUM_ALPHA = 0.14
/** Each stratum beneath the last is this much fainter: memory recedes. */
export const STRATUM_RECEDE = 0.7
export const stratumAlpha = (depth: number) => STRATUM_ALPHA * Math.pow(STRATUM_RECEDE, depth)

export interface Extras {
  /** A palette per stratum, by index into `frame.strata` — the theme each epoch closed under. Missing entries use the live palette. */
  strata?: Array<Palette | undefined>
}
/** How many events the newest ring stays visible for. */
export const NEWEST_FOR = 3

export function draw(ctx: CanvasRenderingContext2D, projection: Projection, frame: Frame, size: Size, pal: Palette, extras: Extras = {}): void {
  ctx.clearRect(0, 0, size.w, size.h)
  ctx.lineWidth = 1
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  switch (projection) {
    case 'layers':
      return drawLayers(ctx, frame, size, pal)
    case 'contours':
      return drawContours(ctx, frame, size, pal, extras)
    case 'field':
      return drawField(ctx, frame, size, pal)
    case 'dot':
      return drawDot(ctx, frame, size, pal, extras)
  }
}

/** The strata, oldest first, each in its own palette, each one beneath the last fainter. */
function drawStrata(ctx: CanvasRenderingContext2D, frame: Frame, S: number, pal: Palette, extras: Extras) {
  const depthOf = frame.strata.length
  frame.strata.forEach((s, k) => strokeLines(ctx, s.lines, S, stratumAlpha(depthOf - 1 - k), (extras.strata?.[k] ?? pal).ink))
}

/* ---------- shared strokes ---------- */

/** World → pixels. A world unit is the canvas height; x spreads with the aspect. */
const scaleOf = (size: Size) => size.h

function tracePath(ctx: CanvasRenderingContext2D, line: Polyline, S: number, ox = 0, oy = 0) {
  const pts = line.points
  if (pts.length < 2) return
  ctx.beginPath()
  ctx.moveTo(ox + pts[0][0] * S, oy + pts[0][1] * S)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(ox + pts[i][0] * S, oy + pts[i][1] * S)
  if (line.closed) ctx.closePath()
  ctx.stroke()
}

function strokeLines(ctx: CanvasRenderingContext2D, lines: readonly Polyline[], S: number, alpha: number, color: string) {
  ctx.globalAlpha = alpha
  ctx.strokeStyle = color
  for (const l of lines) tracePath(ctx, l, S)
}

/** Who chose: a human is a filled dot, an agent a ring, a deviation a dashed ring. */
function marker(ctx: CanvasRenderingContext2D, ev: IdentityEvent, x: number, y: number, r: number, color: string) {
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.beginPath()
  if (ev.kind === 'deviation') {
    ctx.setLineDash([2, 3])
    ctx.arc(x, y, r * 1.8, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    return
  }
  ctx.arc(x, y, r, 0, Math.PI * 2)
  if (ev.hand === 'human') ctx.fill()
  else ctx.stroke()
}

function newestAlpha(frame: Frame) {
  return frame.newest ? clamp01(1 - frame.newest.age / NEWEST_FOR) : 0
}

/* ---------- 1. Layers — the log as a cross-section ---------- */

/**
 * Literal strata: one hairline per decision, stacked in time order. The
 * tick is where the decision lives on the x axis; the marker is who chose.
 * A ship is a heavier line across the whole width — a boundary — and a
 * refusal is a line with nothing on it, because the attempt is on the record.
 */
export function drawLayers(ctx: CanvasRenderingContext2D, frame: Frame, size: Size, pal: Palette) {
  const pad = Math.max(6, size.h * 0.06)
  const rows = Math.max(frame.total, 1)
  const rowH = (size.h - pad * 2) / rows
  const r = Math.min(3, Math.max(1.5, rowH * 0.28))
  frame.arrived.forEach((ev, k) => {
    const y = pad + (ev.i + 0.5) * rowH
    const age = frame.t - ev.i
    const arrive = clamp01(age)
    const isShip = ev.kind === 'ship'
    ctx.globalAlpha = (isShip ? 0.85 : ev.kind === 'refused' ? 0.14 : 0.28) * arrive
    ctx.strokeStyle = pal.ink
    ctx.setLineDash(ev.kind === 'refused' ? [1, 3] : [])
    ctx.beginPath()
    ctx.moveTo(pad, y)
    ctx.lineTo(size.w - pad, y)
    ctx.stroke()
    ctx.setLineDash([])
    if (ev.w === 0) return
    const x = pad + (frame.positions[k][0] / frame.aspect) * (size.w - pad * 2)
    ctx.globalAlpha = 0.9 * arrive
    if (ev.kind === 'cut' && ev.to) {
      // Where the cut was, a faint tick stays; the marker travels to the fallback.
      const x0 = pad + ev.p[0] * (size.w - pad * 2)
      ctx.globalAlpha = 0.3 * arrive
      ctx.strokeStyle = pal.ink
      ctx.beginPath()
      ctx.moveTo(x0, y - r * 1.4)
      ctx.lineTo(x0, y + r * 1.4)
      ctx.stroke()
      ctx.globalAlpha = 0.9 * arrive
    }
    const color = pal.accent && frame.newest?.event === ev ? pal.accent : pal.ink
    marker(ctx, ev, x, y, r, color)
  })
  ctx.globalAlpha = 1
}

/* ---------- 2. Contours — isolines of the field ---------- */

export function drawContours(ctx: CanvasRenderingContext2D, frame: Frame, size: Size, pal: Palette, extras: Extras = {}) {
  const S = scaleOf(size)
  drawStrata(ctx, frame, S, pal, extras)
  const N = frame.contours.length
  frame.contours.forEach(({ lines }, k) => strokeLines(ctx, lines, S, levelAlpha(k, N), pal.ink))
  // Below the ground, dashed: a cut's hollow, and a hand pressing on the field.
  ctx.setLineDash([3, 4])
  frame.hollows.forEach(({ lines }, k) => strokeLines(ctx, lines, S, k === 0 ? 0.3 : 0.45, pal.ink))
  ctx.setLineDash([])
  // A convergence earns a second, concentric hairline around its innermost contour.
  for (const cl of frame.clusters) {
    if (!cl.line) continue
    const xs = cl.line.points.map((p) => p[0])
    const ys = cl.line.points.map((p) => p[1])
    const extent = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * S
    if (extent < 4) continue
    strokeLines(ctx, [concentric(cl.line, cl.c, 1 + 5 / extent)], S, 0.9, pal.ink)
  }
  // Candidates: computed, not decided — dashed, from each member to the group's centre.
  ctx.strokeStyle = pal.ink
  for (const c of frame.candidates) {
    const cx = c.points.reduce((s, p) => s + p[0], 0) / c.points.length
    const cy = c.points.reduce((s, p) => s + p[1], 0) / c.points.length
    ctx.globalAlpha = 0.45
    ctx.setLineDash([3, 5])
    for (const p of c.points) {
      ctx.beginPath()
      ctx.moveTo(p[0] * S, p[1] * S)
      ctx.lineTo(cx * S, cy * S)
      ctx.stroke()
    }
    ctx.setLineDash([])
    ctx.globalAlpha = 0.6
    ctx.beginPath()
    ctx.arc(cx * S, cy * S, 3, 0, Math.PI * 2)
    ctx.stroke()
  }
  // Drains in motion: the path, fading as the mass arrives.
  for (const f of frame.flows) {
    ctx.globalAlpha = 0.5 * (1 - f.k)
    ctx.setLineDash([1, 4])
    ctx.beginPath()
    ctx.moveTo(f.from[0] * S, f.from[1] * S)
    ctx.lineTo(f.to[0] * S, f.to[1] * S)
    ctx.stroke()
    ctx.setLineDash([])
  }
  // Who chose, small, under the lines.
  const mr = Math.max(1.25, Math.min(2.5, S / 220))
  frame.arrived.forEach((ev, k) => {
    if (ev.w === 0) return
    const [x, y] = frame.positions[k]
    ctx.globalAlpha = 0.55 * clamp01(frame.t - ev.i)
    marker(ctx, ev, x * S, y * S, mr, pal.ink)
  })
  // The newest decision's own ring: the present, in the accent when the theme has one.
  if (frame.newest && newestAlpha(frame) > 0) {
    const { q, r } = frame.newest
    ctx.globalAlpha = newestAlpha(frame) * 0.9
    ctx.strokeStyle = pal.accent ?? pal.ink
    ctx.beginPath()
    ctx.arc(q[0] * S, q[1] * S, r * S, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

/* ---------- 3. Field — no lines: a lattice reads the same state ---------- */

export function drawField(ctx: CanvasRenderingContext2D, frame: Frame, size: Size, pal: Palette) {
  const S = scaleOf(size)
  const spacing = Math.max(8, Math.min(14, S / 28))
  const cols = Math.floor(size.w / spacing)
  const rows = Math.floor(size.h / spacing)
  const ox = (size.w - (cols - 1) * spacing) / 2
  const oy = (size.h - (rows - 1) * spacing) / 2
  ctx.fillStyle = pal.ink
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const px = ox + i * spacing
      const py = oy + j * spacing
      const f = sampleGrid(frame.grid, frame.n, frame.nx, px / S, py / S)
      const v = clamp01(f / 1.2)
      const hollow = f < -0.02
      ctx.globalAlpha = hollow ? 0.12 : lerp(0.18, 0.85, v)
      const r = hollow ? 0.5 : lerp(0.55, spacing * 0.3, v)
      ctx.beginPath()
      ctx.arc(px, py, r, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  const mr = Math.max(1.25, Math.min(2.5, S / 220))
  frame.arrived.forEach((ev, k) => {
    if (ev.w === 0) return
    const [x, y] = frame.positions[k]
    ctx.globalAlpha = 0.9 * clamp01(frame.t - ev.i)
    const color = pal.accent && frame.newest?.event === ev ? pal.accent : pal.ink
    marker(ctx, ev, x * S, y * S, mr + 0.5, color)
  })
  ctx.globalAlpha = 1
}

/* ---------- 4. Dot — the whole system at 16px ---------- */

/**
 * The smallest reading: one contour, and a point for the present. This is
 * what a record looks like before anything much is decided, and it is also
 * the favicon, so the icon is not a second drawing.
 */
export function drawDot(ctx: CanvasRenderingContext2D, frame: Frame, size: Size, pal: Palette, extras: Extras = {}) {
  const S = scaleOf(size)
  drawStrata(ctx, frame, S, pal, extras)
  const N = frame.contours.length
  const pick = frame.contours[Math.floor(N / 2)] ?? frame.contours[0]
  if (pick) {
    // A wash inside the outline, so the shape holds together on a tab strip: a rule and a wash, the grammar's own level.
    ctx.fillStyle = pal.ink
    ctx.globalAlpha = WASH_ALPHA
    for (const l of pick.lines) {
      if (!l.closed || l.points.length < 3) continue
      ctx.beginPath()
      ctx.moveTo(l.points[0][0] * S, l.points[0][1] * S)
      for (let i = 1; i < l.points.length; i++) ctx.lineTo(l.points[i][0] * S, l.points[i][1] * S)
      ctx.closePath()
      ctx.fill()
    }
    ctx.lineWidth = outlineWidth(S)
    strokeLines(ctx, pick.lines, S, 0.9, pal.ink)
    ctx.lineWidth = 1
  }
  const c = dotCentre(frame)
  ctx.globalAlpha = pal.accent ? 1 : 0.85
  ctx.fillStyle = pal.accent ?? pal.ink
  ctx.beginPath()
  ctx.arc(c[0] * S, c[1] * S, dotRadius(S), 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
}

export const WASH_ALPHA = 0.14
/** The seed outline: one pixel at icon size, never more than a rule and a half at any size. */
export const outlineWidth = (S: number) => Math.min(1.5, Math.max(1, S / 28))
/** The point for the present: the appearance dot's own proportion at 32px, and never larger than a control's dot. */
export const dotRadius = (S: number) => Math.min(5, Math.max(1.5, S * (3 / 32)))

/** The present: where the newest decision sits, or the centre of the square before anything has arrived. */
export const dotCentre = (frame: Frame): Vec => frame.newest?.q ?? [frame.aspect / 2, 0.5]

/* ---------- SVG — the two projections that ship as files ---------- */

const f2 = (v: number) => (Math.round(v * 100) / 100).toString()

function pathData(line: Polyline, S: number): string {
  const pts = line.points
  if (pts.length < 2) return ''
  let d = `M${f2(pts[0][0] * S)} ${f2(pts[0][1] * S)}`
  for (let i = 1; i < pts.length; i++) d += `L${f2(pts[i][0] * S)} ${f2(pts[i][1] * S)}`
  if (line.closed) d += 'Z'
  return d
}

/**
 * The same frame as an SVG, square, with the ink as a custom property so the
 * file follows the tab strip: the house ground first, the other one flipped bit.
 */
export function svgFrom(frame: Frame, size: number, pal: Palette, opts: { dot: boolean; inks?: { dark: string; light: string; house?: 'dark' | 'light' } }): string {
  const S = size
  const inks = opts.inks ?? { dark: pal.ink, light: pal.ink, house: 'light' as const }
  const house = inks.house ?? 'light'
  const parts: string[] = []
  const path = (line: Polyline, alpha: number, stroke = 'var(--ink)', width = 1) => {
    const d = pathData(line, S)
    if (d) parts.push(`<path d="${d}" fill="none" stroke="${stroke}" stroke-opacity="${f2(alpha)}" stroke-width="${f2(width)}" stroke-linejoin="round" stroke-linecap="round"/>`)
  }
  frame.strata.forEach((s, k) => s.lines.forEach((l) => path(l, stratumAlpha(frame.strata.length - 1 - k))))
  const N = frame.contours.length
  if (opts.dot) {
    const pick = frame.contours[Math.floor(N / 2)] ?? frame.contours[0]
    if (pick) {
      for (const l of pick.lines) {
        if (!l.closed || l.points.length < 3) continue
        parts.push(`<path d="${pathData(l, S)}" fill="var(--ink)" fill-opacity="${f2(WASH_ALPHA)}" stroke="none"/>`)
      }
      for (const l of pick.lines) path(l, 0.9, 'var(--ink)', outlineWidth(S))
    }
  } else {
    frame.contours.forEach(({ lines }, k) => lines.forEach((l) => path(l, levelAlpha(k, N))))
    for (const cl of frame.clusters) {
      if (!cl.line) continue
      const xs = cl.line.points.map((p) => p[0])
      const ys = cl.line.points.map((p) => p[1])
      const extent = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * S
      if (extent >= 4) path(concentric(cl.line, cl.c, 1 + 5 / extent), 0.9)
    }
  }
  if (opts.dot) {
    const c = dotCentre(frame)
    parts.push(`<circle cx="${f2(c[0] * S)}" cy="${f2(c[1] * S)}" r="${f2(dotRadius(S))}" fill="var(--ink)" fill-opacity="0.85"/>`)
  }
  // The house ground first; the other follows the tab strip when it asks.
  const style =
    house === 'light'
      ? `:root{--ink:${inks.light}}@media (prefers-color-scheme:dark){:root{--ink:${inks.dark}}}`
      : `:root{--ink:${inks.dark}}@media (prefers-color-scheme:light){:root{--ink:${inks.light}}}`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}"><style>${style}</style>${parts.join('')}</svg>\n`
}
