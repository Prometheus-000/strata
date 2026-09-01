/**
 * SPATIAL DROP.
 *
 * The designer drags the feature and lets go where it belongs. There is no
 * dropdown, no parent picker, no tree panel and no path field — naming the
 * destination in the structure's own vocabulary is the failure mode this
 * exists to avoid, and a list of slot ids is exactly that list.
 *
 * Slots are visible only during a drag. The rest of the time the view is the
 * design, not a diagram of the design.
 *
 * **Every move is allowed.** A slot that cannot give the feature everything it
 * requires says so while the designer is still reaching for it — marked as they
 * approach, spelled out under the pointer — and then takes the feature anyway.
 * Nothing here refuses. What the cost does is follow the design to the commit,
 * which is the thing that stops.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSlots } from '../runtime/View'
import { costOfDrop, slotCosts, type DropCost } from '../store/store'
import { targetFor, zoneOf } from './zones'
import type { DropTarget } from '../store/store'

const DRAG_THRESHOLD = 4
const INTERACTIVE = 'button, a, input, select, textarea, [role="button"]'

interface Dragging {
  feature: string
  view: string
  state: string
  label: string
  x: number
  y: number
}

interface Hover {
  slot: string
  target: DropTarget
  rect: DOMRect
  /** Where to paint the insertion line, when this is an insertion. */
  edge?: { x: number; y: number; w: number; h: number }
  /** What landing here costs. Shown, never enforced. */
  costs: DropCost[]
}

