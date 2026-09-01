/**
 * `slots init` — put the Claude Code half of the loop into a project.
 *
 * Copies the skill and commands into `.claude/`, registers the hook, pins the
 * source directory, and ignores the generated files. Everything it writes is
 * additive and shown; it merges rather than overwrites, and it never touches a
 * setting it did not add.
 */
import fs from 'node:fs'
import path from 'node:path'

export interface InitResult {
  wrote: string[]
  skipped: string[]
  notes: string[]
}

const IGNORES = ['.slots/preview/', '.slots/ready.json']

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

export function init(root: string, packageRoot: string, source: string): InitResult {
  const wrote: string[] = []
  const skipped: string[] = []
  const notes: string[] = []
  const integration = path.join(packageRoot, 'integrations/claude-code')

  /* the source directory, pinned so nothing has to guess again */
  const configPath = path.join(root, 'slots.config.json')
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify({ source }, null, 2) + '\n')
    wrote.push('slots.config.json')
  } else skipped.push('slots.config.json')

  /* skill + commands */
  copyTree(path.join(integration, 'skills'), path.join(root, '.claude/skills'), wrote, skipped, root)
  copyTree(
    path.join(integration, 'commands'),
    path.join(root, '.claude/commands'),
    wrote,
    skipped,
    root,
  )

  /* the hook script, and its registration in settings */
  const hookDir = path.join(root, '.claude/hooks')
  fs.mkdirSync(hookDir, { recursive: true })
  const hookSrc = path.join(integration, 'hooks/slots-check.sh')
  const hookDst = path.join(hookDir, 'slots-check.sh')
  // Bake in where this binary actually is. Nothing guarantees `slots` is on
  // PATH, and a hook that cannot find it reports "nothing wrong" forever.
  const binPath = path.join(packageRoot, 'bin/slots')
  fs.writeFileSync(hookDst, fs.readFileSync(hookSrc, 'utf8').replaceAll('__SLOTS_BIN__', binPath))
  fs.chmodSync(hookDst, 0o755)
  wrote.push('.claude/hooks/slots-check.sh')

  const settingsPath = path.join(root, '.claude/settings.json')
  const settings: Record<string, unknown> = fs.existsSync(settingsPath)
    ? JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    : {}
  const hooks = (settings.hooks ??= {}) as Record<string, unknown[]>
  const post = (hooks.PostToolUse ??= []) as Array<Record<string, unknown>>
  const command = 'sh "$CLAUDE_PROJECT_DIR/.claude/hooks/slots-check.sh"'
  const already = JSON.stringify(post).includes('slots-check.sh')
  if (already) {
    skipped.push('.claude/settings.json (hook already registered)')
  } else {
    post.push({
      matcher: 'Edit|Write|MultiEdit',
      hooks: [{ type: 'command', command, timeout: 30 }],
    })
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n')
    wrote.push('.claude/settings.json')
  }

  /* generated files should not be committed */
  const gitignore = path.join(root, '.gitignore')
  const existing = fs.existsSync(gitignore) ? fs.readFileSync(gitignore, 'utf8') : ''
  const missing = IGNORES.filter((line) => !existing.split('\n').includes(line))
  if (missing.length) {
    fs.writeFileSync(
      gitignore,
      existing + (existing && !existing.endsWith('\n') ? '\n' : '') + missing.join('\n') + '\n',
    )
    wrote.push('.gitignore')
  } else skipped.push('.gitignore')

  notes.push(
    'commit .slots/manifest.json and every *.view.ts — the manifest is build output but the placements are design decisions',
  )
  return { wrote, skipped, notes }
}
