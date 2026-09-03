/**
 * IDENTITY — the build-time codemod.
 *
 * Two rules make the ids stable enough to hang a design system off:
 *
 *   1. An id is assigned once and never recomputed. If a node already carries
 *      `data-sid`, the codemod does not touch it — so renaming a class, moving
 *      a node, or reformatting the file cannot orphan an override. Identity is
 *      pinned in the source, which is the only place that survives everything.
 *
 *   2. Ids are legible: `Card.div.st-card`, not a hash. This string is what a
 *      designer reads in the drift report, and a report full of hashes is a
 *      report nobody reads.
 *
 * Three attributes, one splice per element:
 *
 *   - `data-sid` on every styled node — an intrinsic element with a className —
 *     and on every landmark element (`<main>`, `<div role="dialog">`) whether or
 *     not it has a class, because a landmark is a container regions move into
 *     and a container has to be addressable by name, never by position.
 *   - `data-view` on a view root, so instance addresses have a scope.
 *   - `data-region="<Component>"` on the root host element of every component
 *     definition. A composed `<TopBar />` has no DOM node of its own; this is
 *     the handle the move gesture picks it up by.
 *
 * The transform splices attribute text at byte offsets rather than re-printing
 * the AST, because a codemod that reformats the file every run is a codemod
 * people turn off.
 */
import ts from 'typescript'
import type { Landmark } from '../schema'
import { landmarkOf } from '../structure/landmarks'

export interface StyledNode {
  nodeId: string
  component: string
  tag: string
  classes: string[]
  isViewRoot: boolean
  landmark?: Landmark
  /** Offset just past the tag name, where attributes are spliced in. */
  insertAt: number
  existingId?: string
}

/** The root host element of a component definition — what `data-region` names. */
export interface RegionRoot {
  component: string
  insertAt: number
  /** Present when the element already carries `data-region`. */
  existing?: string
}

export interface ScanResult {
  nodes: StyledNode[]
  regions: RegionRoot[]
  /** Ids already pinned in this file. */
  pinned: string[]
}

const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

/** Static class names from `className`, including the literal parts of a template. */
function classesOf(attr: ts.JsxAttributeLike | undefined): string[] {
  if (!attr || !ts.isJsxAttribute(attr) || !attr.initializer) return []
  const out: string[] = []
  const add = (text: string) => out.push(...text.split(/\s+/).filter(Boolean))
  const init = attr.initializer
  if (ts.isStringLiteral(init)) add(init.text)
  else if (ts.isJsxExpression(init) && init.expression) {
    const e = init.expression
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) add(e.text)
    else if (ts.isTemplateExpression(e)) {
      add(e.head.text)
      for (const span of e.templateSpans) add(span.literal.text)
    }
  }
  return out
}

const attrNamed = (el: ts.JsxOpeningLikeElement, name: string) =>
  el.attributes.properties.find(
    (p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText() === name,
  )

const stringOf = (attr: ts.JsxAttribute | undefined): string | undefined =>
  attr?.initializer && ts.isStringLiteral(attr.initializer) ? attr.initializer.text : undefined

/** `st-card--interactive` is a modifier; the primary class is the first that is not. */
const primaryOf = (classes: string[]) =>
  classes.find((c) => !c.includes('--')) ?? classes[0] ?? ''

/** Nearest enclosing capitalised function or const — the component that owns the node. */
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

/** The opening tag of each top-level component's root element, when that root is a host element. */
function rootElementsOf(sf: ts.SourceFile): Map<ts.JsxOpeningLikeElement, string> {
  const out = new Map<ts.JsxOpeningLikeElement, string>()
  const firstJsx = (body: ts.Node): ts.Node | null => {
    let found: ts.Node | null = null
    const visit = (n: ts.Node) => {
      if (found) return
      if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) {
        found = n
        return
      }
      ts.forEachChild(n, visit)
    }
    visit(body)
    return found
  }
  const consider = (name: string, body: ts.Node) => {
    if (!/^[A-Z]/.test(name)) return
    const root = firstJsx(body)
    const el = root && ts.isJsxElement(root) ? root.openingElement : root && ts.isJsxSelfClosingElement(root) ? root : null
    if (el && /^[a-z]/.test(el.tagName.getText(sf))) out.set(el, name)
  }
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st) && st.name && st.body) consider(st.name.text, st.body)
    if (ts.isVariableStatement(st))
      for (const d of st.declarationList.declarations)
        if (
          ts.isIdentifier(d.name) &&
          d.initializer &&
          (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))
        )
          consider(d.name.text, d.initializer.body)
  }
  return out
}

