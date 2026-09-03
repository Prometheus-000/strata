/**
 * `npm run tokens` — regenerate the Layer 0 projections through the ledger.
 * The work lives in `src/theme/emit.ts`; this prints what it did.
 */
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { emitTokens } from '../src/theme/emit'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const { counts, added, stale, receipts } = emitTokens(root)

console.log('emitted src/tokens/semantic.css and src/tokens/tokens.json from generateTheme.ts')
console.log(`ledger: ${counts.kept} kept · ${counts.cut} cut · ${counts.proposed} proposed (unreviewed — ship as generated)`)
for (const name of added) console.log(`  + ${name} proposed`)
for (const r of receipts) console.log(`  ✂ ${r.token} → ${r.to}  (${r.by ?? 'human'}${r.reason ? `: ${r.reason}` : ''})`)
for (const name of stale)
  console.log(`  ~ ${name} is in the ledger but the engine no longer emits it — a decision about nothing; remove it by hand`)
