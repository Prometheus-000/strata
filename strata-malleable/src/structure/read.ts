/**
 * THE STRUCTURE READER — a page's regions, read from the page.
 *
 * Nothing declares structure here. A container is a landmark element — the
 * `<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>` or `role` the page
 * already has — or the root component's own root element. A region is a
 * component call site under one: `<Filters />` inside `<main>`. Landmarks are
 * rarely at the composition site (`<header>` lives inside `TopBar()`), so the
 * reader looks through a component element to its definition, one relative
 * import away, and if that definition's root is a landmark it is a container
 * too. A component whose root is not a landmark is a region and nothing more:
 * what happens inside `<Gallery />` is Gallery's business.
 *
 * Every offset here comes from the text that was read. A move re-reads before
 * it writes, so nothing stored can go stale between the two.
 */
import path from 'node:path'
import ts from 'typescript'
import type { Container, Landmark, RegionChild, Structure } from '../schema'
import { attrText, landmarkOf, tagOf } from './landmarks'

/** Read a file's text, or null when there is none. Injected so the reader stays pure. */
export type Read = (file: string) => string | null

export interface ComponentDef {
  name: string
  file: string
  sf: ts.SourceFile
  body: ts.Node
  jsx: ts.Node | null
  exported: boolean
}

const isCapitalised = (s: string) => /^[A-Z]/.test(s)
const opening = (n: ts.Node): ts.JsxOpeningLikeElement | null =>
  ts.isJsxElement(n) ? n.openingElement : ts.isJsxSelfClosingElement(n) ? n : null
const lineOf = (n: ts.Node, sf: ts.SourceFile) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1

function jsxRootOf(body: ts.Node): ts.Node | null {
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

const isExported = (st: ts.Statement) =>
  (ts.canHaveModifiers(st) ? ts.getModifiers(st) : undefined)?.some(
    (m) => m.kind === ts.SyntaxKind.ExportKeyword,
  ) ?? false

/** Every function component defined at the top level of a file. */
export function componentsIn(file: string, sf: ts.SourceFile): Map<string, ComponentDef> {
  const out = new Map<string, ComponentDef>()
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st) && st.name && isCapitalised(st.name.text) && st.body)
      out.set(st.name.text, {
        name: st.name.text,
        file,
        sf,
        body: st.body,
        jsx: jsxRootOf(st.body),
        exported: isExported(st),
      })
    if (ts.isVariableStatement(st))
      for (const d of st.declarationList.declarations)
        if (
          ts.isIdentifier(d.name) &&
          isCapitalised(d.name.text) &&
          d.initializer &&
          (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))
        )
          out.set(d.name.text, {
            name: d.name.text,
            file,
            sf,
            body: d.initializer.body,
            jsx: jsxRootOf(d.initializer.body),
            exported: isExported(st),
          })
  }
  return out
}

/** `import { A, B as C } from './x'` and `import D from './y'` — relative only. */
export function relativeImports(sf: ts.SourceFile): Map<string, string> {
  const out = new Map<string, string>()
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier)) continue
    const spec = st.moduleSpecifier.text
    if (!spec.startsWith('.')) continue
    const clause = st.importClause
    if (!clause) continue
    if (clause.name) out.set(clause.name.text, spec)
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings))
      for (const el of clause.namedBindings.elements) out.set(el.name.text, spec)
  }
  return out
}

/** Candidate files for a relative specifier, in the order a bundler tries them. */
export const candidatesFor = (fromFile: string, spec: string): string[] => {
  const base = path.join(path.dirname(fromFile), spec)
  return [base, `${base}.tsx`, `${base}.ts`, path.join(base, 'index.tsx')]
}

/** Direct element children of a JSX node, looking through fragments and expressions. */
export function childElements(n: ts.Node): ts.Node[] {
  const out: ts.Node[] = []
  const kids = ts.isJsxElement(n) ? n.children : ts.isJsxFragment(n) ? n.children : []
  for (const k of kids) {
    if (ts.isJsxElement(k) || ts.isJsxSelfClosingElement(k)) out.push(k)
    else if (ts.isJsxFragment(k)) out.push(...childElements(k))
    else if (ts.isJsxExpression(k) && k.expression) out.push(...elementsInExpression(k.expression))
  }
  return out
}

/** Elements inside `{cond && <A/>}`, `{cond ? <A/> : <B/>}`, `{list.map(...)}`. */
function elementsInExpression(e: ts.Expression): ts.Node[] {
  const out: ts.Node[] = []
  const visit = (n: ts.Node) => {
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) {
      out.push(n)
      return
    }
    if (ts.isJsxFragment(n)) {
      out.push(...childElements(n))
      return
    }
    ts.forEachChild(n, visit)
  }
  visit(e)
  return out
}

/** The `{ … }` expression an element renders inside, up to its parent element. */
function enclosingExpression(n: ts.Node): ts.JsxExpression | null {
  let p: ts.Node | undefined = n.parent
  while (p && !ts.isJsxElement(p) && !ts.isJsxFragment(p)) {
    if (ts.isJsxExpression(p)) return p
    p = p.parent
  }
  return null
}

