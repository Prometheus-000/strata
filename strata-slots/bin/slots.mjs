#!/usr/bin/env node
/**
 * The slots CLI. Everything the drag surface does, the terminal can do too —
 * not for parity, but because the resolver has to be provable without a
 * browser, and a command that prints a layout is how you prove it.
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { assignIdentity, buildManifest } from '../src/identity/manifest.ts'
import {
  layout,
  resolve,
  assignmentsFromSource,
  allOpenItems,
  unresolvedOpenItems,
} from '../src/resolve/resolve.ts'
import { storeFromSource } from '../src/store/store.ts'
import { diff, formatDiff } from '../src/report/diff.ts'
import { slotsOf } from '../src/grammar/grammar.ts'
import { lint, formatLint } from '../src/lint/lint.ts'
import { resolveConfig, discoverSource, CONFIG_FILE } from '../src/config.ts'
import { generatePreview } from '../src/preview/generate.ts'
import { init } from '../src/init.ts'
import { describeAll, formatGrammar } from '../src/grammar/describe.ts'
import { ARCHETYPES, renderView, renderSurface } from '../src/grammar/archetypes.ts'
import { slotsDevPlugin } from '../src/preview/server.ts'

const [cmd, ...rest] = process.argv.slice(2)
const flag = (n) => {
  const i = rest.indexOf(`--${n}`)
  return i === -1 ? undefined : rest[i + 1]
}
const has = (n) => rest.includes(`--${n}`)

const config = resolveConfig(process.cwd(), flag('root'))
if ('error' in config) {
  if (cmd && cmd !== 'init' && cmd !== 'help') {
    console.error(`\n  ${config.error}\n`)
    process.exit(1)
  }
}
const ROOT = 'error' in config ? '' : config.source
const MANIFEST_PATH = 'error' in config ? '.slots/manifest.json' : config.manifest
const positional = rest.filter((a, i) => !a.startsWith('--') && !(i > 0 && rest[i - 1].startsWith('--')))

/** Does the project being previewed have its own React? */
const pascalCase = (s) =>
  s.replace(/(^|[^A-Za-z0-9])([a-z])/g, (_, __, c) => c.toUpperCase()).replace(/[^A-Za-z0-9]/g, '')

const projectHasReact = (root) => fs.existsSync(path.join(root, 'node_modules/react/package.json'))

const build = () => {
  const { manifest, problems } = buildManifest(ROOT)
  return { manifest, problems }
}
/**
 * Always built from source, never read from the cache.
 *
 * The cached manifest is an artifact for the preview to import; it is a
 * snapshot, and every command here reports on *now*. `lint` in particular
 * exists to catch a grammar that moved underneath committed work — reading a
 * manifest written before that move is reading the world as it was when the
 * problem did not yet exist.
 */
const readManifest = () => build().manifest
const sourcesOf = (manifest) => ({ manifest, assignments: assignmentsFromSource(manifest) })

const report = (problems) => {
  for (const p of problems) console.error(`  ! ${p}`)
  if (problems.length) {
    console.error(`\n${problems.length} problem(s).`)
    process.exitCode = 1
  }
}