export function DragSurface() {
  // The surface reads which view and state it is over from the DOM the runtime
  // already rendered, rather than from a session — because it does not own one.
  const { drop, manifest, store } = useSlots()
  const whereRef = useRef<{ view: string; state: string; feature: string } | null>(null)
  const [dragging, setDragging] = useState<Dragging | null>(null)
  const [hover, setHover] = useState<Hover | null>(null)
  const pending = useRef<Dragging | null>(null)
  const hoverRef = useRef<Hover | null>(null)
  hoverRef.current = hover

  const hitTest = useCallback((x: number, y: number, feature: string): Hover | null => {
    const el = document.elementFromPoint(x, y)
    const slotEl = el?.closest<HTMLElement>('[data-slot]')
    if (!slotEl) return null
    const slot = slotEl.getAttribute('data-slot')!
    const rect = slotEl.getBoundingClientRect()

    // An occupant under the pointer — but never the thing being dragged, which
    // is not its own neighbour.
    const featureEl = el?.closest<HTMLElement>('[data-feature]')
    const occupantId = featureEl?.getAttribute('data-feature')
    const occupant =
      featureEl && occupantId && occupantId !== feature
        ? { feature: occupantId, rect: featureEl.getBoundingClientRect() }
        : null

    const target = targetFor(slot, occupant, x, y)
    let edge: Hover['edge']
    if (occupant && target.kind !== 'swap') {
      const r = occupant.rect
      const zone = zoneOf(r, x, y)
      edge =
        zone === 'before'
          ? { x: r.left, y: r.top - 2, w: r.width, h: 3 }
          : { x: r.left, y: r.bottom - 1, w: r.width, h: 3 }
    }
    const where = whereRef.current
    const costs = where ? costOfDrop(manifest, store, where, target) : []
    return { slot, target, rect: occupant?.rect ?? rect, edge, costs }
  }, [manifest, store])

  // The live drag is kept in a ref, not in state. A pointer sequence can be as
  // short as one move — a flick, or a synthetic drag — and a handler that waits
  // for a re-render to learn what it is dragging drops nothing at all.
  const activeRef = useRef<Dragging | null>(null)

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      const target = e.target as HTMLElement
      if (target.closest(INTERACTIVE)) return
      const featureEl = target.closest<HTMLElement>('[data-feature]')
      const viewEl = featureEl?.closest<HTMLElement>('[data-view]')
      if (!featureEl || !viewEl) return
      const feature = featureEl.getAttribute('data-feature')!
      const view = viewEl.getAttribute('data-view')!
      const state = viewEl.getAttribute('data-state') ?? ''

      // Price every slot before anything moves. None of them is closed — the
      // marks say what a landing would cost, so the designer is reaching
      // towards a known price rather than towards a wall.
      const where = { view, state, feature }
      whereRef.current = where
      const costs = slotCosts(manifest, store, where)
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('[data-slot]'))) {
        const inThisView = el.closest<HTMLElement>('[data-view]')?.dataset.view === view
        const n = inThisView ? (costs.get(el.dataset.slot!)?.length ?? 0) : 0
        el.dataset.slotCost = inThisView && n ? String(n) : ''
        el.dataset.slotForeign = String(!inThisView)
      }

      // Reveal the slots on press, not on the first move. Empty slots have no
      // height at rest, so showing them adds space — and adding space while
      // someone is already aiming moves the target out from under the pointer.
      // Pressing is the start of the gesture; the grid opens, then it settles,
      // and only then does anything move.
      document.body.dataset.slotsArmed = 'true'
      pending.current = {
        feature,
        view,
        state,
        label: manifest.features.find((f) => f.id === feature)?.component ?? feature,
        x: e.clientX,
        y: e.clientY,
      }
    }

    const onMove = (e: PointerEvent) => {
      let active = activeRef.current
      if (!active) {
        const start = pending.current
        if (!start) return
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < DRAG_THRESHOLD) return
        active = { ...start, x: e.clientX, y: e.clientY }
        activeRef.current = active
        document.body.dataset.slotsDragging = 'true'
      }
      e.preventDefault()
      // Hit-test on the same event that started the drag, so a one-move drag
      // still lands somewhere.
      setDragging({ ...active, x: e.clientX, y: e.clientY })
      setHover(hitTest(e.clientX, e.clientY, active.feature))
    }

    const onUp = () => {
      const active = activeRef.current
      const landed = hoverRef.current
      pending.current = null
      activeRef.current = null
      whereRef.current = null
      delete document.body.dataset.slotsArmed
      delete document.body.dataset.slotsDragging
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('[data-slot]'))) {
        delete el.dataset.slotCost
        delete el.dataset.slotForeign
      }
      setDragging(null)
      setHover(null)
      if (!active || !landed) return
      const result = drop(active.view, active.state, active.feature, landed.target)
      if (result.refused) setRefusal(result.refused)
    }

    const onCancel = () => {
      pending.current = null
      activeRef.current = null
      whereRef.current = null
      delete document.body.dataset.slotsArmed
      delete document.body.dataset.slotsDragging
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('[data-slot]'))) {
        delete el.dataset.slotCost
        delete el.dataset.slotForeign
      }
      setDragging(null)
      setHover(null)
    }

    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
  }, [drop, hitTest, manifest, store])

  const [refusal, setRefusal] = useState<string | null>(null)
  useEffect(() => {
    if (!refusal) return
    const t = setTimeout(() => setRefusal(null), 3200)
    return () => clearTimeout(t)
  }, [refusal])

  return (
    <>
      {dragging && (
        <div className="drag" aria-hidden>
          {hover && (
            <div
              className={`drag__slot ${hover.target.kind === 'swap' ? 'is-swap' : ''} ${
                hover.costs.length ? 'has-cost' : ''
              }`}
              style={{
                left: hover.rect.left,
                top: hover.rect.top,
                width: hover.rect.width,
                height: hover.rect.height,
              }}
            >
              <span className={`drag__verb ${hover.costs.length ? 'has-cost' : ''}`}>
                {hover.target.kind === 'swap' ? 'swap' : hover.target.kind === 'append' ? 'place' : 'insert'}
              </span>
              {hover.costs.length > 0 && (
                <ul className="drag__costs">
                  {hover.costs.map((c) => (
                    <li key={`${c.feature}:${c.requirement}`}>
                      <b>{c.requirement}</b> {c.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {hover?.edge && (
            <div
              className="drag__edge"
              style={{
                left: hover.edge.x,
                top: hover.edge.y,
                width: hover.edge.w,
                height: hover.edge.h,
              }}
            />
          )}
          <div className="drag__ghost" style={{ left: dragging.x, top: dragging.y }}>
            {dragging.label}
          </div>
        </div>
      )}
      {refusal && <p className="drag__refusal" role="status">{refusal}</p>}
    </>
  )
}
