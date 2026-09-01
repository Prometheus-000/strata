/**
 * The manifest — everything the codemod knows, written down once so the
 * resolver, the CLI and the runtime read the same facts.
 *
 * It joins two authored halves: the view *declaration* (the grammar, the
 * states, and any placements written through from a drop) and the view
 * *surface* (which features exist and where source puts them by default).
 * Neither half is derived from the other, and neither is derived from the file
 * tree — a view is declared because a designer said it is one.
 */
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { isLegalSlot, validateView } from '../grammar/grammar'
import {
  REQUIREMENTS,
  type Behavior,
  type FeatureDecl,
  type Manifest,
  type PlacementRecord,
  type Placements,
  type Requirement,
  type ViewDecl,
} from '../schema'
import { scan, stamp } from './codemod'
import { findDefineViewArgument, literalOf, type Literal } from './literal'

export function walk(dir: string, match: RegExp, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(p, match, out)
    else if (match.test(entry.name)) out.push(p)
  }
  return out.sort()
}

const rel = (f: string) => path.relative(process.cwd(), f)

/* ---------------- view declarations ---------------- */

const isRecord = (v: Literal | undefined): v is { [k: string]: Literal } =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

function readPlacements(raw: Literal | undefined, problems: string[], where: string): Placements {
  if (raw === undefined) return {}
  if (!isRecord(raw)) {
    problems.push(`${where}: placement must be an object literal`)
    return {}
  }
  const out: Placements = {}
  for (const [state, byFeature] of Object.entries(raw)) {
    if (!isRecord(byFeature)) {
      problems.push(`${where}: placement.${state} must be an object literal`)
      continue
    }
    const entries: Record<string, PlacementRecord> = {}
    for (const [feature, record] of Object.entries(byFeature)) {
      if (!isRecord(record) || typeof record.slot !== 'string' || typeof record.order !== 'number') {
        problems.push(`${where}: placement.${state}["${feature}"] needs a slot and an order`)
        continue
      }
      const by = record.by === 'agent' ? 'agent' : 'human'
      const readList = (key: 'open' | 'accepted'): Requirement[] => {
        const raw = record[key]
        if (raw === undefined) return []
        if (!Array.isArray(raw)) {
          problems.push(`${where}: placement.${state}["${feature}"].${key} must be an array`)
          return []
        }
        const out: Requirement[] = []
        for (const r of raw) {
          if (typeof r === 'string' && (REQUIREMENTS as readonly string[]).includes(r))
            out.push(r as Requirement)
          else
            problems.push(
              `${where}: placement.${state}["${feature}"].${key} names "${String(r)}", which is not a requirement`,
            )
        }
        return out
      }
      entries[feature] = {
        slot: record.slot,
        order: record.order,
        by,
        open: readList('open'),
        accepted: readList('accepted'),
      }
    }
    out[state] = entries
  }
  return out
}

const PHASES = ['before-main', 'main', 'after-main'] as const

/** The half of the behaviour contract a band owns. */
function readBehavior(raw: Literal | undefined, problems: string[], where: string): Behavior {
  if (raw === undefined) return {}
  if (!isRecord(raw)) {
    problems.push(`${where}: behavior must be an object literal`)
    return {}
  }
  const behavior: Behavior = {}
  if (raw.focusPhase !== undefined) {
    if (typeof raw.focusPhase === 'string' && (PHASES as readonly string[]).includes(raw.focusPhase))
      behavior.focusPhase = raw.focusPhase as Behavior['focusPhase']
    else problems.push(`${where}: focusPhase must be one of ${PHASES.join(', ')}`)
  }
  if (raw.dismissible !== undefined) {
    if (typeof raw.dismissible === 'boolean') behavior.dismissible = raw.dismissible
    else problems.push(`${where}: dismissible must be true or false`)
  }
  if (typeof raw.landmark === 'string') behavior.landmark = raw.landmark
  return behavior
}

export function readViewDecl(file: string, source: string, problems: string[]): ViewDecl | null {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS)
  const arg = findDefineViewArgument(sf)
  if (!arg) {
    problems.push(`${rel(file)}: no defineView(...) call found`)
    return null
  }
  const literal = literalOf(arg)
  if (!isRecord(literal)) {
    problems.push(`${rel(file)}: defineView needs a plain object literal — a view is a declaration, not a computation`)
    return null
  }
  const bandsRaw = literal.bands
  const bands = Array.isArray(bandsRaw)
    ? bandsRaw.flatMap((b) =>
        isRecord(b) && typeof b.id === 'string' && typeof b.columns === 'number'
          ? [{
              id: b.id,
              columns: b.columns,
              label: typeof b.label === 'string' ? b.label : undefined,
              rhythm:
                b.rhythm === 'tight' || b.rhythm === 'loose' || b.rhythm === 'normal'
                  ? (b.rhythm as 'tight' | 'normal' | 'loose')
                  : undefined,
              behavior: readBehavior(b.behavior, problems, `${rel(file)} band "${b.id}"`),
            }]
          : [],
      )
    : []
  const view: ViewDecl = {
    id: typeof literal.id === 'string' ? literal.id : '',
    label: typeof literal.label === 'string' ? literal.label : undefined,
    states: Array.isArray(literal.states) ? literal.states.filter((s): s is string => typeof s === 'string') : [],
    defaultState: typeof literal.defaultState === 'string' ? literal.defaultState : '',
    bands,
    placement: readPlacements(literal.placement, problems, rel(file)),
  }
  problems.push(...validateView(view).map((p) => `${rel(file)}: ${p}`))
  return view
}

