/**
 * THE DIAGRAMS, PROJECTED.
 *
 * The three pictures the README and `docs/architecture.md` carry were ASCII,
 * which an agent reads and a designer does not.
 *
 * They are drawn here rather than by hand for the reason every other artifact
 * here is: two files that must agree — a light one and a dark one — are two
 * authors of the same geometry, and the second one drifts. One source, two
 * appearances, `npm run diagrams` writes both.
 *
 * The palette is the semantic tier resolved to sRGB, because an `<img>` on
 * GitHub inherits no custom properties. When the seeds move, these are stale
 * until this is run again — which is what `strata check` reports and what
 * `public/hero-*.svg` does too.
 */
import fs from 'node:fs'
import path from 'node:path'

const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'public')

/** The semantic tier at the seeds in force, as sRGB. Lines, never shadows. */
const THEME = {
  light: { page: '#f6fbfc', sunken: '#ebf2f2', raised: '#fbfefe', ink: '#172122', muted: '#4c5858', faint: '#636d6d', rule: '#172122' },
  dark:  { page: '#010101', sunken: '#000000', raised: '#0a0e0e', ink: '#e5eded', muted: '#9ca7a7', faint: '#737d7d', rule: '#e5eded' },
}

const SANS = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Inter, system-ui, sans-serif"
const MONO = "ui-monospace, 'SF Mono', 'Roboto Mono', Menlo, Consolas, monospace"
const R_SURFACE = 12   // --radius-surface at the density in force
const R_INTERACTIVE = 8

/* ---- marks ------------------------------------------------------------- */

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** A label: the type is one family, and hierarchy is weight and size. */
const label = (x, y, s, { size = 14, weight = 500, fill = 'ink', anchor = 'middle', mono = false, tracking = 0, opacity = 1 } = {}, t) =>
  `<text x="${x}" y="${y}" font-family="${mono ? MONO : SANS}" font-size="${size}" font-weight="${weight}" fill="${t[fill]}"` +
  `${opacity < 1 ? ` fill-opacity="${opacity}"` : ''} text-anchor="${anchor}"` +
  `${tracking ? ` letter-spacing="${tracking}"` : ''}>${esc(s)}</text>`

/** A kicker: mono, faint, tracked — a key, never the accent. */
/** An estimate wide enough to lay out by: the stack is one family everywhere. */
const w = (s, size, mono = false) => s.length * size * (mono ? 0.6 : 0.53)

const kicker = (x, y, s, opts, t) => label(x, y, s.toUpperCase(), { size: 10, weight: 500, fill: 'faint', mono: true, tracking: 1.2, ...opts }, t)

/** A panel: a 1px rule and an alpha wash, and no drop shadow anywhere. */
const panel = (x, y, w, h, t, { r = R_SURFACE, fill = 'raised', stroke = 0.16 } = {}) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${t[fill]}" stroke="${t.rule}" stroke-opacity="${stroke}" stroke-width="1"/>`

const line = (x1, y1, x2, y2, t, o = 0.3) =>
  `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${t.rule}" stroke-opacity="${o}" stroke-width="1" fill="none"/>`

/** A flow arrow. The head is drawn, not a marker, so one file carries no defs. */
const arrow = (x1, y1, x2, y2, t, o = 0.34) => {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1
  const ux = dx / len, uy = dy / len, px = -uy, py = ux, H = 6, W = 3.4
  const tipX = x2, tipY = y2, bx = x2 - ux * H, by = y2 - uy * H
  return `<path d="M${x1} ${y1}L${bx} ${by}" stroke="${t.rule}" stroke-opacity="${o}" stroke-width="1" fill="none"/>` +
    `<path d="M${tipX} ${tipY}L${(bx + px * W).toFixed(2)} ${(by + py * W).toFixed(2)}L${(bx - px * W).toFixed(2)} ${(by - py * W).toFixed(2)}Z" fill="${t.rule}" fill-opacity="${o + 0.18}"/>`
}

const svg = (w, h, t, body, title) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(title)}">\n` +
  `<rect width="${w}" height="${h}" fill="${t.page}"/>\n${body}\n</svg>\n`

/* ---- 1. the loop ------------------------------------------------------- */

/** Rows inside a panel: a name in the one family, its file in mono, because
 *  a path is data and data is the only thing that gets a second face. */
const rows = (x, y, w, items, t, gap = 22) => items.map(([name, file], i) =>
  label(x + 20, y + 20 + i * gap, name, { anchor: 'start', size: 13, weight: 450, fill: 'ink' }, t) +
  (file ? label(x + w - 20, y + 20 + i * gap, file, { anchor: 'end', size: 11, weight: 400, fill: 'faint', mono: true }, t) : '')
).join('\n')

