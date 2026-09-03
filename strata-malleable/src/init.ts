/**
 * `malleable init` — put the Claude Code half of the loop into a project.
 *
 * Copies the skills and the commands into `.claude/`. Nothing else: no hook,
 * no settings, nothing that runs while someone is mid-design. Everything it
 * writes is additive and shown; it merges rather than overwrites.
 */
import fs from 'node:fs'
import path from 'node:path'

export interface InitResult {
  wrote: string[]
  skipped: string[]
  notes: string[]
}

function copyTree(from: string, to: string, wrote: string[], skipped: string[], root: string) {
  fs.mkdirSync(to, { recursive: true })
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name)
    const dst = path.join(to, entry.name)
    if (entry.isDirectory()) copyTree(src, dst, wrote, skipped, root)
    else if (fs.existsSync(dst) && fs.readFileSync(dst, 'utf8') === fs.readFileSync(src, 'utf8'))
      skipped.push(path.relative(root, dst))
    else {
      fs.copyFileSync(src, dst)
      wrote.push(path.relative(root, dst))
    }
  }
}

export function init(root: string, packageRoot: string): InitResult {
  const wrote: string[] = []
  const skipped: string[] = []
  const notes: string[] = []
  const integration = path.join(packageRoot, 'integrations/claude-code')

  copyTree(path.join(integration, 'skills'), path.join(root, '.claude/skills'), wrote, skipped, root)
  copyTree(path.join(integration, 'commands'), path.join(root, '.claude/commands'), wrote, skipped, root)

  notes.push(
    'commit .malleable/manifest.json, .malleable/structure.json and .malleable/overrides.json — build output, but the overrides are design decisions',
    'commit .strata/decisions.jsonl — it is the record; everything else is a projection of it',
  )
  return { wrote, skipped, notes }
}
