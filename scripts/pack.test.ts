/**
 * THE TARBALL CARRIES WHAT THE CLI IMPORTS.
 *
 * `package.json`'s `files` list names `src/init.ts` by hand, so a new module
 * beside it is published only if someone remembers. Nobody did: `src/voices.ts`
 * shipped without being packed and every adopter's CLI died on the first
 * command with ERR_MODULE_NOT_FOUND. The smoke test caught it after the push,
 * which is the right place to catch it and the wrong place to find out.
 *
 * The release workflow has a guard, and it is a hand-written list of paths —
 * the same kind of thing that failed here, a step further along. This reads the
 * imports instead: whatever the entry points reach, the tarball carries.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

const REPO = path.join(path.dirname(new URL(import.meta.url).pathname), '..')

const isFile = (p: string) => {
  try {
    return fs.statSync(p).isFile()
  } catch {
    return false
  }
}

/** The entry points a product runs: the CLI, and the MCP server beside it. */
const ENTRIES = ['bin/strata.mjs', 'bin/main.mjs', 'mcp/main.mjs']

/** Every local file those entries reach, following relative imports as far as they go. */
function reached(from: readonly string[]): Set<string> {
  const seen = new Set<string>()
  const queue = [...from]
  while (queue.length) {
    const rel = queue.shift()!
    if (seen.has(rel)) continue
    const abs = path.join(REPO, rel)
    if (!isFile(abs)) continue
    seen.add(rel)
    const text = fs.readFileSync(abs, 'utf8')
    for (const m of text.matchAll(/(?:from|import)\s*\(?\s*['"](\.[^'"]+)['"]/g)) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), m[1]))
      // A package's own subpath imports resolve through node_modules, not here.
      if (target.startsWith('..')) continue
      // A bare path may name a directory, which is not a module to follow.
      for (const c of [target, `${target}.ts`, `${target}.mjs`, `${target}/index.ts`]) if (isFile(path.join(REPO, c))) queue.push(c)
    }
  }
  return seen
}

test('the tarball carries every file the CLI imports', () => {
  const packed = new Set(
    (JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json'], { cwd: REPO, encoding: 'utf8' })) as Array<{ files: Array<{ path: string }> }>)[0].files.map((f) => f.path),
  )
  const missing = [...reached(ENTRIES)].filter((f) => !packed.has(f)).sort()
  assert.deepEqual(
    missing,
    [],
    `these are imported by the CLI and are not in package.json's "files", so a product that installs Strata cannot run it:\n  ${missing.join('\n  ')}`,
  )
})

test('every entry point is itself packed', () => {
  const packed = new Set(
    (JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json'], { cwd: REPO, encoding: 'utf8' })) as Array<{ files: Array<{ path: string }> }>)[0].files.map((f) => f.path),
  )
  for (const e of ENTRIES) assert.ok(packed.has(e), `${e} is an entry point and is not in the tarball`)
})
