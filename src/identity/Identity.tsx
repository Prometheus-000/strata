/**
 * One canvas, one projection of the shared state. It measures itself, keeps a
 * DPR-correct backing store, computes its own frame for its own aspect, and
 * redraws synchronously whenever the frame or the palette changes. Time,
 * playback and the pointer's easing live in the page; this component has no
 * timers of its own.
 *
 * The pointer is reported in unit coordinates so every station can bend to
 * the same presence, and a click is reported the same way so the page can
 * append the one thing that is remembered.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { frameAt, toUnit, toWorld, type FieldOptions, type IdentityState, type Presence, type Vec } from '@strata/identity/field'
import { draw, type Palette, type Projection } from '@strata/identity/render'
import type { Seeds } from '@strata/identity/field'

export interface IdentityProps {
  projection: Projection
  state: IdentityState
  t: number
  /** Everything but `n`, `aspect` and `presence`, which this component supplies. */
  opts: Omit<FieldOptions, 'n' | 'aspect' | 'presence'>
  palette: Palette
  /** The theme each stratum closed under, as a palette; the live palette is used where a stratum has no seeds. */
  paletteFor?: (seeds: Seeds) => Palette
  /** The pointer in unit coordinates, and how hard it presses. */
  presence?: { p: Vec; w: number } | null
  /** Cells per world unit; defaults from the rendered height. */
  n?: number
  label: string
  className?: string
  /** Magnify about the centre of the square: a one-decision record is small at its true scale. */
  zoom?: number
  onPointer?: (p: Vec | null) => void
  onPick?: (p: Vec) => void
}

const cellsFor = (h: number) => Math.max(48, Math.min(160, Math.round(h / 6)))

export function Identity({ projection, state, t, opts, palette, presence, n, label, className, zoom = 1, onPointer, onPick }: IdentityProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize((s) => (s.w === Math.round(width) && s.h === Math.round(height) ? s : { w: Math.round(width), h: Math.round(height) }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const aspect = size.h > 0 ? size.w / size.h : 1
  const fieldPresence: Presence | undefined = presence && presence.w > 0 ? { p: toWorld(presence.p, aspect), w: presence.w } : undefined
  const frame = useMemo(
    () => frameAt(state, t, { ...opts, n: n ?? cellsFor(size.h || 240), aspect, presence: fieldPresence }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, t, opts.energy, opts.density, opts.levels, opts.breath, aspect, size.h, n, fieldPresence?.p[0], fieldPresence?.p[1], fieldPresence?.w],
  )

  useLayoutEffect(() => {
    const el = canvas.current
    if (!el || size.w === 0 || size.h === 0) return
    const dpr = Math.min(3, window.devicePixelRatio || 1)
    if (el.width !== Math.round(size.w * dpr) || el.height !== Math.round(size.h * dpr)) {
      el.width = Math.round(size.w * dpr)
      el.height = Math.round(size.h * dpr)
    }
    const ctx = el.getContext('2d')
    if (!ctx) return
    const ox = (size.w * (zoom - 1)) / 2
    const oy = (size.h * (zoom - 1)) / 2
    ctx.setTransform(dpr, 0, 0, dpr, -ox * dpr, -oy * dpr)
    draw(ctx, projection, frame, { w: size.w * zoom, h: size.h * zoom }, palette)
  }, [frame, palette, projection, size, zoom])

  const unitAt = (e: React.PointerEvent<HTMLCanvasElement>): Vec => {
    const r = e.currentTarget.getBoundingClientRect()
    const world: Vec = [(e.clientX - r.left) / r.height, (e.clientY - r.top) / r.height]
    return toUnit(world, aspect)
  }

  const receipt = frame.newest?.event.receipt
  const name = receipt ? `${label}: ${frame.arrived.length} of ${frame.total} decisions; latest ${receipt.kind} on ${receipt.target}, decided by ${receipt.hand}` : `${label}: nothing decided yet`

  return (
    <canvas
      ref={canvas}
      className={className}
      role="img"
      aria-label={name}
      onPointerMove={onPointer ? (e) => onPointer(unitAt(e)) : undefined}
      onPointerLeave={onPointer ? () => onPointer(null) : undefined}
      onClick={onPick ? (e) => onPick(unitAt(e as unknown as React.PointerEvent<HTMLCanvasElement>)) : undefined}
      style={onPick ? { cursor: 'crosshair' } : undefined}
    />
  )
}

/** The same query the engine reads in `applyTheme`, watched. */
export function useReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)'
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(query).matches === true)
  useEffect(() => {
    const mq = window.matchMedia?.(query)
    if (!mq) return
    const on = () => setReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}
