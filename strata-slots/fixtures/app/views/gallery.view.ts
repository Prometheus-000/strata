/**
 * A view, declared. Not inferred from a route, a folder, or a component — a
 * designer said "this is a unit of design work" and wrote it down.
 *
 * The bands are the spacing grammar, and they carry the behaviour contract.
 * Slots are enumerated in reading order, and reading order *is* focus order, so
 * `focusPhase` is not a label on the arrangement — it is the arrangement,
 * written down where a check can reach it.
 */
import { defineView } from '../../../src/grammar/grammar'

export default defineView({
  id: 'gallery',
  label: 'Preset gallery',
  states: ['browse', 'focus'],
  defaultState: 'browse',
  bands: [
    {
      id: 'masthead',
      columns: 1,
      rhythm: 'loose',
      behavior: { focusPhase: 'before-main', landmark: 'banner' },
    },
    { id: 'lede', columns: 2, behavior: { focusPhase: 'before-main', landmark: 'search' } },
    { id: 'body', columns: 3, behavior: { focusPhase: 'main', landmark: 'main' } },
    {
      // The only band where "outside" is defined, so the only band a
      // dismissible region can legally sit in.
      id: 'aside',
      columns: 1,
      behavior: { focusPhase: 'main', dismissible: true, landmark: 'complementary' },
    },
    {
      id: 'footer',
      columns: 2,
      rhythm: 'tight',
      behavior: { focusPhase: 'after-main', landmark: 'contentinfo' },
    },
  ],
})
