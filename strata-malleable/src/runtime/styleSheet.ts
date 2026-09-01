/**
 * Store + manifest → CSS. One function, used by the dev runtime and by ship,
 * so what a designer sees while dragging and what the build emits cannot
 * disagree. If these were two code paths they would diverge, and the divergence
 * would be discovered in production.
 *
 * Specificity is arranged to match precedence rather than fight it:
 *   component  [data-sid]                        (0,1,0)
 *   view       [data-view] [data-sid]            (0,2,0)
 *   instance   [data-view] [data-mi][data-sid]   (0,3,0)
 * Ascending, so narrower scopes win without a single `!important`.
 */
import { PROPERTIES } from '../resolve/properties'
import { evaluate, effectiveSeeds, tokenTable } from '../resolve/resolve'
import type { Manifest, Override, Store } from '../schema'
import { SCOPES } from '../schema'

const esc = (s: string) => s.replace(/["\\]/g, '\\$&')

export function selectorText(o: Override): string | null {
  const { scope, selector } = o.target
  if (scope === 'system') return null
  if (scope === 'component') return `[data-sid="${esc(selector)}"]`
  const [left, nodeId] = selector.split('::')
  if (scope === 'view') return `[data-view="${esc(left)}"] [data-sid="${esc(nodeId)}"]`
  const slash = left.indexOf('/')
  const viewId = left.slice(0, slash)
  const instancePath = left.slice(slash + 1)
  return `[data-view="${esc(viewId)}"] [data-mi="${esc(instancePath)}"][data-sid="${esc(nodeId)}"]`
}

export interface CompiledRule {
  selector: string
  decls: string[]
  override: Override
}

export function compileRules(store: Store, _manifest: Manifest): CompiledRule[] {
  const table = tokenTable(effectiveSeeds(store.seeds, store.overrides))
  return store.overrides
    .filter((o) => o.target.scope !== 'system')
    .slice()
    .sort(
      (a, b) =>
        SCOPES.indexOf(a.target.scope) - SCOPES.indexOf(b.target.scope) ||
        a.target.selector.localeCompare(b.target.selector),
    )
    .reverse() // widest first: component, then view, then instance
    .flatMap((o) => {
      const selector = selectorText(o)
      const spec = PROPERTIES[o.property]
      if (!selector || !spec) return []
      const { css } = evaluate(o.value, table)
      return [{ selector, decls: spec.css.map((p) => `${p}: ${css};`), override: o }]
    })
}

export function compileStyleSheet(store: Store, manifest: Manifest): string {
  const rules = compileRules(store, manifest)
  if (!rules.length) return ''
  return rules
    .map((r) => `${r.selector} {\n  ${r.decls.join('\n  ')}\n}`)
    .join('\n')
}
