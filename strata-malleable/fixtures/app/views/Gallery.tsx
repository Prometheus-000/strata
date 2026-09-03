/**
 * LAYER 3 — LOCAL. Free, no permission required. Six cards from data: the
 * scenario the whole repo is built around. Change one, leave five alone,
 * then decide whether the change belongs to the five, to the recipe, or to
 * the system.
 */
import { Badge } from '../recipes/Badge'
import { Button } from '../recipes/Button'
import { Card } from '../recipes/Card'

const RELEASES = [
  { id: 'obsidian', name: 'Obsidian', meta: '250° · mono', note: 'The house voice. Dark, monochrome, slate-cast, calm.' },
  { id: 'gallery', name: 'Gallery', meta: '250° · mono', note: 'The same six numbers on paper. Light is one flipped bit.' },
  { id: 'ember', name: 'Ember', meta: '40° · 0.170', note: 'Kinetic and warm — energy buys shape as well as speed.' },
  { id: 'ultraviolet', name: 'Ultraviolet', meta: '300° · 0.200', note: 'Electric chroma, cool cast, spring easing throughout.' },
  { id: 'meadow', name: 'Meadow', meta: '135° · 0.120', note: 'Airy density, calm motion, green at low chroma.' },
  { id: 'glacier', name: 'Glacier', meta: '220° · 0.100', note: 'Cool slate neutrals and the slowest glide in the set.' },
]

export function Gallery() {
  return (
    <section data-region="Gallery" data-sid="Gallery.section.gallery" data-view="gallery" className="gallery">
      <header data-sid="Gallery.header.gallery__head" className="gallery__head">
        <h2 data-sid="Gallery.h2.gallery__title" className="gallery__title">Presets</h2>
        <Badge tone="accent">six seeds each</Badge>
      </header>
      <div data-sid="Gallery.div.gallery__grid" className="gallery__grid">
        {RELEASES.map((r) => (
          <Card
            key={r.id}
            mkey={r.id}
            title={r.name}
            meta={r.meta}
            interactive
            footer={<Button variant="secondary">Apply</Button>}
          >
            {r.note}
          </Card>
        ))}
      </div>
    </section>
  )
}
