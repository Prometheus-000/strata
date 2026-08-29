/**
 * LAYER 1 — BEHAVIOR. Headless native-<dialog> controller.
 * Owns the open/close lifecycle, Escape handling (via the platform),
 * and backdrop-click dismissal. Recipes style; this decides.
 */
import { useEffect, useRef, type MouseEvent } from 'react'

export function useDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  // A click that lands on the <dialog> element itself is a backdrop click —
  // clicks inside content land on descendants.
  const onBackdropClick = (e: MouseEvent) => {
    if (e.target === ref.current) onClose()
  }

  return { ref, dialogProps: { ref, onClose, onClick: onBackdropClick } }
}
