/**
 * A second view, so that "views are flat and a node belongs to exactly one"
 * is something the tests can check rather than something the README claims.
 */
import { defineView } from '../../../src/grammar/grammar'

export default defineView({
  id: 'settings',
  label: 'Workspace settings',
  states: ['default', 'advanced'],
  defaultState: 'default',
  bands: [
    {
      id: 'masthead',
      columns: 1,
      rhythm: 'loose',
      behavior: { focusPhase: 'before-main', landmark: 'banner' },
    },
    { id: 'body', columns: 2, behavior: { focusPhase: 'main', landmark: 'main' } },
    {
      id: 'footer',
      columns: 1,
      rhythm: 'tight',
      behavior: { focusPhase: 'after-main', landmark: 'contentinfo' },
    },
  ],
})
