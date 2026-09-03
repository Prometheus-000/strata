#!/usr/bin/env node
/**
 * The malleable CLI, run with the library as its home: `.malleable/` and
 * `.strata/decisions.jsonl` both at the current directory. The commands
 * live in `src/cli.ts`; the product's `strata` CLI runs the same function.
 */
import process from 'node:process'
import { runMalleable } from '../src/cli.ts'

const argv = process.argv.slice(2)
const flag = (name) => {
  const i = argv.indexOf(`--${name}`)
  return i === -1 ? undefined : argv[i + 1]
}
const root = process.cwd()
process.exit(runMalleable(argv, { logRoot: root, root, source: flag('root') ?? process.env.MALLEABLE_ROOT ?? 'fixtures/app' }))
