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
 * The transform splices attribute text at byte offsets rather than re-printing
 * the AST, because a codemod that reformats the file every run is a codemod
 * people turn off.
 */
import ts from 'typescript'

export interface StyledNode {
  nodeId: string
  component: string
  tag: string
  classes: string[]
  isViewRoot: boolean
  /** Offset just past the tag name, where attributes are spliced in. */
  insertAt: number
  existingId?: string
}

export interface ScanResult {
  nodes: StyledNode[]
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

export function scan(filePath: string, source: string, isView: boolean): ScanResult {
  const sf = ts.createSourceFile(filePath, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)
  const nodes: StyledNode[] = []
  const pinned: string[] = []
  const seenRootFor = new Set<string>()

  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(sf)
      const isIntrinsic = /^[a-z]/.test(tag)
      const className = attrNamed(node, 'className')
      // A styled node is an intrinsic element carrying a className. A component
      // element is not styled here — its styling lives inside its own recipe.
      if (isIntrinsic && className) {
        const classes = classesOf(className)
        const component = componentOf(node)
        const existing = attrNamed(node, 'data-sid')
        const existingId =
          existing && existing.initializer && ts.isStringLiteral(existing.initializer)
            ? existing.initializer.text
            : undefined
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
          insertAt: node.tagName.getEnd(),
          existingId,
        })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return { nodes, pinned }
}

export interface StampResult {
  source: string
  assigned: Array<{ nodeId: string; component: string; tag: string }>
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
  const { nodes } = scan(filePath, source, isView)
  const splices: Array<{ at: number; text: string }> = []
  const assigned: StampResult['assigned'] = []
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
    splices.push({ at: n.insertAt, text: ` data-sid="${id}"${view}` })
    assigned.push({ nodeId: id, component: n.component, tag: n.tag })
  }

  // Descending, so earlier offsets stay valid as later ones are spliced.
  splices.sort((a, b) => b.at - a.at)
  let out = source
  for (const s of splices) out = out.slice(0, s.at) + s.text + out.slice(s.at)
  return { source: out, assigned, unchanged }
}
