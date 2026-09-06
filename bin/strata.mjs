#!/usr/bin/env node
/**
 * `strata` — the one interface to the substrate.
 *
 * A launcher, because the CLI is TypeScript and a bin has to run from
 * `npx strata` in any directory, with nothing on the command line but the
 * verb. tsx's loader is registered here, at runtime, and the CLI itself is
 * `bin/main.mjs`. `tsconfig: false` keeps an adopter's own `paths` from
 * deciding how Strata resolves its modules. Registering twice in one process
 * — a harness that already runs under the loader — is guarded, not assumed
 * away.
 */
import { register } from 'tsx/esm/api'

const KEY = Symbol.for('strata.tsx')
if (!globalThis[KEY]) globalThis[KEY] = register({ tsconfig: false })
await import('./main.mjs')
