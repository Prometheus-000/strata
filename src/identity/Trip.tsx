/**
 * THE TRIP — from the literal to the abstract, on one page.
 *
 * One state, read from the record at build time (or from a synthetic stream
 * under `?seed=`), rendered four ways at once and at four scales, with a
 * scrubber over the only free variable there is: how many decisions have
 * arrived. The page opens with the field as its ground, because the identity
 * is the picture and not the chrome around it. `?full` is the same field
 * alone, at the size of the room.
 */
import { useMemo } from 'react'
import { Button } from '../components'
import { Section } from '../site/Section'
import { SeedDials } from '../site/ThemeControls'
import { hashFromSeeds } from '../theme/ThemeContext'
import { AppearanceDot } from '../site/AppearanceDot'
import markUrl from './mark.svg'
import { seedState, type IdentityState } from '@strata/identity/field'
import type { Projection } from '@strata/identity/render'
import { Identity } from './Identity'
import { useIdentity } from './useIdentity'

const BASE = import.meta.env.BASE_URL

const STATIONS: Array<{ projection: Projection; name: string; note: string }> = [
  {
    projection: 'layers',
    name: 'Layers',
    note: 'The log as a cross-section. One line per decision, in order. The tick is where it lives; the mark is who chose — a human filled, an agent a ring.',
  },
  {
    projection: 'contours',
    name: 'Contours',
    note: 'Isolines of a field the decisions raise. Age spreads and settles but never erases. A cut travels to its fallback and leaves a hollow behind.',
  },
  {
    projection: 'field',
    name: 'Field',
    note: 'No lines. A lattice reads the same state, the way the dot after the wordmark reads a theme: presence, not outline.',
  },
  {
    projection: 'dot',
    name: 'Dot',
    note: 'The whole system at sixteen pixels: one contour, and a point for the present. This is the favicon. Nothing was drawn twice.',
  },
]

const RULES: Array<[string, string]> = [
  ['The state is the record.', 'One event per decision, appended and never removed. A visitor can add; nothing can take away.'],
  ['The same target always lands in the same place.', 'Position is a hash of what was decided about, so precedent is visible without being declared.'],
  ['Time is sequence, not the clock.', 'Two builds of one record look alike; two visitors see the same structure.'],
  ['Age spreads and settles; it never erases.', 'An old decision is broad, low relief. The floor is the rule that nothing returns to zero.'],
  ['A cut is mass moving to its fallback, and it leaves a hollow.', 'The record says a cut collapses to something; the picture says the same.'],
  ['A ship closes an epoch.', 'The live field carries only what has happened since the last ship; what came before is the stratum that ship froze, kept beneath, receding. Memory accumulates as strata, not as height, so the plane cannot fill.'],
  ['Flow is mass moving along a recorded consequence.', 'A promotion drains the decisions whose convergence earned it into the promoted place, and leaves a hollow where each was. A source already shipped rises out of its stratum.'],
  ['Candidacy is computed; promotion is decided.', 'Three decisions on distinct targets sharing one value are a dashed constellation until a hand promotes them. The picture says which of the two it is showing.'],
  ['The theme in force is a decision.', 'The live epoch wears the six seeds in force now; each stratum keeps the seeds its epoch closed under. Colour has no other source.'],
  ['Presence disturbs; only a decision is remembered.', 'The pointer bends the field and leaves no trace. A click is a deviation, and it stays.'],
  ['Nothing loops.', 'The record replays once and holds. What breathes afterwards is noise that never returns to its start.'],
]

/** The loading state: a record with one decision in it. */
const SEED: IdentityState = seedState()

