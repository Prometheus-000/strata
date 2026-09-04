/**
 * THIS PRODUCT'S PROSE SETTINGS — where its English lives, and what it retired.
 *
 * The scan itself is `substrate/src/prose.ts` and ships with Strata. What
 * cannot ship is which directories hold prose, which packages define scripts,
 * and which words this repository decided to stop using: those are one
 * product's facts, and an adopter's are different.
 *
 * Read by `bin/strata.mjs`, so `strata check` reports ghosts, and by
 * `scripts/prose.test.ts`, which is this repository choosing to fail its own
 * build on what the substrate only reports.
 */
import type { ProseOptions } from '@strata/substrate/prose'
import { SUBSTRATE_COMMANDS } from '@strata/substrate/cli'
import { THEME_COMMANDS } from '../src/theme/cli'
import { MALLEABLE_COMMANDS } from '../strata-malleable/src/cli'

export const PROSE: ProseOptions = {
  // `runs` is the bench's gitignored arms — copies of this repo, whose prose
  // is a snapshot of an older one by design. `fixtures` is a sample app.
  skip: ['node_modules', 'dist', 'runs', 'fixtures'],
  packages: ['.', 'substrate', 'strata-malleable', 'engine'],
  commands: [...SUBSTRATE_COMMANDS, ...THEME_COMMANDS, ...MALLEABLE_COMMANDS, 'help'],
  /**
   * Three phrases this repository retired, each of which survived in prose for
   * months after the thing it described was gone. They are allowed exactly
   * where the system remembers them on purpose: in a rule's `incident`, and in
   * the README's account of what was removed and why. The convention is one
   * word — a retired thing is named as "the old X" when the point is that it
   * is gone, and the lookbehind is the whole mechanism.
   */
  retired: [
    { pattern: /(?<!old )\bvalidator\b/i, why: 'there is no validator; evaluation replaced enforcement' },
    { pattern: /npm run validate/i, why: 'the script is gone' },
    { pattern: /correctness is not a taste question/i, why: 'a designer’s arrangement is the design; what breaks under it is code' },
  ],
  /**
   * A command named as history rather than as instruction. The system keeps
   * what it removed on purpose — the slot layer in an incident, this one in
   * the comment on the verb built to replace it — so the exemption names the
   * file that is allowed to remember it rather than trusting a whole file.
   */
  remembered: ['decide (strata-malleable/src/cli.ts)', 'decide (grammar/rules.json)'],
  /**
   * The grammar is prose too, and for a long time it was the only prose here
   * nothing read: `statement`, `reason` and `incident` are English in a JSON
   * file, and `source` points at the page the rule was argued on. The hub
   * projects all four onto the index, so a ghost in the grammar is a ghost on
   * the front page.
   */
  data: [{ file: 'grammar/rules.json', text: ['statement', 'reason', 'incident'], paths: ['source'] }],
}
