/**
 * LAYER 3 — LOCAL. A search form: self-contained, no props, no state from
 * anywhere else — so it can be moved to any container and still render.
 */
import { Button } from '../recipes/Button'

export function Filters() {
  return (
    <form data-sid="Filters.form.filters" data-view="filters" data-region="Filters" role="search" className="filters" onSubmit={(e) => e.preventDefault()}>
      <input data-sid="Filters.input.filters__input" className="filters__input" type="search" placeholder="Filter presets" aria-label="Filter presets" />
      <Button variant="secondary" type="submit">
        Filter
      </Button>
    </form>
  )
}
