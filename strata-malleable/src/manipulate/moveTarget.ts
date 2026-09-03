/**
 * The DOM side of a move: which region is under the pointer, which container
 * and neighbour a drop would land beside. Pure over DOM APIs; nothing here
 * writes, and nothing here knows what a move costs — there is no such thing.
 *
 * A region is addressed the way the structure addresses it: (container sid,
 * component name, ordinal among same-name siblings in that container), read
 * off the live DOM at the moment of the gesture and resolved against a fresh
 * source scan when the drop is written. Nothing persists an ordinal.
 */
import type { Container, RegionChild, Structure } from '../schema'
import { axisOf, edgeOf, type Axis } from '../drop/zones'

export const REGION_ATTR = 'data-region'
const SID_ATTR = 'data-sid'

export interface Thing {
  element: HTMLElement
  container: Container
  containerEl: HTMLElement
  child: RegionChild
  ordinal: number
}

export interface Drop {
  container: Container
  containerEl: HTMLElement
  /** The neighbour the pointer is beside, or none when the drop lands at the end. */
  anchor: { child: RegionChild; element: HTMLElement; edge: 'before' | 'after' } | null
  axis: Axis
  /** Where to draw the insertion line, in viewport pixels. */
  line: { left: number; top: number; width: number; height: number }
}

const containerBySid = (s: Structure, sid: string) => s.containers.find((c) => c.sid === sid)

/** The nearest ancestor (or self) that is a structure container. */
function containerAbove(el: Element | null, s: Structure): { container: Container; element: HTMLElement } | null {
  let node = el?.closest<HTMLElement>(`[${SID_ATTR}]`) ?? null
  while (node) {
    const c = containerBySid(s, node.getAttribute(SID_ATTR)!)
    if (c) return { container: c, element: node }
    node = node.parentElement?.closest<HTMLElement>(`[${SID_ATTR}]`) ?? null
  }
  return null
}

/** The DOM elements that are this container's region children, in DOM order, with their structure entries. */
function regionElements(containerEl: HTMLElement, container: Container, s: Structure): Array<{ child: RegionChild; element: HTMLElement }> {
  const out: Array<{ child: RegionChild; element: HTMLElement }> = []
  const seen = new Map<string, number>()
  for (const el of Array.from(containerEl.querySelectorAll<HTMLElement>(`[${REGION_ATTR}]`))) {
    const name = el.getAttribute(REGION_ATTR)!
    // Only elements whose nearest container is this one — not regions inside a nested container.
    if (containerAbove(el.parentElement, s)?.element !== containerEl) continue
    const n = seen.get(name) ?? 0
    seen.set(name, n + 1)
    const child = container.children.find((k) => k.kind === 'component' && k.component === name && k.ordinal === n)
    if (child) out.push({ child, element: el })
  }
  return out
}

/** The region under a pointer: the nearest data-region ancestor that its container knows as a child. */
export function thingUnder(el: Element | null, s: Structure): Thing | null {
  let node = el?.closest<HTMLElement>(`[${REGION_ATTR}]`) ?? null
  while (node) {
    const above = containerAbove(node.parentElement, s)
    if (above) {
      const hit = regionElements(above.element, above.container, s).find((r) => r.element === node)
      if (hit) return { element: node, container: above.container, containerEl: above.element, child: hit.child, ordinal: hit.child.ordinal }
    }
    node = node.parentElement?.closest<HTMLElement>(`[${REGION_ATTR}]`) ?? null
  }
  return null
}

/** Where a drop at (x, y) would land, for `thing`. Null when the pointer is over nothing that can take it. */
export function dropUnder(x: number, y: number, thing: Thing, s: Structure): Drop | null {
  let el: Element | null = document.elementFromPoint(x, y)
  if (el?.closest('[data-malleable-chrome]')) return null
  // The container under the pointer, skipping any inside the thing itself.
  let found = containerAbove(el, s)
  while (found && (thing.element === found.element || thing.element.contains(found.element)))
    found = containerAbove(found.element.parentElement, s)
  if (!found) return null
  const { container, element: containerEl } = found

  const siblings = regionElements(containerEl, container, s).filter((r) => r.element !== thing.element)
  const rects = siblings.map((r) => r.element.getBoundingClientRect())
  const axis = axisOf(rects[0] ?? null, rects[1] ?? null)
  const crect = containerEl.getBoundingClientRect()

  if (!siblings.length) {
    return {
      container,
      containerEl,
      anchor: null,
      axis,
      line:
        axis === 'vertical'
          ? { left: crect.left + 8, top: crect.bottom - 6, width: Math.max(0, crect.width - 16), height: 2 }
          : { left: crect.right - 6, top: crect.top + 8, width: 2, height: Math.max(0, crect.height - 16) },
    }
  }

  // The nearest neighbour along the axis.
  let best = 0
  let bestDist = Infinity
  rects.forEach((r, i) => {
    const d = axis === 'vertical' ? Math.abs(y - (r.top + r.height / 2)) : Math.abs(x - (r.left + r.width / 2))
    if (d < bestDist) {
      bestDist = d
      best = i
    }
  })
  const r = rects[best]
  const edge = edgeOf(r, x, y, axis)
  const line =
    axis === 'vertical'
      ? { left: r.left, top: (edge === 'before' ? r.top : r.bottom) - 1, width: r.width, height: 2 }
      : { left: (edge === 'before' ? r.left : r.right) - 1, top: r.top, width: 2, height: r.height }
  return { container, containerEl, anchor: { child: siblings[best].child, element: siblings[best].element, edge }, axis, line }
}

/** True when the drop describes where the thing already is. */
export function isNoop(thing: Thing, drop: Drop): boolean {
  if (drop.container.sid !== thing.container.sid) return false
  const kids = thing.container.children
  const i = kids.indexOf(thing.child)
  if (!drop.anchor) return i === kids.length - 1
  const j = kids.indexOf(drop.anchor.child)
  return drop.anchor.edge === 'before' ? j === i + 1 : j === i - 1
}

/* ---------------- component instances, for prop controls ---------------- */

export interface Instance {
  /** The instance's root element — the one carrying data-region. */
  element: HTMLElement
  component: string
  /**
   * The component instances above it, nearest first. The call site is in one
   * of their files — usually the nearest, but a `<Button>` passed to a Card as
   * its footer renders inside the Card and is written in the Gallery — so the
   * chain is offered and the server takes the first that has the call site.
   */
  chain: Array<{ element: HTMLElement; component: string; ordinal: number }>
}

/** The component instance an element belongs to, and the instances it could have been called from. */
export function instanceUnder(el: Element | null): Instance | null {
  const self = el?.closest<HTMLElement>(`[${REGION_ATTR}]`) ?? null
  if (!self) return null
  const component = self.getAttribute(REGION_ATTR)!
  const chain: Instance['chain'] = []
  let up = self.parentElement?.closest<HTMLElement>(`[${REGION_ATTR}]`) ?? null
  while (up) {
    const all = Array.from(up.querySelectorAll<HTMLElement>(`[${REGION_ATTR}="${component}"]`))
    chain.push({ element: up, component: up.getAttribute(REGION_ATTR)!, ordinal: Math.max(0, all.indexOf(self)) })
    up = up.parentElement?.closest<HTMLElement>(`[${REGION_ATTR}]`) ?? null
  }
  if (!chain.length) return null
  return { element: self, component, chain }
}
