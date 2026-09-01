/**
 * Store persistence. The overrides file is design data, not build output — it
 * is committed, diffable, and reviewable, because "who changed the radius and
 * when" is a question a team asks out loud.
 */
import fs from 'node:fs'
import path from 'node:path'
import { OBSIDIAN } from '../engine/generateTheme'
import type { Manifest, Store } from '../schema'
import { emptyStore } from './store'

export const STORE_PATH = '.malleable/overrides.json'
export const MANIFEST_PATH = '.malleable/manifest.json'

export function readStore(root = process.cwd()): Store {
  const p = path.join(root, STORE_PATH)
  if (!fs.existsSync(p)) return emptyStore(OBSIDIAN)
  const parsed = JSON.parse(fs.readFileSync(p, 'utf8')) as Store
  return { version: 1, seeds: parsed.seeds ?? OBSIDIAN, overrides: parsed.overrides ?? [] }
}

export function writeStore(store: Store, root = process.cwd()) {
  const p = path.join(root, STORE_PATH)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(store, null, 2) + '\n')
}

export function readManifest(root = process.cwd()): Manifest {
  const p = path.join(root, MANIFEST_PATH)
  if (!fs.existsSync(p))
    throw new Error(`no manifest at ${MANIFEST_PATH} — run \`npm run id\` first`)
  return JSON.parse(fs.readFileSync(p, 'utf8')) as Manifest
}

export function writeManifest(manifest: Manifest, root = process.cwd()) {
  const p = path.join(root, MANIFEST_PATH)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(manifest, null, 2) + '\n')
}
