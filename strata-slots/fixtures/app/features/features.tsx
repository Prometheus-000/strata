/**
 * The features. A feature is a composed region — a heading with a badge, a grid
 * of cards, a feed — never a leaf element. What is inside one is not this
 * repo's business; that it is a region that can move somewhere else is.
 */
import type { ReactNode } from 'react'

function Region({ tone = 'plain', title, meta, children }: {
  tone?: 'plain' | 'accent' | 'quiet'
  title: string
  meta?: string
  children?: ReactNode
}) {
  return (
    <section className={`region region--${tone}`}>
      <header className="region__head">
        <h3 className="region__title">{title}</h3>
        {meta && <span className="region__meta">{meta}</span>}
      </header>
      {children}
    </section>
  )
}

export function Masthead() {
  return (
    <Region tone="accent" title="Presets" meta="six seeds each">
      <p className="region__body">
        A theme is not a stylesheet. It is five numbers and a flipped bit.
      </p>
    </Region>
  )
}

export function Filters() {
  return (
    <Region title="Filters" meta="4">
      <div className="chips">
        {['dark', 'light', 'warm', 'kinetic'].map((c) => (
          <span key={c} className="chip">{c}</span>
        ))}
      </div>
    </Region>
  )
}

export function PresetGrid() {
  const names = ['Obsidian', 'Gallery', 'Ember', 'Ultraviolet', 'Meadow', 'Glacier']
  return (
    <Region title="Gallery" meta={`${names.length} presets`}>
      <div className="tiles">
        {names.map((n) => (
          <article key={n} className="tile">
            <b>{n}</b>
            <span>oklch</span>
          </article>
        ))}
      </div>
    </Region>
  )
}

export function Detail() {
  return (
    <Region tone="accent" title="Ember" meta="40° · 0.170">
      <p className="region__body">
        Kinetic and warm. Energy buys shape as well as speed, so the corners
        round as the easing springs.
      </p>
    </Region>
  )
}

export function Activity() {
  return (
    <Region tone="quiet" title="Activity" meta="live">
      <ul className="feed">
        <li>chroma 0.155 → 0.170</li>
        <li>appearance dark</li>
        <li>density 1.00</li>
      </ul>
    </Region>
  )
}

export function Footnote() {
  return (
    <Region tone="quiet" title="Provenance">
      <p className="region__body">Every value here is derived, none is typed.</p>
    </Region>
  )
}

export function SettingsHeader() {
  return <Region tone="accent" title="Workspace" meta="settings" />
}

export function Appearance() {
  return (
    <Region title="Appearance">
      <p className="region__body">Dark and light are one flipped bit.</p>
    </Region>
  )
}

export function Motion() {
  return (
    <Region title="Motion">
      <p className="region__body">Reduced motion is honoured twice, quietly.</p>
    </Region>
  )
}

export function Diagnostics() {
  return (
    <Region tone="quiet" title="Diagnostics" meta="advanced">
      <ul className="feed">
        <li>resolver: pure</li>
        <li>store: 0 assignments</li>
      </ul>
    </Region>
  )
}

export function SaveBar() {
  return (
    <Region tone="quiet" title="Save">
      <p className="region__body">Assignments are committed, not transcribed.</p>
    </Region>
  )
}
