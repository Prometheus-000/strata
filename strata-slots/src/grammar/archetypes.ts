/**
 * Starting grammars.
 *
 * These are seeds, not schemas. **Nothing validates a grammar against an
 * archetype** — the fastest way to use one is to delete from it, and the
 * comments say so at the point where someone is deciding.
 *
 * `document` ships `main` with two columns to demonstrate that columns are
 * peers, not to predict that anyone's main region has two things in it. That
 * distinction is the whole reason these are allowed to exist: a template that
 * teaches a rule is guidance, and a template that predicts a layout is a page
 * builder.
 */
import type { Band, StateId } from '../schema'

export interface Archetype {
  name: string
  summary: string
  bands: Array<Band & { why: string }>
}

export const ARCHETYPES: Record<string, Archetype> = {
  document: {
    name: 'document',
    summary: 'a page: something above the content, the content, something below',
    bands: [
      {
        id: 'masthead',
        columns: 1,
        rhythm: 'loose',
        behavior: { focusPhase: 'before-main', landmark: 'banner' },
        why: 'Reachable before the main content. Delete it if this view has no banner.',
      },
      {
        id: 'main',
        columns: 2,
        behavior: { focusPhase: 'main', landmark: 'main' },
        why: 'Two columns because features here are peers — swapping them is taste, not meaning. Narrow to 1 if only one region ever sits here.',
      },
      {
        id: 'footer',
        columns: 1,
        rhythm: 'tight',
        behavior: { focusPhase: 'after-main', landmark: 'contentinfo' },
        why: 'After the main content in focus order, which is what `after-main` means.',
      },
    ],
  },

  workbench: {
    name: 'workbench',
    summary: 'a tool: navigation, a canvas, an inspector beside it',
    bands: [
      {
        id: 'masthead',
        columns: 1,
        behavior: { focusPhase: 'before-main', landmark: 'banner' },
        why: 'Title, account, global actions.',
      },
      {
        id: 'rail',
        columns: 1,
        behavior: { focusPhase: 'before-main', landmark: 'navigation' },
        why: 'Navigation must be reachable before what it navigates to. Separate from masthead because the landmark differs — that is the test for a band.',
      },
      {
        id: 'canvas',
        columns: 1,
        behavior: { focusPhase: 'main', landmark: 'main' },
        why: 'The thing being worked on. One column: a canvas has no peer.',
      },
      {
        id: 'inspector',
        columns: 1,
        behavior: { focusPhase: 'main', dismissible: true, landmark: 'complementary' },
        why: 'Dismissible, so a panel that closes on Escape has somewhere legal to live. Without this, anything requiring `dismissible` is stuck.',
      },
      {
        id: 'status',
        columns: 2,
        rhythm: 'tight',
        behavior: { focusPhase: 'after-main', landmark: 'contentinfo' },
        why: 'Counts, sync state, progress — read after the work, not before it.',
      },
    ],
  },

  feed: {
    name: 'feed',
    summary: 'a stream: filters above it, something alongside',
    bands: [
      {
        id: 'masthead',
        columns: 1,
        rhythm: 'loose',
        behavior: { focusPhase: 'before-main', landmark: 'banner' },
        why: 'Title and identity.',
      },
      {
        id: 'lede',
        columns: 2,
        behavior: { focusPhase: 'before-main', landmark: 'search' },
        why: 'Filters and search must come before the results they filter — that is a real accessibility rule, not a layout preference.',
      },
      {
        id: 'stream',
        columns: 1,
        behavior: { focusPhase: 'main', landmark: 'main' },
        why: 'The feed itself.',
      },
      {
        id: 'aside',
        columns: 1,
        behavior: { focusPhase: 'main', dismissible: true, landmark: 'complementary' },
        why: 'Named for its role, not its side — `aside` survives right-to-left and stacking; `right` does not.',
      },
      {
        id: 'footer',
        columns: 2,
        rhythm: 'tight',
        behavior: { focusPhase: 'after-main', landmark: 'contentinfo' },
        why: 'Legal, provenance, links.',
      },
    ],
  },

  surface: {
    name: 'surface',
    summary: 'a dialog or sheet: dismissible throughout',
    bands: [
      {
        id: 'header',
        columns: 1,
        behavior: { focusPhase: 'before-main', dismissible: true },
        why: 'Dismissible everywhere, because a surface is a dismissal context — Escape and click-outside mean something in all of it.',
      },
      {
        id: 'body',
        columns: 2,
        behavior: { focusPhase: 'main', dismissible: true, landmark: 'main' },
        why: 'Two columns for peers. Narrow to 1 for a simple confirm.',
      },
      {
        id: 'actions',
        columns: 1,
        rhythm: 'tight',
        behavior: { focusPhase: 'after-main', dismissible: true },
        why: 'Actions come last in focus order so the content is read before the choice.',
      },
    ],
  },

  blank: {
    name: 'blank',
    summary: 'nothing — derive it from your own features',
    bands: [],
  },
}

