#!/usr/bin/env node
/**
 * THE BENCH — the founding claim, run as an experiment rather than asserted.
 *
 *   prepare              an isolated copy of the product per task × arm
 *   prompt <task> <arm>  print one arm's prompt, to hand to a harness
 *   score                read each arm's record and tree, and score it
 *   report               the arms side by side
 *
 * Strata calls no model, and neither does this. The bench prepares, and scores
 * what a harness left behind; performing the task is the harness's job, which
 * is the same separation the substrate makes everywhere else.
 *
 * Every measure is read off the record or off the tree. Nothing here is a
 * rating, because a rating would make the result an opinion about an opinion.
 */
import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const BENCH = path.join(ROOT, 'bench')
const RUNS = path.join(BENCH, 'runs')
const ARMS = ['packet', 'list']

const tasks = JSON.parse(fs.readFileSync(path.join(BENCH, 'tasks.json'), 'utf8')).tasks
const armDir = (task, arm) => path.join(RUNS, `${task}-${arm}`)
const rel = (p) => path.relative(ROOT, p)

/**
 * The arm's *own* CLI, not this repo's. A copy of the product includes its
 * substrate, and pointing at the original would have every arm scoring the
 * repository it was copied from — which is the one mistake that would make
 * every number here meaningless.
 */