function loop(t) {
  const W = 880, CX = 470, PX = 190, PW = 560
  const o = []
  o.push(kicker(CX, 30, 'human intent', {}, t))
  o.push(arrow(CX, 44, CX, 68, t))

  // the substrate
  o.push(panel(PX, 70, PW, 178, t))
  o.push(kicker(PX + 20, 94, 'decision substrate', { anchor: 'start', fill: 'muted' }, t))
  o.push(line(PX + 20, 106, PX + PW - 20, 106, t, 0.12))
  o.push(rows(PX, 100, PW, [
    ['decisions', '.strata/decisions.jsonl'],
    ['context', 'history · current · pending'],
    ['grammar', 'grammar/rules.json'],
    ['provenance', 'decided · written · at · via'],
    ['precedent', 'strata precedent'],
    ['evidence', 'strata explain · strata check'],
  ], t))
  o.push(arrow(CX, 248, CX, 276, t))

  // the hands
  const ax = [250, 470, 690]
  o.push(line(ax[0], 276, ax[2], 276, t, 0.22))
  ax.forEach((x) => o.push(line(x, 276, x, 286, t, 0.22)))
  ax.forEach((x, i) => {
    o.push(panel(x - 86, 286, 172, 52, t, { r: R_INTERACTIVE, fill: 'sunken', stroke: 0.14 }))
    o.push(label(x, 307, ['Agent', 'Agent', 'Agent'][i] + ' ' + 'ABC'[i], { size: 13, weight: 500 }, t))
    o.push(kicker(x, 324, ['generate', 'evaluate', 'explore'][i], {}, t))
  })
  ax.forEach((x) => o.push(line(x, 338, x, 350, t, 0.22)))
  o.push(line(ax[0], 350, ax[2], 350, t, 0.22))
  o.push(arrow(CX, 352, CX, 374, t))

  // the door
  o.push(kicker(CX, 392, 'decisions', { size: 11, fill: 'ink' }, t))
  o.push(label(CX, 410, 'decide(request, { decided, written, via })', { size: 11.5, mono: true, fill: 'muted' }, t))
  o.push(arrow(CX, 420, CX, 446, t))

  // the projections
  o.push(panel(PX, 448, PW, 156, t))
  o.push(kicker(PX + 20, 472, 'projections', { anchor: 'start', fill: 'muted' }, t))
  o.push(line(PX + 20, 484, PX + PW - 20, 484, t, 0.12))
  o.push(rows(PX, 478, PW, [
    ['React', 'src/theme/ThemeContext.tsx'],
    ['CSS', 'src/tokens/semantic.css'],
    ['tokens.json', 'src/tokens/tokens.json'],
    ['the override store', '.malleable/overrides.json'],
    ['the JSX itself', 'a move is a diff'],
  ], t))
  o.push(arrow(CX, 604, CX, 630, t))

  // use, and what it returns
  o.push(kicker(CX, 638, 'real use', {}, t))
  o.push(arrow(CX, 648, CX, 672, t))
  o.push(kicker(CX, 680, 'observations', {}, t))
  o.push(label(CX, 698, 'consumers · contrast · convergence', { size: 11.5, mono: true, fill: 'faint' }, t))
  o.push(arrow(CX, 708, CX, 732, t))
  o.push(panel(PX + 90, 734, PW - 180, 48, t, { r: R_INTERACTIVE, fill: 'sunken', stroke: 0.14 }))
  o.push(label(CX, 755, '37 instances · 3 hands · converged on 12px', { size: 12, mono: true, fill: 'ink' }, t))
  o.push(kicker(CX, 771, 'precedent', {}, t))

  // the return: the loop made visible
  const rx = 104, ax2 = rx - 44
  o.push(`<path d="M${PX + 90} 758L${rx} 758Q${ax2} 758 ${ax2} 714L${ax2} 203Q${ax2} 159 ${rx} 159L${PX - 8} 159" stroke="${t.rule}" stroke-opacity="0.26" stroke-width="1" fill="none" stroke-dasharray="3 4"/>`)
  o.push(arrow(PX - 15, 159, PX - 1, 159, t, 0.3))
  o.push(`<g transform="translate(${ax2 - 9} 458) rotate(-90)">${kicker(0, 0, 'back to the record', { size: 9.5 }, t)}</g>`)

  return svg(W, 812, t, o.join('\n'), 'The loop: intent becomes a decision, a decision becomes every projection, and use becomes precedent')
}

