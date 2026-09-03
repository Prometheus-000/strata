/**
 * LAYER 3 — LOCAL. A dialog that owns its own open state and its own Escape,
 * so it carries its dismissal context wherever it is moved.
 */
import { useState } from 'react'
import { Button } from '../recipes/Button'

export function PublishDialog() {
  const [open, setOpen] = useState(false)
  return (
    <div data-sid="PublishDialog.div.publish" data-view="publish-dialog" data-region="PublishDialog" className="publish">
      <Button variant="ghost" onClick={() => setOpen(true)}>
        Publish theme
      </Button>
      {open && (
        <div data-sid="PublishDialog.div.publish__dialog"
          role="dialog"
          aria-modal="true"
          aria-label="Publish theme"
          className="publish__dialog"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false)
          }}
        >
          <p data-sid="PublishDialog.p.publish__body" className="publish__body">Writes the current seeds to tokens.json. Versioned and reversible.</p>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}
