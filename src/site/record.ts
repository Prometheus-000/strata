/**
 * THE RECORD, as the site reads it: parsed once from `.strata/decisions.jsonl`
 * at build time, and the theme in force folded from it. The hub, the sky and
 * the identity page each parsed the same file; this is the one place that
 * does, so the seeds every page starts from are the seeds the record holds
 * rather than a constant that has to be kept in step with it.
 */
import raw from '../../.strata/decisions.jsonl?raw'
import type { Decision } from '@strata/substrate/decision'
import { seedsInForce } from '@strata/substrate/fold'
import { OBSIDIAN } from '../theme/generateTheme'

export const LOG: Decision[] = raw
  .split('\n')
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l) as Decision)

/** The seeds the record has in force — the theme every page opens on. */
export const HOUSE = seedsInForce(LOG, OBSIDIAN)
