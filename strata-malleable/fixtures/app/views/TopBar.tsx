/**
 * LAYER 3 — LOCAL. The page's banner. The `<header>` is here, inside the
 * component, not at the page — which is where landmarks usually live, and why
 * the structure reader looks through `<TopBar />` to find it.
 */
import { Badge } from '../recipes/Badge'

export function TopBar() {
  return (
    <header data-sid="TopBar.header.topbar" data-view="top-bar" data-region="TopBar" className="topbar">
      <a data-sid="TopBar.a.topbar__logo" className="topbar__logo" href="#top">
        Strata
      </a>
      <nav data-sid="TopBar.nav.topbar__nav" className="topbar__nav" aria-label="Sections">
        <a data-sid="TopBar.a.topbar__link" className="topbar__link" href="#presets">Presets</a>
        <a data-sid="TopBar.a.topbar__link#2" className="topbar__link" href="#workspace">Workspace</a>
        <Badge tone="accent">malleable</Badge>
      </nav>
    </header>
  )
}