export function Trip() {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const seedParam = params.get('seed')
  const full = params.has('full')
  /** `?still`: open settled, without the replay — for an embed or a still. */
  const still = params.has('still')
  const synthetic = seedParam !== null
  const { state, seeds, setSeeds, palette, paletteFor, reduced, pb, pick, stationOpts, dotOpts, heroOpts } = useIdentity({ seed: synthetic ? Number(seedParam) || 7 : undefined, still })

  const max = state.events.length
  const recordSeeds = useMemo(() => {
    let out: IdentityState['events'][number]['seeds']
    for (const e of state.events) if (e.seeds && e.i < pb.t) out = e.seeds
    return out
  }, [state, pb.t])
  const arrivedIndex = Math.min(max, Math.ceil(pb.t)) - 1
  const current = arrivedIndex >= 0 ? state.events[arrivedIndex] : undefined
  const status = pb.playing ? 'replaying' : pb.t >= max ? 'settled' : 'held'

  if (full) {
    return (
      <div className="identity-full">
        <Identity
          projection="contours"
          state={state}
          t={pb.t}
          opts={heroOpts}
          palette={palette} paletteFor={paletteFor}
          presence={pb.presence}
          label="Strata, the field"
          className="identity-full__canvas"
          onPointer={pb.setPointer}
          onPick={pick}
        />
        <a className="identity-full__exit" href={`${BASE}identity.html${synthetic ? `?seed=${seedParam}` : ''}`}>
          Strata
        </a>
      </div>
    )
  }

  return (
    <>
      <section className="identity-open" id="top">
        <Identity
          projection="contours"
          state={state}
          t={pb.t}
          opts={heroOpts}
          palette={palette} paletteFor={paletteFor}
          presence={pb.presence}
          label="Strata, the field"
          className="identity-open__canvas"
          onPointer={pb.setPointer}
          onPick={pick}
        />
        <nav className="wrap identity-open__nav" aria-label="Pages">
          <a href={BASE}>Hub</a>
          <a href={`${BASE}identity.html?full${synthetic ? `&seed=${seedParam}` : ''}`}>Installation</a>
          {synthetic ? <a href={`${BASE}identity.html`}>The record</a> : <a href={`${BASE}identity.html?seed=7`}>A synthetic record</a>}
        </nav>
        <div className="wrap identity-open__text">
          <div className="identity-open__brand">
            <span className="identity-open__mark">Strata</span>
            <AppearanceDot />
          </div>
          <p className="identity-open__lede">A persistent structure. Changing expressions. Memory of what came before.</p>
          <p className="identity-open__note">
            {max} decisions {synthetic ? 'in a synthetic record' : 'on the record'} · {status} · move to disturb, click to decide
          </p>
        </div>
      </section>

      <Section kicker="From the literal to the abstract" title="One state, four projections. None of them is the identity." sub="Every station below reads the same list of decisions at the same moment. The behaviour that produces them is what Strata looks like." id="trip">
        <div className="identity-trip">
          {STATIONS.map((s) => (
            <figure className="identity-station" key={s.projection}>
              <div className="identity-station__frame">
                <Identity
                  projection={s.projection}
                  state={state}
                  t={pb.t}
                  opts={s.projection === 'dot' ? dotOpts : stationOpts}
                  palette={palette} paletteFor={paletteFor}
                  presence={s.projection === 'layers' ? undefined : pb.presence}
                  label={s.name}
                  className="identity-station__canvas"
                  onPointer={s.projection === 'layers' ? undefined : pb.setPointer}
                  onPick={s.projection === 'layers' ? undefined : pick}
                />
                {s.projection === 'dot' && (
                  <div className="identity-station__tiny" aria-hidden>
                    <Identity projection="dot" state={state} t={pb.t} opts={dotOpts} palette={palette} paletteFor={paletteFor} n={16} label="The favicon at size" />
                  </div>
                )}
              </div>
              <figcaption>
                <span className="identity-station__name">{s.name}</span>
                <span className="identity-station__note">{s.note}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </Section>

      <Section kicker="Time" title="Nothing loops. The record replays once, then holds." sub="Time here is sequence, not the clock: the only free variable is how many decisions have arrived. The scrubber is the one way back." id="time">
        <div className="identity-time">
          <div className="identity-time__controls">
            {!reduced && (
              <Button variant="ghost" size="sm" onClick={pb.playing ? pb.pause : pb.t >= max ? () => { pb.setT(0); pb.play() } : pb.play}>
                {pb.playing ? 'Pause' : pb.t >= max ? 'From the start' : 'Play'}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => pb.step(-1)} aria-label="One decision back">
              −1
            </Button>
            <Button variant="ghost" size="sm" onClick={() => pb.step(1)} aria-label="One decision forward">
              +1
            </Button>
          </div>
          <label className="lab-slider identity-time__scrub">
            <span className="lab-slider__head">
              <span className="lab-slider__name">Decisions arrived</span>
              <span className="lab-slider__value">
                {pb.t.toFixed(reduced ? 0 : 2)} / {max}
              </span>
            </span>
            <input type="range" min={0} max={max} step={reduced ? 1 : 0.01} value={pb.t} onChange={(e) => pb.setT(Number(e.target.value))} />
          </label>
          <dl className="identity-receipt" aria-live="polite">
            {current ? (
              <>
                <div>
                  <dt>Decision</dt>
                  <dd>{current.receipt.id}</dd>
                </div>
                <div>
                  <dt>Kind</dt>
                  <dd>{current.kind === 'refused' ? `${current.receipt.kind} · refused` : current.receipt.kind}</dd>
                </div>
                <div>
                  <dt>Target</dt>
                  <dd>{current.receipt.target}</dd>
                </div>
                <div>
                  <dt>Decided by</dt>
                  <dd>{current.receipt.hand}</dd>
                </div>
                <div>
                  <dt>On</dt>
                  <dd>{current.receipt.date}</dd>
                </div>
              </>
            ) : (
              <div>
                <dt>Decision</dt>
                <dd>nothing decided yet</dd>
              </div>
            )}
          </dl>
        </div>
      </Section>

      <Section kicker="Scale" title="One system, from the tab strip to the wall." sub="The same engine at every size. The favicon and the mark are files, emitted from the record by a script; everything else here is live." id="scale">
        <div className="identity-scale">
          <figure className="identity-scale__item">
            <div className="identity-scale__box identity-scale__box--favicon">
              <Identity projection="dot" state={state} t={pb.t} opts={dotOpts} palette={palette} paletteFor={paletteFor} n={24} label="Favicon" />
            </div>
            <figcaption>
              <span className="identity-station__name">Favicon</span>
              <span className="identity-station__note">32 px, live. The file in the tab is this frame at the last build.</span>
            </figcaption>
          </figure>
          <figure className="identity-scale__item">
            <div className="identity-scale__box identity-scale__box--mark">
              <img src={markUrl} width={160} height={160} alt="The Strata mark: four isolines of the field the record raises, as emitted at the last build" />
            </div>
            <figcaption>
              <span className="identity-station__name">Mark</span>
              <span className="identity-station__note">160 px, a file. Regenerated by npm run identity, and by every build.</span>
            </figcaption>
          </figure>
          <figure className="identity-scale__item">
            <div className="identity-scale__box identity-scale__box--loading">
              <Identity projection="dot" state={SEED} t={1.5} opts={{ ...dotOpts, breath: pb.breath }} palette={palette} paletteFor={paletteFor} n={48} zoom={5} label="Loading" />
            </div>
            <figcaption>
              <span className="identity-station__name">Loading</span>
              <span className="identity-station__note">The seed phase: one decision, and the first contour around it, breathing.</span>
            </figcaption>
          </figure>
          <figure className="identity-scale__item">
            <a className="identity-scale__box identity-scale__box--full" href={`${BASE}identity.html?full${synthetic ? `&seed=${seedParam}` : ''}`}>
              <span>Open the installation</span>
            </a>
            <figcaption>
              <span className="identity-station__name">Installation</span>
              <span className="identity-station__note">The field alone, at the size of the room. The pointer as presence; a click as a decision.</span>
            </figcaption>
          </figure>
        </div>
      </Section>

      <Section kicker="The theme in force" title="Six seeds. The live epoch wears them; the strata keep theirs." sub="The same picker as the Theme Lab, driving the same engine. Here it is a trial: what you set paints the live field and the frame around it, and the strata beneath keep the theme the record says they closed under. The URL carries the seeds." id="theme">
        <div className="identity-theme">
          <div className="identity-theme__dials">
            <SeedDials seeds={seeds} onChange={setSeeds} />
          </div>
          <dl className="identity-receipt identity-theme__receipt">
            <div>
              <dt>In force</dt>
              <dd>{`${seeds.hue}° · c${seeds.chroma.toFixed(3)} · w${seeds.warmth.toFixed(2)} · e${seeds.energy.toFixed(2)} · d${seeds.density.toFixed(2)} · ${seeds.appearance}`}</dd>
            </div>
            <div>
              <dt>The record says</dt>
              <dd>{recordSeeds ? `${recordSeeds.hue}° · c${recordSeeds.chroma} · ${recordSeeds.appearance}, decided` : 'no seed decision has arrived'}</dd>
            </div>
            <div>
              <dt>Share</dt>
              <dd>{hashFromSeeds(seeds)}</dd>
            </div>
          </dl>
        </div>
      </Section>

      <Section kicker="The rules" title="The identity is a behaviour, not a drawing." sub="Like everything else in Strata, it is a set of rules with the reasons that earned them. The page and the files are projections of these." id="rules">
        <ol className="identity-rules">
          {RULES.map(([statement, reason]) => (
            <li key={statement}>
              <strong>{statement}</strong> {reason}
            </li>
          ))}
        </ol>
      </Section>

      <footer className="identity-foot wrap">
        <span>{synthetic ? `synthetic record, seed ${seedParam}` : 'the record, as of the last build'}</span>
        <span>the theme hash changes the rendering, never the state</span>
        <a href={BASE}>← Strata</a>
      </footer>
    </>
  )
}
