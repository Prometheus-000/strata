/**
 * THE SKY — the record as a night sky, the counterpart of the field.
 *
 * The field is the record from above: one plane, height where decisions
 * are. The sky is the same record with depth: every record the engine can
 * draw at a distance, one record as a galaxy, its families as systems, each
 * target a planet massed by the decisions made on it, and each of those a
 * moon in time order. One continuous zoom joins them, and nothing is a
 * different program at a different distance.
 *
 * The neighbours are synthetic records, and say so on their labels; the
 * only real one is the product's own. The sky's ground is the theme's dark
 * surface whatever the page's ground is, because the night sky is a canvas.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import raw from '../../.strata/decisions.jsonl?raw'
import LEDGER from '../theme/ledger.json'
import type { Ledger } from '../theme/ledger'
import { useTheme } from '../theme/ThemeContext'
import { neighbourCentre, type Seeds, type Sky as SkyRecord, type SkyNode } from '@strata/identity'
import { parseRecord, skyOf, syntheticStream } from '@strata/identity/record'
import { paletteFrom } from '../identity/palette'
import { useReducedMotion } from '../identity/Identity'
import { AppearanceDot } from '../site/AppearanceDot'
import { mountSky, type Readout, type SkyScene } from './scene'

const BASE = import.meta.env.BASE_URL

/** The real record, and three synthetic ones at a distance, so there is a supercluster to come out to. */
function skies(): SkyRecord[] {
  return [
    skyOf('the record', parseRecord(raw)),
    skyOf('a synthetic record · seed 7', syntheticStream(7), neighbourCentre('seed 7', 0)),
    skyOf('a synthetic record · seed 11', syntheticStream(11, 120), neighbourCentre('seed 11', 1)),
    skyOf('a synthetic record · seed 3', syntheticStream(3, 300), neighbourCentre('seed 3', 2)),
  ]
}

const describeDistance = (d: number) => (d >= 1 ? `${d.toFixed(2)} record radii out` : d >= 0.01 ? `${(d * 1000).toFixed(0)} thousandths in` : `${(d * 1e5).toFixed(0)} hundred-thousandths in`)

export function Sky() {
  const { seeds } = useTheme()
  const reduced = useReducedMotion()
  const all = useMemo(skies, [])
  // The night: the theme's dark ground and ink, whatever the page is doing.
  const night = useMemo(() => paletteFrom({ ...seeds, appearance: 'dark' }, LEDGER as Ledger), [seeds])
  const paletteFor = useMemo(() => {
    const cache = new Map<string, ReturnType<typeof paletteFrom>>()
    return (s: Seeds) => {
      const key = JSON.stringify(s)
      let p = cache.get(key)
      if (!p) {
        p = paletteFrom(s, LEDGER as Ledger)
        cache.set(key, p)
      }
      return p
    }
  }, [])
  const canvas = useRef<HTMLCanvasElement>(null)
  const labels = useRef<HTMLDivElement>(null)
  const scene = useRef<SkyScene | null>(null)
  const [readout, setReadout] = useState<Readout>({ level: 'supercluster', what: 'every record the engine can draw', distance: 22.8 })

  useEffect(() => {
    if (!canvas.current || !labels.current) return
    const s = mountSky(canvas.current, labels.current, { skies: all, palette: night, paletteFor, onReadout: setReadout, reduced })
    scene.current = s
    return () => {
      s.dispose()
      scene.current = null
    }
  }, [all, night, paletteFor, reduced])

  const fly = (node: SkyNode) => scene.current?.flyTo(node)

  return (
    <div className="sky">
      <canvas ref={canvas} className="sky__stage" aria-label="The record as a sky: every record, one record, its systems, their targets, their histories" />
      {/* The labels sit on the night, so they take the night's ink, not the page's. */}
      <div ref={labels} className="sky__labels" aria-hidden style={{ ['--sky-ink' as string]: night.ink } as React.CSSProperties} />
      <aside className="sky__panel">
        <div className="sky__brand">
          <a className="sky__mark" href={BASE}>
            Strata
          </a>
          <AppearanceDot />
        </div>
        <span className="sky__kicker">The sky</span>
        <h1 className="sky__title">The record, with depth.</h1>
        <p className="sky__lede">One zoom, from every record the engine can draw to the moons of one target. Scroll to go in or out. Click a body to fly to it.</p>
        <dl className="sky__readout">
          <div>
            <dt>Level</dt>
            <dd className="sky__level">{readout.level}</dd>
          </div>
          <div>
            <dt>Which is</dt>
            <dd>{readout.what}</dd>
          </div>
          <div>
            <dt>Distance</dt>
            <dd>{describeDistance(readout.distance)}</dd>
          </div>
        </dl>
        <div className="sky__records" role="group" aria-label="Records">
          {all.map((s) => (
            <button key={s.name} type="button" onClick={() => fly(s.root)}>
              <span>{s.name}</span>
              <span className="sky__mass">{s.root.mass}</span>
            </button>
          ))}
        </div>
        <button type="button" className="sky__home" onClick={() => scene.current?.home()}>
          Out to the supercluster
        </button>
        <nav className="sky__nav" aria-label="Pages">
          <a href={`${BASE}identity.html`}>The field</a>
          <a href={BASE}>Hub</a>
        </nav>
      </aside>
    </div>
  )
}
