/**
 * MANIPULATORS — handles on the object itself, and the object itself as a handle.
 *
 * There is no inspector here and there is no field to type into. Two gestures:
 *
 *   - Drag a handle: a corner is dragged by its corner, padding by its edge, a
 *     gap by the gap. That writes an instance override, and nothing else until
 *     someone says so.
 *   - Drag a region: pick up `<Filters />` by its body and put it down in
 *     another landmark, before or after a neighbour. That rewrites the JSX on
 *     the spot — there is no store for structure; the diff is the record.
 *
 * Nothing is priced and nothing is marked while a region is in the air. The
 * only things drawn are the container under the pointer and one line where
 * the region would land. A design in progress fails any check by definition,
 * so no check runs here.
 *
 * Everything a property inspector would have offered is either on the object
 * or is not offered, which is the constraint that keeps this from becoming the
 * thing it exists to replace.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { PROPERTIES, specFor, type PropertySpec } from '../resolve/properties'
import { tokenTable } from '../resolve/resolve'
import { addressOfElement, SID_ATTR } from '../runtime/instancePaths'
import { decideFromOverlay, useMalleable } from '../runtime/MalleableProvider'
import type { MoveRequest, NodeAddress, PropRequest, PropValue } from '../schema'
import { describe } from '@strata/substrate/format'
import { deltaFor, snap, ticksFor, SNAP_PX } from './handles'
import { dropUnder, instanceUnder, isNoop, thingUnder, type Drop, type Instance, type Thing } from './moveTarget'
import { Promote } from './Promote'

const INTERACTIVE = 'button, a, input, select, textarea, [role="button"], [contenteditable]'
const MOVE_THRESHOLD = 4

interface Moving {
  thing: Thing
  x: number
  y: number
  drop: Drop | null
}

export interface Target {
  address: NodeAddress
  element: HTMLElement
  properties: string[]
  /** The spec each property gets on this node — the registry's, shaped by what the component declared. */
  specs: Record<string, PropertySpec>
}

const sameAddress = (a: NodeAddress | undefined, b: NodeAddress | undefined) =>
  !!a && !!b && a.nodeId === b.nodeId && a.viewId === b.viewId && a.instancePath === b.instancePath