/* ---------------- identity ---------------- */

export interface IdentityResult {
  written: string[]
  assigned: Array<{ id: string; component: string; view: string }>
  unchanged: number
  problems: string[]
}

/** Run the codemod across the tree. Assigns only what has no id yet. */
export function assignIdentity(root: string): IdentityResult {
  const surfaces = walk(root, /\.tsx$/)
  const taken = new Set<string>()
  const problems: string[] = []
  for (const f of surfaces)
    for (const feature of scan(f, fs.readFileSync(f, 'utf8')).features)
      if (feature.existingId) taken.add(feature.existingId)

  const written: string[] = []
  const assigned: IdentityResult['assigned'] = []
  let unchanged = 0
  for (const f of surfaces) {
    const src = fs.readFileSync(f, 'utf8')
    const res = stamp(f, src, taken)
    unchanged += res.unchanged
    problems.push(...res.problems)
    if (res.source !== src) {
      fs.writeFileSync(f, res.source)
      written.push(rel(f))
    }
    assigned.push(...res.assigned)
  }
  return { written, assigned, unchanged, problems }
}

/* ---------------- the manifest ---------------- */

export function buildManifest(root: string): { manifest: Manifest; problems: string[] } {
  const problems: string[] = []
  const declFiles = walk(root, /\.view\.ts$/)
  const surfaceFiles = walk(root, /\.tsx$/)

  const views: ViewDecl[] = []
  const viewFiles: Record<string, string> = {}
  for (const file of declFiles) {
    const view = readViewDecl(file, fs.readFileSync(file, 'utf8'), problems)
    if (!view) continue
    if (views.some((v) => v.id === view.id))
      problems.push(`${rel(file)}: view "${view.id}" is declared twice — a view is one unit of design work`)
    else {
      views.push(view)
      viewFiles[view.id] = rel(file)
    }
  }

  const features: FeatureDecl[] = []
  const viewSurfaces: Record<string, { file: string; component: string }> = {}
  const perView = new Map<string, number>()
  for (const file of surfaceFiles) {
    const result = scan(file, fs.readFileSync(file, 'utf8'))
    problems.push(...result.problems.map((p) => p.replace(file, rel(file))))
    for (const v of result.views) {
      if (!views.some((decl) => decl.id === v.id))
        problems.push(`${rel(file)}: <View id="${v.id}"> has no declaration — declare it in a .view.ts file`)
      else viewSurfaces[v.id] = { file: rel(file), component: v.component }
    }

    for (const f of result.features) {
      if (!f.existingId) continue // not stamped yet; `npm run id` assigns it
      const view = views.find((v) => v.id === f.view)
      if (!view) continue
      if (features.some((x) => x.id === f.existingId)) {
        problems.push(`${rel(file)}:${f.line}: feature id "${f.existingId}" is used twice`)
        continue
      }
      if (!isLegalSlot(view, f.slot))
        problems.push(
          `${rel(file)}:${f.line}: slot "${f.slot}" is not in view "${view.id}"'s grammar — slots are enumerated in advance`,
        )
      for (const state of f.states ?? [])
        if (!view.states.includes(state))
          problems.push(`${rel(file)}:${f.line}: state "${state}" is not declared by view "${view.id}"`)

      const requires: Requirement[] = []
      for (const r of f.requires) {
        if ((REQUIREMENTS as readonly string[]).includes(r)) requires.push(r as Requirement)
        else
          problems.push(
            `${rel(file)}:${f.line}: "${r}" is not a behaviour requirement — one of ${REQUIREMENTS.join(', ')}`,
          )
      }

      const sourceIndex = perView.get(f.view) ?? 0
      perView.set(f.view, sourceIndex + 1)
      features.push({
        id: f.existingId,
        view: f.view,
        component: f.component,
        file: rel(file),
        sourceSlot: f.slot,
        sourceIndex,
        states: f.states,
        requires,
      })
    }
  }

  // Placements written through from a drop are source too, and get checked
  // like any other source: a placement naming a feature or a slot that no
  // longer exists is reported here rather than discovered as a hole in a view.
  for (const view of views)
    for (const [state, byFeature] of Object.entries(view.placement ?? {})) {
      if (!view.states.includes(state))
        problems.push(`view "${view.id}": placement names undeclared state "${state}"`)
      for (const [featureId, record] of Object.entries(byFeature)) {
        if (!features.some((f) => f.id === featureId && f.view === view.id))
          problems.push(`view "${view.id}": placement.${state} names unknown feature "${featureId}"`)
        if (!isLegalSlot(view, record.slot))
          problems.push(`view "${view.id}": placement.${state}["${featureId}"] names unknown slot "${record.slot}"`)
      }
    }

  // Source defaults are deliberately *not* checked here any more. A default
  // whose slot cannot give a feature what it requires is the same kind of fact
  // as a dragged one: an open item, which blocks the commit and is visible in
  // `npm run open`. Failing the build for it would make source the one place
  // where a behavioural cost is fatal rather than answerable, and there is no
  // reason for the rule to change depending on who typed it.

  return {
    manifest: {
      version: 1,
      generatedFrom: [...declFiles, ...surfaceFiles].map(rel),
      views,
      features,
      viewFiles,
      viewSurfaces,
    },
    problems,
  }
}
