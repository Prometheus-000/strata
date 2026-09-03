/** LAYER 2 — RECIPE. Status is ink and wash, split by role. */
import type { ReactNode } from 'react'
import { defineControls } from '../../../src/controls/define'

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'accent' | 'positive'
  children: ReactNode
}) {
  return <span data-region="Badge" data-sid="Badge.span.st-badge" className={`st-badge st-badge--${tone}`}>{children}</span>
}

/** What may be changed about a Badge: its tone, picked on the object; its radius, within the pill. */
export const controls = defineControls(Badge, {
  tone: { options: ['neutral', 'accent', 'positive'] },
  radius: { range: [0, 24], snap: ['--radius-pill', '--radius-interactive', '--strata-radius-1'] },
})
