/**
 * COMMIT — assignments write through to source.
 *
 * There is no freeze step and no in-tool review. This function rewrites the
 * `placement` literal inside a view's declaration file and stops; the diff is
 * the review and git is where it happens.
 *
 * Two properties matter more than they look:
 *
 *   1. **Everything else in the file is untouched.** The literal is spliced by
 *      byte offset, not re-printed, so a designer's comments, import order and
 *      formatting survive a drop. A tool that reformats the file it writes to
 *      makes its own diff unreadable, which defeats the entire mechanism.
 *
 *   2. **The output is ordered deterministically** — states in declaration
 *      order, features in source order. Two machines with the same store emit
 *      byte-identical text, so a diff only ever shows what actually moved.
 */
import ts from 'typescript'
import type { Author, Manifest, Placements, Requirement, Store, ViewId } from '../schema'
import { allOpenItems, featuresOf, resolve } from '../resolve/resolve'

const q = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
/** A bare key when it can be one, quoted when it cannot. Feature ids have dots. */
const key = (s: string) => (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(s) ? s : q(s))

/**
 * Assignments for one view, shaped as the literal that will be written — with
 * the open items stamped in.
 *
 * Two things happen here that the store does not do:
 *
 *   1. **Open items are computed and recorded.** The store never carries them;
 *      this is the one place that knows what the finished arrangement costs, so
 *      it is the one place that writes it down.
 *   2. **A record is materialised for a feature that carries a cost but never
 *      moved.** Crowding a neighbour costs *the neighbour* its `sole-focus`,
 *      and the neighbour may be sitting at its source default with nothing
 *      written about it. Without a record there is nowhere for that cost to
 *      live, and it would exist only while the tool was running — which is the
 *      failure this step exists to fix. The written record keeps the same slot,
 *      so the diff shows a placement that did not move and a cost that arrived.
 */
export function placementsFor(manifest: Manifest, store: Store, view: ViewId): Placements {
  const decl = manifest.views.find((v) => v.id === view)
  if (!decl) return {}
  const order = featuresOf(manifest, view).map((f) => f.id)
  const src = { manifest, assignments: store.assignments }
  const items = allOpenItems(src).filter((i) => i.view === view)

  const out: Placements = {}
  for (const state of decl.states) {
    const assigned = store.assignments.filter((a) => a.view === view && a.state === state)
    const costed = items.filter((i) => i.state === state)

    // Every feature that needs a line: it was assigned, or it carries a cost.
    const features = [...new Set([...assigned.map((a) => a.feature), ...costed.map((i) => i.feature)])]
      .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    if (!features.length) continue

    const rows: Placements[string] = {}
    for (const feature of features) {
      const assignment = assigned.find((a) => a.feature === feature)
      const placement = assignment ?? resolve(src, view, state, feature)
      if (!placement) continue
      const open = costed
        .filter((i) => i.feature === feature)
        .map((i) => i.requirement)
        .sort() as Requirement[]
      const accepted = (assignment?.accepted ?? []).filter((r) => open.includes(r)).sort()
      rows[feature] = {
        slot: placement.slot,
        order: placement.order,
        by: (assignment?.author ?? 'human') as Author,
        ...(open.length ? { open } : {}),
        ...(accepted.length ? { accepted } : {}),
      }
    }
    if (Object.keys(rows).length) out[state] = rows
  }
  return out
}

/** The `placement: { ... }` property text, indented to sit inside defineView({. */
export function renderPlacements(placements: Placements, indent = '  '): string {
  const states = Object.entries(placements).filter(([, v]) => Object.keys(v).length)
  if (!states.length) return ''
  const lines: string[] = [`${indent}placement: {`]
  for (const [state, byFeature] of states) {
    lines.push(`${indent}  ${key(state)}: {`)
    for (const [feature, r] of Object.entries(byFeature)) {
      const open = r.open?.length ? `, open: [${r.open.map(q).join(', ')}]` : ''
      const accepted = r.accepted?.length
        ? `, accepted: [${r.accepted.map(q).join(', ')}]`
        : ''
      lines.push(
        `${indent}    ${key(feature)}: { slot: ${q(r.slot)}, order: ${r.order}, by: ${q(r.by)}${open}${accepted} },`,
      )
    }
    lines.push(`${indent}  },`)
  }
  lines.push(`${indent}},`)
  return lines.join('\n')
}

/**
 * Splice the rendered placements into a `.view.ts` file. Replaces an existing
 * `placement` property, inserts one when there is none, and removes it when the
 * store has nothing to say — so reverting every drop returns the file to the
 * bytes it had before the first one.
 */
export function writePlacements(source: string, placements: Placements): string {
  const sf = ts.createSourceFile('view.ts', source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS)

  let object: ts.ObjectLiteralExpression | undefined
  const find = (node: ts.Node) => {
    if (object) return
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'defineView' &&
      node.arguments.length === 1 &&
      ts.isObjectLiteralExpression(node.arguments[0])
    ) {
      object = node.arguments[0]
      return
    }
    ts.forEachChild(node, find)
  }
  find(sf)
  if (!object) return source

  const indent = indentOf(source, object.getStart(sf)) + '  '
  const rendered = renderPlacements(placements, indent)

  const existing = object.properties.find(
    (p): p is ts.PropertyAssignment =>
      ts.isPropertyAssignment(p) &&
      (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) &&
      p.name.text === 'placement',
  )

  if (existing) {
    // Swallow the property's own line, its trailing comma, and the blank space
    // in front of it, so removing the last placement leaves no orphan newline.
    const start = lineStart(source, existing.getStart(sf))
    let end = existing.getEnd()
    if (source[end] === ',') end++
    while (end < source.length && (source[end] === ' ' || source[end] === '\t')) end++
    if (source[end] === '\n') end++
    return source.slice(0, start) + (rendered ? rendered + '\n' : '') + source.slice(end)
  }

  if (!rendered) return source

  // No placement yet: insert after the last property, keeping its comma.
  const last = object.properties[object.properties.length - 1]
  let at = last ? last.getEnd() : object.getStart(sf) + 1
  if (source[at] === ',') at++
  return source.slice(0, at) + '\n' + rendered + source.slice(at)
}

const lineStart = (source: string, at: number) => source.lastIndexOf('\n', at - 1) + 1

function indentOf(source: string, at: number): string {
  const start = lineStart(source, at)
  const m = /^[ \t]*/.exec(source.slice(start))
  return m ? m[0] : ''
}
