/**
 * LAYER 2 — RECIPE. Speaks the semantic tier, consumes Layer 1 behavior,
 * forkable by default. The malleable layer adds nothing to this file by hand:
 * `npm run id` stamps the identity attributes and nothing else.
 */
import type { ReactNode } from 'react'

export interface CardProps {
  title?: ReactNode
  meta?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  interactive?: boolean
  /** Stable instance key. Optional — without it the runtime falls back to ordinal. */
  mkey?: string
}

export function Card({ title, meta, children, footer, interactive, mkey }: CardProps) {
  return (
    <div data-sid="Card.div.st-card" className={`st-card ${interactive ? 'st-card--interactive' : ''}`} data-mkey={mkey}>
      <div data-sid="Card.div.st-card__head" className="st-card__head">
        {title && <h3 data-sid="Card.h3.st-card__title" className="st-card__title">{title}</h3>}
        {meta && <span data-sid="Card.span.st-card__meta" className="st-card__meta">{meta}</span>}
      </div>
      {typeof children === 'string' ? <p data-sid="Card.p.st-card__body" className="st-card__body">{children}</p> : children}
      {footer && <div data-sid="Card.div.st-card__footer" className="st-card__footer">{footer}</div>}
    </div>
  )
}