/** The condition an element renders under, read off its enclosing expression. */
function conditionOf(n: ts.Node, sf: ts.SourceFile): string | undefined {
  let p: ts.Node | undefined = n.parent
  while (p && !ts.isJsxElement(p) && !ts.isJsxFragment(p)) {
    if (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)
      return p.left.getText(sf)
    if (ts.isConditionalExpression(p)) return p.condition.getText(sf)
    p = p.parent
  }
  return undefined
}

/** True when the element is rendered from inside a `.map(...)` callback. */
function inList(n: ts.Node): boolean {
  let p: ts.Node | undefined = n.parent
  while (p && !ts.isJsxElement(p) && !ts.isJsxFragment(p)) {
    if (
      ts.isCallExpression(p) &&
      ts.isPropertyAccessExpression(p.expression) &&
      p.expression.name.text === 'map'
    )
      return true
    p = p.parent
  }
  return false
}

/** The id the codemod gives an element, or the one it already carries. */
export function sidOf(el: ts.JsxOpeningLikeElement, component: string, sf: ts.SourceFile): string {
  const existing = attrText(el, 'data-sid', sf)
  if (existing) return existing
  const tag = tagOf(el, sf)
  const classes = (attrText(el, 'className', sf) ?? '').split(/\s+/).filter(Boolean)
  const primary = classes.find((c) => !c.includes('--') && !c.includes('$')) ?? ''
  return `${component}.${tag}${primary ? `.${primary}` : ''}`
}

/* ---------------- the reader ---------------- */

export interface ReadOptions {
  read: Read
  /** Repo-relative paths in the output. Defaults to the paths as given. */
  relative?: (file: string) => string
}

/**
 * Read the structure of every root in `files` — a root being a component that
 * nothing in these files renders. Pure over the injected reader.
 */
