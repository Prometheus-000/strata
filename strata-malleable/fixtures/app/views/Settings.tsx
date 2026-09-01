/**
 * LAYER 3 — LOCAL. A second view holding the same recipe, which is the only
 * way to see the difference between "every card here" and "the Card recipe".
 * Without it, view scope and component scope look identical and the promotion
 * control is a lie.
 */
import { Badge } from '../recipes/Badge'
import { Button } from '../recipes/Button'
import { Card } from '../recipes/Card'

export function Settings() {
  return (
    <section data-sid="Settings.section.settings" data-view="settings" className="settings">
      <header data-sid="Settings.header.settings__head" className="settings__head">
        <h2 data-sid="Settings.h2.settings__title" className="settings__title">Workspace</h2>
        <Badge tone="neutral">two cards</Badge>
      </header>
      <div data-sid="Settings.div.settings__stack" className="settings__stack">
        <Card
          mkey="appearance"
          title="Appearance"
          meta="seed · appearance"
          footer={<Button variant="ghost">Reset</Button>}
        >
          Dark and light are one flipped bit, not two stylesheets.
        </Card>
        <Card
          mkey="motion"
          title="Motion"
          meta="seed · energy"
          footer={<Button variant="ghost">Reset</Button>}
        >
          Reduced motion is honored at the stylesheet and again at runtime.
        </Card>
      </div>
    </section>
  )
}
