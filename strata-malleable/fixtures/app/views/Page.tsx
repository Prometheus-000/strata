/**
 * LAYER 3 — LOCAL. The page: the composition every region sits in.
 *
 * Structure is read from here. The landmarks — `<main>`, `<aside>`,
 * `<footer>`, and the `<header>` inside `<TopBar />` — are the containers, and
 * each component call site under one is a region that can be dragged to
 * another. Nothing is declared: this file is the state, and a move is a diff
 * of it.
 */
import { Filters } from './Filters'
import { Gallery } from './Gallery'
import { PublishDialog } from './PublishDialog'
import { Settings } from './Settings'
import { TopBar } from './TopBar'

/** A local region, defined here rather than in its own file. */
function Notes() {
  return (
    <div data-sid="Notes.div.notes" data-view="notes" data-region="Notes" className="notes">
      <h3 data-sid="Notes.h3.notes__title" className="notes__title">Notes</h3>
      <p data-sid="Notes.p.notes__body" className="notes__body">Drag a corner to change a radius. Drag a region to move it.</p>
    </div>
  )
}

export function Page() {
  return (
    <div data-sid="Page.div.page" data-view="page" data-region="Page" className="page">
      <TopBar />
      <main data-sid="Page.main.page__main" className="page__main">
        <Filters />
        <Gallery />
        <Settings />
      </main>
      <aside data-sid="Page.aside.page__aside" className="page__aside">
        <Notes />
        <PublishDialog />
      </aside>
      <footer data-sid="Page.footer.page__foot" className="page__foot">
        <span data-sid="Page.span.page__note" className="page__note">STRATA — a grammar, not a library</span>
      </footer>
    </div>
  )
}
