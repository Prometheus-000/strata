/**
 * Selector construction, in one place, because a resolver and a store that
 * disagree about what an override addresses is the whole bug class this repo
 * exists to avoid.
 */
import type { NodeAddress, Scope } from '../schema'

export function selectorFor(scope: Scope, address: NodeAddress, seed?: string): string {
  switch (scope) {
    case 'instance':
      return `${address.viewId}/${address.instancePath}::${address.nodeId}`
    case 'view':
      return `${address.viewId}::${address.nodeId}`
    case 'component':
      return address.nodeId
    case 'system':
      // System scope does not address a node at all. It addresses a seed.
      return seed ?? ''
  }
}

/** True when `override.target` addresses this node at that scope. */
export function matches(scope: Scope, selector: string, address: NodeAddress): boolean {
  if (scope === 'system') return true // seeds reach every node
  return selector === selectorFor(scope, address)
}
