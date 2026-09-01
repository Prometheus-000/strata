/** LAYER 2 — RECIPE. Status is ink and wash, split by role. */
import type { ReactNode } from 'react'

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'accent' | 'positive'
  children: ReactNode
}) {
  return <span data-sid="Badge.span.st-badge" className={`st-badge st-badge--${tone}`}>{children}</span>
}
