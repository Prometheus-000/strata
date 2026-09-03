/**
 * `npm run ledger` — kept as an alias. The commands live in `src/theme/cli.ts`
 * and every write is a decision on the record; `npx strata cut …` is the same
 * call.
 */
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { runTheme } from '../src/theme/cli'

process.exit(runTheme(process.argv.slice(2), { root: join(dirname(fileURLToPath(import.meta.url)), '..') }))