export function scan(filePath: string, source: string, isView: boolean): ScanResult {
  const sf = ts.createSourceFile(filePath, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)
  const nodes: StyledNode[] = []
  const regions: RegionRoot[] = []
  const pinned: string[] = []
  const seenRootFor = new Set<string>()
  const roots = rootElementsOf(sf)

  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(sf)
      const isIntrinsic = /^[a-z]/.test(tag)
      const className = attrNamed(node, 'className')
      const landmark = isIntrinsic ? landmarkOf(node, sf) : null
      // A styled node is an intrinsic element carrying a className. A component
      // element is not styled here — its styling lives inside its own recipe.
      // A landmark is identified whether or not it is styled: it is a container.
      if (isIntrinsic && (className || landmark)) {
        const classes = classesOf(className)
        const component = componentOf(node)
        const existingId = stringOf(attrNamed(node, 'data-sid'))
        if (existingId) pinned.push(existingId)
        const primary = primaryOf(classes)
        const isViewRoot = isView && !seenRootFor.has(component)
        if (isViewRoot) seenRootFor.add(component)
        nodes.push({
          nodeId: existingId ?? `${component}.${tag}${primary ? `.${primary}` : ''}`,
          component,
          tag,
          classes,
          isViewRoot,
          ...(landmark ? { landmark } : {}),
          insertAt: node.tagName.getEnd(),
          existingId,
        })
      }
      const region = roots.get(node)
      if (region)
        regions.push({
          component: region,
          insertAt: node.tagName.getEnd(),
          existing: stringOf(attrNamed(node, 'data-region')),
        })
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return { nodes, regions, pinned }
}

export interface StampResult {
  source: string
  assigned: Array<{ nodeId: string; component: string; tag: string }>
  /** Component roots that received `data-region` on this run. */
  regions: string[]
  unchanged: number
}

/**
 * Write identity into the source. Idempotent: running it twice is a no-op, and
 * running it after an unrelated edit assigns ids only to genuinely new nodes.
 *
 * `taken` carries ids already pinned anywhere in the project so a new node in
 * one file cannot collide with an old node in another.
 */
export function stamp(
  filePath: string,
  source: string,
  isView: boolean,
  taken: Set<string>,
): StampResult {
  const { nodes, regions } = scan(filePath, source, isView)
  // One splice per element: two splices at one offset would land reversed.
  const splices = new Map<number, string>()
  const add = (at: number, text: string) => splices.set(at, (splices.get(at) ?? '') + text)
  const assigned: StampResult['assigned'] = []
  const regionsAssigned: string[] = []
  let unchanged = 0

  for (const n of nodes) {
    if (n.existingId) {
      unchanged++
      continue
    }
    let id = n.nodeId
    let k = 2
    while (taken.has(id)) id = `${n.nodeId}#${k++}`
    taken.add(id)
    const view = n.isViewRoot ? ` data-view="${kebab(n.component)}"` : ''
    add(n.insertAt, ` data-sid="${id}"${view}`)
    assigned.push({ nodeId: id, component: n.component, tag: n.tag })
  }
  for (const r of regions) {
    if (r.existing) continue
    add(r.insertAt, ` data-region="${r.component}"`)
    regionsAssigned.push(r.component)
  }

  // Descending, so earlier offsets stay valid as later ones are spliced.
  const ordered = [...splices.entries()].sort((a, b) => b[0] - a[0])
  let out = source
  for (const [at, text] of ordered) out = out.slice(0, at) + text + out.slice(at)
  return { source: out, assigned, regions: regionsAssigned, unchanged }
}