const strata = (cwd, args) => {
  const cli = fs.existsSync(path.join(cwd, 'bin/strata.mjs')) ? path.join(cwd, 'bin/strata.mjs') : path.join(ROOT, 'bin/strata.mjs')
  try {
    return execFileSync('node', ['--import', 'tsx/esm', cli, ...args], {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, NODE_OPTIONS: '' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (err) {
    return `${err.stdout ?? ''}${err.stderr ?? ''}`
  }
}

/* ---------------- prepare ---------------- */

/** Every tracked file, so an arm is the product and not the product plus a build. */
const tracked = () => execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)

function copyProduct(dest) {
  fs.rmSync(dest, { recursive: true, force: true })
  for (const file of tracked()) {
    if (file.startsWith('bench/runs/')) continue
    const to = path.join(dest, file)
    fs.mkdirSync(path.dirname(to), { recursive: true })
    fs.copyFileSync(path.join(ROOT, file), to)
  }
  // The record travels with the copy: the packet arm's precedent has to be
  // real precedent, or the experiment tests a fixture instead of a product.
  fs.mkdirSync(path.join(dest, '.strata'), { recursive: true })
  fs.copyFileSync(path.join(ROOT, '.strata/decisions.jsonl'), path.join(dest, '.strata/decisions.jsonl'))
  for (const dir of ['node_modules', 'strata-malleable/node_modules']) linkModules(path.join(ROOT, dir), path.join(dest, dir), dest)
}

/**
 * Third-party packages are shared with the original — they are the same bytes
 * and copying them four times is waste. The workspace packages are not: an arm
 * that resolved `@strata/substrate` to the original repo would register its
 * evaluators into one module instance and read them from another, and every
 * invariant would come back "no evaluator here can speak for this". So the
 * arm's own substrate and engine are linked to the arm's own copies.
 */
function linkModules(from, to, dest) {
  if (!fs.existsSync(from)) return
  fs.mkdirSync(to, { recursive: true })
  for (const entry of fs.readdirSync(from)) {
    if (entry === '@strata') continue
    fs.symlinkSync(path.join(from, entry), path.join(to, entry), 'dir')
  }
  const scoped = path.join(to, '@strata')
  fs.mkdirSync(scoped, { recursive: true })
  for (const pkg of ['substrate', 'engine']) {
    const own = path.join(dest, pkg)
    if (fs.existsSync(own)) fs.symlinkSync(own, path.join(scoped, pkg), 'dir')
  }
}

/**
 * The control arm's brief: the same design system as names. Generated from the
 * same ledger the packet is built from, so both arms know the same vocabulary
 * and differ only in whether they are told why.
 */
function writeBrief(dest) {
  const ledger = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/theme/ledger.json'), 'utf8'))
  const components = fs
    .readFileSync(path.join(ROOT, 'src/components/index.tsx'), 'utf8')
    .split('\n')
    .filter((l) => /^export function [A-Z]/.test(l))
    .map((l) => l.replace(/^export function (\w+).*/, '$1'))
  const views = fs.readdirSync(path.join(ROOT, 'strata-malleable/fixtures/app/views')).filter((f) => f.endsWith('.tsx'))
  const out = [
    '# The design system',
    '',
    'Components, tokens and views available in this product.',
    '',
    '## Components',
    '',
    components.map((c) => `- \`<${c}>\``).join('\n'),
    '',
    '## Views',
    '',
    views.map((v) => `- \`strata-malleable/fixtures/app/views/${v}\``).join('\n'),
    '',
    '## Tokens',
    '',
    Object.keys(ledger.tokens).map((t) => `- \`var(${t})\``).join('\n'),
    '',
    '## Files',
    '',
    '- `src/tokens/semantic.css` — the token definitions',
    '- `src/components/strata.css` — component styles',
    '- `strata-malleable/fixtures/app/` — the app',
    '',
  ].join('\n')
  fs.mkdirSync(path.join(BENCH, 'arms/list'), { recursive: true })
  fs.writeFileSync(path.join(BENCH, 'arms/list/BRIEF.md'), out)
  fs.mkdirSync(path.dirname(path.join(dest, 'BRIEF.md')), { recursive: true })
  fs.writeFileSync(path.join(dest, 'BRIEF.md'), out)
}

function promptFor(task, arm, dir) {
  const head = [
    `# ${task.id} · ${arm}`,
    '',
    `Working directory: \`${rel(dir)}\``,
    '',
    '## Task',
    '',
    task.instruction,
    '',
  ]
  if (arm === 'packet') {
    const inputs = Object.entries(task.inputs).flatMap(([k, v]) => [`--${k}`, v])
    return [
      ...head,
      '## Context',
      '',
      'Assembled by the substrate. Run it yourself to see it fresh:',
      '',
      '```bash',
      `strata skill ${task.skill} ${inputs.join(' ')}`,
      '```',
      '',
      strata(dir, ['skill', task.skill, ...inputs]),
      '',
    ].join('\n')
  }
  return [...head, '## Context', '', fs.readFileSync(path.join(dir, 'BRIEF.md'), 'utf8')].join('\n')
}

function prepare() {
  fs.mkdirSync(RUNS, { recursive: true })
  for (const task of tasks) {
    for (const arm of ARMS) {
      const dir = armDir(task.id, arm)
      copyProduct(dir)
      writeBrief(dir)
      fs.writeFileSync(path.join(dir, 'PROMPT.md'), promptFor(task, arm, dir))
      fs.writeFileSync(path.join(dir, 'BEFORE.jsonl'), fs.readFileSync(path.join(dir, '.strata/decisions.jsonl')))
      fs.writeFileSync(path.join(dir, 'BEFORE.files.json'), JSON.stringify(hashTree(dir), null, 2))
      console.log(`  ${rel(dir)}`)
    }
  }
  console.log(`\n  ${tasks.length * ARMS.length} arm(s) prepared. Perform each PROMPT.md with its directory as the working directory, then: node bench/run.mjs score\n`)
}

/**
 * What the tree looked like before the harness touched it.
 *
 * `git status` cannot answer this: an arm lives under `bench/runs/`, which is
 * ignored, so git reports a clean tree no matter what changed inside it. So
 * the bench takes its own before-and-after, which also means an arm needs no
 * repository of its own.
 */
function hashTree(dir) {
  const out = {}
  const skip = new Set(['node_modules', '.git', 'dist', 'runs'])
  const walk = (abs) => {
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue
      const p = path.join(abs, entry.name)
      if (entry.isSymbolicLink()) continue
      if (entry.isDirectory()) walk(p)
      else if (/\.(css|tsx?|jsonl?|md|html)$/.test(entry.name)) out[path.relative(dir, p)] = crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex')
    }
  }
  walk(dir)
  return out
}

/** Files the harness added, changed or removed. */
function changedFiles(dir) {
  const beforeFile = path.join(dir, 'BEFORE.files.json')
  if (!fs.existsSync(beforeFile)) return []
  const before = JSON.parse(fs.readFileSync(beforeFile, 'utf8'))
  const after = hashTree(dir)
  const names = new Set([...Object.keys(before), ...Object.keys(after)])
  return [...names]
    .filter((f) => before[f] !== after[f])
    .filter((f) => !['BEFORE.files.json', 'PROMPT.md', 'BEFORE.jsonl', 'BRIEF.md', '.strata/decisions.jsonl'].includes(f))
    .sort()
}

/** The lines this arm added to a file, against the pristine copy it started from. */
function addedLines(dir, file) {
  const after = fs.existsSync(path.join(dir, file)) ? fs.readFileSync(path.join(dir, file), 'utf8').split('\n') : []
  const originalPath = path.join(ROOT, file)
  if (!fs.existsSync(originalPath)) return after
  const before = fs.readFileSync(originalPath, 'utf8').split('\n')
  const counts = new Map()
  for (const line of before) counts.set(line, (counts.get(line) ?? 0) + 1)
  const added = []
  for (const line of after) {
    const n = counts.get(line) ?? 0
    if (n > 0) counts.set(line, n - 1)
    else added.push(line)
  }
  return added
}

/* ---------------- score ---------------- */

const readLog = (file) =>
  fs.existsSync(file)
    ? fs
        .readFileSync(file, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l))
    : []

