/**
 * The harness. Not scaffolding — it is the interface the whole repo is an
 * argument about, and the only place the six steps are visible in sequence.
 *
 * The chrome is a strip, not a workspace: the design fills the page, and
 * everything the tool has to say sits above and below it. There is no panel,
 * because the moment a panel exists the corner stops being where you change
 * the corner.
 */
import { useMemo, useState } from 'react'
import { Gallery } from '../../fixtures/app/views/Gallery'
import { Settings } from '../../fixtures/app/views/Settings'
import { OBSIDIAN } from '../engine/generateTheme'
import { Overlay } from '../manipulate/Overlay'
import { MalleableProvider, useMalleable } from '../runtime/MalleableProvider'
import { driftReport } from '../ship/drift'
import manifestJson from '../../.malleable/manifest.json'
import storeJson from '../../.malleable/overrides.json'
import type { Manifest, Store } from '../schema'
import './harness.css'
import '../tokens/primitives.css'
import '../../fixtures/app/recipes/recipes.css'
import '../../fixtures/app/views/views.css'

const MANIFEST = manifestJson as Manifest
const INITIAL = storeJson as Store

export function Harness() {
  const [enabled, setEnabled] = useState(true)
  return (
    <MalleableProvider manifest={MANIFEST} seeds={OBSIDIAN} initialStore={INITIAL}>
      <Chrome enabled={enabled} onToggle={setEnabled} />
      <main className="hx__stage">
        <Gallery />
        <Settings />
      </main>
      <Overlay enabled={enabled} />
    </MalleableProvider>
  )
}

function Chrome({ enabled, onToggle }: { enabled: boolean; onToggle: (v: boolean) => void }) {
  const { store, manifest, seeds, reset } = useMalleable()
  const report = useMemo(() => driftReport(store, manifest), [store, manifest])
  const counts = {
    instance: store.overrides.filter((o) => o.target.scope === 'instance').length,
    view: store.overrides.filter((o) => o.target.scope === 'view').length,
    component: store.overrides.filter((o) => o.target.scope === 'component').length,
    system: store.overrides.filter((o) => o.target.scope === 'system').length,
  }
  return (
    <header className="hx__chrome" data-malleable-chrome>
      <div className="hx__brand">
        <span className="hx__mark">STRATA</span>
        <span className="hx__sub">malleable layer</span>
      </div>

      <div className="hx__counts">
        {(['instance', 'view', 'component', 'system'] as const).map((scope) => (
          <span key={scope} className={`hx__count ${counts[scope] ? 'is-live' : ''}`}>
            <b>{counts[scope]}</b> {scope}
          </span>
        ))}
        {report.redundant.length > 0 && (
          <span className="hx__count hx__count--dead">
            <b>{report.redundant.length}</b> redundant
          </span>
        )}
      </div>

      <div className="hx__seeds" title="the six numbers the engine compiles from">
        {(['hue', 'chroma', 'warmth', 'energy', 'density'] as const).map((k) => (
          <span key={k} className={counts.system && k === 'energy' ? 'is-moved' : undefined}>
            {k} <b>{seeds[k]}</b>
          </span>
        ))}
      </div>

      <div className="hx__actions">
        <button type="button" className="hx__btn" onClick={reset}>
          reset
        </button>
        <label className="hx__toggle">
          <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} />
          <span>malleable</span>
        </label>
      </div>
    </header>
  )
}