/* ---- 2. report, don't police ------------------------------------------- */

function authority(t) {
  const W = 880, H = 250, o = []
  const LX = 60, LW = 280, RX = 420, RW = 400
  o.push(panel(LX, 40, LW, 150, t, { fill: 'sunken' }))
  o.push(kicker(LX + 24, 70, 'invariant', { anchor: 'start', fill: 'ink', size: 11 }, t))
  o.push(label(LX + 24, 96, 'enforce', { anchor: 'start', size: 20, weight: 500 }, t))
  o.push(label(LX + 24, 122, 'The only class a build fails on.', { anchor: 'start', size: 12, weight: 400, fill: 'muted' }, t))
  o.push(label(LX + 24, 140, 'A mechanical truth about the artifact,', { anchor: 'start', size: 12, weight: 400, fill: 'faint' }, t))
  o.push(label(LX + 24, 157, 'never a design judgement.', { anchor: 'start', size: 12, weight: 400, fill: 'faint' }, t))
  o.push(label(LX + 24, 176, '4 of 36 rules', { anchor: 'start', size: 11, mono: true, fill: 'faint' }, t))

  // the divide
  o.push(`<path d="M${(LX + LW + RX) / 2} 34L${(LX + LW + RX) / 2} 196" stroke="${t.rule}" stroke-opacity="0.18" stroke-width="1" stroke-dasharray="2 5"/>`)

  o.push(panel(RX, 40, RW, 150, t))
  o.push(kicker(RX + 24, 70, 'everything else', { anchor: 'start', fill: 'muted', size: 11 }, t))
  const steps = ['observe', 'record', 'evaluate', 'learn / promote']
  let sx = RX + 24
  steps.forEach((s, i) => {
    o.push(label(sx, 104, s, { size: 13, weight: 500, anchor: 'start' }, t))
    sx += w(s, 13)
    if (i < steps.length - 1) { o.push(arrow(sx + 8, 100, sx + 26, 100, t, 0.3)); sx += 34 }
  })
  o.push(label(RX + 24, 136, 'A design that is different is reported, never refused.', { anchor: 'start', size: 12, weight: 400, fill: 'muted' }, t))
  o.push(label(RX + 24, 157, 'Nothing runs while someone is designing.', { anchor: 'start', size: 12, weight: 400, fill: 'faint' }, t))
  o.push(label(RX + 24, 176, '32 of 36 rules', { anchor: 'start', size: 11, mono: true, fill: 'faint' }, t))

  o.push(label(W / 2, 224, 'Report, don’t police.', { size: 13, weight: 500, fill: 'muted' }, t))
  return svg(W, H, t, o.join('\n'), 'Report, don’t police: invariants are enforced, everything else is observed, recorded, evaluated and learned from')
}

/* ---- 3. the arrangement ------------------------------------------------ */

function architecture(t) {
  const W = 880, H = 300, CX = 440, o = []
  const tier = (y, title, items, h = 46) => {
    const w = 660, x = CX - w / 2
    o.push(panel(x, y, w, h, t, { r: R_INTERACTIVE, fill: 'sunken', stroke: 0.14 }))
    o.push(kicker(x + 20, y + 20, title, { anchor: 'start', fill: 'muted' }, t))
    const span = w - 40
    items.forEach((s, i) => o.push(label(x + 20 + (span / items.length) * (i + 0.5), y + 34, s, { size: 13, weight: 450 }, t)))
  }
  tier(30, 'the record', ['Context', 'Decisions', 'Evidence'])
  o.push(arrow(CX, 76, CX, 104, t))
  tier(106, 'the hands', ['human', 'agent', 'overlay', 'mcp'])
  o.push(arrow(CX, 152, CX, 180, t))
  tier(182, 'projections', ['Code', 'Figma', 'Runtime'])
  o.push(label(CX, 262, 'Everything below the record is derived from it, and can be produced again.', { size: 12, weight: 400, fill: 'faint' }, t))
  return svg(W, H, t, o.join('\n'), 'The arrangement: one record, every hand through one door, and projections derived from it')
}

/* ---- write ------------------------------------------------------------- */

const DIAGRAMS = { 'diagram-loop': loop, 'diagram-authority': authority, 'diagram-architecture': architecture }
for (const [name, draw] of Object.entries(DIAGRAMS)) {
  for (const [appearance, t] of Object.entries(THEME)) {
    const file = path.join(OUT, `${name}-${appearance}.svg`)
    fs.writeFileSync(file, draw(t))
    console.log(`${path.relative(process.cwd(), file)}  ${fs.statSync(file).size} bytes`)
  }
}
