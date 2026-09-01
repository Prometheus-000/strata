/**
 * MANIPULATORS — handles on the object itself.
 *
 * There is no inspector here and there is no field to type into. A corner is
 * dragged by its corner, padding by its edge, a gap by the gap. Everything a
 * property inspector would have offered is either on the object or is not
 * offered, which is the constraint that keeps this from becoming the thing it
 * exists to replace.
 *
 * A drag writes an instance override. Nothing else, until someone says so.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { PROPERTIES } from '../resolve/properties'
import { tokenTable } from '../resolve/resolve'
import { addressOfElement, SID_ATTR } from '../runtime/instancePaths'
import { useMalleable } from '../runtime/MalleableProvider'
import type { NodeAddress } from '../schema'
import { deltaFor, snap, ticksFor, SNAP_PX } from './handles'
import { Promote } from './Promote'

export interface Target {
  address: NodeAddress
  element: HTMLElement
  properties: string[]
}

const sameAddress = (a: NodeAddress | undefined, b: NodeAddress | undefined) =>
  !!a && !!b && a.nodeId === b.nodeId && a.viewId === b.viewId && a.instancePath === b.instancePath

export function Overlay({ enabled }: { enabled: boolean }) {
  const { manifest, read, write, seeds, epoch } = useMalleable()
  const [hover, setHover] = useState<Target | null>(null)
  const [selected, setSelected] = useState<Target | null>(null)
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null)
  const [drag, setDrag] = useState<{ property: string; px: number; token?: string } | null>(null)
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
      const properties = Object.keys(entry?.base ?? {}).filter((p) => p in PROPERTIES)
      if (!properties.length) return null
      return { address, element: node, properties }
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
      if (dragRef.current) return
      const el = document.elementFromPoint(e.clientX, e.clientY)
      if (el?.closest('[data-malleable-chrome]')) return
      setHover(targetFor(el))
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [enabled, targetFor])

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
    if (!drag) return
    const spec = PROPERTIES[drag.property]

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
      const spec2 = PROPERTIES[d.property]
      for (const p of spec2.css) d.element.style.removeProperty(p)
      const s = snap(drag.px, spec2, table)
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
  }, [drag, table, write])

  useEffect(() => {
    if (!enabled) return
    const onDown = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY)
      if (el?.closest('[data-malleable-chrome]')) return
      const t = targetFor(el)
      setSelected(t)
      setSelectedProperty(t?.properties[0] ?? null)
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [enabled, targetFor])

  if (!enabled) return null

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

      {selected && selectedProperty && (
        <Readout
          address={selected.address}
          property={selectedProperty}
          properties={selected.properties}
          onPick={setSelectedProperty}
        />
      )}
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
  const spec = PROPERTIES[property]
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
  const spec = PROPERTIES[property]
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
