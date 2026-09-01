/**
 * INSTANCE IDENTITY — which rendered copy of a source node this is.
 *
 * The codemod can only name the node in the source. Six cards rendered from one
 * `<Card>` share that name, so addressing one of them needs a second component,
 * and there are only two honest ways to get it:
 *
 *   1. the app supplies a key (`data-mkey`, usually the same id already used as
 *      React's `key`) — stable across reorder, filter and re-render;
 *   2. failing that, the node's ordinal among its same-`data-sid` siblings in
 *      the view — free, requires nothing of the app, and breaks under reorder.
 *
 * Preferring the key and falling back to the ordinal is the whole policy. What
 * is not on offer is pretending the ordinal is stable: a store written against
 * ordinals is a store that silently reattaches to the wrong card, and that is
 * the failure this layer cannot survive.
 */

export const VIEW_ATTR = 'data-view'
export const SID_ATTR = 'data-sid'
export const KEY_ATTR = 'data-mkey'
export const INSTANCE_ATTR = 'data-mi'

export interface StampReport {
  stamped: number
  /** Nodes that fell back to an ordinal because the app supplied no key. */
  ordinalFallbacks: string[]
}

/** Write `data-mi` on every identified node under `root`. Idempotent. */
export function stampInstances(root: ParentNode): StampReport {
  const report: StampReport = { stamped: 0, ordinalFallbacks: [] }
  const counters = new Map<string, number>()

  for (const el of Array.from(root.querySelectorAll<HTMLElement>(`[${SID_ATTR}]`))) {
    const sid = el.getAttribute(SID_ATTR)!
    const view = el.closest<HTMLElement>(`[${VIEW_ATTR}]`)?.getAttribute(VIEW_ATTR) ?? ''
    const key = el.getAttribute(KEY_ATTR)
    let path: string
    if (key) {
      path = key
    } else {
      const counterKey = `${view}::${sid}`
      const n = counters.get(counterKey) ?? 0
      counters.set(counterKey, n + 1)
      path = String(n)
      if (!report.ordinalFallbacks.includes(sid)) report.ordinalFallbacks.push(sid)
    }
    if (el.getAttribute(INSTANCE_ATTR) !== path) el.setAttribute(INSTANCE_ATTR, path)
    report.stamped++
  }
  return report
}

/** The address of a live element, or null when it carries no identity. */
export function addressOfElement(
  el: Element | null,
): { nodeId: string; viewId: string; instancePath: string } | null {
  const node = el?.closest<HTMLElement>(`[${SID_ATTR}]`)
  if (!node) return null
  return {
    nodeId: node.getAttribute(SID_ATTR)!,
    viewId: node.closest<HTMLElement>(`[${VIEW_ATTR}]`)?.getAttribute(VIEW_ATTR) ?? '',
    instancePath: node.getAttribute(INSTANCE_ATTR) ?? '',
  }
}
