/**
 * THE PRODUCT'S FRAME FILE — `.strata/config.json`.
 *
 * Where the source is, where the tokens are written, whether the malleable
 * layer is mounted. This is frame, not a decision: an ordinary file a person
 * edits, read when a command starts, and never written by `decide()`. Every
 * default is the convention this repository already follows, so a product
 * with no file at all is laid out like this one — and this repository keeps
 * a file that says what it already does, because a path that lives in a
 * constant is a path an adopter cannot move.
 */
import fs from 'node:fs'
import path from 'node:path'

export interface ProductConfig {
  /** Directories the evaluators read: where components and stylesheets live, relative to the root. */
  source: string[]
  /** Where the token projections are written — primitives.css, semantic.css, tokens.json — or null for a product that keeps its own tokens. */
  tokens: string | null
  /** The ledger projection. Defaults to `<tokens>/ledger.json`. */
  ledger: string
  /** The malleable layer, when the product mounts one: where `.malleable/` lives (default: the root) and the app tree under it. */
  malleable?: { root?: string; source: string }
  /** Prose scan settings a product may add to the defaults: directory names never descended into, package roots. */
  prose?: { skip?: string[]; packages?: string[] }
}

export const CONFIG_PATH = '.strata/config.json'

/** What a product is when it says nothing: source in `src`, tokens beside it. */
export const DEFAULT_CONFIG: ProductConfig = { source: ['src'], tokens: 'src/tokens', ledger: 'src/tokens/ledger.json' }

export function problemsWithConfig(c: unknown): string[] {
  if (typeof c !== 'object' || c === null || Array.isArray(c)) return ['the config is not an object']
  const x = c as Record<string, unknown>
  const p: string[] = []
  if (x.source !== undefined && !(Array.isArray(x.source) && x.source.length > 0 && x.source.every((s) => typeof s === 'string' && s)))
    p.push('source is a non-empty list of directories')
  if (x.tokens !== undefined && x.tokens !== null && (typeof x.tokens !== 'string' || !x.tokens)) p.push('tokens is a directory, or null')
  if (x.ledger !== undefined && (typeof x.ledger !== 'string' || !x.ledger)) p.push('ledger is a file path')
  if (x.malleable !== undefined) {
    const m = x.malleable as Record<string, unknown> | null
    if (typeof m !== 'object' || m === null || typeof m.source !== 'string' || !m.source) p.push('malleable names the app tree as source')
    else if (m.root !== undefined && typeof m.root !== 'string') p.push('malleable.root is a directory')
  }
  return p
}

/** The product's config with the defaults filled in; a product with no file is a product laid out like this repository. */
export function loadConfig(root: string): ProductConfig {
  const p = path.join(root, CONFIG_PATH)
  if (!fs.existsSync(p)) return { ...DEFAULT_CONFIG }
  let parsed: unknown
  try {
    parsed = JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {
    throw new Error(`${CONFIG_PATH} is not JSON`)
  }
  const problems = problemsWithConfig(parsed)
  if (problems.length) throw new Error(`${CONFIG_PATH}: ${problems.join('; ')}`)
  const x = parsed as Partial<ProductConfig>
  const tokens = x.tokens === undefined ? DEFAULT_CONFIG.tokens : x.tokens
  return {
    source: x.source ?? DEFAULT_CONFIG.source,
    tokens,
    ledger: x.ledger ?? (tokens ? path.posix.join(tokens, 'ledger.json') : DEFAULT_CONFIG.ledger),
    ...(x.malleable ? { malleable: x.malleable } : {}),
    ...(x.prose ? { prose: x.prose } : {}),
  }
}

export function writeConfig(root: string, config: Partial<ProductConfig>): void {
  const p = path.join(root, CONFIG_PATH)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(config, null, 2) + '\n')
}

/** The three token projections and the primitives they stand on, by path — or null when the product keeps its own tokens. */
export function tokenPaths(c: ProductConfig): { primitives: string; semantic: string; tokens: string; ledger: string } | null {
  if (!c.tokens) return null
  return {
    primitives: path.posix.join(c.tokens, 'primitives.css'),
    semantic: path.posix.join(c.tokens, 'semantic.css'),
    tokens: path.posix.join(c.tokens, 'tokens.json'),
    ledger: c.ledger,
  }
}
