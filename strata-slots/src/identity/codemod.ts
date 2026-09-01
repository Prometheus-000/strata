/**
 * IDENTITY — the build-time codemod.
 *
 * Two rules, and the second is the one the brief insists on:
 *
 *   1. A feature's id is assigned once and never recomputed. A node that already
 *      carries `fid` is left alone.
 *   2. **A structural path is not an id.** The id is derived from the view and
 *      the component the feature is made of — never from where the feature sits.
 *      Because it is then pinned into the source, wrapping the feature in a
 *      container, reordering it, or moving it to another slot cannot change what
 *      it is. That is precisely the set of edits this layer exists to make, so an
 *      id that did not survive them would be an id that broke every time it was
 *      used.
 *
 * The transform splices attribute text at byte offsets instead of re-printing
 * the AST, because a codemod that reformats the file on every run is a codemod
 * people switch off.
 */
import ts from 'typescript'

export interface ScannedFeature {
  /** Present when this file has already been stamped. */
  existingId?: string
  /** The id it would be given, before disambiguation. */
  proposedId: string
  view: string
  component: string
  slot: string
  states: string[] | null
  requires: string[]
  /** Offset just past `<Feature`, where attributes are spliced in. */
  insertAt: number
  line: number
}

export interface ScanResult {
  /** View ids declared in this file, with the component that renders each. */
  views: Array<{ id: string; component: string }>
  features: ScannedFeature[]
  problems: string[]
}

export const kebab = (s: string) =>
  s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .toLowerCase()
    .replace(/^-|-$/g, '')

const attr = (el: ts.JsxOpeningLikeElement, name: string) =>
  el.attributes.properties.find(
    (p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText() === name,
  )

function stringAttr(el: ts.JsxOpeningLikeElement, name: string): string | undefined {
  const a = attr(el, name)
  if (!a?.initializer) return undefined
  if (ts.isStringLiteral(a.initializer)) return a.initializer.text
  if (ts.isJsxExpression(a.initializer) && a.initializer.expression) {
    const e = a.initializer.expression
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text
  }
  return undefined
}

const tagOf = (el: ts.JsxOpeningLikeElement, sf: ts.SourceFile) => el.tagName.getText(sf)

/** Nearest enclosing capitalised function or const — the component rendering this. */
function componentOf(node: ts.Node): string {
  let n: ts.Node | undefined = node
  while (n) {
    if (ts.isFunctionDeclaration(n) && n.name && /^[A-Z]/.test(n.name.text)) return n.name.text
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && /^[A-Z]/.test(n.name.text))
      return n.name.text
    n = n.parent
  }
  return 'Anonymous'
}

/** The composed region inside a `<Feature>` — the first component element child. */
function componentInside(node: ts.Node, sf: ts.SourceFile): string | undefined {
  let found: string | undefined
  const visit = (n: ts.Node) => {
    if (found) return
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      const tag = tagOf(n, sf)
      if (/^[A-Z]/.test(tag) && tag !== 'Feature' && tag !== 'View') {
        found = tag
        return
      }
    }
    ts.forEachChild(n, visit)
  }
  ts.forEachChild(node, visit)
  return found
}

export function scan(filePath: string, source: string): ScanResult {
  const sf = ts.createSourceFile(filePath, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)
  const views: ScanResult['views'] = []
  const features: ScannedFeature[] = []
  const problems: string[] = []
  const at = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1

  const visit = (node: ts.Node, view: string | null) => {
    let nextView = view

    // A JSX element's children are siblings of its opening tag, not descendants
    // of it, so the enclosing view has to be read off the element and handed
    // down — reading it off the opening tag would scope it to the attributes.
    const opening: ts.JsxOpeningLikeElement | null = ts.isJsxElement(node)
      ? node.openingElement
      : ts.isJsxSelfClosingElement(node)
        ? node
        : null

    if (opening) {
      const tag = tagOf(opening, sf)
      const line = at(opening)

      if (tag === 'View') {
        const id = stringAttr(opening, 'id')
        if (!id) problems.push(`${filePath}:${line} <View> without a literal id`)
        else if (view)
          // Views are flat. A nested view is not a smaller view, it is a mistake
          // about what a view is — so it fails the build rather than resolving.
          problems.push(
            `${filePath}:${line} <View id="${id}"> is nested inside <View id="${view}"> — views do not nest`,
          )
        else {
          views.push({ id, component: componentOf(node) })
          nextView = id
        }
      }

      if (tag === 'Feature') {
        if (!view) {
          problems.push(
            `${filePath}:${line} <Feature> outside any <View> — a feature belongs to exactly one view`,
          )
        } else {
          const slot = stringAttr(opening, 'slot')
          const component = componentInside(node, sf)
          if (!slot) problems.push(`${filePath}:${line} <Feature> without a literal slot`)
          else if (!component)
            problems.push(
              `${filePath}:${line} <Feature slot="${slot}"> holds no component — a feature is a composed region, not a leaf`,
            )
          else {
            const statesRaw = stringAttr(opening, 'states')
            const requiresRaw = stringAttr(opening, 'requires')
            features.push({
              existingId: stringAttr(opening, 'fid'),
              proposedId: `${view}.${kebab(component)}`,
              view,
              component,
              slot,
              states: statesRaw ? statesRaw.split(/\s+/).filter(Boolean) : null,
              requires: requiresRaw ? requiresRaw.split(/\s+/).filter(Boolean) : [],
              insertAt: opening.tagName.getEnd(),
              line,
            })
          }
        }
      }
    }

    ts.forEachChild(node, (child) => visit(child, nextView))
  }

  visit(sf, null)
  return { views, features, problems }
}

export interface StampResult {
  source: string
  assigned: Array<{ id: string; component: string; view: string }>
  unchanged: number
  problems: string[]
}

/**
 * Write identity into the source. Idempotent: a second run is a no-op, and a run
 * after an unrelated edit touches only genuinely new features.
 *
 * `taken` carries every id already pinned anywhere in the project, so a new
 * feature in one file cannot collide with an old one in another.
 */
export function stamp(filePath: string, source: string, taken: Set<string>): StampResult {
  const { features, problems } = scan(filePath, source)
  const splices: Array<{ at: number; text: string }> = []
  const assigned: StampResult['assigned'] = []
  let unchanged = 0

  for (const f of features) {
    if (f.existingId) {
      unchanged++
      continue
    }
    let id = f.proposedId
    let k = 2
    while (taken.has(id)) id = `${f.proposedId}#${k++}`
    taken.add(id)
    splices.push({ at: f.insertAt, text: ` fid="${id}"` })
    assigned.push({ id, component: f.component, view: f.view })
  }

  splices.sort((a, b) => b.at - a.at)
  let out = source
  for (const s of splices) out = out.slice(0, s.at) + s.text + out.slice(s.at)
  return { source: out, assigned, unchanged, problems }
}
