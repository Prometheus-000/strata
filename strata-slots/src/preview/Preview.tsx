/**
 * THE PREVIEW — the host, and the designer's half of the loop.
 *
 * Everything the library refuses to decide is decided here, in one file, on
 * purpose — so that reading it tells you exactly which choices are this app's
 * and which are the library's. The library holds assignments and open items and
 * exposes them; the four policies below are mine, and another host is free to
 * make all four differently:
 *
 *   1. **Session.** Which view and which state you are looking at.
 *   2. **Persistence.** Every change goes to local storage immediately, so work
 *      in progress is uncommitted rather than lost.
 *   3. **Triggers.** When a batch is written through to source.
 *   4. **Enforcement.** None. Open items are shown, counted, and carried into
 *      the diff. Nothing here refuses to ship — the system reports what a
 *      decision costs and leaves the decision alone.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DragSurface } from '../drop/DragSurface'
import { diff } from '../report/diff'
import { SlotsProvider, useSlots } from '../runtime/View'
import { storeFromSource } from '../store/store'
import type { Manifest, OpenItem, Store, ViewId } from '../schema'
import './preview.css'

export type Surfaces = Record<string, (props: { state?: string }) => JSX.Element>

const STORAGE_KEY = 'strata.slots.host'

/* ---------------- policy 2: persistence ---------------- */

interface Session {
  version: 1
  store: Store
  /** What source was last told. Lets the host answer "what is uncommitted". */
  committed: Store
}

const loadSession = (manifest: Manifest): Session => {
  const fresh = storeFromSource(manifest)
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Session
      if (parsed?.version === 1 && parsed.store?.assignments)
        return { version: 1, store: parsed.store, committed: parsed.committed ?? fresh }
    }
  } catch {
    // Private mode, a cleared origin, storage disabled: start from source
    // rather than from nothing.
  }
  return { version: 1, store: fresh, committed: fresh }
}

const saveSession = (session: Session) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    /* in-memory still works for this session */
  }
}

const differs = (a: Store, b: Store) =>
  JSON.stringify(a.assignments.map(rowOf).sort()) !==
  JSON.stringify(b.assignments.map(rowOf).sort())
const rowOf = (a: { id: string; slot: string; order: number; accepted: string[] }) =>
  `${a.id}|${a.slot}|${a.order}|${a.accepted.join()}`

export function Preview({ manifest, surfaces }: { manifest: Manifest; surfaces: Surfaces }) {
  const initial = useRef(loadSession(manifest)).current
  const session = useRef<Session>(initial)

  const onChange = useCallback((store: Store) => {
    // Persist immediately. Writing through to source waits for a boundary;
    // not losing the work does not wait for anything.
    session.current = { ...session.current, store }
    saveSession(session.current)
  }, [])

  return (
    <SlotsProvider manifest={manifest} initialStore={initial.store} onChange={onChange}>
      <Body session={session} surfaces={surfaces} />
      <DragSurface />
    </SlotsProvider>
  )
}