export function readStructureFrom(files: string[], opts: ReadOptions): Structure {
  const rel = opts.relative ?? ((f: string) => f)
  const defsByFile = new Map<string, Map<string, ComponentDef>>()
  const importsByFile = new Map<string, Map<string, string>>()

  const load = (file: string): Map<string, ComponentDef> | null => {
    const cached = defsByFile.get(file)
    if (cached) return cached
    const text = opts.read(file)
    if (text === null) return null
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)
    const defs = componentsIn(file, sf)
    defsByFile.set(file, defs)
    importsByFile.set(file, relativeImports(sf))
    return defs
  }
  for (const f of files) load(f)

  /** A component's definition: the file it is used in, then one relative hop. */
  const resolveDef = (name: string, fromFile: string): ComponentDef | null => {
    const local = defsByFile.get(fromFile)?.get(name)
    if (local) return local
    const spec = importsByFile.get(fromFile)?.get(name)
    if (!spec) return null
    for (const candidate of candidatesFor(fromFile, spec)) {
      const def = load(candidate)?.get(name)
      if (def) return def
    }
    return null
  }

  /* roots: components with JSX that nothing in these files renders */
  const rendered = new Set<string>()
  for (const [, defs] of defsByFile)
    for (const d of defs.values())
      if (d.jsx)
        forEachElement(d.jsx, (el) => {
          const t = tagOf(el, d.sf)
          if (isCapitalised(t)) rendered.add(t)
        })
  const roots: ComponentDef[] = []
  for (const f of files)
    for (const d of defsByFile.get(f)?.values() ?? [])
      if (d.jsx && !rendered.has(d.name) && (ts.isJsxElement(d.jsx) || ts.isJsxSelfClosingElement(d.jsx)))
        roots.push(d)

  const containers: Container[] = []
  const unaddressable: Structure['unaddressable'] = []
  const seenUnaddressable = new Set<string>()
  const visiting = new Set<string>()

  const hostOf = (def: ComponentDef | null): string | null => {
    if (!def) return null
    const el = def.jsx ? opening(def.jsx) : null
    if (!el || isCapitalised(tagOf(el, def.sf))) {
      if (!seenUnaddressable.has(def.name)) {
        seenUnaddressable.add(def.name)
        unaddressable.push({
          component: def.name,
          file: rel(def.file),
          why: !def.jsx
            ? 'renders no JSX'
            : !el
              ? 'its root is a fragment, so it has no host element to carry data-region'
              : `its root is <${tagOf(el, def.sf)} />, a component — the host element belongs to that component`,
        })
      }
      return null
    }
    return def.name
  }

  const openContainer = (node: ts.Node, landmark: Landmark | 'root', def: ComponentDef): Container => {
    const el = opening(node)!
    const container: Container = {
      sid: sidOf(el, def.name, def.sf),
      landmark,
      tag: tagOf(el, def.sf),
      component: def.name,
      via: [...visiting],
      file: rel(def.file),
      line: lineOf(el, def.sf),
      range: [node.getStart(def.sf), node.getEnd()],
      open: [el.getStart(def.sf), el.getEnd()],
      close: ts.isJsxElement(node) ? node.closingElement.getStart(def.sf) : null,
      children: [],
    }
    containers.push(container)
    return container
  }

  /** `<header>` and `<footer>` are landmarks only outside sectioning content — HTML's own rule. */
  const SECTIONING = new Set(['section', 'article', 'aside', 'main', 'nav'])
  const landmarkHere = (el: ts.JsxOpeningLikeElement, sf: ts.SourceFile, inSectioning: boolean): Landmark | null => {
    const lm = landmarkOf(el, sf)
    const tag = tagOf(el, sf)
    if (lm && inSectioning && (tag === 'header' || tag === 'footer') && !attrText(el, 'role', sf)) return null
    return lm
  }

  /**
   * Walk a JSX tree inside `def`. Host elements are transparent; a landmark
   * opens a container; a component element is a region of the container it
   * sits in — recorded only when there is one — and is looked through for
   * landmarks of its own either way. What a component renders inside a
   * non-landmark root is its own business: it is descended for containers,
   * not for regions.
   */
  const walk = (node: ts.Node, into: Container | null, def: ComponentDef, inSectioning: boolean) => {
    for (const child of childElements(node)) {
      const el = opening(child)!
      const tag = tagOf(el, def.sf)
      if (isCapitalised(tag)) {
        const target = resolveDef(tag, def.file)
        if (into) {
          const expr = enclosingExpression(child)
          const list = inList(child)
          const same = into.children.filter((c) => c.component === tag)
          const spec = importsByFile.get(def.file)?.get(tag)
          into.children.push({
            kind: list ? 'list' : 'component',
            component: tag,
            ordinal: same.length,
            line: lineOf(el, def.sf),
            range: expr ? [expr.getStart(def.sf), expr.getEnd()] : [child.getStart(def.sf), child.getEnd()],
            ...(list ? {} : conditionOf(child, def.sf) ? { condition: conditionOf(child, def.sf) } : {}),
            host: hostOf(target),
            ...(spec ? { importedFrom: spec } : {}),
          })
        }
        // Look through the component for containers of its own.
        if (target?.jsx && !visiting.has(target.name)) {
          visiting.add(target.name)
          const rootEl = opening(target.jsx)
          const lm = rootEl ? landmarkHere(rootEl, target.sf, false) : null
          if (lm) walk(target.jsx, openContainer(target.jsx, lm, target), target, SECTIONING.has(tagOf(rootEl!, target.sf)))
          else walk(target.jsx, null, target, rootEl ? SECTIONING.has(tagOf(rootEl, target.sf)) : false)
          visiting.delete(target.name)
        }
        continue
      }
      const lm = landmarkHere(el, def.sf, inSectioning)
      const sectioning = inSectioning || SECTIONING.has(tag)
      if (lm) {
        walk(child, openContainer(child, lm, def), def, sectioning)
        continue
      }
      walk(child, into, def, sectioning)
    }
  }

  const rootsOut: Structure['roots'] = []
  for (const root of roots) {
    visiting.add(root.name)
    const el = opening(root.jsx!)!
    const lm = landmarkHere(el, root.sf, false)
    const container = openContainer(root.jsx!, lm ?? 'root', root)
    rootsOut.push({ component: root.name, file: rel(root.file), sid: container.sid })
    walk(root.jsx!, container, root, SECTIONING.has(tagOf(el, root.sf)))
    visiting.delete(root.name)
  }

  return {
    version: 1,
    generatedFrom: files.map(rel),
    roots: rootsOut,
    containers,
    unaddressable,
  }
}

function forEachElement(n: ts.Node, f: (el: ts.JsxOpeningLikeElement) => void) {
  const visit = (x: ts.Node) => {
    const el = opening(x)
    if (el) f(el)
    ts.forEachChild(x, visit)
  }
  visit(n)
}

/* ---------------- printing ---------------- */

export function formatStructure(s: Structure): string {
  const out: string[] = ['']
  const line = (x = '') => out.push(x)
  if (!s.containers.length) line('  no containers — no landmark and no root component in these files')
  for (const c of s.containers) {
    const where = c.landmark === 'root' ? `root of ${c.component}` : c.landmark
    line(`${c.sid.padEnd(30)} <${c.tag}> ${where} · ${c.file}:${c.line}`)
    if (!c.children.length) line('    (no regions — a drop lands at the end)')
    for (const k of c.children) {
      const tail = [
        k.kind === 'list' ? 'list — its data is its order; not moved' : null,
        k.condition ? `when ${k.condition}` : null,
        k.host ? null : 'no host element — movable from the CLI only',
      ]
        .filter(Boolean)
        .join(' · ')
      line(`    ${`<${k.component} />`.padEnd(22)} ${String(k.line).padStart(4)}${tail ? `   ${tail}` : ''}`)
    }
  }
  if (s.unaddressable.length) {
    line('')
    line('  not addressable in the DOM')
    for (const u of s.unaddressable) line(`    ${u.component.padEnd(16)} ${u.why} (${u.file})`)
  }
  line('')
  return out.join('\n')
}
