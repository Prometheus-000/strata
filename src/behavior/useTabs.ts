/**
 * LAYER 1 — BEHAVIOR. Headless, unstyled, never forked.
 * A solved primitive is imported, never reimplemented: roving tabindex,
 * arrow-key navigation and ARIA wiring live here so no recipe rebuilds them,
 * because a second implementation is a second set of bugs and it is the copy
 * that rots.
 */
import { useId, useRef, useState, type KeyboardEvent } from 'react'

export interface TabDescriptor {
  id: string
}

export function useTabs<T extends TabDescriptor>(tabs: T[], defaultTab?: string) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id)
  const baseId = useId()
  const listRef = useRef<HTMLDivElement>(null)

  const onKeyDown = (e: KeyboardEvent) => {
    const idx = tabs.findIndex((t) => t.id === active)
    let next = -1
    if (e.key === 'ArrowRight') next = (idx + 1) % tabs.length
    if (e.key === 'ArrowLeft') next = (idx - 1 + tabs.length) % tabs.length
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = tabs.length - 1
    if (next >= 0) {
      e.preventDefault()
      setActive(tabs[next].id)
      const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      buttons?.[next]?.focus()
    }
  }

  const tabProps = (id: string) => ({
    role: 'tab' as const,
    id: `${baseId}-tab-${id}`,
    'aria-selected': id === active,
    'aria-controls': `${baseId}-panel-${id}`,
    tabIndex: id === active ? 0 : -1,
    onClick: () => setActive(id),
  })

  const listProps = { role: 'tablist' as const, ref: listRef, onKeyDown }

  const panelProps = {
    role: 'tabpanel' as const,
    id: `${baseId}-panel-${active}`,
    'aria-labelledby': `${baseId}-tab-${active}`,
  }

  return { active, setActive, listProps, tabProps, panelProps }
}