function Body({
  session,
  surfaces,
}: {
  session: React.MutableRefObject<Session>
  surfaces: Surfaces
}) {
  const { manifest, store, openItems, reset, accept, unaccept } = useSlots()

  /* ---------------- policy 1: session ---------------- */
  const [view, setViewState] = useState<ViewId>(manifest.views[0]?.id ?? '')
  const [states, setStates] = useState<Record<ViewId, string>>(() =>
    Object.fromEntries(manifest.views.map((v) => [v.id, v.defaultState])),
  )
  const state = states[view] ?? manifest.views.find((v) => v.id === view)?.defaultState ?? ''

  const [lastWrite, setLastWrite] = useState<string | null>(null)
  const [ready, setReady] = useState<{ costs: number; broken: number } | null>(null)
  const uncommitted = differs(store, session.current.committed)
  const unresolved = openItems.filter((i) => !i.accepted)

  /* ---------------- policy 3: triggers ---------------- */

  const storeRef = useRef(store)
  storeRef.current = store

  const write = useCallback(async () => {
    if (!differs(storeRef.current, session.current.committed)) return
    try {
      const res = await fetch('/__slots/commit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(storeRef.current),
      })
      const body = await res.json()
      session.current = { ...session.current, committed: storeRef.current }
      saveSession(session.current)
      setLastWrite(body.written?.length ? `wrote ${body.written.join(', ')}` : 'no change on disk')
    } catch {
      setLastWrite('no writer attached — held locally, still uncommitted')
    }
  }, [session])

  /**
   * Written on this host's own boundaries, never on a clock.
   *
   * A timer knows nothing about the work, so it fires mid-thought and produces
   * exactly the gesture-sized diffs batching exists to avoid. This app is built
   * out of units of work, so it uses them: leaving a state or a view is the
   * designer saying they are done with this one, and the moment the last open
   * item stops being open is the moment they finished dealing with something.
   *
   * Both are *this host's* choices. The library has no opinion, and closing the
   * tab is not a boundary — the work is persisted, so it is uncommitted, not
   * lost, and it lands when the thought actually ends.
   */
  const leave = useCallback(
    (go: () => void) => {
      void write()
      go()
    },
    [write],
  )

  const wasOpen = useRef(unresolved.length > 0)
  useEffect(() => {
    const clear = unresolved.length === 0
    if (wasOpen.current && clear) void write()
    wasOpen.current = !clear
  }, [unresolved.length, write])

  const Surface = surfaces[view]
  const decl = manifest.views.find((v) => v.id === view)
  const rows = useMemo(
    () =>
      diff({ manifest, assignments: store.assignments }).find(
        (d) => d.view === view && d.state === state,
      ),
    [manifest, store, view, state],
  )

  return (
    <>
      <header className="hx" data-chrome>
        <span className="hx__mark">STRATA</span>
        <span className="hx__sub">slot layer</span>

        <nav className="hx__tabs" aria-label="views">
          {manifest.views.map((v) => (
            <button
              key={v.id}
              type="button"
              className={`hx__tab ${v.id === view ? 'is-current' : ''}`}
              onClick={() => leave(() => setViewState(v.id))}
            >
              {v.label ?? v.id}
            </button>
          ))}
        </nav>

        <nav className="hx__tabs hx__tabs--states" aria-label="states">
          {decl?.states.map((s) => (
            <button
              key={s}
              type="button"
              className={`hx__tab hx__tab--state ${s === state ? 'is-current' : ''}`}
              onClick={() => leave(() => setStates((prev) => ({ ...prev, [view]: s })))}
            >
              {s}
            </button>
          ))}
        </nav>

        <span className={`hx__status ${uncommitted ? 'is-pending' : ''}`}>
          {uncommitted ? 'uncommitted · lands when you leave' : (lastWrite ?? 'at source')}
        </span>
        <button type="button" className="hx__btn" onClick={() => leave(reset)}>
          revert
        </button>
        {/*
          "Ready for review" is not a commit and not a save. The moves are
          already in source; this writes a handoff file saying the designer
          thinks the work is right, for whoever reviews it next. It withholds
          nothing, which is what keeps it from being the save button this design
          removed.
        */}
        <button
          type="button"
          className="hx__btn hx__btn--ready"
          onClick={() => {
            void write().then(async () => {
              try {
                const res = await fetch('/__slots/ready', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ by: 'human', at: new Date().toISOString() }),
                })
                setReady(await res.json())
              } catch {
                setReady({ costs: -1, broken: -1 })
              }
            })
          }}
        >
          ready for review
        </button>
      </header>

      {ready && (
        <p className="hx__ready" role="status">
          {ready.costs < 0 ? (
            <>no reviewer attached — start the preview with <code>slots preview</code></>
          ) : (
            <>
              handed off · {ready.broken} broken, {ready.costs} unacknowledged cost
              {ready.costs === 1 ? '' : 's'} · run <code>/slots-review</code>
            </>
          )}
        </p>
      )}

      <main className="hx__stage">{Surface ? <Surface state={state} /> : null}</main>

      <OpenItems items={openItems} accept={accept} unaccept={unaccept} />

      <footer className="hx__foot" data-chrome>
        <span className="hx__foot-key">
          {view} · {state}
        </span>
        {rows && rows.rows.length ? (
          <ul className="hx__rows">
            {rows.rows.map((r) => (
              <li key={r.feature}>
                <b>{r.component}</b>
                {r.kind === 'moved' ? (
                  <>
                    {' '}
                    {r.from} <i>→</i> {r.to}
                  </>
                ) : r.kind === 'reordered' ? (
                  <>
                    {' '}
                    {r.to} · order {r.fromOrder} <i>→</i> {r.toOrder}
                  </>
                ) : (
                  <> {r.to} · cost accepted</>
                )}
                <em>{r.author}</em>
              </li>
            ))}
          </ul>
        ) : (
          <span className="hx__quiet">at source defaults — drag a region to move it</span>
        )}
        {rows?.absent.length ? (
          <span className="hx__absent">absent here: {rows.absent.join(', ')}</span>
        ) : null}
      </footer>
    </>
  )
}

/**
 * What the current design costs. A ledger, not a gate — nothing here refuses to
 * ship, and this host has no "resolve before you may continue" step, because
 * nobody designs from inside a system that is waiting for them to comply.
 *
 * Acknowledging is one click and changes nothing except the record. A
 * justification field would be a text box, and a text box is the failure this
 * whole model is arranged around; what makes the decision reviewable is that it
 * lands in source with a name against it, on the same line as the slot.
 */
function OpenItems({
  items,
  accept,
  unaccept,
}: {
  items: OpenItem[]
  accept: SlotsApiFn
  unaccept: SlotsApiFn
}) {
  if (!items.length) return null
  const open = items.filter((i) => !i.accepted)
  return (
    <section className="hx__open" data-chrome>
      <h2 className="hx__open-head">
        {open.length
          ? `${open.length} behavioural cost${open.length === 1 ? '' : 's'} in this design`
          : 'every cost in this design is acknowledged'}
      </h2>
      <ul className="hx__open-list">
        {items.map((i) => (
          <li key={i.id} className={i.accepted ? 'is-accepted' : ''}>
            <span className="hx__open-where">
              {i.view} · {i.state} · <b>{i.component}</b> in {i.slot}
            </span>
            <span className="hx__open-req">{i.requirement}</span>
            <span className="hx__open-why">{i.reason}</span>
            {i.accepted ? (
              <button
                type="button"
                className="hx__btn hx__btn--quiet"
                onClick={() => unaccept(i.view, i.state, i.feature, i.requirement)}
              >
                {i.acceptedBy ?? 'human'} accepted this · undo
              </button>
            ) : (
              <button
                type="button"
                className="hx__btn hx__btn--accept"
                onClick={() => accept(i.view, i.state, i.feature, i.requirement)}
              >
                acknowledge
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

type SlotsApiFn = (
  view: string,
  state: string,
  feature: string,
  requirement: OpenItem['requirement'],
) => void