export function Overlay({ enabled }: { enabled: boolean }) {
  const { manifest, read, write, seeds, epoch, structure, refreshStructure } = useMalleable()
  const [hover, setHover] = useState<Target | null>(null)
  const [selected, setSelected] = useState<Target | null>(null)
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null)
  const [drag, setDrag] = useState<{ property: string; px: number; token?: string } | null>(null)
  const [moving, setMoving] = useState<Moving | null>(null)
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null)
  const pendingRef = useRef<{ thing: Thing; x: number; y: number } | null>(null)
  const movingRef = useRef<Moving | null>(null)
  const [, force] = useState(0)
  const dragRef = useRef<{
    property: string
    start: { x: number; y: number }
    startPx: number
    element: HTMLElement
    address: NodeAddress
  } | null>(null)

  const table = useMemo(() => tokenTable(seeds), [seeds])

  const targetFor = useCallback(
    (el: Element | null): Target | null => {
      const node = el?.closest<HTMLElement>(`[${SID_ATTR}]`)
      const address = addressOfElement(node ?? null)
      if (!node || !address) return null
      const entry = manifest.nodes.find((n) => n.nodeId === address.nodeId)
      const specs: Record<string, PropertySpec> = {}
      for (const p of Object.keys(entry?.base ?? {})) {
        const spec = specFor(p, entry?.controls?.css[p])
        if (spec) specs[p] = spec
      }
      const properties = Object.keys(specs)
      // A node with nothing to drag can still carry prop controls on its instance.
      if (!properties.length && !instanceUnder(node)) return null
      return { address, element: node, properties, specs }
    },
    [manifest],
  )

  /* ---- hover tracking ---- */
  useEffect(() => {
    if (!enabled) {
      setHover(null)
      return
    }
    const onMove = (e: PointerEvent) => {
      if (dragRef.current || movingRef.current) return
      const el = document.elementFromPoint(e.clientX, e.clientY)
      if (el?.closest('[data-malleable-chrome]')) return
      setHover(targetFor(el))
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [enabled, targetFor])

  /* ---- the move: pick a region up, put it down somewhere else ---- */
  const finishMove = useCallback(
    async (m: Moving) => {
      document.body.removeAttribute('data-malleable-moving')
      m.thing.element.style.removeProperty('opacity')
      movingRef.current = null
      setMoving(null)
      if (!m.drop || isNoop(m.thing, m.drop)) return
      const to: MoveRequest['to'] = m.drop.anchor
        ? m.drop.anchor.edge === 'before'
          ? { container: m.drop.container.sid, before: { region: m.drop.anchor.child.component, ordinal: m.drop.anchor.child.ordinal } }
          : { container: m.drop.container.sid, after: { region: m.drop.anchor.child.component, ordinal: m.drop.anchor.child.ordinal } }
        : { container: m.drop.container.sid, end: true }
      const req: MoveRequest = {
        what: { container: m.thing.container.sid, region: m.thing.child.component, ordinal: m.thing.ordinal },
        to,
      }
      try {
        const result = await decideFromOverlay({ kind: 'move', request: req })
        if (!result.ok) setStatus({ text: result.error, error: true })
        else if (result.unchanged) setStatus({ text: `<${m.thing.child.component} /> is already there` })
        else {
          setStatus({ text: describe(result.decision) })
          await refreshStructure()
        }
      } catch {
        setStatus({ text: 'no dev server — a move writes to source, and only the dev server can', error: true })
      }
    },
    [refreshStructure],
  )

  useEffect(() => {
    if (!enabled || !structure) return
    const onMove = (e: PointerEvent) => {
      const m = movingRef.current
      if (m) {
        const next = { ...m, x: e.clientX, y: e.clientY, drop: dropUnder(e.clientX, e.clientY, m.thing, structure) }
        movingRef.current = next
        setMoving(next)
        return
      }
      const p = pendingRef.current
      if (!p) return
      if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < MOVE_THRESHOLD) return
      pendingRef.current = null
      document.body.setAttribute('data-malleable-moving', 'true')
      // Faded in place, not moved: React owns these nodes, and the page will
      // re-render from source the moment the write lands.
      p.thing.element.style.setProperty('opacity', '0.45')
      const started = { thing: p.thing, x: e.clientX, y: e.clientY, drop: dropUnder(e.clientX, e.clientY, p.thing, structure) }
      movingRef.current = started
      setMoving(started)
      setHover(null)
      setSelected(null)
    }
    const onUp = () => {
      pendingRef.current = null
      const m = movingRef.current
      if (m) void finishMove(m)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      pendingRef.current = null
      const m = movingRef.current
      if (m) void finishMove({ ...m, drop: null })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('keydown', onKey)
    }
  }, [enabled, structure, finishMove])

  useEffect(() => {
    if (!status) return
    const t = setTimeout(() => setStatus(null), 7000)
    return () => clearTimeout(t)
  }, [status])

  /* ---- keep boxes glued to their elements ---- */
  useLayoutEffect(() => {
    const bump = () => force((n) => n + 1)
    window.addEventListener('scroll', bump, true)
    window.addEventListener('resize', bump)
    const ro = new ResizeObserver(bump)
    if (hover) ro.observe(hover.element)
    if (selected) ro.observe(selected.element)
    return () => {
      window.removeEventListener('scroll', bump, true)
      window.removeEventListener('resize', bump)
      ro.disconnect()
    }
  }, [hover, selected, epoch])

  /* ---- the drag itself ---- */
  const beginDrag = (target: Target, property: string) => (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const current = read(target.address, property)
    const startPx = current?.px ?? 0
    dragRef.current = {
      property,
      start: { x: e.clientX, y: e.clientY },
      startPx,
      element: target.element,
      address: target.address,
    }
    setSelected(target)
    setSelectedProperty(property)
    setDrag({ property, px: startPx })
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }

  useEffect(() => {
    if (!drag || !selected) return
    const spec = selected.specs[drag.property] ?? PROPERTIES[drag.property]

    const onMove = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const raw =
        d.startPx + deltaFor(spec.handle, e.clientX - d.start.x, e.clientY - d.start.y) * spec.gain
      const s = snap(raw, spec, table)
      // Painted directly during the drag so the object tracks the cursor without
      // recompiling the stylesheet sixty times a second. Removed on commit — the
      // store is the only lasting authority.
      const painted = 'token' in s.value ? `var(${s.value.token})` : s.value.literal
      for (const p of spec.css) d.element.style.setProperty(p, painted)
      setDrag({ property: d.property, px: s.px, token: s.token })
    }

    const onUp = () => {
      const d = dragRef.current
      if (!d) return
      for (const p of spec.css) d.element.style.removeProperty(p)
      const s = snap(drag.px, spec, table)
      write(d.address, d.property, s.value)
      dragRef.current = null
      setDrag(null)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp, { once: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [drag, selected, table, write])

  useEffect(() => {
    if (!enabled) return
    const onDown = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY)
      if (el?.closest('[data-malleable-chrome]')) return
      const t = targetFor(el)
      setSelected(t)
      setSelectedProperty(t?.properties[0] ?? null)
      // A press on a region arms a move; it becomes one only past the threshold.
      if (e.button === 0 && structure && !el?.closest(INTERACTIVE)) {
        const thing = thingUnder(el, structure)
        pendingRef.current = thing ? { thing, x: e.clientX, y: e.clientY } : null
      }
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [enabled, targetFor, structure])

  if (!enabled) return null

  if (moving) {
    const c = moving.drop ? moving.drop.containerEl.getBoundingClientRect() : null
    return (
      <div className="mv" data-malleable-chrome>
        {moving.drop && c && (
          <div className="mv__container" style={{ left: c.left, top: c.top, width: c.width, height: c.height }}>
            <span className="mv__label">
              {moving.drop.container.tag} · {moving.drop.container.file.split('/').pop()}:{moving.drop.container.line}
            </span>
          </div>
        )}
        {moving.drop && <div className="mv__line" style={moving.drop.line} />}
        <div className="mv__ghost" style={{ left: moving.x, top: moving.y }}>
          {`<${moving.thing.child.component} />`}
          {moving.drop?.anchor && ` ${moving.drop.anchor.edge} <${moving.drop.anchor.child.component} />`}
          {moving.drop && !moving.drop.anchor && ` at the end of <${moving.drop.container.tag}>`}
        </div>
      </div>
    )
  }

  const boxes = [
    hover && !sameAddress(hover.address, selected?.address) ? { target: hover, kind: 'hover' as const } : null,
    selected ? { target: selected, kind: 'selected' as const } : null,
  ].filter(Boolean) as Array<{ target: Target; kind: 'hover' | 'selected' }>

  return (
    <div className="mv" data-malleable-chrome>
      {boxes.map(({ target, kind }) => {
        const r = target.element.getBoundingClientRect()
        return (
          <div
            key={`${kind}-${target.address.viewId}-${target.address.instancePath}-${target.address.nodeId}`}
            className={`mv__box mv__box--${kind}`}
            style={{ left: r.left, top: r.top, width: r.width, height: r.height }}
          >
            <span className="mv__label">
              {target.address.nodeId}
              {target.address.instancePath && <em> · {target.address.instancePath}</em>}
            </span>
            {kind === 'selected' &&
              target.properties.map((property) => (
                <Handle
                  key={property}
                  target={target}
                  property={property}
                  rect={r}
                  onDown={beginDrag(target, property)}
                  active={drag?.property === property || selectedProperty === property}
                  onFocusProperty={() => setSelectedProperty(property)}
                />
              ))}
          </div>
        )
      })}

      {drag && (
        <Ruler
          target={selected!}
          property={drag.property}
          px={drag.px}
          token={drag.token}
          table={table}
        />
      )}

      {selected && selectedProperty && !drag && (
        <Promote address={selected.address} property={selectedProperty} element={selected.element} />
      )}

      {selected && !drag && <PropControls element={selected.element} onStatus={setStatus} />}

      {selected && selectedProperty && (
        <Readout
          address={selected.address}
          property={selectedProperty}
          properties={selected.properties}
          onPick={setSelectedProperty}
        />
      )}

      {status && <div className={`mv__status ${status.error ? 'is-error' : ''}`}>{status.text}</div>}
    </div>
  )
}

/**
 * Why this value is this value — the resolver's chain, rendered.
 *
 * Read-only, and a status line rather than a panel: nothing here is editable,
 * so it costs the object nothing. A cascade that cannot be inspected is a
 * cascade people work around instead of with.
 */
function Readout({
  address,
  property,
  properties,
  onPick,
}: {
  address: NodeAddress
  property: string
  properties: string[]
  onPick: (p: string) => void
}) {
  const { read } = useMalleable()
  const r = read(address, property)
  if (!r) return null
  return (
    <div className="mv__readout" data-malleable-chrome>
      <div className="mv__readout-head">
        <span className="mv__readout-node">
          {address.nodeId}
          {address.instancePath && <em> · {address.instancePath}</em>}
        </span>
        <span className="mv__readout-props">
          {properties.map((p) => (
            <button
              key={p}
              type="button"
              className={`mv__chip ${p === property ? 'is-current' : ''}`}
              onClick={() => onPick(p)}
            >
              {p}
            </button>
          ))}
        </span>
        <span className="mv__readout-value">
          {r.css}
          {r.px !== null && <em> · {Math.round(r.px * 10) / 10}px</em>}
        </span>
      </div>
      <ol className="mv__chain">
        {r.chain.map((step, i) => (
          <li key={i} className={`mv__step is-${step.outcome}`}>
            <span className="mv__step-scope">{step.scope}</span>
            <span className="mv__step-value">
              {'token' in step.value ? `var(${step.value.token})` : step.value.literal}
            </span>
            <span className="mv__step-note">{step.note ?? (step.outcome === 'applied' ? 'wins' : '')}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

/**
 * PROP CONTROLS — a component's own options, on the object.
 *
 * `<Badge tone="accent">` has three tones because Badge said so, beside
 * itself. They appear as a strip above the selected instance; a pick writes
 * the attribute at the call site — a diff, receipted — and the page re-renders
 * from source. No panel, no field: only the values the component allows.
 */
function PropControls({ element, onStatus }: { element: HTMLElement; onStatus: (s: { text: string; error?: boolean }) => void }) {
  const { manifest } = useMalleable()
  const instance = useMemo(() => instanceUnder(element), [element])
  const controls = instance
    ? manifest.nodes.find((n) => n.nodeId === instance.element.getAttribute(SID_ATTR))?.controls
    : undefined
  // The call site could be in any ancestor's file, nearest first.
  const candidates = useMemo(
    () =>
      (instance?.chain ?? []).flatMap((c) => {
        const file = manifest.nodes.find((n) => n.component === c.component)?.file
        return file ? [{ parent: c.component, file, ordinal: c.ordinal }] : []
      }),
    [instance, manifest],
  )
  const [site, setSite] = useState<{ parent: string; file: string; ordinal: number; attrs: Record<string, PropValue>; list: boolean } | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const key = `${instance?.component}|${candidates.map((c) => `${c.parent}:${c.ordinal}`).join(',')}`

  useEffect(() => {
    setSite(null)
    setNote(null)
    if (!instance || !candidates.length) return
    const q = new URLSearchParams({ component: instance.component, candidates: JSON.stringify(candidates) }).toString()
    fetch(`/__malleable/callsite?${q}`)
      .then((r) => r.json())
      .then((r: { ok: boolean; parent?: string; file?: string; ordinal?: number; attrs?: Record<string, PropValue>; list?: boolean; error?: string }) => {
        if (r.ok && r.attrs && r.parent && r.file !== undefined) setSite({ parent: r.parent, file: r.file, ordinal: r.ordinal ?? 0, attrs: r.attrs, list: !!r.list })
        else if (r.error) setNote(r.error)
      })
      .catch(() => setNote('no dev server — picks write to source, and only the dev server can'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  if (!instance || !controls || !Object.keys(controls.props).length) return null
  const rect = instance.element.getBoundingClientRect()
  // One call site, many instances: a pick on any of them is a pick on all of
  // them. Shown, not said — every instance in the group is outlined while the
  // strip is up, so what the pick touches is the thing on screen.
  const group = site?.list ? groupOf(instance, site.parent) : null

  const pick = async (prop: string, value: PropValue) => {
    if (!site) return
    const req: PropRequest = { file: site.file, component: instance.component, parent: site.parent, ordinal: site.ordinal, prop, value }
    try {
      const r = await decideFromOverlay({ kind: 'prop', request: req })
      if (!r.ok) return setNote(r.error)
      if (!r.unchanged) onStatus({ text: r.decision.consequence.note ?? describe(r.decision) })
      setSite((c) => (c ? { ...c, attrs: { ...c.attrs, [prop]: req.value } } : c))
    } catch {
      setNote('no dev server — picks write to source, and only the dev server can')
    }
  }

  return (
    <>
      {group?.map((el, i) => {
        const g = el.getBoundingClientRect()
        return <div key={i} className="mv__box mv__box--group" style={{ left: g.left, top: g.top, width: g.width, height: g.height }} />
      })}
      <div className="mv__props" data-malleable-chrome style={{ left: rect.left, top: rect.top - 8 }}>
        {Object.entries(controls.props).map(([prop, c]) => {
          const cur = site?.attrs[prop]
          const stated = site ? prop in site.attrs : false
          return (
            <div key={prop} className="mv__promote-row">
              <span className="mv__promote-lede">
                {instance.component}
                <em> {prop}</em>
              </span>
              {c.kind === 'options' &&
                c.options.map((o) => (
                  <button
                    key={o}
                    type="button"
                    className={`mv__seg ${cur === o ? 'is-current' : ''}`}
                    disabled={!site}
                    title={cur === o ? `${prop}="${o}" — click to drop back to the default` : `${prop}="${o}"`}
                    onClick={() => void pick(prop, cur === o ? null : o)}
                  >
                    {o}
                  </button>
                ))}
              {c.kind === 'toggle' && (
                // One chip. Its state is what the component will do: the attribute
                // when stated, the declared default when not. Picking writes the
                // other state — as the bare attribute, `={false}`, or nothing,
                // whichever says it in the fewest characters.
                <button
                  type="button"
                  className={`mv__seg ${(stated ? cur === true : c.default) ? 'is-current' : ''}`}
                  disabled={!site}
                  title={`${prop}: ${(stated ? cur === true : c.default) ? 'on' : 'off'} — click to switch`}
                  onClick={() => {
                    const on = stated ? cur === true : c.default
                    const next = !on
                    void pick(prop, next === c.default ? null : next)
                  }}
                >
                  {(stated ? cur === true : c.default) ? 'on' : 'off'}
                </button>
              )}
              {c.kind === 'number' && (
                <Scrub
                  value={typeof cur === 'number' ? cur : null}
                  range={c.range}
                  step={c.step}
                  disabled={!site}
                  onCommit={(n) => void pick(prop, n)}
                  onClear={() => void pick(prop, null)}
                />
              )}
              {site && stated && cur === null && <em className="mv__props-note">set in code</em>}
            </div>
          )
        })}
        {note && <p className="mv__promote-note">{note}</p>}
      </div>
    </>
  )
}

/**
 * A number, scrubbed: press the chip and drag sideways. One step per few
 * pixels, clamped to the range the component declared; the value lands on
 * release. Click without dragging drops the attribute back to the default.
 */
function Scrub({
  value,
  range,
  step,
  disabled,
  onCommit,
  onClear,
}: {
  value: number | null
  range: [number, number]
  step: number
  disabled: boolean
  onCommit: (n: number) => void
  onClear: () => void
}) {
  const [live, setLive] = useState<number | null>(null)
  const ref = useRef<{ x: number; start: number; moved: boolean } | null>(null)
  const shown = live ?? value
  const PX_PER_STEP = 6
  return (
    <button
      type="button"
      className={`mv__seg mv__seg--scrub ${value !== null ? 'is-current' : ''}`}
      disabled={disabled}
      title={`${range[0]}–${range[1]} · drag sideways · click to drop back to the default`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        ref.current = { x: e.clientX, start: value ?? range[0], moved: false }
      }}
      onPointerMove={(e) => {
        const r = ref.current
        if (!r) return
        const steps = Math.round((e.clientX - r.x) / PX_PER_STEP)
        if (steps !== 0) r.moved = true
        const next = Math.min(range[1], Math.max(range[0], r.start + steps * step))
        setLive(Number(next.toFixed(6)))
      }}
      onPointerUp={() => {
        const r = ref.current
        ref.current = null
        if (!r) return
        if (r.moved && live !== null) onCommit(live)
        else if (!r.moved) onClear()
        setLive(null)
      }}
    >
      {shown === null ? '(default)' : shown}
    </button>
  )
}

/** Every instance a list call site renders inside the parent that wrote it — the group a pick lands on. */
function groupOf(instance: Instance, parent: string): HTMLElement[] {
  const link = instance.chain.find((c) => c.component === parent)
  if (!link) return [instance.element]
  return Array.from(link.element.querySelectorAll<HTMLElement>(`[data-region="${instance.component}"]`))
}

/** One grab point, placed on the geometry it changes. */
function Handle({
  target,
  property,
  rect,
  onDown,
  active,
  onFocusProperty,
}: {
  target: Target
  property: string
  rect: DOMRect
  onDown: (e: React.PointerEvent) => void
  active: boolean
  onFocusProperty: () => void
}) {
  const { read } = useMalleable()
  const spec = target.specs[property] ?? PROPERTIES[property]
  const px = read(target.address, property)?.px ?? 0
  let left = 0
  let top = 0
  if (spec.handle === 'corner') {
    const inset = Math.max(4, px * 0.7071)
    left = inset
    top = inset
  } else if (spec.handle === 'inset') {
    left = Math.max(4, px)
    top = rect.height / 2
  } else {
    // The gap handle sits in the actual gap, between the first two children.
    const kids = Array.from(target.element.children) as HTMLElement[]
    if (kids.length >= 2) {
      const a = kids[0].getBoundingClientRect()
      const b = kids[1].getBoundingClientRect()
      const vertical = b.top >= a.bottom - 1
      left = vertical ? rect.width / 2 : (a.right + b.left) / 2 - rect.left
      top = vertical ? (a.bottom + b.top) / 2 - rect.top : rect.height / 2
    } else {
      left = rect.width / 2
      top = rect.height - 6
    }
  }
  return (
    <button
      type="button"
      className={`mv__handle mv__handle--${spec.handle} ${active ? 'is-active' : ''}`}
      style={{ left, top }}
      onPointerDown={onDown}
      onFocus={onFocusProperty}
      aria-label={`${spec.label} — drag to change`}
      title={`${spec.label} · ${Math.round(px)}px`}
    />
  )
}

/** The tick strip that appears only while dragging, showing where the tokens are. */
function Ruler({
  target,
  property,
  px,
  token,
  table,
}: {
  target: Target
  property: string
  px: number
  token?: string
  table: Record<string, string>
}) {
  const spec = target.specs[property] ?? PROPERTIES[property]
  const rect = target.element.getBoundingClientRect()
  const ticks = ticksFor(spec, table)
  const span = Math.max(spec.range[1], px + 8)
  return (
    <div className="mv__ruler" style={{ left: rect.left, top: rect.bottom + 10, width: 220 }}>
      <div className="mv__ruler-track">
        {ticks.map((t) => (
          <span
            key={t.token}
            className={`mv__tick ${token === t.token ? 'is-snapped' : ''}`}
            style={{ left: `${(t.px / span) * 100}%` }}
            title={`${t.token} · ${t.px}px`}
          />
        ))}
        <span className="mv__cursor" style={{ left: `${(px / span) * 100}%` }} />
      </div>
      <div className="mv__ruler-value">
        {token ? (
          <>
            <strong>{token}</strong> <em>snapped</em>
          </>
        ) : (
          <>
            <strong>{Math.round(px)}px</strong> <em>drifted · {SNAP_PX}px to the nearest token</em>
          </>
        )}
      </div>
    </div>
  )
}