switch (cmd) {
  case 'id': {
    const identity = assignIdentity(ROOT)
    for (const a of identity.assigned) console.log(`  + ${a.id.padEnd(28)} ${a.component}`)
    const { manifest, problems } = build()
    fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true })
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n')
    console.log(
      `\n${identity.assigned.length} assigned · ${identity.unchanged} already pinned · ${identity.written.length} file(s) rewritten`,
    )
    console.log(
      `${manifest.views.length} view(s) · ${manifest.features.length} feature(s) · ${manifest.views.reduce((n, v) => n + slotsOf(v).length, 0)} slot(s)`,
    )
    report([...new Set([...identity.problems, ...problems])])
    break
  }

  case 'manifest': {
    const m = readManifest()
    for (const v of m.views) {
      console.log(`\n${v.id}  [${v.states.join(' · ')}]  ${m.viewFiles[v.id] ?? ''}`)
      for (const f of m.features.filter((x) => x.view === v.id))
        console.log(
          `  ${f.id.padEnd(28)} ${f.sourceSlot.padEnd(12)} ${f.states ? f.states.join(' ') : 'all states'}`,
        )
    }
    console.log()
    break
  }

  case 'slots': {
    const m = readManifest()
    for (const v of m.views) {
      console.log(`\n${v.id}`)
      for (const band of v.bands)
        console.log(
          `  ${band.id.padEnd(10)} ${Array.from({ length: band.columns }, (_, i) => `${band.id}/${i + 1}`).join('  ')}`,
        )
    }
    console.log()
    break
  }

  case 'layout': {
    const m = readManifest()
    const src = sourcesOf(m)
    const only = positional[0]
    for (const v of m.views) {
      if (only && v.id !== only) continue
      for (const state of v.states) {
        const l = layout(src, v.id, state)
        console.log(`\n${v.id} · ${state}`)
        console.log('─'.repeat(24))
        for (const s of l.slots) {
          const names = s.features.map(
            (f) => `${f.component}${f.from === 'assigned' ? '*' : ''}`,
          )
          console.log(`  ${s.slot.id.padEnd(14)} ${names.join(', ') || '·'}`)
        }
        if (l.absent.length) console.log(`  absent: ${l.absent.join(', ')}`)
        for (const o of l.orphans)
          console.log(`  ! ${o.assignment.feature} → ${o.assignment.slot} (${o.reason})`)
      }
    }
    console.log('\n* = assigned, otherwise the source default\n')
    break
  }

  case 'resolve': {
    const [view, state, feature] = positional
    if (!view || !state || !feature) {
      console.error('usage: resolve <view> <state> <feature>')
      process.exit(1)
    }
    const m = readManifest()
    const p = resolve(sourcesOf(m), view, state, feature)
    if (!p) {
      console.error(`${feature} does not resolve in ${view} · ${state}`)
      process.exit(1)
    }
    console.log(`\n  ${p.component}  →  ${p.slot}  (order ${p.order}, from ${p.from})`)
    if (p.movedFrom) console.log(`  moved from ${p.movedFrom}${p.author ? ` by ${p.author}` : ''}`)
    console.log()
    break
  }

  case 'diff': {
    console.log(formatDiff(diff(sourcesOf(readManifest()))))
    break
  }

  case 'init': {
    const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
    const source =
      flag('root') ?? ('error' in config ? discoverSource(process.cwd()) : config.source)
    if (!source) {
      console.error(
        `\n  no *.view.ts found. Create one first, or run: slots init --root <dir>\n`,
      )
      process.exit(1)
    }
    const result = init(process.cwd(), packageRoot, source)
    for (const f of result.wrote) console.log(`  + ${f}`)
    for (const f of result.skipped) console.log(`  · ${f} (unchanged)`)
    console.log(`\n  views: ${source}`)
    for (const n of result.notes) console.log(`  note: ${n}`)
    console.log(`\n  next: slots id && slots preview\n`)
    break
  }

  case 'preview': {
    const manifest = readManifest()
    const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
    if (!projectHasReact(process.cwd())) {
      // Say so plainly rather than half-working. Borrowing this package's React
      // would put two copies on one page, and the surfaces are the project's.
      console.error(
        `\n  no React found in ${process.cwd()}.\n` +
          '  `slots preview` renders your real view surfaces, so it needs your React:\n' +
          '    npm install react react-dom\n',
      )
      process.exit(1)
    }
    const generated = generatePreview(manifest, process.cwd(), packageRoot)
    for (const m of generated.missing) console.error(`  ! surface not found — ${m}`)
    if (!generated.views.length) {
      console.error('\n  no view surfaces to preview. Run `slots id` first.\n')
      process.exit(1)
    }
    // Resolved from this package, not from the project being previewed, and by
    // asking Node rather than guessing a dist path — a hardcoded path breaks on
    // the next version bump of a dependency the user never chose.
    const require = createRequire(`${packageRoot}/package.json`)
    const from = (id) => pathToFileURL(require.resolve(id)).href
    const { createServer } = await import(from('vite'))
    const react = (await import(from('@vitejs/plugin-react'))).default
    const server = await createServer({
      configFile: false,
      root: generated.dir,
      plugins: [react(), slotsDevPlugin(ROOT, process.cwd())],
      resolve: {
        // The project's React, not this package's. The surfaces being previewed
        // are theirs, and two copies of React on one page is a broken page.
        dedupe: ['react', 'react-dom'],
      },
      server: {
        port: Number(flag('port') ?? 5199),
        fs: { allow: [process.cwd(), packageRoot] },
      },
    })
    await server.listen()
    const url = `http://localhost:${server.config.server.port}`
    console.log(`\n  previewing ${generated.views.join(', ')}\n  ${url}\n`)
    console.log('  drag a feature; press "ready for review" when the shape is right.\n')
    break
  }

  case 'grammar': {
    const only = positional[0]
    const all = describeAll(readManifest()).filter((d) => !only || d.view === only)
    if (!all.length) {
      console.error(`\n  no such view${only ? `: ${only}` : ''}\n`)
      process.exit(1)
    }
    console.log(formatGrammar(all))
    break
  }

  case 'new': {
    const id = positional[0]
    if (!id) {
      console.error('\n  usage: slots new <id> [--from document|workbench|feed|surface|blank]\n')
      process.exit(1)
    }
    const name = flag('from') ?? 'document'
    const archetype = ARCHETYPES[name]
    if (!archetype) {
      console.error(`\n  no archetype "${name}". Try: ${Object.keys(ARCHETYPES).join(', ')}\n`)
      process.exit(1)
    }
    const states = (flag('states') ?? 'default').split(',').map((s) => s.trim()).filter(Boolean)
    const dir = ROOT || 'src/views'
    fs.mkdirSync(dir, { recursive: true })
    const viewFile = path.join(dir, `${id}.view.ts`)
    const surfaceFile = path.join(dir, `${pascalCase(id)}.tsx`)
    for (const f of [viewFile, surfaceFile])
      if (fs.existsSync(f)) {
        console.error(`\n  ${f} already exists — nothing written.\n`)
        process.exit(1)
      }
    fs.writeFileSync(viewFile, renderView(id, states, archetype))
    fs.writeFileSync(surfaceFile, renderSurface(id, archetype))
    console.log(`\n  + ${viewFile}`)
    console.log(`  + ${surfaceFile}`)
    console.log(`\n  from "${archetype.name}" — ${archetype.summary}`)
    console.log('  a seed, not a schema: delete bands you do not have, rename freely.')
    console.log('  see GRAMMAR.md for how to derive one from your own features.\n')
    console.log('  next: add your features to the surface, then `slots id`\n')
    break
  }

  case 'lint': {
    const report = lint(readManifest())
    if (has('json')) console.log(JSON.stringify(report, null, 2))
    else console.log(formatLint(report))
    // Exit 0 whatever it found. The library reports; whether a finding stops a
    // build is the host's decision, and this CLI is not the one to make it.
    break
  }

  case 'open': {
    const src = sourcesOf(readManifest())
    const items = allOpenItems(src)
    if (!items.length) {
      console.log('\nno behavioural costs in this design\n')
      break
    }
    for (const i of items) {
      console.log(
        `\n${i.accepted ? '·' : '!'} ${i.view} · ${i.state} · ${i.component} in ${i.slot}`,
      )
      console.log(`  ${i.requirement} — ${i.reason}`)
      if (i.accepted) console.log(`  accepted by ${i.acceptedBy ?? 'human'}`)
    }
    const stuck = unresolvedOpenItems(src)
    console.log(
      stuck.length
        ? `\n${stuck.length} not yet acknowledged\n`
        : '\nevery cost acknowledged\n',
    )
    // Exit 0 either way. Whether an unacknowledged cost should stop a build is
    // a policy, and policies differ between teams; a host that wants that rule
    // can read this output and apply it. The library does not apply it for them.
    break
  }

  default:
    console.log(`slots — commands:
  id         assign identity over the view surfaces, rebuild the manifest
  manifest   every declared view and the features that belong to it
  slots      the slot set each view's grammar enumerates
  layout     [view] — resolved layout, every state
  resolve    <view> <state> <feature> — where one feature sits, and why
  diff       placements that differ from source defaults, per view and per state
  open       behavioural costs this design carries, and who has acknowledged them
  lint       [--json] unsatisfied contracts, dangling assignments, drifted records
  preview    [--port n] serve this project's views so a designer can move them
  init       install the Claude Code skill, commands and hook into this project
  grammar    [view] describe a view's vocabulary — slots, free movement, what it can satisfy
  new        <id> [--from <archetype>] [--states a,b] scaffold a view from a seed`)
}