function scoreArm(task, arm) {
  const dir = armDir(task.id, arm)
  if (!fs.existsSync(dir)) return null
  const before = new Set(readLog(path.join(dir, 'BEFORE.jsonl')).map((d) => d.id))
  const written = readLog(path.join(dir, '.strata/decisions.jsonl')).filter((d) => !before.has(d.id))

  let check = { invariants: [], findings: [] }
  try {
    check = JSON.parse(strata(dir, ['check', '--json']))
  } catch {
    /* a record that will not parse is itself the finding, below */
  }

  const cut = new Set(
    Object.entries(JSON.parse(fs.readFileSync(path.join(dir, 'src/theme/ledger.json'), 'utf8')).tokens)
      .filter(([, d]) => d.status === 'cut')
      .map(([t]) => t),
  )
  // A name the ledger cut, reached for in a file this arm changed. The list
  // arm has no way to know these are cut; that is the predicted failure.
  const reachedForCut = []
  const changed = changedFiles(dir)
  for (const file of changed.filter((f) => /\.(css|tsx|ts)$/.test(f))) {
    // Only what this arm *added*. A cut token already sitting in a file it
    // happened to touch is the repository's business, not this arm's, and
    // counting it would flatter or damn an arm for someone else's line.
    for (const line of addedLines(dir, file)) {
      for (const token of cut) if (line.includes(`var(${token})`)) reachedForCut.push(`${file}:${line.trim().slice(0, 60)} → ${token}`)
    }
  }

  const finding = (rule) => check.findings.filter((f) => f.rule === rule).length
  return {
    task: task.id,
    arm,
    decisions: written.length,
    withReason: written.filter((d) => d.reason && d.reason.trim()).length,
    decidedByAgent: written.filter((d) => d.decided?.kind === 'agent').length,
    invariantsHold: check.invariants.every((i) => i.ok),
    failingInvariants: check.invariants.filter((i) => !i.ok).map((i) => i.rule),
    projectionsHandEdited: check.invariants.find((i) => i.rule === 'projections.match-record')?.findings.length ?? 0,
    undeclaredLiterals: finding('layer0.semantic-names-only'),
    reachedForCut,
    filesChanged: changed,
  }
}

function score() {
  const rows = []
  for (const task of tasks) for (const arm of ARMS) {
    const r = scoreArm(task, arm)
    if (r) rows.push(r)
  }
  if (!rows.length) {
    console.log('\n  nothing to score — run: node bench/run.mjs prepare\n')
    return
  }
  fs.writeFileSync(path.join(BENCH, 'RESULT.json'), JSON.stringify({ at: new Date().toISOString(), rows }, null, 2) + '\n')
  report(rows)
}

/* ---------------- report ---------------- */

function report(rows = JSON.parse(fs.readFileSync(path.join(BENCH, 'RESULT.json'), 'utf8')).rows) {
  const MEASURES = [
    ['decisions written', (r) => r.decisions],
    ['with a reason', (r) => r.withReason],
    ['decided by agent', (r) => r.decidedByAgent],
    ['invariants hold', (r) => (r.invariantsHold ? 'yes' : `no — ${r.failingInvariants.join(', ')}`)],
    ['projections hand-edited', (r) => r.projectionsHandEdited],
    ['undeclared literals', (r) => r.undeclaredLiterals],
    ['reached for a cut token', (r) => r.reachedForCut.length],
    ['files changed', (r) => r.filesChanged.length],
  ]
  for (const task of tasks) {
    const mine = ARMS.map((a) => rows.find((r) => r.task === task.id && r.arm === a)).filter(Boolean)
    if (!mine.length) continue
    console.log(`\n  ${task.id}`)
    console.log(`  ${'measure'.padEnd(26)}${mine.map((r) => r.arm.padStart(10)).join('')}`)
    console.log(`  ${'─'.repeat(26 + 10 * mine.length)}`)
    for (const [name, of] of MEASURES) console.log(`  ${name.padEnd(26)}${mine.map((r) => String(of(r)).padStart(10)).join('')}`)
    for (const r of mine) for (const hit of r.reachedForCut) console.log(`    ${r.arm}: reached for a cut token — ${hit}`)
  }
  console.log('\n  A difference in the last three rows is evidence for the claim.')
  console.log('  A difference in the first two says the door works, which is a smaller claim.\n')
}

/* ---------------- main ---------------- */

const [cmd, a, b] = process.argv.slice(2)
switch (cmd) {
  case 'prepare':
    prepare()
    break
  case 'prompt': {
    const task = tasks.find((t) => t.id === a)
    if (!task || !ARMS.includes(b)) {
      console.error(`\n  usage: run.mjs prompt <${tasks.map((t) => t.id).join('|')}> <${ARMS.join('|')}>\n`)
      process.exit(1)
    }
    const dir = armDir(task.id, b)
    if (!fs.existsSync(dir)) {
      console.error('\n  prepare first: node bench/run.mjs prepare\n')
      process.exit(1)
    }
    console.log(fs.readFileSync(path.join(dir, 'PROMPT.md'), 'utf8'))
    break
  }
  case 'score':
    score()
    break
  case 'report':
    report()
    break
  default:
    console.log(`bench — the founding claim, as an experiment (see bench/README.md)

  prepare              one isolated copy of the product per task × arm
  prompt <task> <arm>  print one arm's prompt
  score                read each arm's record and tree
  report               the arms side by side

  tasks: ${tasks.map((t) => t.id).join(', ')}   arms: ${ARMS.join(', ')}`)
}
