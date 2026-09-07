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
import { RULES_PATH } from '@strata/substrate/grammar'
import { TEMPLATE_GRAMMAR } from '../src/init'
import { PRIMITIVES_SOURCE } from '../src/theme/init'

const REPO = path.join(path.dirname(new URL(import.meta.url).pathname), '..')

let cached: Set<string> | undefined
/** What `npm pack` would put in the tarball. Asked once; it is not a fast question. */
function packedFiles(): Set<string> {
  cached ??= new Set(
    (JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json'], { cwd: REPO, encoding: 'utf8' })) as Array<{ files: Array<{ path: string }> }>)[0].files.map((f) => f.path),
  )
  return cached
}

const isFile = (p: string) => {
  try {
    return fs.statSync(p).isFile()
  } catch {
    return false
  }
}

/** The entry points a product runs: the CLI, and the MCP server beside it. */
const ENTRIES = ['bin/strata.mjs', 'bin/main.mjs', 'mcp/main.mjs']

/**
 * Every file those entries reach.
 *
 * Relative imports, and the bundled workspaces too: `@strata/substrate/cli` is
 * a package import that resolves to a file the tarball has to carry, and
 * following only the relative ones covered none of the three packages the CLI
 * cannot run without.
 */
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
    const push = (target: string) => {
      for (const c of [target, `${target}.ts`, `${target}.mjs`, `${target}/index.ts`]) if (isFile(path.join(REPO, c))) queue.push(c)
    }
    for (const m of text.matchAll(/(?:from|import)\s*\(?\s*['"](\.[^'"]+)['"]/g)) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), m[1]))
      // A bare path may name a directory, which is not a module to follow.
      if (!target.startsWith('..')) push(target)
    }
    // A workspace this package bundles: `@strata/substrate/cli` is
    // `node_modules/@strata/substrate/src/cli.ts` in the tarball, and its own
    // relative imports are followed from there.
    for (const m of text.matchAll(/(?:from|import)\s*\(?\s*['"]@strata\/([\w-]+)(?:\/([^'"]+))?['"]/g))
      push(path.posix.join('node_modules/@strata', m[1], 'src', m[2] ?? 'index'))
  }
  return seen
}

test('the tarball carries every file the CLI imports', () => {
  const packed = packedFiles()
  const missing = [...reached(ENTRIES)].filter((f) => !packed.has(f)).sort()
  assert.deepEqual(
    missing,
    [],
    `these are imported by the CLI and are not in package.json's "files", so a product that installs Strata cannot run it:\n  ${missing.join('\n  ')}`,
  )
})

test('the tarball carries the files the CLI reads at runtime', () => {
  // Not imports: read by path, from constants. A hand-written list of these
  // lived in the release workflow, which is the kind of list that goes stale —
  // and would not have named `src/voices.ts` when that shipped unpacked.
  const packed = packedFiles()
  for (const f of [RULES_PATH, TEMPLATE_GRAMMAR, PRIMITIVES_SOURCE, 'skills', 'mcp'])
    assert.ok([...packed].some((p) => p === f || p.startsWith(`${f}/`)), `${f} is read at runtime and is not in the tarball`)
})

test('the bundled workspaces are bundled', () => {
  // `bundleDependencies` is the promise; this is whether it was kept. The CLI
  // is three packages in a trench coat and carries none of them by itself.
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8')) as { bundleDependencies?: string[] }
  const packed = packedFiles()
  assert.ok(pkg.bundleDependencies?.length, 'the package says which workspaces travel with it')
  for (const name of pkg.bundleDependencies ?? [])
    assert.ok([...packed].some((p) => p.startsWith(`node_modules/${name}/`)), `${name} is bundled by name and no file of it is in the tarball`)
})

test('every entry point is itself packed', () => {
  const packed = packedFiles()
  for (const e of ENTRIES) assert.ok(packed.has(e), `${e} is an entry point and is not in the tarball`)
})
