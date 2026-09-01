/**
 * Where a project keeps its views, and where the manifest goes.
 *
 * Resolved in three steps, most explicit first, because a tool that guesses
 * wrong about which directory it owns is a tool that rewrites the wrong files:
 *
 *   1. `--root <dir>` on the command line
 *   2. `slots.config.json` in the project root
 *   3. discovery — the shallowest directory containing a `*.view.ts`
 *
 * Discovery exists so `slots lint` works in a repo nobody has configured yet,
 * which is the difference between a tool you can try and a tool you must first
 * adopt. It reports what it found, so a wrong guess is visible rather than
 * silent.
 */
import fs from 'node:fs'
import path from 'node:path'

export interface SlotsConfig {
  /** Directory holding `*.view.ts` declarations and their view surfaces. */
  source: string
  /** Where the generated manifest is written. */
  manifest: string
  /** How the source directory was chosen, for the "is this right?" line. */
  origin: 'flag' | 'config' | 'discovered'
}

export const CONFIG_FILE = 'slots.config.json'
const DEFAULT_MANIFEST = '.slots/manifest.json'
const SKIP = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'out', 'coverage'])

/** Shallowest directory containing a view declaration. Breadth-first on purpose. */
export function discoverSource(root: string, maxDepth = 6): string | null {
  let frontier = ['.']
  for (let depth = 0; depth <= maxDepth && frontier.length; depth++) {
    const next: string[] = []
    for (const rel of frontier) {
      const abs = path.join(root, rel)
      let entries: fs.Dirent[]
      try {
        entries = fs.readdirSync(abs, { withFileTypes: true })
      } catch {
        continue
      }
      if (entries.some((e) => e.isFile() && e.name.endsWith('.view.ts'))) return rel
      for (const e of entries)
        if (e.isDirectory() && !SKIP.has(e.name) && !e.name.startsWith('.'))
          next.push(path.join(rel, e.name))
    }
    frontier = next
  }
  return null
}

export function resolveConfig(root: string, flagRoot?: string): SlotsConfig | { error: string } {
  if (flagRoot) return { source: flagRoot, manifest: DEFAULT_MANIFEST, origin: 'flag' }

  const configPath = path.join(root, CONFIG_FILE)
  if (fs.existsSync(configPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Partial<SlotsConfig>
      if (typeof parsed.source !== 'string')
        return { error: `${CONFIG_FILE} needs a "source" directory` }
      return {
        source: parsed.source,
        manifest: typeof parsed.manifest === 'string' ? parsed.manifest : DEFAULT_MANIFEST,
        origin: 'config',
      }
    } catch (err) {
      return { error: `${CONFIG_FILE} is not valid JSON — ${String(err)}` }
    }
  }

  const found = discoverSource(root)
  if (!found)
    return {
      error:
        `no *.view.ts found under ${root}. Point at your views with --root <dir>, ` +
        `or write ${CONFIG_FILE}:\n  { "source": "src/views" }`,
    }
  return { source: found, manifest: DEFAULT_MANIFEST, origin: 'discovered' }
}
