/**
 * The runtime — the library's rendering surface, and nothing else.
 *
 * `<View>` renders the grammar (bands, columns, slots) and asks the resolver
 * where each feature goes. It decides nothing itself; if the rendered layout and
 * `slots layout` in the terminal ever disagree, one of them is not calling
 * `layout()`, and it is not this file.
 *
 * `<Feature>` never renders. It is a declaration `<View>` reads as data: its
 * props say what the feature is, where source puts it, which states include it,
 * and what it requires. Its children are the region itself. That is what lets a
 * feature be re-placed without being re-parented in source — the source order of
 * these elements is a default, not a layout.
 *
 * ---
 *
 * **What this provider does not do**, on purpose:
 *
 * It does not persist. It does not own a session — which view and which state
 * someone is looking at is not its business. It does not schedule, batch, or
 * decide when anything is written. And it does not gate: an open item is a
 * fact it computes and hands over, not a permission it withholds.
 *
 * All of that belongs to the host. The library holds assignments and open items
 * and exposes them; `onChange` is where a host picks them up and does whatever
 * its own policy says. `src/harness` is one such host, and its choices there are
 * examples rather than the library's opinion.
 */
import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { layout as resolveLayout, viewOf } from '../resolve/resolve'
import type {
  FeatureId,
  Manifest,
  OpenItem,
  Requirement,
  SlotId,
  StateId,
  Store,
  ViewId,
} from '../schema'
import {
  accept as acceptOp,
  drop as dropOp,
  emptyStore,
  storeFromSource,
  unaccept as unacceptOp,
  type DropResult,
  type DropTarget,
} from '../store/store'
import type { FeatureProps, ViewProps } from './contract'

export type { FeatureProps, ViewProps }

/* ---------------- the library surface ---------------- */

export interface SlotsApi {
  manifest: Manifest
  store: Store
  /**
   * Every behavioural cost the current arrangement carries, across every view
   * and state. Computed, never stored — so it cannot drift from the design it
   * describes. What a host does with one is the host's decision.
   */
  openItems: OpenItem[]
  drop: (view: ViewId, state: StateId, feature: FeatureId, target: DropTarget) => DropResult
  accept: (view: ViewId, state: StateId, feature: FeatureId, requirement: Requirement) => void
  unaccept: (view: ViewId, state: StateId, feature: FeatureId, requirement: Requirement) => void
  /** Back to what source says. */
  reset: () => void
  /** Replace the store wholesale — how a host restores a session it saved. */
  load: (store: Store) => void
}

const Ctx = createContext<SlotsApi | null>(null)
export const useSlots = () => {
  const api = useContext(Ctx)
  if (!api) throw new Error('useSlots outside SlotsProvider')
  return api
}

export function SlotsProvider({
  manifest,
  children,
  author = 'human',
  initialStore,
  onChange,
}: {
  manifest: Manifest
  children: ReactNode
  author?: 'human' | 'agent'
  /** Where the host restores from. Defaults to what source says. */
  initialStore?: Store
  /**
   * Called after every change, with the new store and the open items it now
   * carries. This is the whole extension point: persist here, batch here,
   * write through here, refuse to ship here — or do none of it.
   */
  onChange?: (store: Store, openItems: OpenItem[]) => void
}) {
  const [store, setStore] = useState<Store>(
    () => initialStore ?? storeFromSource(manifest) ?? emptyStore(),
  )

  const openItems = useMemo(
    () =>
      manifest.views.flatMap((v) =>
        v.states.flatMap(
          (state) =>
            resolveLayout({ manifest, assignments: store.assignments }, v.id, state)?.openItems ??
            [],
        ),
      ),
    [manifest, store],
  )

  const commit = useCallback(
    (next: Store) => {
      setStore(next)
      onChange?.(
        next,
        manifest.views.flatMap((v) =>
          v.states.flatMap(
            (state) =>
              resolveLayout({ manifest, assignments: next.assignments }, v.id, state)?.openItems ??
              [],
          ),
        ),
      )
    },
    [manifest, onChange],
  )

  const api: SlotsApi = useMemo(
    () => ({
      manifest,
      store,
      openItems,
      load: commit,
      reset: () => commit(storeFromSource(manifest)),
      drop: (view, state, feature, target) => {
        const result = dropOp(manifest, store, { view, state, feature }, target, author, Date.now())
        if (!result.refused && result.effects.length) commit(result.store)
        return result
      },
      accept: (view, state, feature, requirement) =>
        commit(
          acceptOp(manifest, store, { view, state, feature }, requirement, author, Date.now()),
        ),
      unaccept: (view, state, feature, requirement) =>
        commit(unacceptOp(store, { view, state, feature }, requirement)),
    }),
    [manifest, store, openItems, author, commit],
  )

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

/* ---------------- the elements ---------------- */

interface ReadFeature {
  fid: string
  slot: SlotId
  states: string[] | null
  node: ReactNode
}

/** `<Feature>` is data. `<View>` consumes it; it never renders on its own. */
export function Feature(_props: FeatureProps) {
  return null
}
Feature.displayName = 'Feature'

function readFeatures(children: ReactNode): ReadFeature[] {
  const out: ReadFeature[] = []
  for (const child of Children.toArray(children)) {
    if (!isValidElement(child) || child.type !== Feature) continue
    const props = child.props as FeatureProps
    if (!props.fid) continue // not stamped yet — `npm run id` assigns it
    out.push({
      fid: props.fid,
      slot: props.slot,
      states: props.states ? props.states.split(/\s+/).filter(Boolean) : null,
      node: props.children,
    })
  }
  return out
}

export function View({ id, state, children }: ViewProps) {
  const { manifest, store } = useSlots()
  const decl = viewOf(manifest, id)
  const active = state ?? decl?.defaultState ?? ''
  const nodes = useMemo(() => {
    const map = new Map<string, ReactNode>()
    for (const f of readFeatures(children)) map.set(f.fid, f.node)
    return map
  }, [children])

  if (!decl) return <p className="view-error">No declaration for view “{id}”.</p>
  const l = resolveLayout({ manifest, assignments: store.assignments }, id, active)
  if (!l) return <p className="view-error">View “{id}” has no state “{active}”.</p>

  return (
    <div className="view" data-view={id} data-state={active}>
      {decl.bands.map((band) => (
        <div
          key={band.id}
          className={`band band--${band.rhythm ?? 'normal'}`}
          data-band={band.id}
          style={{ gridTemplateColumns: `repeat(${band.columns}, minmax(0, 1fr))` }}
        >
          {l.slots
            .filter((s) => s.slot.band === band.id)
            .map((s) => (
              <div key={s.slot.id} className="slot" data-slot={s.slot.id}>
                <span className="slot__name" aria-hidden>
                  {s.slot.id}
                </span>
                {s.features.map((p) => (
                  <div
                    key={p.feature}
                    className="feature"
                    data-feature={p.feature}
                    data-from={p.from}
                  >
                    {nodes.get(p.feature) ?? null}
                  </div>
                ))}
              </div>
            ))}
        </div>
      ))}
    </div>
  )
}