const q = (s: string) => `'${s.replace(/'/g, "\\'")}'`

function renderBand(b: Archetype['bands'][number]): string {
  const parts = [`id: ${q(b.id)}`, `columns: ${b.columns}`]
  if (b.rhythm) parts.push(`rhythm: ${q(b.rhythm)}`)
  if (b.behavior) {
    const inner = [
      b.behavior.focusPhase ? `focusPhase: ${q(b.behavior.focusPhase)}` : null,
      b.behavior.dismissible ? 'dismissible: true' : null,
      b.behavior.landmark ? `landmark: ${q(b.behavior.landmark)}` : null,
    ].filter(Boolean)
    parts.push(`behavior: { ${inner.join(', ')} }`)
  }
  return `    // ${b.why}\n    { ${parts.join(', ')} },`
}

export function renderView(id: string, states: StateId[], archetype: Archetype): string {
  const bands = archetype.bands.length
    ? archetype.bands.map(renderBand).join('\n')
    : `    // Derive these from your features — see GRAMMAR.md, "Deriving one".
    // 1. list every feature across all states
    // 2. group them: before the main content · is it · after it · needs dismissal
    // 3. each group is a band; columns = the most from that group in any one state`
  return `/**
 * The ${id} view.
 *
 * Started from the "${archetype.name}" archetype — ${archetype.summary}.
 * It is a seed, not a schema: delete bands you do not have, rename freely,
 * change the column counts. Nothing validates this against the archetype.
 *
 * The measure of a grammar is how much movement is free, not how many slots it
 * has: within a band, order is taste; across bands, order is meaning. See
 * GRAMMAR.md, and \`slots grammar\` for what this one currently gives you.
 */
import { defineView } from 'strata-slots'

export default defineView({
  id: ${q(id)},
  states: [${states.map(q).join(', ')}],
  defaultState: ${q(states[0])},
  bands: [
${bands}
  ],
})
`
}

const pascal = (s: string) =>
  s.replace(/(^|[^A-Za-z0-9])([a-z])/g, (_, __, c: string) => c.toUpperCase()).replace(/[^A-Za-z0-9]/g, '')

export function renderSurface(id: string, archetype: Archetype): string {
  const first = archetype.bands[0]
  const slot = first ? `${first.id}/1` : 'band/1'
  return `import { Feature, View } from 'strata-slots'

/**
 * The ${id} surface. Each <Feature> says where source puts it, which states
 * include it, and what it needs from wherever it sits.
 *
 * Run \`slots id\` after adding one — it stamps the stable \`fid\`. Never write
 * or edit a \`fid\` by hand, and never hand-edit \`placement\` in the .view.ts.
 */
export function ${pascal(id)}({ state }: { state?: string }) {
  return (
    <View id="${id}" state={state}>
      {/* A feature is a composed region, never a leaf element:
      <Feature slot="${slot}" requires="before-main">
        <YourRegion />
      </Feature> */}
    </View>
  )
}
`
}
