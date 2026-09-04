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

/**
 * The frame: everything that says what this product decided and why.
 *
 * The first version of this bench copied the whole repository into both arms
 * and differed only in what the *prompt* mentioned. That is not a control. An
 * agent handed a component list and dropped into a directory goes looking —
 * of course it does — and the first run proved it: the `list` arm found the
 * skill, the ledger, the fallback table and the precedent unaided, then made
 * the same decision by the same route as the arm that was handed them. The
 * measured difference was zero, and it meant nothing, because the two arms
 * were the same experiment.
 *
 * So the control now genuinely lacks the frame. What is left is what a team
 * gets when they install a design system and never adopt a record: the
 * components, the compiled stylesheet, the app, and names without reasons.
 */
const FRAME = [
  // The record itself is a tracked file, so it arrives with the copy loop
  // unless it is named here. Leaving it out was how the first control ended
  // up holding thirty-seven decisions it was never handed.
  '.strata',
  'README.md',
  'GRAMMAR.md',
  'CLAUDE.md',
  'grammar',
  'skills',
  'bench',
  'mcp',
  '.claude',
  'src/theme/ledger.json',
  'strata-malleable/integrations',
]

const isFrame = (file) => FRAME.some((f) => file === f || file.startsWith(`${f}/`)) || file.endsWith('SKILL.md')

function copyProduct(dest, arm) {
  const control = arm === 'list'
  fs.rmSync(dest, { recursive: true, force: true })
  for (const file of tracked()) {
    if (file.startsWith('bench/runs/')) continue
    if (control && isFrame(file)) continue
    const to = path.join(dest, file)
    fs.mkdirSync(path.dirname(to), { recursive: true })
    fs.copyFileSync(path.join(ROOT, file), to)
  }
  if (control) stripReasons(dest)
  else {
    // The record travels with the packet arm: its precedent has to be real
    // precedent, or the experiment tests a fixture instead of a product.
    fs.mkdirSync(path.join(dest, '.strata'), { recursive: true })
    fs.copyFileSync(path.join(ROOT, '.strata/decisions.jsonl'), path.join(dest, '.strata/decisions.jsonl'))
  }
  for (const dir of ['node_modules', 'strata-malleable/node_modules']) linkModules(path.join(ROOT, dir), path.join(dest, dir), dest)
}

/**
 * The two projections that carry the record inside them, reduced to what a
 * conventional design system ships: values and names.
 *
 * `semantic.css` announces every cut in a comment with the argument for it,
 * and `tokens.json` carries the whole ledger under `$extensions`. Leaving
 * either in would hand the control arm the reasons through the back door —
 * which is exactly the failure this function exists to fix.
 */
function stripReasons(dest) {
  const css = path.join(dest, 'src/tokens/semantic.css')
  if (fs.existsSync(css)) {
    const text = fs
      .readFileSync(css, 'utf8')
      .replace(/ \/\* cut by [^*]*\*\//g, '')
      .replace(/^ {3}through the decisions.*\n(?: {3}.*\n)?/m, '')
    fs.writeFileSync(css, text)
  }
  // One copy of the record lives outside it: the harness engine vendors the
  // three cuts so it renders the page the site renders, and the file's own
  // comment calls it "a copy of a decision". It names exactly the tokens this
  // bench measures reaching for, so the control cannot keep it.
  const harness = path.join(dest, 'strata-malleable/src/engine/generateTheme.ts')
  if (fs.existsSync(harness))
    fs.writeFileSync(
      harness,
      fs.readFileSync(harness, 'utf8').replace(/export const LEDGER_CUTS[\s\S]*?\n\}/, 'export const LEDGER_CUTS: Record<string, string> = {}'),
    )

  const jsonPath = path.join(dest, 'src/tokens/tokens.json')
  if (!fs.existsSync(jsonPath)) return
  const json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
  const strip = (node) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach(strip)
    delete node.$extensions
    delete node.$reasons
    for (const v of Object.values(node)) strip(v)
  }
  delete json.strata?.ledger
  strip(json)
  json.$description = 'Design tokens. Every value is a compiled projection of a seed set; do not edit values here.'
  fs.writeFileSync(jsonPath, JSON.stringify(json, null, 2) + '\n')
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
      copyProduct(dir, arm)
      writeBrief(dir)
      fs.writeFileSync(path.join(dir, 'PROMPT.md'), promptFor(task, arm, dir))
      // The control arm has no record to snapshot, which is the point of it.
      const record = path.join(dir, '.strata/decisions.jsonl')
      fs.writeFileSync(path.join(dir, 'BEFORE.jsonl'), fs.existsSync(record) ? fs.readFileSync(record) : '')
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

  // What is cut is a fact about the product, read from the source repo. The
  // control arm has no ledger — that is what makes it a control — and asking
  // it what it thinks is cut would score it against its own ignorance.
  const cut = new Set(
    Object.entries(JSON.parse(fs.readFileSync(path.join(ROOT, 'src/theme/ledger.json'), 'utf8')).tokens)
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

  /**
   * The measure this bench was missing, and the one that found the difference.
   *
   * "Reached for a cut token" only catches an arm that *writes* a cut name. It
   * does not catch the thing that actually happened: the control made one
   * correct local decision, the write re-emitted the stylesheet, and three
   * cuts it had no way to see were silently undone — shadows repainted,
   * dialogs given back their overshoot, a third radius returned. Nothing was
   * reached for. A decision was simply lost, because the artifact carried no
   * trace that it had ever been made.
   */
  const reverted = []
  const armCss = path.join(dir, 'src/tokens/semantic.css')
  const decl = (text, token) => (text.match(new RegExp(`^\\s*${token}:\\s*([^;]+);`, 'm')) ?? [])[1]?.trim()
  if (fs.existsSync(armCss)) {
    const before = fs.readFileSync(path.join(ROOT, 'src/tokens/semantic.css'), 'utf8')
    const after = fs.readFileSync(armCss, 'utf8')
    for (const token of cut) {
      const was = decl(before, token)
      const now = decl(after, token)
      if (was && now && was !== now) reverted.push(`${token}: ${was} → ${now}`)
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
    reverted,
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
    ['decisions silently undone', (r) => (r.reverted ?? []).length],
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
    for (const r of mine) for (const hit of r.reverted ?? []) console.log(`    ${r.arm}: a decision was undone — ${hit}`)
  }
  console.log('\n  A difference in the last four rows is evidence for the claim.')
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
