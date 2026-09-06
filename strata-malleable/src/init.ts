/**
 * The malleable layer's half of `strata init` — the Claude Code pieces that
 * are this layer's own: the skill that teaches the loop, and the two
 * commands that run it. Nothing else: no hook, no settings, nothing that
 * speaks while someone is mid-design.
 *
 * It does not install Strata's skill catalogue. It used to, for the case
 * where the library sat inside the product — and once `strata init` began
 * installing the skills itself, that copy landed *after* and overwrote them
 * with the shipped versions, examples and all, so a new product's first
 * check reported three decision ids it had never heard of. One installer per
 * thing.
 *
 * Nothing here overwrites a file that exists.
 */
import fs from 'node:fs'
import path from 'node:path'

export interface InitResult {
  wrote: string[]
  skipped: string[]
  notes: string[]
}

function copyTree(from: string, to: string, wrote: string[], skipped: string[], root: string, dry = false) {
  if (!fs.existsSync(from)) return
  if (!dry) fs.mkdirSync(to, { recursive: true })
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name)
    const dst = path.join(to, entry.name)
    if (entry.isDirectory()) copyTree(src, dst, wrote, skipped, root, dry)
    else if (fs.existsSync(dst)) skipped.push(path.relative(root, dst))
    else {
      if (!dry) {
        fs.mkdirSync(path.dirname(dst), { recursive: true })
        fs.copyFileSync(src, dst)
      }
      wrote.push(path.relative(root, dst))
    }
  }
}

export function init(root: string, packageRoot: string, opts: { dry?: boolean } = {}): InitResult {
  const wrote: string[] = []
  const skipped: string[] = []
  const integration = path.join(packageRoot, 'integrations/claude-code')

  copyTree(path.join(integration, 'skills'), path.join(root, '.claude/skills'), wrote, skipped, root, opts.dry)
  copyTree(path.join(integration, 'commands'), path.join(root, '.claude/commands'), wrote, skipped, root, opts.dry)

  return {
    wrote,
    skipped,
    notes: ['commit .malleable/manifest.json, .malleable/structure.json and .malleable/overrides.json — build output, but the overrides are design decisions'],
  }
}
