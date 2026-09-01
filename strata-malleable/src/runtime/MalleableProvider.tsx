/**
 * The runtime. It owns the store, keeps `data-mi` current, and injects the one
 * stylesheet compiled by `runtime/styleSheet` — the same compiler ship uses, so
 * dragged pixels and shipped pixels are the same pixels by construction.
 *
 * It resolves nothing itself. Every value on screen comes from `resolve()`.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { applyTheme, type ThemeSeeds } from '../engine/generateTheme'
import { resolve, effectiveSeeds } from '../resolve/resolve'
import type { Manifest, NodeAddress, Resolution, Scope, Store, Value } from '../schema'
import { emptyStore, put, setScope, type ScopeChange } from '../store/store'
import { compileStyleSheet } from './styleSheet'
import { stampInstances } from './instancePaths'

interface MalleableApi {
  store: Store
  manifest: Manifest
  seeds: ThemeSeeds
  /** Resolve one property of one node. The only way anything reads a value. */
  read: (address: NodeAddress, property: string) => Resolution | null
  baseOf: (nodeId: string, property: string) => Value | null
  write: (address: NodeAddress, property: string, value: Value) => void
  rescope: (address: NodeAddress, property: string, scope: Scope) => ScopeChange
  /** The same computation without committing — how the system proposal is shown first. */
  previewScope: (address: NodeAddress, property: string, scope: Scope) => ScopeChange
  reset: () => void
  /** Bumped whenever the DOM is restamped, so overlays reposition. */
  epoch: number
}

const Ctx = createContext<MalleableApi | null>(null)
export const useMalleable = () => {
  const api = useContext(Ctx)
  if (!api) throw new Error('useMalleable outside MalleableProvider')
  return api
}

const STORAGE_KEY = 'strata.malleable.store'

async function persist(store: Store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    /* private mode, quota, a browser that blocks storage — the file write below still runs */
  }
  try {
    // The dev server writes .malleable/overrides.json, so `npm run ship` acts on
    // the same decisions the designer made — "come back later" has to survive a
    // restarted machine, not just a reloaded tab.
    await fetch('/__malleable/store', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(store),
    })
  } catch {
    /* no dev server — localStorage alone still round-trips the session */
  }
}

function load(initial: Store): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Store
      if (parsed?.version === 1) return parsed
    }
  } catch {
    /* fall through to the file-backed store */
  }
  return initial
}

export function MalleableProvider({
  manifest,
  seeds,
  initialStore,
  children,
}: {
  manifest: Manifest
  seeds: ThemeSeeds
  initialStore?: Store
  children: ReactNode
}) {
  const [store, setStore] = useState<Store>(() => load(initialStore ?? emptyStore(seeds)))
  const [epoch, setEpoch] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)

  const commit = useCallback((next: Store) => {
    setStore(next)
    void persist(next)
  }, [])

  const active = useMemo(() => effectiveSeeds(store.seeds, store.overrides), [store])

  useEffect(() => {
    applyTheme(active, document.documentElement)
  }, [active])

  // Identity has to exist in the DOM before anything can be addressed, so it is
  // stamped in a layout effect — before paint, before the overlay measures.
  useLayoutEffect(() => {
    if (!rootRef.current) return
    stampInstances(rootRef.current)
    setEpoch((e) => e + 1)
    const mo = new MutationObserver(() => {
      if (!rootRef.current) return
      stampInstances(rootRef.current)
      setEpoch((e) => e + 1)
    })
    mo.observe(rootRef.current, { childList: true, subtree: true })
    return () => mo.disconnect()
  }, [])

  const css = useMemo(() => compileStyleSheet(store, manifest), [store, manifest])

  const baseOf = useCallback(
    (nodeId: string, property: string): Value | null =>
      manifest.nodes.find((n) => n.nodeId === nodeId)?.base[property] ?? null,
    [manifest],
  )

  const api: MalleableApi = useMemo(
    () => ({
      store,
      manifest,
      seeds: active,
      epoch,
      baseOf,
      read: (address, property) => {
        const base = baseOf(address.nodeId, property)
        if (!base) return null
        return resolve({ seeds: store.seeds, overrides: store.overrides, address, property, base })
      },
      write: (address, property, value) =>
        commit(put(store, { address, property, value, author: 'human', ts: Date.now() })),
      previewScope: (address, property, scope) =>
        setScope(store, manifest, address, property, scope, 'human', Date.now()),
      rescope: (address, property, scope) => {
        const change = setScope(store, manifest, address, property, scope, 'human', Date.now())
        if (!change.refused) commit(change.store)
        return change
      },
      reset: () => commit(emptyStore(seeds)),
    }),
    [store, manifest, active, epoch, baseOf, commit, seeds],
  )

  return (
    <Ctx.Provider value={api}>
      <style data-malleable-runtime>{css}</style>
      <div ref={rootRef} className="malleable-root">
        {children}
      </div>
    </Ctx.Provider>
  )
}
